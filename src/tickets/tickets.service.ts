import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TicketStatus } from '../prisma-enums';
import * as crypto from 'crypto';
import { EmailsService } from '../emails/emails.service';

export function generateQrToken(): string {
  // qr_ prefix lets the scanner distinguish tickets from card codes
  return `qr_${crypto.randomBytes(16).toString('hex')}`;
}

export function generateTicketCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private prisma: PrismaService,
    private emailsService: EmailsService,
  ) {}

  async claimFreeTicket(
    userId: string,
    eventId: string,
    ticketTypeId: string,
    userSchoolId?: string,
  ) {
    if (!userId) throw new BadRequestException('User not authenticated');

    const ticketType = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
    });
    if (!ticketType) throw new NotFoundException('Ticket type not found');
    if (ticketType.eventId !== eventId)
      throw new BadRequestException(
        'Ticket type does not belong to this event',
      );

    // Look up event to compare school IDs and enforce eventType boundary
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { schoolId: true, eventType: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    // External events are always handled by the external ticket provider.
    // TiKit never issues tickets for external events regardless of user role or ticket price.
    if (event.eventType === 'EXTERNAL') {
      throw new BadRequestException(
        'Tickets for this event must be purchased through the external ticket provider.',
      );
    }

    const isHostSchoolStudent = userSchoolId && userSchoolId === event.schoolId;

    // Eligibility: price===0 (always free) OR (freeForHostSchool AND host-school student)
    const isFreeEligible =
      ticketType.price === 0 ||
      (ticketType.freeForHostSchool && isHostSchoolStudent);

    if (!isFreeEligible) {
      throw new BadRequestException(
        'This ticket type is not available for free claim',
      );
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.ticket.findFirst({
        where: { userId, eventId },
      });
      if (existing)
        throw new ConflictException('You already have a ticket for this event');

      // Atomic decrement: the WHERE quantityRemaining > 0 is evaluated and the update applied
      // in a single DB round-trip, so concurrent claims cannot both pass the availability check.
      const reserved = await tx.ticketType.updateMany({
        where: {
          id: ticketTypeId,
          quantityRemaining: { gt: 0 },
          isSoldOut: false,
        },
        data: { quantityRemaining: { decrement: 1 } },
      });

      if (reserved.count === 0) {
        throw new BadRequestException('Tickets are sold out');
      }

      // Re-read to check if we just took the last ticket
      const afterReserve = await tx.ticketType.findUnique({
        where: { id: ticketTypeId },
        select: { quantityRemaining: true },
      });
      if (afterReserve?.quantityRemaining === 0) {
        await tx.ticketType.update({
          where: { id: ticketTypeId },
          data: { isSoldOut: true },
        });
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

    // Send receipt email in background — failure is logged but never blocks the response
    this.findOne(ticket.id)
      .then((populated) =>
        this.emailsService
          .sendTicketReceiptEmail(
            populated.user.email,
            populated.user.displayName,
            populated.event.title,
            populated.code,
          )
          .catch((err) =>
            this.logger.error('Receipt email failed', err?.stack),
          ),
      )
      .catch((err) =>
        this.logger.error('Failed to load ticket for email', err?.stack),
      );

    return ticket;
  }

  async voidTicket(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: { status: true, ticketTypeId: true },
    });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    if (ticket.status === TicketStatus.VOID)
      throw new BadRequestException('Ticket is already voided');

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id },
        data: { status: TicketStatus.VOID },
      });

      // Restore capacity only when the ticket was never used.
      // A CHECKED_IN ticket has been consumed — restoring capacity would over-count.
      if (ticket.status !== TicketStatus.CHECKED_IN) {
        await tx.ticketType.update({
          where: { id: ticket.ticketTypeId },
          data: { quantityRemaining: { increment: 1 }, isSoldOut: false },
        });
      }
    });

    return { message: 'Ticket voided successfully' };
  }

  async cancelTicket(userId: string, eventId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { userId, eventId },
    });
    if (!ticket) throw new NotFoundException('No ticket found for this event');
    if (ticket.status === TicketStatus.CHECKED_IN) {
      throw new BadRequestException(
        'Cannot cancel a ticket that has already been used',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: TicketStatus.VOID },
      });
      await tx.ticketType.update({
        where: { id: ticket.ticketTypeId },
        data: { quantityRemaining: { increment: 1 }, isSoldOut: false },
      });
    });

    return { message: 'Ticket cancelled and quantity restored' };
  }

  async checkIn(id: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    if (ticket.status === TicketStatus.VOID)
      throw new BadRequestException('Ticket has been voided');
    if (ticket.status === TicketStatus.CHECKED_IN)
      throw new BadRequestException('Ticket already checked in');

    return this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.CHECKED_IN, checkedInAt: new Date() },
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            username: true,
          },
        },
        event: {
          select: { id: true, title: true, startsAt: true, venueName: true },
        },
        ticketType: { select: { id: true, name: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async findAll(eventId?: string, userId?: string) {
    const where: { eventId?: string; userId?: string } = {};
    if (eventId) where.eventId = eventId;
    if (userId) where.userId = userId;

    return this.prisma.ticket.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            username: true,
          },
        },
        event: { select: { id: true, title: true, startsAt: true } },
        ticketType: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
