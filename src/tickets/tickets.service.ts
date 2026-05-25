import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '../prisma-enums';
import * as crypto from 'crypto';

export function generateQrToken(): string {
  // Unified format: qr_ prefix + 32 random hex chars
  // The qr_ prefix is checked by the scanner to distinguish tickets from card codes
  return `qr_${crypto.randomBytes(16).toString('hex')}`;
}

export function generateTicketCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async claimFreeTicket(userId: string, eventId: string, ticketTypeId: string) {
    if (!userId) throw new BadRequestException('User not authenticated');

    const ticketType = await this.prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
    if (!ticketType) throw new NotFoundException('Ticket type not found');
    if (ticketType.eventId !== eventId) throw new BadRequestException('Ticket type does not belong to this event');
    if (ticketType.price > 0) throw new BadRequestException('This ticket is not free');

    const ticket = await this.prisma.$transaction(async (tx) => {
      // Re-read inside transaction to get consistent state
      const freshType = await tx.ticketType.findUnique({ where: { id: ticketTypeId } });
      if (!freshType || freshType.isSoldOut || freshType.quantityRemaining <= 0) {
        throw new BadRequestException('Tickets are sold out');
      }

      // Check duplicate inside transaction — relies on @@unique([userId, eventId]) constraint
      const existing = await tx.ticket.findFirst({ where: { userId, eventId } });
      if (existing) throw new ConflictException('You already have a ticket for this event');

      const updated = await tx.ticketType.update({
        where: { id: ticketTypeId },
        data: { quantityRemaining: { decrement: 1 } },
      });

      if (updated.quantityRemaining === 0) {
        await tx.ticketType.update({ where: { id: ticketTypeId }, data: { isSoldOut: true } });
      }

      return tx.ticket.create({
        data: {
          userId,
          eventId,
          ticketTypeId,
          code: generateTicketCode(),
          qrToken: generateQrToken(),
          status: TicketStatus.ISSUED,
        },
      });
    });

    return ticket;
  }

  async voidTicket(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    if (ticket.status === TicketStatus.VOID) throw new BadRequestException('Ticket already voided');

    return this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.VOID },
    });
  }

  async cancelTicket(userId: string, eventId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { userId, eventId } });
    if (!ticket) throw new NotFoundException('No ticket found for this event');
    if (ticket.status === TicketStatus.CHECKED_IN) {
      throw new BadRequestException('Cannot cancel a ticket that has already been used');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: TicketStatus.VOID } });
      await tx.ticketType.update({
        where: { id: ticket.ticketTypeId },
        data: { quantityRemaining: { increment: 1 }, isSoldOut: false },
      });
    });

    return { message: 'Ticket cancelled and quantity restored' };
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true, displayName: true, email: true, avatarUrl: true, username: true,
          },
        },
        event: { select: { id: true, title: true, startsAt: true, venueName: true } },
        ticketType: { select: { id: true, name: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async findAll(eventId?: string, userId?: string) {
    const where: any = {};
    if (eventId) where.eventId = eventId;
    if (userId) where.userId = userId;

    return this.prisma.ticket.findMany({
      where,
      include: {
        user: {
          select: { id: true, displayName: true, email: true, avatarUrl: true, username: true },
        },
        event: { select: { id: true, title: true, startsAt: true } },
        ticketType: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkIn(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    if (ticket.status === TicketStatus.VOID) throw new BadRequestException('Ticket has been voided');
    if (ticket.status === TicketStatus.CHECKED_IN) throw new BadRequestException('Ticket already checked in');

    return this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.CHECKED_IN, checkedInAt: new Date() },
    });
  }
}
