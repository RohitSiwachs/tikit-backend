import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

    const codesToCreate: { cardId: string; code: string }[] = [];
    for (let i = 0; i < count; i++) {
      codesToCreate.push({
        cardId,
        code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      });
    }

    await this.prisma.cardCode.createMany({
      data: codesToCreate,
    });

    return {
      cardId,
      cardTitle: card.title,
      generatedCount: count,
    };
  }

  async exportCodes(cardId: string) {
    const codes = await this.prisma.cardCode.findMany({
      where: { cardId },
      select: { code: true, isUsed: true, usedAt: true },
    });
    return codes;
  }

  async pauseCard(cardId: string) {
    return this.prisma.card.update({
      where: { id: cardId },
      data: { status: 'paused' },
    });
  }

  async blockCard(cardId: string) {
    return this.prisma.card.update({
      where: { id: cardId },
      data: { status: 'blocked' },
    });
  }

  async getActivatedStudents(cardId: string) {
    const activatedCodes = await this.prisma.cardCode.findMany({
      where: { cardId, isUsed: true },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            className: true,
            school: { select: { id: true, name: true } },
          },
        },
      },
    });

    return activatedCodes.map((c) => ({
      code: c.code,
      usedAt: c.usedAt,
      student: c.user,
    }));
  }

  async findAll(schoolId?: string) {
    return this.prisma.card.findMany({
      where: schoolId ? { schoolId } : {},
      include: {
        school: { select: { name: true } },
        _count: { select: { codes: true } },
      },
    });
  }

  async findOne(id: string) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: {
        school: { select: { name: true } },
        _count: { select: { codes: true } },
      },
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

  async duplicateCard(id: string) {
    const card = await this.prisma.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundException(`Card with ID ${id} not found`);

    const { id: _id, createdAt, ...cardData } = card;
    return this.prisma.card.create({
      data: {
        ...cardData,
        title: `${cardData.title} (Copy)`,
        status: 'draft',
      },
    });
  }

  async remove(id: string) {
    return this.prisma.card.delete({
      where: { id },
    });
  }

  async claimCard(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    // Pre-flight validation outside transaction
    const cardCode = await this.prisma.cardCode.findUnique({
      where: { code },
      include: { card: true },
    });

    if (!cardCode) throw new BadRequestException('Invalid card code');
    if (cardCode.userId && cardCode.userId !== userId) {
      throw new BadRequestException(
        'This card code is assigned to another user',
      );
    }
    if (!user.schoolId || cardCode.card.schoolId !== user.schoolId) {
      throw new BadRequestException('This card does not belong to your school');
    }

    // Atomic claim: re-read inside transaction to prevent double-activation
    const updatedCardCode = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.cardCode.findUnique({
        where: { code },
        include: { card: true },
      });

      if (!fresh) throw new BadRequestException('Invalid card code');
      if (fresh.isUsed)
        throw new BadRequestException('This card code has already been used');

      const claimed = await tx.cardCode.update({
        where: { id: fresh.id },
        data: { isUsed: true, userId, usedAt: new Date() },
        include: { card: true },
      });

      await tx.user.update({
        where: { id: userId },
        data: { cardStatus: 'active' },
      });

      return claimed;
    });

    return {
      message: 'Card claimed successfully',
      cardCode: updatedCardCode.code,
      cardTitle: updatedCardCode.card.title,
      validFrom: updatedCardCode.card.validFrom,
      validUntil: updatedCardCode.card.validUntil,
    };
  }
}
