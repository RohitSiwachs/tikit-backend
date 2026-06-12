import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { BulkCreateSchoolItemDto } from './dto/bulk-create-school.dto';
import { EmailsService } from '../emails/emails.service';

@Injectable()
export class SchoolsService {
  constructor(
    private prisma: PrismaService,
    private emailsService: EmailsService,
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

    return this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
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
          role: 'KARORDFORANDE',
          accountStatus: 'ACTIVE',
          schoolId: school.id,
          isVerified: true,
          approvalStatus: 'approved',
        },
      });

      // Default communication quota — 500 per channel for every new school
      await tx.communicationAllocation.create({
        data: {
          schoolId: school.id,
          pushAllocated: 500,
          emailAllocated: 500,
          smsAllocated: 500,
        },
      });

      return school;
    });
  }

  async findAll(query: {
    search?: string;
    city?: string;
    page?: number;
    limit?: number;
  }) {
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

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
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

    return school;
  }

  async update(id: string, updateSchoolDto: UpdateSchoolDto, callerRole?: string) {
    const {
      schoolCode,
      pushAllocated, emailAllocated, smsAllocated,
      pushPrice, emailPrice, smsPrice,
      ...schoolData
    } = updateSchoolDto as any;

    const school = await this.prisma.school.update({
      where: { id },
      data: schoolData,
    });

    // Communication limits are TIKIT_ADMIN-only — silently ignored for other roles
    if (callerRole === 'TIKIT_ADMIN') {
      const alloc: Record<string, number> = {};
      if (pushAllocated  !== undefined) alloc.pushAllocated  = pushAllocated;
      if (emailAllocated !== undefined) alloc.emailAllocated = emailAllocated;
      if (smsAllocated   !== undefined) alloc.smsAllocated   = smsAllocated;
      if (pushPrice      !== undefined) alloc.pushPrice      = pushPrice;
      if (emailPrice     !== undefined) alloc.emailPrice     = emailPrice;
      if (smsPrice       !== undefined) alloc.smsPrice       = smsPrice;

      if (Object.keys(alloc).length > 0) {
        await this.prisma.communicationAllocation.upsert({
          where:  { schoolId: id },
          create: { schoolId: id, ...alloc },
          update: alloc,
        });
      }
    }

    return school;
  }

  async remove(id: string) {
    return this.prisma.school.delete({
      where: { id },
    });
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

    return this.prisma.school.update({
      where: { id },
      data: { isVerified: true },
    });
  }

  async removeVerification(id: string) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) {
      throw new NotFoundException(`School with ID ${id} not found`);
    }

    if (!school.isVerified) {
      throw new BadRequestException('School is not currently verified');
    }

    return this.prisma.school.update({
      where: { id },
      data: { isVerified: false },
    });
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
      code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      isUsed: false,
    }));

    await this.prisma.cardCode.createMany({
      data: codesToCreate,
      skipDuplicates: true, // In case of duplicate codes randomly generated
    });

    // Send assignment emails in the background
    Promise.allSettled(
      students.map((student) => {
        const studentCode = codesToCreate.find((c) => c.userId === student.id)?.code;
        if (student.email && studentCode) {
          return this.emailsService.sendCardAssignedEmail(
            student.email,
            student.displayName,
            card.title,
            studentCode,
          );
        }
        return Promise.resolve();
      })
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
        errors.push({ row: rowNum, slug: row.slug ?? '', reason: 'name, slug and city are required' });
        continue;
      }

      const slug = row.slug.trim().toLowerCase();

      if (slugsSeen.has(slug)) {
        errors.push({ row: rowNum, slug, reason: 'Duplicate slug within request' });
        continue;
      }
      slugsSeen.add(slug);

      // Auto-generate a unique schoolCode from slug + random hex suffix
      const codeBase = slug.replace(/-/g, '').toUpperCase().slice(0, 8);
      const schoolCode = `${codeBase}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

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
        errors.push({ row: r.idx, slug: r.data.slug, reason: 'Slug already exists in database' });
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

    return {
      created: finalCreate.length,
      failed: rows.length - finalCreate.length,
      errors,
    };
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

  async createClass(schoolId: string, dto: { className: string; graduationYear: number }) {
    const existing = await this.prisma.class.findFirst({
      where: { schoolId, className: dto.className },
    });

    if (existing) {
      throw new BadRequestException(`Class ${dto.className} already exists in this school.`);
    }

    return this.prisma.class.create({
      data: {
        schoolId,
        className: dto.className,
        graduationYear: dto.graduationYear,
      },
    });
  }

  async updateClass(schoolId: string, classId: string, dto: { className?: string; graduationYear?: number }) {
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
        throw new BadRequestException(`Class name ${dto.className} is already taken.`);
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
