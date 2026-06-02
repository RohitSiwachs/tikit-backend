import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSegmentDto } from './dto/segment.dto';

@Injectable()
export class SegmentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createSegmentDto: CreateSegmentDto) {
    return this.prisma.segment.create({
      data: createSegmentDto,
    });
  }

  findAll() {
    return this.prisma.segment.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const segment = await this.prisma.segment.findUnique({ where: { id } });
    if (!segment) throw new NotFoundException(`Segment with ID ${id} not found`);
    return segment;
  }

  remove(id: string) {
    return this.prisma.segment.delete({ where: { id } });
  }
}
