import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { generateQrToken, generateTicketCode } from '../tickets/tickets.service';
import { CreateVoucherDto, RedeemVoucherDto } from './dto/voucher.dto';

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVoucherDto, createdById: string) {
    const [event, ticketType] = await Promise.all([
      this.prisma.event.findUnique({ where: { id: dto.eventId } }),
      this.prisma.ticketType.findUnique({ where: { id: dto.ticketTypeId } }),
    ]);

    if (!event) throw new NotFoundException('Event not found');
    if (!ticketType) throw new NotFoundException('Ticket type not found');
    if (ticketType.eventId !== dto.eventId) {
      throw new BadRequestException('Ticket type does not belong to this event');
    }

    return this.prisma.voucher.create({
      data: {
        code: `VCH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        eventId: dto.eventId,
        ticketTypeId: dto.ticketTypeId,
        createdById,
        assignedToId: dto.assignedToId ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async redeem(dto: RedeemVoucherDto, userId: string) {
    const voucher = await this.prisma.voucher.findUnique({ where: { code: dto.code } });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.isUsed) throw new BadRequestException('Voucher has already been used');
    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      throw new BadRequestException('Voucher has expired');
    }
    if (voucher.assignedToId && voucher.assignedToId !== userId) {
      throw new BadRequestException('This voucher is assigned to a different user');
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const freshType = await tx.ticketType.findUnique({ where: { id: voucher.ticketTypeId } });
      if (!freshType || freshType.quantityRemaining <= 0) {
        throw new BadRequestException('Tickets are sold out');
      }

      const existing = await tx.ticket.findFirst({ where: { userId, eventId: voucher.eventId } });
      if (existing) throw new ConflictException('You already have a ticket for this event');

      const updated = await tx.ticketType.update({
        where: { id: voucher.ticketTypeId },
        data: { quantityRemaining: { decrement: 1 } },
      });
      if (updated.quantityRemaining === 0) {
        await tx.ticketType.update({ where: { id: voucher.ticketTypeId }, data: { isSoldOut: true } });
      }

      await tx.voucher.update({
        where: { id: voucher.id },
        data: { isUsed: true, redeemedById: userId, redeemedAt: new Date() },
      });

      return tx.ticket.create({
        data: {
          userId,
          eventId: voucher.eventId,
          ticketTypeId: voucher.ticketTypeId,
          code: generateTicketCode(),
          qrToken: generateQrToken(),
          status: 'ISSUED',
        },
      });
    });

    return { message: 'Voucher redeemed successfully', ticket };
  }

  findAll(eventId?: string) {
    return this.prisma.voucher.findMany({
      where: eventId ? { eventId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException('Voucher not found');
    return voucher;
  }
}
