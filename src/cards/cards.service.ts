import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCardDto, UpdateCardDto } from './dto/card.dto';
import * as crypto from 'crypto';

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCardDto) {
    return this.prisma.card.create({
      data: {
        ...dto,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
      },
    });
  }

  async generateCodes(cardId: string, count: number) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card) throw new NotFoundException(`Card with ID ${cardId} not found`);

    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }

    return {
      cardId,
      cardTitle: card.title,
      codes,
    };
  }

  async findAll(schoolId?: string) {
    return this.prisma.card.findMany({
      where: schoolId ? { schoolId } : {},
      include: { school: { select: { name: true } } },
    });
  }

  async findOne(id: string) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: { school: { select: { name: true } } },
    });
    if (!card) throw new NotFoundException(`Card with ID ${id} not found`);
    return card;
  }

  async update(id: string, dto: UpdateCardDto) {
    const data: any = { ...dto };
    if (data.validFrom) data.validFrom = new Date(data.validFrom);
    if (data.validUntil) data.validUntil = new Date(data.validUntil);

    return this.prisma.card.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.card.delete({
      where: { id },
    });
  }
}
