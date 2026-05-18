import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    const now = new Date();

    // Get Tickets
    const tickets = await this.prisma.ticket.findMany({
      where: { userId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            venueName: true,
            coverUrl: true,
          }
        },
        user: {
          select: {
            displayName: true,
            email: true,
          }
        }
      }
    });

    const formattedTickets = tickets.map(ticket => ({
      ...ticket,
      isExpired: ticket.event.endsAt < now,
    }));

    // Get Activated Cards
    const cardCodes = await this.prisma.cardCode.findMany({
      where: { userId, isUsed: true },
      include: {
        card: true
      }
    });

    const formattedCards = cardCodes.map(code => ({
      id: code.id,
      code: code.code,
      activatedAt: code.usedAt,
      cardId: code.card.id,
      title: code.card.title,
      coverUrl: code.card.coverUrl,
      benefits: code.card.benefits,
      validFrom: code.card.validFrom,
      validUntil: code.card.validUntil,
      status: code.card.status,
      isExpired: code.card.validUntil < now || code.card.status === 'blocked',
    }));

    return {
      tickets: formattedTickets,
      cards: formattedCards,
    };
  }

  async activateCard(userId: string, code: string) {
    const cardCode = await this.prisma.cardCode.findUnique({
      where: { code },
      include: { card: true }
    });

    if (!cardCode) {
      throw new NotFoundException('Card code not found');
    }

    if (cardCode.isUsed) {
      throw new BadRequestException('Card code has already been used');
    }

    if (cardCode.card.status === 'blocked') {
      throw new BadRequestException('This card has been blocked');
    }

    if (new Date() > cardCode.card.validUntil) {
      throw new BadRequestException('This card has expired');
    }

    // Activate the card
    const activatedCode = await this.prisma.cardCode.update({
      where: { id: cardCode.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
        userId,
      },
    });

    return {
      message: 'Card activated successfully',
      code: activatedCode.code,
      cardTitle: cardCode.card.title,
    };
  }
}
