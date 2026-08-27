import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    const now = new Date();

    // All three queries are independent — fire in parallel to eliminate sequential round-trips.
    // Before: ~3 × DB RTT ≈ 150–300ms. After: max(RTT_userProfile, RTT_tickets, RTT_cards).
    const [userProfile, tickets, cardCodes] = await Promise.all([
      // Fetch logged-in user profile details for cards/tickets detail screens
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          username: true,
          birthdate: true,
          avatarUrl: true,
        },
      }),

      // Get Tickets including TicketType name/desc
      this.prisma.ticket.findMany({
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
            },
          },
          ticketType: {
            select: {
              name: true,
              description: true,
            },
          },
        },
      }),

      // Get Activated Cards including School branding info
      this.prisma.cardCode.findMany({
        where: { userId, isUsed: true },
        include: {
          card: {
            include: {
              school: {
                select: {
                  name: true,
                  slug: true,
                  logoUrl: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const formattedTickets = tickets.map((ticket) => ({
      id: ticket.id,
      code: ticket.code,
      qrToken: ticket.qrToken,
      status: ticket.status,
      checkedInAt: ticket.checkedInAt,
      ticketTypeName: ticket.ticketType?.name,
      ticketTypeDescription: ticket.ticketType?.description,
      event: ticket.event,
      isExpired: ticket.event.endsAt < now,
    }));

    const formattedCards = cardCodes.map((code) => ({
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
      school: code.card.school,
      isExpired: code.card.validUntil < now || code.card.status === 'blocked',
    }));

    return {
      user: userProfile,
      tickets: formattedTickets,
      cards: formattedCards,
    };
  }

  async getPendingCards(userId: string) {
    const now = new Date();

    const pendingCardCodes = await this.prisma.cardCode.findMany({
      where: { userId, isUsed: false },
      include: {
        card: {
          include: {
            school: {
              select: {
                name: true,
                slug: true,
                schoolCode: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });

    const formattedPendingCards = pendingCardCodes.map((code) => ({
      id: code.id,
      code: code.code,
      assignedAt: code.assignedAt,
      cardId: code.card.id,
      title: code.card.title,
      coverUrl: code.card.coverUrl,
      benefits: code.card.benefits,
      validFrom: code.card.validFrom,
      validUntil: code.card.validUntil,
      status: code.card.status,
      school: code.card.school,
      isExpired: code.card.validUntil < now || code.card.status === 'blocked',
    }));

    const message =
      formattedPendingCards.length === 0
        ? 'No pending cards assigned to you at the moment.'
        : `You have ${formattedPendingCards.length} pending card(s) waiting to be activated.`;

    return {
      message,
      pendingCards: formattedPendingCards,
    };
  }

  async activateCard(userId: string, code: string) {
    // Atomic activation: re-read inside transaction to prevent double-activation race
    const activatedCode = await this.prisma.$transaction(async (tx) => {
      const cardCode = await tx.cardCode.findUnique({
        where: { code },
        include: { card: true },
      });

      if (!cardCode) throw new NotFoundException('Card code not found');
      if (cardCode.isUsed)
        throw new BadRequestException('Card code has already been used');
      if (cardCode.card.status === 'blocked')
        throw new BadRequestException('This card has been blocked');
      if (new Date() > cardCode.card.validUntil)
        throw new BadRequestException('This card has expired');

      return tx.cardCode.update({
        where: { id: cardCode.id },
        data: { isUsed: true, usedAt: new Date(), userId },
        include: {
          card: {
            include: { school: { select: { name: true, logoUrl: true } } },
          },
          user: { select: { username: true } },
        },
      });
    });

    return {
      message: 'Card activated successfully',
      username: activatedCode.user?.username,
      card: {
        title: activatedCode.card.title,
        validUntil: activatedCode.card.validUntil,
        benefits: activatedCode.card.benefits,
        coverUrl: activatedCode.card.coverUrl,
        status: 'active',
        schoolName: activatedCode.card.school?.name,
      },
    };
  }
}
