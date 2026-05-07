import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { Ticket } from '../entities/ticket.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { Event } from '../entities/event.entity.js';
import { Voucher } from '../entities/voucher.entity.js';
import { CheckIn } from '../entities/check-in.entity.js';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketType) private readonly ttRepo: Repository<TicketType>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Voucher) private readonly voucherRepo: Repository<Voucher>,
    @InjectRepository(CheckIn) private readonly checkinRepo: Repository<CheckIn>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async purchase(eventId: string, dto: { ticket_type_id: string; quantity: number; voucher_code?: string }, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      const tt = await manager.findOne(TicketType, {
        where: { id: dto.ticket_type_id, event_id: eventId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tt) throw new NotFoundException('Ticket type not found');
      if (tt.sold_count + dto.quantity > tt.total_inventory) {
        throw new BadRequestException('Not enough tickets available');
      }

      // Check existing ticket
      const existing = await manager.findOne(Ticket, {
        where: { user_id: userId, event_id: eventId },
      });
      if (existing) throw new ConflictException('You already have a ticket for this event');

      // Voucher check
      if (dto.voucher_code) {
        const voucher = await manager.findOne(Voucher, {
          where: { code: dto.voucher_code, ticket_type_id: dto.ticket_type_id, is_redeemed: false },
        });
        if (!voucher) throw new BadRequestException('Invalid voucher code');
        voucher.is_redeemed = true;
        voucher.redeemed_at = new Date();
        voucher.assigned_to = userId;
        await manager.save(voucher);
      }

      const event = await manager.findOne(Event, { where: { id: eventId } });
      if (!event) throw new NotFoundException('Event not found');

      // Generate ticket
      const code = this.generateCode();
      const qr_token = this.jwtService.sign(
        { ticket_id: 'pending', user_id: userId, event_id: eventId },
        { secret: event.qr_secret, expiresIn: '12h' },
      );

      const ticket = manager.create(Ticket, {
        code,
        user_id: userId,
        event_id: eventId,
        ticket_type_id: dto.ticket_type_id,
        qr_token,
        status: 'valid' as any,
      });
      const saved = await manager.save(ticket);

      // Update QR with actual ticket ID
      saved.qr_token = this.jwtService.sign(
        { ticket_id: saved.id, user_id: userId, event_id: eventId },
        { secret: event.qr_secret, expiresIn: '12h' },
      );
      await manager.save(saved);

      // Increment sold count
      tt.sold_count += dto.quantity;
      await manager.save(tt);

      // Auto sold-out check
      const allTypes = await manager.find(TicketType, { where: { event_id: eventId } });
      const allSoldOut = allTypes.every((t) => t.sold_count >= t.total_inventory);
      if (allSoldOut) {
        await manager.update(Event, eventId, { is_sold_out: true });
      }

      return {
        ticket: saved,
        message: 'Din biljett sparas direkt i din Plånbok',
      };
    });
  }

  async checkin(eventId: string, qrToken: string, scannerId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Verify QR JWT
    let payload: { ticket_id: string; user_id: string; event_id: string };
    try {
      payload = this.jwtService.verify(qrToken, { secret: event.qr_secret });
    } catch {
      throw new BadRequestException('Invalid or expired QR code');
    }

    if (payload.event_id !== eventId) {
      throw new BadRequestException('QR code does not match this event');
    }

    const ticket = await this.ticketRepo.findOne({
      where: { id: payload.ticket_id },
      relations: ['user'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === ('used' as any)) {
      throw new ConflictException(`Already checked in at ${ticket.checked_in_at}`);
    }

    // Mark as used
    ticket.status = 'used' as any;
    ticket.checked_in_at = new Date();
    await this.ticketRepo.save(ticket);

    // Create check-in record
    await this.checkinRepo.save({
      user_id: ticket.user_id,
      event_id: eventId,
      venue_id: event.venue_id,
    });

    // Get updated stats
    const totalTickets = await this.ticketRepo.count({ where: { event_id: eventId } });
    const checkedIn = await this.ticketRepo.count({ where: { event_id: eventId, status: 'used' as any } });

    return {
      success: true,
      check_in: {
        id: ticket.id,
        user: {
          display_name: ticket.user.display_name,
          avatar_url: ticket.user.avatar_url,
          id_code: `#${ticket.code.slice(-5)}`,
        },
        ticket: { type: 'Standardbiljett', status: 'used' },
        checked_in_at: ticket.checked_in_at,
      },
      event_stats: {
        checked_in: checkedIn,
        remaining: totalTickets - checkedIn,
        total_tickets: totalTickets,
        percentage: totalTickets > 0 ? Math.round((checkedIn / totalTickets) * 100) : 0,
      },
    };
  }

  async searchGuests(eventId: string, query: string) {
    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'u')
      .leftJoinAndSelect('t.ticket_type', 'tt')
      .where('t.event_id = :eventId', { eventId });

    if (query) {
      qb.andWhere('(u.display_name ILIKE :q OR t.code ILIKE :q)', { q: `%${query}%` });
    }
    qb.take(20);
    return qb.getMany();
  }

  private generateCode(): string {
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  }
}
