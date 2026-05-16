import { Injectable, NotFoundException } from '@nestjs/common';
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
}
