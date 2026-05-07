import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Event } from '../entities/event.entity.js';
import { TicketType } from '../entities/ticket-type.entity.js';
import { Venue } from '../entities/venue.entity.js';
import { Ticket } from '../entities/ticket.entity.js';
import { CreateEventDto } from './dto/create-event.dto.js';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(TicketType) private readonly ttRepo: Repository<TicketType>,
    @InjectRepository(Venue) private readonly venueRepo: Repository<Venue>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async create(dto: CreateEventDto, userId: string, schoolId: string) {
    // Create or find venue
    let venue: Venue | null = null;
    if (dto.venue) {
      venue = this.venueRepo.create({
        name: dto.venue.name,
        address: dto.venue.address,
        location:
          dto.venue.latitude && dto.venue.longitude
            ? { type: 'Point', coordinates: [dto.venue.longitude, dto.venue.latitude] }
            : undefined,
      });
      venue = await this.venueRepo.save(venue);
    }

    const event = this.eventRepo.create({
      title: dto.title,
      description: dto.description,
      cover_image_url: dto.cover_image_url,
      event_type: dto.event_type,
      category: dto.category,
      starts_at: new Date(dto.starts_at),
      ends_at: new Date(dto.ends_at),
      is_draft: dto.is_draft ?? false,
      linked_card_id: dto.linked_card_id,
      school_id: schoolId,
      created_by: userId,
      venue_id: venue?.id,
      qr_secret: crypto.randomBytes(32).toString('hex'),
    });

    const saved = await this.eventRepo.save(event);

    // Create ticket types
    if (dto.ticket_types?.length) {
      const types = dto.ticket_types.map((tt) =>
        this.ttRepo.create({ ...tt, event_id: saved.id }),
      );
      await this.ttRepo.save(types);
    }

    return this.findOne(saved.id);
  }

  async findAll(query: {
    category?: string;
    school_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.venue', 'v')
      .leftJoinAndSelect('e.school', 's')
      .leftJoinAndSelect('e.ticket_types', 'tt')
      .where('e.is_draft = false');

    if (query.category && query.category !== 'all') {
      qb.andWhere('e.category = :category', { category: query.category });
    }
    if (query.school_id) {
      qb.andWhere('e.school_id = :schoolId', { schoolId: query.school_id });
    }
    if (query.status === 'upcoming') {
      qb.andWhere('e.ends_at > NOW()');
    } else if (query.status === 'past') {
      qb.andWhere('e.ends_at <= NOW()');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.orderBy('e.starts_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: { page, total_pages: Math.ceil(total / limit), total_count: total },
    };
  }

  async findOne(id: string) {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['venue', 'school', 'ticket_types', 'creator'],
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async toggleSoldOut(id: string, isSoldOut: boolean) {
    await this.eventRepo.update(id, { is_sold_out: isSoldOut });
    return this.findOne(id);
  }

  async getCheckinStats(eventId: string) {
    const event = await this.findOne(eventId);
    const totalTickets = await this.ticketRepo.count({ where: { event_id: eventId } });
    const checkedIn = await this.ticketRepo.count({
      where: { event_id: eventId, status: 'used' as any },
    });
    return {
      checked_in: checkedIn,
      remaining: totalTickets - checkedIn,
      total_tickets: totalTickets,
      percentage: totalTickets > 0 ? Math.round((checkedIn / totalTickets) * 100) : 0,
    };
  }
}
