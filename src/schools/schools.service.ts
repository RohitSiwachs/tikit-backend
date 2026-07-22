import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { generateFormattedCode } from '../common/utils/code-generator';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { BulkCreateSchoolItemDto } from './dto/bulk-create-school.dto';
import { GenerateIndividualCodesDto } from './dto/invite-code.dto';
import { EmailsService } from '../emails/emails.service';
import { CacheService } from '../cache/cache.service';
import { CK, TTL } from '../cache/cache-keys';

@Injectable()
export class SchoolsService {
  constructor(
    private prisma: PrismaService,
    private emailsService: EmailsService,
    private cache: CacheService,
  ) {}

  async create(createSchoolDto: CreateSchoolDto) {
    const { schoolAdminPassword, ...schoolData } = createSchoolDto as any;

    if (!schoolData.contactEmail || !schoolAdminPassword) {
      throw new BadRequestException(
        'contactEmail and schoolAdminPassword are required to create a school',
      );
    }

    // Generate deep link URL for this school
    const baseUrl =
      process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const deepLink = `${baseUrl}/v1/join/${schoolData.schoolCode}`;

    const school = await this.prisma.$transaction(async (tx) => {
      const created = await tx.school.create({
        data: {
          ...schoolData,
          deepLink,
        },
      });

      const hashedPassword = await bcrypt.hash(schoolAdminPassword, 12);

      const usernameBase = schoolData.contactEmail.split('@')[0];
      const uniqueSuffix = crypto.randomBytes(2).toString('hex');

      await tx.user.create({
        data: {
          email: schoolData.contactEmail,
          username: `${usernameBase}_${uniqueSuffix}`,
          displayName: `${schoolData.name} Admin`,
          password: hashedPassword,
          role: 'SCHOOL_ADMIN',
          accountStatus: 'ACTIVE',
          schoolId: created.id,
          isVerified: true,
          approvalStatus: 'approved',
        },
      });

      // Default communication quota — 500 per channel for every new school
      await tx.communicationAllocation.create({
        data: {
          schoolId: created.id,
          pushAllocated: 500,
          emailAllocated: 500,
          smsAllocated: 500,
        },
      });

      return created;
    });

    await this.cache.delByPattern('schools:list:*');
    return school;
  }

  async findAll(query: {
    search?: string;
    city?: string;
    page?: number;
    limit?: number;
  }) {
    const cacheKey = CK.schoolsList(query);
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const { search, city, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    const [total, data] = await Promise.all([
      this.prisma.school.count({ where }),
      this.prisma.school.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { users: true },
          },
        },
      }),
    ]);

    const result = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cache.set(cacheKey, result, TTL.SCHOOLS_LIST);
    return result;
  }

  async findOne(id: string, callerRole?: string) {
    const cached = await this.cache.get<any>(CK.school(id));

    if (cached) {
      // Strip sensitive field for non-admins even from cache
      if (callerRole !== 'TIKIT_ADMIN') {
        const { tempAdminPassword: _stripped, ...safe } = cached;
        return safe;
      }
      return cached;
    }

    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, events: true, cards: true },
        },
      },
    });

    if (!school) {
      throw new NotFoundException(`School with ID ${id} not found`);
    }

    await this.cache.set(CK.school(id), school, TTL.SCHOOL);

    // tempAdminPassword is only visible to TIKIT_ADMIN
    if (callerRole !== 'TIKIT_ADMIN') {
      const { tempAdminPassword: _stripped, ...safe } = school as any;
      return safe;
    }

    return school;
  }

  async update(
    id: string,
    updateSchoolDto: UpdateSchoolDto,
    callerRole?: string,
  ) {
    const {
      schoolCode,
      pushAllocated,
      emailAllocated,
      smsAllocated,
      pushPrice,
      emailPrice,
      smsPrice,
      cardLimit,
      ...schoolData
    } = updateSchoolDto as any;

    if (callerRole === 'TIKIT_ADMIN' && cardLimit !== undefined) {
      schoolData.cardLimit = cardLimit;
    }

    const school = await this.prisma.school.update({
      where: { id },
      data: schoolData,
    });

    await Promise.all([
      this.cache.del(CK.school(id)),
      this.cache.delByPattern('schools:list:*'),
    ]);

    // Communication limits are TIKIT_ADMIN-only — silently ignored for other roles
    if (callerRole === 'TIKIT_ADMIN') {
      const alloc: Record<string, number> = {};
      if (pushAllocated !== undefined) alloc.pushAllocated = pushAllocated;
      if (emailAllocated !== undefined) alloc.emailAllocated = emailAllocated;
      if (smsAllocated !== undefined) alloc.smsAllocated = smsAllocated;
      if (pushPrice !== undefined) alloc.pushPrice = pushPrice;
      if (emailPrice !== undefined) alloc.emailPrice = emailPrice;
      if (smsPrice !== undefined) alloc.smsPrice = smsPrice;

      if (Object.keys(alloc).length > 0) {
        await this.prisma.communicationAllocation.upsert({
          where: { schoolId: id },
          create: { schoolId: id, ...alloc },
          update: alloc,
        });
      }
    }

    return school;
  }

  async remove(id: string) {
    const school = await this.prisma.school.delete({ where: { id } });
    await Promise.all([
      this.cache.del(CK.school(id)),
      this.cache.delByPattern('schools:list:*'),
    ]);
    return school;
  }

  // ─── School Verification ─────────────────────────────────────────────────

  async getVerificationStatus(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      select: { id: true, name: true, isVerified: true },
    });

    if (!school) {
      throw new NotFoundException(`School with ID ${id} not found`);
    }

    return school;
  }

  async verifySchool(id: string) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) {
      throw new NotFoundException(`School with ID ${id} not found`);
    }

    if (school.isVerified) {
      throw new BadRequestException('School is already verified');
    }

    const result = await this.prisma.school.update({
      where: { id },
      data: { isVerified: true },
    });
    await this.cache.del(CK.school(id));
    return result;
  }

  async removeVerification(id: string) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) {
      throw new NotFoundException(`School with ID ${id} not found`);
    }

    if (!school.isVerified) {
      throw new BadRequestException('School is not currently verified');
    }

    const result = await this.prisma.school.update({
      where: { id },
      data: { isVerified: false },
    });
    await this.cache.del(CK.school(id));
    return result;
  }

  async uploadStudents(
    schoolId: string,
    students: { email: string; displayName: string; className?: string }[],
  ) {
    const usersToCreate = await Promise.all(
      students.map(async (s) => {
        const tempPassword = crypto.randomBytes(12).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 12);
        return {
          username:
            s.email.split('@')[0] + crypto.randomBytes(2).toString('hex'),
          email: s.email,
          displayName: s.displayName,
          className: s.className,
          schoolId,
          password: hashedPassword,
          tempPassword, // persist plain-text — TIKIT_ADMIN only via GET /users/:id
          approvalStatus: 'pending',
          role: 'STUDENT',
        };
      }),
    );

    await this.prisma.user.createMany({
      data: usersToCreate,
      skipDuplicates: true,
    });

    return { message: `${students.length} students uploaded successfully.` };
  }

  async uploadClasses(
    schoolId: string,
    classes: { className: string; graduationYear?: number }[],
  ) {
    const classesToCreate = classes.map((c) => ({
      className: c.className,
      graduationYear: c.graduationYear || new Date().getFullYear() + 3,
      schoolId,
    }));

    await this.prisma.class.createMany({
      data: classesToCreate,
      skipDuplicates: true,
    });

    return { message: `${classes.length} classes uploaded successfully.` };
  }

  async assignCards(schoolId: string, cardId: string, classNames: string[]) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId, schoolId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const students = await this.prisma.user.findMany({
      where: {
        schoolId,
        className: { in: classNames },
      },
    });

    if (students.length === 0) {
      return { message: 'No students found in the selected classes.' };
    }

    const codesToCreate = students.map((student) => ({
      cardId,
      userId: student.id,
      code: generateFormattedCode(),
      isUsed: false,
    }));

    await this.prisma.cardCode.createMany({
      data: codesToCreate,
      skipDuplicates: true, // In case of duplicate codes randomly generated
    });

    // Send assignment emails in the background
    Promise.allSettled(
      students.map((student) => {
        const studentCode = codesToCreate.find(
          (c) => c.userId === student.id,
        )?.code;
        if (student.email && studentCode) {
          return this.emailsService.sendCardAssignedEmail(
            student.email,
            student.displayName,
            card.title,
            studentCode,
          );
        }
        return Promise.resolve();
      }),
    ).catch((err) => {
      console.error('Error sending card assignment emails:', err);
    });

    return {
      message: `Assigned card ${cardId} to ${students.length} students in classes: ${classNames.join(', ')}`,
    };
  }

  // ─── Bulk School Creation ─────────────────────────────────────────────────

  async bulkCreate(rows: BulkCreateSchoolItemDto[]): Promise<{
    created: number;
    failed: number;
    errors: { row: number; slug: string; reason: string }[];
  }> {
    const errors: { row: number; slug: string; reason: string }[] = [];
    const toCreate: { idx: number; data: Record<string, any> }[] = [];
    const slugsSeen = new Set<string>();

    // ── Per-row validation ────────────────────────────────────────────────────
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.name?.trim() || !row.slug?.trim() || !row.city?.trim()) {
        errors.push({
          row: rowNum,
          slug: row.slug ?? '',
          reason: 'name, slug and city are required',
        });
        continue;
      }

      const slug = row.slug.trim().toLowerCase();

      if (slugsSeen.has(slug)) {
        errors.push({
          row: rowNum,
          slug,
          reason: 'Duplicate slug within request',
        });
        continue;
      }
      slugsSeen.add(slug);

      // Auto-generate a formatted schoolCode
      const schoolCode = generateFormattedCode();

      toCreate.push({
        idx: rowNum,
        data: {
          name: row.name.trim(),
          slug,
          city: row.city.trim(),
          description: row.description?.trim() ?? null,
          schoolCode,
        },
      });
    }

    if (toCreate.length === 0) {
      return { created: 0, failed: rows.length, errors };
    }

    // ── Check DB for already-existing slugs ───────────────────────────────────
    const existingSlugs = await this.prisma.school.findMany({
      where: { slug: { in: toCreate.map((r) => r.data.slug) } },
      select: { slug: true },
    });
    const existingSet = new Set(existingSlugs.map((s) => s.slug));

    const finalCreate = toCreate.filter((r) => {
      if (existingSet.has(r.data.slug)) {
        errors.push({
          row: r.idx,
          slug: r.data.slug,
          reason: 'Slug already exists in database',
        });
        return false;
      }
      return true;
    });

    if (finalCreate.length > 0) {
      await this.prisma.school.createMany({
        data: finalCreate.map((r) => ({
          name: r.data.name as string,
          slug: r.data.slug as string,
          city: r.data.city as string,
          description: r.data.description as string | null,
          schoolCode: r.data.schoolCode as string,
        })),
        skipDuplicates: true,
      });
    }

    if (finalCreate.length > 0) {
      await this.cache.delByPattern('schools:list:*');
    }

    return {
      created: finalCreate.length,
      failed: rows.length - finalCreate.length,
      errors,
    };
  }

  // ─── CSV School Upload ──────────────────────────────────────────────────────

  async uploadSchoolsCsv(buffer: Buffer): Promise<{
    created: number;
    failed: number;
    errors: { row: number; name: string; reason: string }[];
  }> {
    const text = buffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV file must have a header row and at least one data row',
      );
    }

    // ── Parse header ────────────────────────────────────────────────────────
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const requiredCols = ['name', 'slug', 'city', 'contactemail'];
    for (const col of requiredCols) {
      if (!headers.includes(col)) {
        throw new BadRequestException(`CSV missing required column: "${col}"`);
      }
    }

    const col = (row: string[], name: string) => {
      const idx = headers.indexOf(name);
      return idx !== -1 ? (row[idx] ?? '').trim() : '';
    };

    const errors: { row: number; name: string; reason: string }[] = [];
    const toCreate: { rowNum: number; data: Record<string, any> }[] = [];
    const slugsSeen = new Set<string>();

    // ── Per-row validation ───────────────────────────────────────────────────
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      const rowNum = i; // 1-based (excluding header)

      const name = col(parts, 'name');
      const slug = col(parts, 'slug').toLowerCase();
      const city = col(parts, 'city');
      const contactEmail = col(parts, 'contactemail');
      const description = col(parts, 'description') || null;
      const contactPhone = col(parts, 'contactphone') || null;
      const address = col(parts, 'address') || null;

      if (!name || !slug || !city) {
        errors.push({
          row: rowNum,
          name: name || '(empty)',
          reason: 'name, slug and city are required',
        });
        continue;
      }

      if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        errors.push({
          row: rowNum,
          name,
          reason: 'contactEmail is missing or invalid',
        });
        continue;
      }

      if (slugsSeen.has(slug)) {
        errors.push({
          row: rowNum,
          name,
          reason: 'Duplicate slug within this CSV',
        });
        continue;
      }
      slugsSeen.add(slug);

      toCreate.push({
        rowNum,
        data: {
          name,
          slug,
          city,
          contactEmail,
          description,
          contactPhone,
          address,
        },
      });
    }

    if (toCreate.length === 0) {
      return { created: 0, failed: lines.length - 1, errors };
    }

    // ── Check DB for already-existing slugs / emails ─────────────────────────
    const [existingSlugs, existingEmails] = await Promise.all([
      this.prisma.school.findMany({
        where: { slug: { in: toCreate.map((r) => r.data.slug) } },
        select: { slug: true },
      }),
      this.prisma.user.findMany({
        where: { email: { in: toCreate.map((r) => r.data.contactEmail) } },
        select: { email: true },
      }),
    ]);

    const existingSlugSet = new Set(existingSlugs.map((s) => s.slug));
    const existingEmailSet = new Set(existingEmails.map((u) => u.email));

    const finalCreate = toCreate.filter((r) => {
      if (existingSlugSet.has(r.data.slug)) {
        errors.push({
          row: r.rowNum,
          name: r.data.name,
          reason: 'Slug already exists in database',
        });
        return false;
      }
      if (existingEmailSet.has(r.data.contactEmail)) {
        errors.push({
          row: r.rowNum,
          name: r.data.name,
          reason: 'Admin email already in use',
        });
        return false;
      }
      return true;
    });

    // ── Create each school in its own transaction ────────────────────────────
    let created = 0;
    for (const item of finalCreate) {
      const {
        name,
        slug,
        city,
        contactEmail,
        description,
        contactPhone,
        address,
      } = item.data;
      const schoolCode = generateFormattedCode();
      const tempPassword = crypto.randomBytes(10).toString('hex'); // 20-char hex
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      try {
        await this.prisma.$transaction(async (tx) => {
          const baseUrl =
            process.env.BASE_URL ||
            `http://localhost:${process.env.PORT || 3000}`;
          const deepLink = `${baseUrl}/v1/join/${schoolCode}`;

          const school = await tx.school.create({
            data: {
              name,
              slug,
              city,
              contactEmail,
              description,
              contactPhone,
              address,
              schoolCode,
              deepLink,
              tempAdminPassword: tempPassword, // stored plain-text — TIKIT_ADMIN only
            },
          });

          const usernameBase = contactEmail.split('@')[0];
          const uniqueSuffix = crypto.randomBytes(2).toString('hex');

          await tx.user.create({
            data: {
              email: contactEmail,
              username: `${usernameBase}_${uniqueSuffix}`,
              displayName: `${name} Admin`,
              password: hashedPassword,
              role: 'SCHOOL_ADMIN',
              accountStatus: 'ACTIVE',
              schoolId: school.id,
              isVerified: true,
              approvalStatus: 'approved',
            },
          });

          await tx.communicationAllocation.create({
            data: {
              schoolId: school.id,
              pushAllocated: 500,
              emailAllocated: 500,
              smsAllocated: 500,
            },
          });
        });

        created++;
      } catch (err: any) {
        errors.push({
          row: item.rowNum,
          name,
          reason: err?.message ?? 'Unknown DB error',
        });
      }
    }

    if (created > 0) {
      await this.cache.delByPattern('schools:list:*');
    }

    return { created, failed: lines.length - 1 - created, errors };
  }

  // ─── Individual Invite Codes ──────────────────────────────────────────────

  async generateIndividualCodes(
    schoolId: string,
    dto: GenerateIndividualCodesDto,
  ): Promise<{ generated: number; codes: string[] }> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true },
    });
    if (!school) throw new NotFoundException(`School ${schoolId} not found`);

    if (!dto.codes || dto.codes.length === 0) {
      throw new BadRequestException(
        'You must provide an array of codes to create.',
      );
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    const codes = dto.codes;

    await this.prisma.schoolInviteCode.createMany({
      data: codes.map((code) => ({
        schoolId,
        code,
        studentName: dto.studentName ?? null,
        studentEmail: dto.studentEmail ?? null,
        expiresAt,
      })),
      skipDuplicates: true,
    });

    return { generated: codes.length, codes };
  }

  async listIndividualCodes(
    schoolId: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: any[]; meta: any }> {
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.schoolInviteCode.count({ where: { schoolId } }),
      this.prisma.schoolInviteCode.findMany({
        where: { schoolId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          usedBy: { select: { id: true, displayName: true, email: true } },
        },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async exportIndividualCodes(schoolId: string): Promise<string> {
    const codes = await this.prisma.schoolInviteCode.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });

    const header =
      'code,studentName,studentEmail,isUsed,usedAt,expiresAt,createdAt';
    const rows = codes.map((c) =>
      [
        c.code,
        c.studentName ?? '',
        c.studentEmail ?? '',
        c.isUsed ? 'true' : 'false',
        c.usedAt?.toISOString() ?? '',
        c.expiresAt?.toISOString() ?? '',
        c.createdAt.toISOString(),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  async redeemIndividualCode(
    userId: string,
    code: string,
  ): Promise<{ message: string }> {
    // Validate the code before opening a transaction — these checks are cheap reads
    // and their failure should not consume a transaction slot.
    const invite = await this.prisma.schoolInviteCode.findUnique({
      where: { code },
    });

    if (!invite) throw new NotFoundException('Invite code not found');
    if (invite.isUsed)
      throw new BadRequestException('This invite code has already been used');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('This invite code has expired');
    }

    // Callback-form transaction: the schoolId guard and both writes are a single
    // atomic unit. This eliminates the TOCTOU race where two concurrent requests
    // for the same user could both pass the guard and each overwrite schoolId.
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { schoolId: true },
      });

      if (user?.schoolId) {
        throw new BadRequestException('You already belong to a school.');
      }

      const now = new Date();

      await tx.schoolInviteCode.update({
        where: { code },
        data: { isUsed: true, usedByUserId: userId, usedAt: now },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          schoolId: invite.schoolId,
          approvalStatus: 'approved',
          joinedViaCode: true,
        },
      });
    });

    return { message: 'School joined successfully' };
  }

  // ─── Classes CRUD ─────────────────────────────────────────────────────────

  async getClasses(schoolId: string) {
    const classes = await this.prisma.class.findMany({
      where: { schoolId },
      orderBy: { graduationYear: 'desc' },
    });

    // Also fetch the list of students for each class
    // Since User only has a string 'className', we fetch students matching the schoolId
    const students = await this.prisma.user.findMany({
      where: {
        schoolId,
        className: { in: classes.map((c) => c.className) },
        role: 'STUDENT',
        deletedAt: null,
      },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        className: true,
      },
    });

    // Group students by className and attach to each class object
    const classData = classes.map((c) => {
      const classStudents = students.filter((s) => s.className === c.className);
      return {
        ...c,
        students: classStudents,
        studentCount: classStudents.length,
      };
    });

    return classData;
  }

  async createClass(
    schoolId: string,
    dto: { className: string; graduationYear: number },
  ) {
    const existing = await this.prisma.class.findFirst({
      where: { schoolId, className: dto.className },
    });

    if (existing) {
      throw new BadRequestException(
        `Class ${dto.className} already exists in this school.`,
      );
    }

    return this.prisma.class.create({
      data: {
        schoolId,
        className: dto.className,
        graduationYear: dto.graduationYear,
      },
    });
  }

  async updateClass(
    schoolId: string,
    classId: string,
    dto: { className?: string; graduationYear?: number },
  ) {
    const existing = await this.prisma.class.findFirst({
      where: { id: classId, schoolId },
    });

    if (!existing) {
      throw new NotFoundException('Class not found');
    }

    if (dto.className && dto.className !== existing.className) {
      const nameTaken = await this.prisma.class.findFirst({
        where: { schoolId, className: dto.className },
      });
      if (nameTaken) {
        throw new BadRequestException(
          `Class name ${dto.className} is already taken.`,
        );
      }

      // If we rename the class, we should also update the className for all students in this class
      await this.prisma.user.updateMany({
        where: { schoolId, className: existing.className },
        data: { className: dto.className },
      });
    }

    return this.prisma.class.update({
      where: { id: classId },
      data: dto,
    });
  }

  async deleteClass(schoolId: string, classId: string) {
    const existing = await this.prisma.class.findFirst({
      where: { id: classId, schoolId },
    });

    if (!existing) {
      throw new NotFoundException('Class not found');
    }

    // Unassign students from this class
    await this.prisma.user.updateMany({
      where: { schoolId, className: existing.className },
      data: { className: null },
    });

    await this.prisma.class.delete({
      where: { id: classId },
    });

    return { message: 'Class deleted successfully' };
  }
}
