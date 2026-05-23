import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string) {
    const now = new Date();

    // Fetch logged-in user profile details for cards/tickets detail screens
    const userProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        firstName: true,
        lastName: true,
        username: true,
        birthdate: true,
        avatarUrl: true,
      }
    });

    // Get Tickets including TicketType name/desc
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
        ticketType: {
          select: {
            name: true,
            description: true,
          }
        }
      }
    });

    const formattedTickets = tickets.map(ticket => ({
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

    // Get Activated Cards including School branding info
    const cardCodes = await this.prisma.cardCode.findMany({
      where: { userId, isUsed: true },
      include: {
        card: {
          include: {
            school: {
              select: {
                name: true,
                slug: true,
                logoUrl: true,
              }
            }
          }
        }
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
      school: code.card.school,
      isExpired: code.card.validUntil < now || code.card.status === 'blocked',
    }));

    return {
      user: userProfile,
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
      include: {
        card: {
          include: {
            school: { select: { name: true, logoUrl: true } }
          }
        },
        user: { select: { username: true } }
      }
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
      }
    };
  }
}
