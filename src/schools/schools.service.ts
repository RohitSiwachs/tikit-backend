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

  async update(id: string, updateSchoolDto: UpdateSchoolDto) {
    const { schoolCode, ...updateData } = updateSchoolDto as any;
    return this.prisma.school.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    return this.prisma.school.delete({
      where: { id },
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
