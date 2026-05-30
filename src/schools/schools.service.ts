import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  async create(createSchoolDto: CreateSchoolDto) {
    const { schoolAdminPassword, ...schoolData } = createSchoolDto as any;

    return this.prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: schoolData,
      });

      if (schoolData.contactEmail && schoolAdminPassword) {
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
          }
        });
      }

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

  async uploadStudents(schoolId: string, students: { email: string, displayName: string, className?: string }[]) {
    const usersToCreate = await Promise.all(
      students.map(async (s) => {
        const tempPassword = crypto.randomBytes(12).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 12);
        return {
          username: s.email.split('@')[0] + crypto.randomBytes(2).toString('hex'),
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

  async uploadClasses(schoolId: string, classes: { className: string; graduationYear?: number }[]) {
    const classesToCreate = classes.map(c => ({
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
    const students = await this.prisma.user.findMany({
      where: {
        schoolId,
        className: { in: classNames },
      }
    });

    if (students.length === 0) {
      return { message: 'No students found in the selected classes.' };
    }

    const codesToCreate = students.map(student => ({
      cardId,
      userId: student.id,
      code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      isUsed: false,
    }));

    await this.prisma.cardCode.createMany({
      data: codesToCreate,
      skipDuplicates: true, // In case of duplicate codes randomly generated
    });

    return { message: `Assigned card ${cardId} to ${students.length} students in classes: ${classNames.join(', ')}` };
  }
}
