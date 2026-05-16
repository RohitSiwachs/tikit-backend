import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createClassDto: CreateClassDto) {
    return this.prisma.class.create({
      data: createClassDto,
    });
  }

  findAll(schoolId?: string) {
    if (schoolId) {
      return this.prisma.class.findMany({ where: { schoolId } });
    }
    return this.prisma.class.findMany();
  }

  async findOne(id: string) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
    });
    if (!classEntity) throw new NotFoundException(`Class with ID ${id} not found`);
    return classEntity;
  }

  update(id: string, updateClassDto: UpdateClassDto) {
    return this.prisma.class.update({
      where: { id },
      data: updateClassDto,
    });
  }

  remove(id: string) {
    return this.prisma.class.delete({
      where: { id },
    });
  }
}
