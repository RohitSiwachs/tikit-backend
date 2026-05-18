import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '../prisma-enums';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async voidTicket(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket with ID ${id} not found`);

    return this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.VOID },
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        user: true,
        event: true,
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
        user: true,
        event: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkIn(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket with ID ${id} not found`);

    return this.prisma.ticket.update({
      where: { id },
      data: { status: 'CHECKED_IN', checkedInAt: new Date() },
    });
  }

  async claimFreeTicket(userId: string, eventId: string, ticketTypeId: string) {
    const ticketType = await this.prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
    if (!ticketType) throw new NotFoundException('Ticket type not found');
    if (ticketType.eventId !== eventId) throw new BadRequestException('Ticket type does not belong to this event');
    if (ticketType.isSoldOut || ticketType.quantityRemaining <= 0) throw new BadRequestException('Tickets are sold out');
    if (ticketType.price > 0) throw new BadRequestException('This ticket is not free');

    // Create the ticket and decrement quantity using a transaction
    const ticket = await this.prisma.$transaction(async (prisma) => {
      const updatedType = await prisma.ticketType.update({
        where: { id: ticketTypeId },
        data: {
          quantityRemaining: { decrement: 1 },
        },
      });

      if (updatedType.quantityRemaining < 0) {
        throw new BadRequestException('Tickets are sold out');
      }

      if (updatedType.quantityRemaining === 0) {
        await prisma.ticketType.update({
          where: { id: ticketTypeId },
          data: { isSoldOut: true },
        });
      }

      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const qrToken = `qr_${code}_${Date.now()}`;

      return prisma.ticket.create({
        data: {
          userId,
          eventId,
          ticketTypeId,
          code,
          qrToken,
          status: 'ISSUED',
        },
      });
    });

    return ticket;
  }
}
