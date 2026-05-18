import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScannerService {
  constructor(private prisma: PrismaService) {}

  async scan(qrToken: string) {
    // Check if it's a ticket
    if (qrToken.startsWith('qr_')) {
      return this.scanTicket(qrToken);
    }

    // Otherwise, assume it's a card code
    return this.scanCard(qrToken);
  }

  private async scanTicket(qrToken: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrToken },
      include: {
        event: true,
        user: {
          select: { displayName: true, email: true }
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

    if (ticket.status === 'CHECKED_IN') {
      throw new BadRequestException(`This ticket was already used at ${ticket.checkedInAt}`);
    }

    // Mark as checked in
    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
      }
    });

    // Calculate stats
    const eventStats = await this.getEventScanStats(ticket.eventId);

    return {
      type: 'TICKET',
      message: 'Ticket scanned successfully',
      ticket: updatedTicket,
      user: ticket.user,
      event: { title: ticket.event.title },
      stats: eventStats,
    };
  }

  private async scanCard(code: string) {
    const cardCode = await this.prisma.cardCode.findUnique({
      where: { code },
      include: {
        card: true,
        user: { select: { displayName: true, email: true } }
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

  private async getEventScanStats(eventId: string) {
    const totalTickets = await this.prisma.ticket.count({
      where: { eventId, status: { not: 'VOID' } }
    });

    const scannedTickets = await this.prisma.ticket.count({
      where: { eventId, status: 'CHECKED_IN' }
    });

    return {
      scannedCount: scannedTickets,
      remainingEntries: totalTickets - scannedTickets,
      totalCapacity: totalTickets
    };
  }
}
