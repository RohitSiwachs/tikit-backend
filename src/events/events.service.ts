import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto, UpdateEventDto, CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEventDto) {
    const { ticketTypes, ...eventData } = dto;
    return this.prisma.event.create({
      data: {
        ...eventData,
        startsAt: new Date(eventData.startsAt),
        endsAt: new Date(eventData.endsAt),
        ticketTypes: {
          create: ticketTypes.map((tt) => ({
            ...tt,
            quantityRemaining: tt.quantityTotal,
          })),
        },
      },
      include: {
        ticketTypes: true,
      },
    });
  }

  async findAll(query: {
    schoolId?: string;
    isPublished?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { schoolId, isPublished, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (isPublished !== undefined) where.isPublished = isPublished;

    const [total, data] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        include: {
          school: { select: { name: true } },
          _count: { select: { tickets: true } },
        },
        orderBy: { startsAt: 'asc' },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        ticketTypes: true,
        school: true,
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return event;
  }

  async update(id: string, dto: UpdateEventDto) {
    const { ticketTypes, ...updateData } = dto;
    
    const data: any = { ...updateData };
    if (updateData.startsAt) data.startsAt = new Date(updateData.startsAt);
    if (updateData.endsAt) data.endsAt = new Date(updateData.endsAt);

    return this.prisma.event.update({
      where: { id },
      data,
    });
  }

  async getAttendees(id: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { eventId: id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return tickets.map((t) => ({
      ...t.user,
      ticketId: t.id,
      ticketStatus: t.status,
      checkedInAt: t.checkedInAt,
    }));
  }

  async remove(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return this.prisma.event.delete({
      where: { id },
    });
  }

  async createTicketType(eventId: string, dto: CreateTicketTypeDto) {
    return this.prisma.ticketType.create({
      data: {
        ...dto,
        eventId,
        quantityRemaining: dto.quantityTotal,
      },
    });
  }

  async updateTicketType(ticketTypeId: string, dto: UpdateTicketTypeDto) {
    return this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: dto,
    });
  }

  async removeTicketType(ticketTypeId: string) {
    return this.prisma.ticketType.delete({
      where: { id: ticketTypeId },
    });
  }
}
