import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class ScannerService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async scan(qrToken: string, verifyOnly: boolean = false) {
    if (!qrToken) throw new BadRequestException('QR token is required');

    // Tickets always use the qr_ prefix (enforced by generateQrToken())
    if (qrToken.startsWith('qr_')) {
      return this.scanTicket(qrToken, verifyOnly);
    }

    // Anything else is treated as a card activation code
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
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Invalid QR code — ticket not found');

    if (ticket.event.isCancelled) {
      throw new BadRequestException('This event has been cancelled');
    }

    if (new Date() > ticket.event.endsAt) {
      throw new BadRequestException('This event has already ended');
    }

    if (ticket.status === 'VOID') {
      throw new BadRequestException('This ticket has been voided');
    }

    if (ticket.status === 'CHECKED_IN' && !verifyOnly) {
      throw new BadRequestException(`Ticket already used at ${ticket.checkedInAt}`);
    }

    let finalStatus = ticket.status;
    let checkedInAt = ticket.checkedInAt;
    let eventStats: Awaited<ReturnType<typeof this.getEventStats>> | null = null;

    if (!verifyOnly && ticket.status !== 'CHECKED_IN') {
      const updated = await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'CHECKED_IN', checkedInAt: new Date() },
      });
      finalStatus = updated.status;
      checkedInAt = updated.checkedInAt;

      // Fetch stats once and reuse for both broadcast and response
      eventStats = await this.getEventStats(ticket.eventId);
      this.eventsGateway.emitCheckinUpdate(ticket.eventId, {
        userId: ticket.user.id,
        userName: ticket.user.displayName,
        ticketType: ticket.ticketType?.name ?? 'Standard',
        checkedInAt,
        totalCheckins: eventStats.scannedCount,
      });
    }

    // Only fetch if not already fetched above (verify-only path)
    if (!eventStats) {
      eventStats = await this.getEventStats(ticket.eventId);
    }

    return {
      type: 'TICKET',
      message: verifyOnly ? 'Ticket is valid' : 'Check-in successful',
      isCheckedIn: finalStatus === 'CHECKED_IN',
      checkedInAt,
      ticket: { id: ticket.id, code: ticket.code, status: finalStatus },
      user: ticket.user,
      event: { id: ticket.event.id, title: ticket.event.title },
      ticketType: { name: ticket.ticketType?.name ?? 'Standard' },
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
            displayName: true, firstName: true, lastName: true,
            email: true, avatarUrl: true, age: true,
          },
        },
      },
    });

    if (!cardCode) throw new NotFoundException('Invalid card code — not found');

    if (cardCode.card.status === 'blocked') {
      throw new BadRequestException('This card has been blocked');
    }

    if (cardCode.card.status === 'paused') {
      throw new BadRequestException('This card is currently paused');
    }

    if (new Date() > cardCode.card.validUntil) {
      throw new BadRequestException('This card has expired');
    }

    return {
      type: 'CARD',
      message: cardCode.isUsed
        ? 'Card is valid and already activated'
        : 'Card code is valid and ready to be activated',
      cardTitle: cardCode.card.title,
      cardBenefits: cardCode.card.benefits,
      validUntil: cardCode.card.validUntil,
      isActivated: cardCode.isUsed,
      activatedAt: cardCode.usedAt ?? null,
      user: cardCode.isUsed ? cardCode.user : null,
    };
  }

  async getEventStats(eventId: string) {
    const [totalTickets, scannedTickets] = await Promise.all([
      this.prisma.ticket.count({ where: { eventId, status: { not: 'VOID' } } }),
      this.prisma.ticket.count({ where: { eventId, status: 'CHECKED_IN' } }),
    ]);

    return {
      scannedCount: scannedTickets,
      remainingEntries: totalTickets - scannedTickets,
      totalCapacity: totalTickets,
      occupancyRate: totalTickets > 0 ? Math.round((scannedTickets / totalTickets) * 100) : 0,
    };
  }
}
