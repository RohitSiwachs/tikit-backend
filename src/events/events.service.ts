import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto, UpdateEventDto, CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEventDto) {
    const { ticketTypes, connectedSchools, ...eventData } = dto;
    return this.prisma.event.create({
      data: {
        ...eventData,
        startsAt: new Date(eventData.startsAt),
        endsAt: new Date(eventData.endsAt),
        connectedSchools: connectedSchools
          ? { connect: connectedSchools.map((id) => ({ id })) }
          : undefined,
        ticketTypes: {
          create: ticketTypes.map((tt) => ({
            ...tt,
            quantityRemaining: tt.quantityTotal,
          })),
        },
      },
      include: {
        ticketTypes: true,
        connectedSchools: true,
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

  async findOne(id: string, requestingUserId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true, logoUrl: true } },
        ticketTypes: true,
        _count: {
          select: { tickets: true, likes: true, comments: true }
        },
        likes: requestingUserId ? { where: { userId: requestingUserId } } : false,
        tickets: requestingUserId
          ? {
              where: { userId: requestingUserId },
              select: { id: true, status: true }
            }
          : false,
      },
    });

    if (!event) throw new NotFoundException(`Event with ID ${id} not found`);

    const totalCapacity = event.ticketTypes.reduce((acc, tt) => acc + tt.quantityTotal, 0);
    const soldTickets = event.ticketTypes.reduce((acc, tt) => acc + (tt.quantityTotal - tt.quantityRemaining), 0);

    // Friends attending — only if caller is authenticated
    let friendsAttending: any[] = [];
    if (requestingUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { following: { select: { id: true } } }
      });
      if (user) {
        const followingIds = user.following.map(f => f.id);
        const friendTickets = await this.prisma.ticket.findMany({
          where: { eventId: id, userId: { in: followingIds } },
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        });
        friendsAttending = friendTickets.map(t => t.user);
      }
    }

    const { _count, likes, tickets, ...rest } = event as any;

    return {
      ...rest,
      stats: {
        totalCapacity,
        soldTickets,
        attendees: _count.tickets,
        likes: _count.likes,
        comments: _count.comments,
      },
      hasLiked: likes ? likes.length > 0 : null,
      userTicket: tickets?.[0] ?? null,
      friendsAttending,
    };
  }

  async update(id: string, dto: UpdateEventDto) {
    const { ticketTypes, connectedSchools, ...updateData } = dto;
    
    const data: any = { ...updateData };
    if (updateData.startsAt) data.startsAt = new Date(updateData.startsAt);
    if (updateData.endsAt) data.endsAt = new Date(updateData.endsAt);
    if (connectedSchools) {
      data.connectedSchools = {
        set: connectedSchools.map((schoolId) => ({ id: schoolId })),
      };
    }

    return this.prisma.event.update({
      where: { id },
      data,
      include: {
        connectedSchools: true,
      }
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

  async duplicateEvent(id: string) {
    const eventToDuplicate = await this.prisma.event.findUnique({
      where: { id },
      include: {
        ticketTypes: true,
        connectedSchools: true,
      },
    });

    if (!eventToDuplicate) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    const { id: oldId, createdAt, ticketTypes, connectedSchools, ...eventData } = eventToDuplicate;

    return this.prisma.event.create({
      data: {
        ...eventData,
        title: `${eventData.title} (Copy)`,
        isPublished: false,
        status: 'draft',
        connectedSchools: {
          connect: connectedSchools.map(s => ({ id: s.id })),
        },
        ticketTypes: {
          create: ticketTypes.map(tt => {
            const { id: oldTtId, eventId, isSoldOut, ...ttData } = tt;
            return {
              ...ttData,
              quantityRemaining: tt.quantityTotal,
            };
          }),
        },
      },
      include: {
        ticketTypes: true,
        connectedSchools: true,
      },
    });
  }

  async pinEvent(id: string) {
    return this.update(id, { isPinned: true } as any);
  }

  async unpinEvent(id: string) {
    return this.update(id, { isPinned: false } as any);
  }

  async unpublishEvent(id: string) {
    return this.update(id, { isPublished: false, status: 'draft' } as any);
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

  async removeTicketType(eventId: string, ticketTypeId: string) {
    return this.prisma.ticketType.delete({
      where: { id: ticketTypeId },
    });
  }

  // --- EVENT DETAIL FLOW ---

  async likeEvent(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException(`Event with ID ${eventId} not found`);

    const existing = await this.prisma.eventLike.findUnique({
      where: { eventId_userId: { eventId, userId } }
    });

    if (existing) {
      await this.prisma.eventLike.delete({ where: { eventId_userId: { eventId, userId } } });
      return { message: 'Unliked', liked: false };
    }

    await this.prisma.eventLike.create({ data: { eventId, userId } });
    return { message: 'Liked', liked: true };
  }

  async addComment(eventId: string, userId: string, body: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException(`Event with ID ${eventId} not found`);

    return this.prisma.eventComment.create({
      data: { eventId, userId, body },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } }
      }
    });
  }

  async getComments(eventId: string) {
    return this.prisma.eventComment.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async rsvp(eventId: string, userId: string) {
    // RSVP is equivalent to fetching a free ticket for internal events
    return this.fetchFreeTicket(eventId, userId);
  }

  async fetchFreeTicket(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { ticketTypes: true }
    });

    if (!event) throw new NotFoundException(`Event with ID ${eventId} not found`);

    if (event.eventType !== 'INTERNAL') {
      throw new BadRequestException('Free tickets can only be fetched for internal events. External events redirect to ticket provider.');
    }

    // Check if user already has a ticket
    const existingTicket = await this.prisma.ticket.findFirst({
      where: { eventId, userId }
    });
    if (existingTicket) throw new ConflictException('You already have a ticket for this event');

    // Find the first available free ticket type
    const freeTicketType = event.ticketTypes.find(tt => tt.price === 0 && tt.quantityRemaining > 0);
    if (!freeTicketType) throw new BadRequestException('No free tickets available for this event');

    const code = crypto.randomUUID().replace(/-/g, '').toUpperCase();
    const qrToken = crypto.randomUUID();

    const ticket = await this.prisma.$transaction(async (tx) => {
      // Decrement remaining quantity
      await tx.ticketType.update({
        where: { id: freeTicketType.id },
        data: { quantityRemaining: { decrement: 1 } }
      });

      return tx.ticket.create({
        data: {
          userId,
          eventId,
          ticketTypeId: freeTicketType.id,
          code,
          qrToken,
          status: 'ISSUED',
        },
        include: {
          event: { select: { title: true, startsAt: true, venueName: true } },
          user: { select: { displayName: true, email: true } }
        }
      });
    });

    return { message: 'Ticket issued and saved to Wallet', ticket };
  }

  async getExternalLink(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException(`Event with ID ${eventId} not found`);

    if (event.eventType !== 'EXTERNAL') {
      throw new BadRequestException('This is not an external event');
    }

    return {
      externalBuyUrl: event.externalBuyUrl,
      externalTicketStatus: event.externalTicketStatus,
    };
  }

  // --- MULTI-SCHOOL EVENT CONNECTIONS ---

  async requestConnection(eventId: string, requestingSchoolId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    if (event.schoolId === requestingSchoolId) {
      throw new Error('School cannot request connection to its own event');
    }

    const existingRequest = await this.prisma.eventConnectionRequest.findFirst({
      where: { eventId, requestingSchoolId, status: { in: ['pending', 'approved'] } }
    });

    if (existingRequest) {
      throw new Error(`Connection request already exists with status: ${existingRequest.status}`);
    }

    return this.prisma.eventConnectionRequest.create({
      data: {
        eventId,
        requestingSchoolId,
      }
    });
  }

  async getConnectionRequests(eventId: string) {
    return this.prisma.eventConnectionRequest.findMany({
      where: { eventId },
      include: {
        requestingSchool: { select: { name: true, slug: true } }
      }
    });
  }

  async respondToConnectionRequest(requestId: string, status: string) {
    const request = await this.prisma.eventConnectionRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException(`Connection request with ID ${requestId} not found`);
    }

    if (status === 'approved') {
      // Connect the school to the event
      await this.prisma.event.update({
        where: { id: request.eventId },
        data: {
          connectedSchools: {
            connect: { id: request.requestingSchoolId }
          }
        }
      });
    } else if (status === 'rejected') {
      // If they were previously connected, we might want to disconnect them, but here we just update request status
      // We could add disconnect logic if needed.
    }

    return this.prisma.eventConnectionRequest.update({
      where: { id: requestId },
      data: { status }
    });
  }
}
