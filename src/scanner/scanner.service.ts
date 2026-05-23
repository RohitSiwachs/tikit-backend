import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScannerService {
  constructor(private prisma: PrismaService) {}

  async scan(qrToken: string, verifyOnly: boolean = false) {
    // Check if it's a ticket
    if (qrToken.startsWith('qr_')) {
      return this.scanTicket(qrToken, verifyOnly);
    }

    // Otherwise, assume it's a card code
    return this.scanCard(qrToken);
  }

  private async scanTicket(qrToken: string, verifyOnly: boolean) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrToken },
      include: {
        event: true,
        ticketType: { select: { name: true } },
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            age: true,
          }
        }
      }
    });

    if (!ticket) {
      throw new NotFoundException('Invalid ticket QR code');
    }

    if (ticket.event.isCancelled) {
      throw new BadRequestException('This event has been cancelled');
    }

    if (new Date() > ticket.event.endsAt) {
      throw new BadRequestException('This event has already ended (Expired)');
    }

    if (ticket.status === 'VOID') {
      throw new BadRequestException('This ticket has been voided');
    }

    if (ticket.status === 'CHECKED_IN' && !verifyOnly) {
      throw new BadRequestException(`This ticket was already used at ${ticket.checkedInAt}`);
    }

    let updatedStatus = ticket.status;
    let checkedInAt = ticket.checkedInAt;

    if (!verifyOnly && ticket.status !== 'CHECKED_IN') {
      const updated = await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'CHECKED_IN',
          checkedInAt: new Date(),
        }
      });
      updatedStatus = updated.status;
      checkedInAt = updated.checkedInAt;
    }

    // Calculate stats
    const eventStats = await this.getEventStats(ticket.eventId);

    return {
      type: 'TICKET',
      message: verifyOnly ? 'Ticket verified successfully' : 'Ticket scanned successfully',
      isCheckedIn: updatedStatus === 'CHECKED_IN',
      checkedInAt,
      ticket: {
        id: ticket.id,
        code: ticket.code,
        status: updatedStatus,
      },
      user: ticket.user,
      event: { title: ticket.event.title },
      ticketType: {
        name: ticket.ticketType?.name || 'Standardbiljett',
      },
      stats: eventStats,
    };
  }

  private async scanCard(code: string) {
    const cardCode = await this.prisma.cardCode.findUnique({
      where: { code },
      include: {
        card: true,
        user: {
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            age: true,
          }
        }
      }
    });

    if (!cardCode) {
      throw new NotFoundException('Invalid card code');
    }

    if (cardCode.card.status === 'blocked') {
      throw new BadRequestException('This card has been blocked');
    }

    if (cardCode.card.status === 'paused') {
      throw new BadRequestException('This card is currently paused');
    }

    if (new Date() > cardCode.card.validUntil) {
      throw new BadRequestException('This card has expired');
    }

    if (cardCode.isUsed) {
      return {
        type: 'CARD',
        message: 'Card is valid and already activated',
        cardTitle: cardCode.card.title,
        user: cardCode.user,
        activatedAt: cardCode.usedAt,
      };
    }

    return {
      type: 'CARD',
      message: 'Card code is valid and ready to be activated',
      cardTitle: cardCode.card.title,
      validUntil: cardCode.card.validUntil,
    };
  }

  async getEventStats(eventId: string) {
    const totalTickets = await this.prisma.ticket.count({
      where: { eventId, status: { not: 'VOID' } }
    });

    const scannedTickets = await this.prisma.ticket.count({
      where: { eventId, status: 'CHECKED_IN' }
    });

    const remaining = totalTickets - scannedTickets;
    const occupancyPercentage = totalTickets > 0 ? Math.round((scannedTickets / totalTickets) * 100) : 0;

    return {
      scannedCount: scannedTickets,
      remainingEntries: remaining,
      totalCapacity: totalTickets,
      occupancyRate: occupancyPercentage,
    };
  }
}
