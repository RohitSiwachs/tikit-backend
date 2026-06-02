import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '../prisma-enums';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class ScannerService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
  ) {}

  async scan(qrToken: string, verifyOnly: boolean = false) {
    if (!qrToken) throw new BadRequestException('QR token is required');

    // Tickets use the qr_ prefix (enforced by generateQrToken())
    if (qrToken.startsWith('qr_')) {
      return this.scanTicket(qrToken, verifyOnly);
    }

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
    if (ticket.event.isCancelled) throw new BadRequestException('This event has been cancelled');
    if (new Date() > ticket.event.endsAt) throw new BadRequestException('This event has already ended');
    if (ticket.status === TicketStatus.VOID) throw new BadRequestException('This ticket has been voided');

    if (verifyOnly) {
      if (ticket.status === TicketStatus.CHECKED_IN) {
        throw new BadRequestException(`Ticket already checked in at ${ticket.checkedInAt}`);
      }
      const stats = await this.getEventStats(ticket.eventId);
      return this.buildTicketResponse('Ticket is valid', ticket, ticket.status, ticket.checkedInAt, stats);
    }

    if (ticket.status === TicketStatus.CHECKED_IN) {
      throw new BadRequestException(`Ticket already checked in at ${ticket.checkedInAt}`);
    }

    // Atomic conditional update — the WHERE status = 'ISSUED' clause is the race guard.
    // PostgreSQL row-level locking ensures exactly one concurrent call wins this update.
    // If two scans arrive simultaneously, one gets count=1 and the other gets count=0.
    const result = await this.prisma.ticket.updateMany({
      where: { id: ticket.id, status: TicketStatus.ISSUED },
      data: { status: TicketStatus.CHECKED_IN, checkedInAt: new Date() },
    });

    if (result.count === 0) {
      // Another scan beat us to this ticket within the same request window
      const current = await this.prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { checkedInAt: true },
      });
      throw new BadRequestException(
        `Ticket was just checked in at ${current?.checkedInAt?.toISOString() ?? 'unknown'}`,
      );
    }

    // Re-read the updated record so checkedInAt reflects the actual DB timestamp
    const updated = await this.prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true, checkedInAt: true },
    });

    const eventStats = await this.getEventStats(ticket.eventId);

    this.eventsGateway.emitCheckinUpdate(ticket.eventId, {
      userId: ticket.user.id,
      userName: ticket.user.displayName,
      ticketType: ticket.ticketType?.name ?? 'Standard',
      checkedInAt: updated!.checkedInAt,
      totalCheckins: eventStats.scannedCount,
    });

    return this.buildTicketResponse(
      'Check-in successful',
      ticket,
      updated!.status,
      updated!.checkedInAt,
      eventStats,
    );
  }

  private buildTicketResponse(
    message: string,
    ticket: any,
    status: string,
    checkedInAt: Date | null,
    stats: Awaited<ReturnType<typeof this.getEventStats>>,
  ) {
    return {
      type: 'TICKET',
      message,
      isCheckedIn: status === TicketStatus.CHECKED_IN,
      checkedInAt,
      ticket: { id: ticket.id, code: ticket.code, status },
      user: ticket.user,
      event: { id: ticket.event.id, title: ticket.event.title },
      ticketType: { name: ticket.ticketType?.name ?? 'Standard' },
      stats,
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
    if (cardCode.card.status === 'blocked') throw new BadRequestException('This card has been blocked');
    if (cardCode.card.status === 'paused') throw new BadRequestException('This card is currently paused');
    if (new Date() > cardCode.card.validUntil) throw new BadRequestException('This card has expired');

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
      this.prisma.ticket.count({ where: { eventId, status: { not: TicketStatus.VOID } } }),
      this.prisma.ticket.count({ where: { eventId, status: TicketStatus.CHECKED_IN } }),
    ]);

    return {
      scannedCount: scannedTickets,
      remainingEntries: totalTickets - scannedTickets,
      totalCapacity: totalTickets,
      occupancyRate: totalTickets > 0 ? Math.round((scannedTickets / totalTickets) * 100) : 0,
    };
  }
}
