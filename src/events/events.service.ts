import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { generateQrToken, generateTicketCode } from '../tickets/tickets.service';
import { CreateEventDto, UpdateEventDto, CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/create-event.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEventDto, requestingSchoolId?: string | null) {
    // Non-admin users can only create events for their own school
    if (requestingSchoolId && dto.schoolId && dto.schoolId !== requestingSchoolId) {
      throw new ForbiddenException('You can only create events for your own school');
    }
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

  async update(id: string, dto: UpdateEventDto, requestingSchoolId?: string | null) {
    await this.assertSchoolOwnership(id, requestingSchoolId ?? null);
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

  async getAttendees(
    id: string,
    query?: { search?: string; status?: string; page?: number; limit?: number }
  ) {
    const search = query?.search;
    const status = query?.status;
    const page = query?.page ? parseInt(query.page as any) : 1;
    const limit = query?.limit ? parseInt(query.limit as any) : 50;
    const skip = (page - 1) * limit;

    const where: any = { eventId: id };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ]
          }
        }
      ];
    }

    const [total, tickets] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        include: {
          ticketType: { select: { name: true } },
          user: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              age: true,
            },
          },
        },
        orderBy: { user: { displayName: 'asc' } }
      })
    ]);

    const attendees = tickets.map((t) => ({
      id: t.user.id,
      displayName: t.user.displayName,
      firstName: t.user.firstName,
      lastName: t.user.lastName,
      avatarUrl: t.user.avatarUrl,
      age: t.user.age,
      ticketId: t.id,
      ticketCode: t.code,
      ticketStatus: t.status,
      ticketTypeName: t.ticketType?.name,
      checkedInAt: t.checkedInAt,
    }));

    return {
      data: attendees,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  async remove(id: string, requestingSchoolId?: string | null) {
    await this.assertSchoolOwnership(id, requestingSchoolId ?? null);
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

  async publishEvent(id: string, requestingSchoolId?: string | null) {
    await this.assertSchoolOwnership(id, requestingSchoolId ?? null);
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException(`Event with ID ${id} not found`);
    if (event.isCancelled) throw new BadRequestException('Cannot publish a cancelled event');
    return this.prisma.event.update({
      where: { id },
      data: { isPublished: true, status: 'published' },
    });
  }

  async unpublishEvent(id: string) {
    return this.update(id, { isPublished: false, status: 'draft' } as any);
  }

  async cancelEvent(id: string, requestingSchoolId?: string | null) {
    await this.assertSchoolOwnership(id, requestingSchoolId ?? null);
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException(`Event with ID ${id} not found`);
    if (event.isCancelled) throw new BadRequestException('Event is already cancelled');
    return this.prisma.event.update({
      where: { id },
      data: { isCancelled: true, isPublished: false, status: 'cancelled' },
    });
  }

  private async assertSchoolOwnership(eventId: string, requestingSchoolId: string | null) {
    if (!requestingSchoolId) return; // TIKIT_ADMIN has no schoolId — always allowed
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { schoolId: true } });
    if (event && event.schoolId !== requestingSchoolId) {
      throw new ForbiddenException('You can only manage events belonging to your school');
    }
  }

  async createTicketType(eventId: string, dto: CreateTicketTypeDto, requestingSchoolId?: string | null) {
    await this.assertSchoolOwnership(eventId, requestingSchoolId ?? null);
    return this.prisma.ticketType.create({
      data: {
        ...dto,
        eventId,
        quantityRemaining: dto.quantityTotal,
      },
    });
  }

  async updateTicketType(ticketTypeId: string, dto: UpdateTicketTypeDto, requestingSchoolId?: string | null) {
    const tt = await this.prisma.ticketType.findUnique({ where: { id: ticketTypeId }, select: { eventId: true } });
    if (tt) await this.assertSchoolOwnership(tt.eventId, requestingSchoolId ?? null);
    return this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: dto,
    });
  }

  async removeTicketType(eventId: string, ticketTypeId: string, requestingSchoolId?: string | null) {
    await this.assertSchoolOwnership(eventId, requestingSchoolId ?? null);
    return this.prisma.ticketType.delete({
      where: { id: ticketTypeId },
    });
  }

  async markTicketTypeSoldOut(eventId: string, ticketTypeId: string, isSoldOut: boolean, requestingSchoolId?: string | null) {
    await this.assertSchoolOwnership(eventId, requestingSchoolId ?? null);
    const tt = await this.prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
    if (!tt || tt.eventId !== eventId) throw new NotFoundException('Ticket type not found for this event');

    return this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: { isSoldOut },
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

  async rsvp(eventId: string, userId: string, userSchoolId: string) {
    return this.fetchFreeTicket(eventId, userId, userSchoolId);
  }

  async cancelRsvp(eventId: string, userId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { userId, eventId } });
    if (!ticket) throw new NotFoundException('No ticket found for this event');
    if (ticket.status === 'CHECKED_IN') {
      throw new BadRequestException('Cannot cancel a ticket that has already been used');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: 'VOID' } });
      await tx.ticketType.update({
        where: { id: ticket.ticketTypeId },
        data: { quantityRemaining: { increment: 1 }, isSoldOut: false },
      });
    });

    return { message: 'RSVP cancelled and capacity restored' };
  }

  async fetchFreeTicket(eventId: string, userId: string, userSchoolId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { ticketTypes: true }
    });

    if (!event) throw new NotFoundException(`Event with ID ${eventId} not found`);

    if (event.eventType !== 'INTERNAL') {
      throw new BadRequestException('Free tickets can only be fetched for internal events. External events redirect to ticket provider.');
    }

    // Host-school check: user.schoolId must match event.schoolId
    const isHostSchoolStudent = userSchoolId && userSchoolId === event.schoolId;

    if (!isHostSchoolStudent) {
      throw new ForbiddenException('Only host-school students can claim free tickets for internal events');
    }

    // Find the first available ticket type marked free for host-school students
    const freeTicketType = event.ticketTypes.find(
      tt => tt.freeForHostSchool && tt.quantityRemaining > 0 && !tt.isSoldOut
    );
    if (!freeTicketType) throw new BadRequestException('No ticket types are available for free host-school claim');

    const ticket = await this.prisma.$transaction(async (tx) => {
      // Re-read inside transaction for consistent state
      const freshType = await tx.ticketType.findUnique({ where: { id: freeTicketType.id } });
      if (!freshType || freshType.isSoldOut || freshType.quantityRemaining <= 0) {
        throw new BadRequestException('Tickets are sold out');
      }

      // Duplicate check inside transaction — DB @@unique([userId, eventId]) is the final guard
      const existing = await tx.ticket.findFirst({ where: { userId, eventId } });
      if (existing) throw new ConflictException('You already have a ticket for this event');

      const updated = await tx.ticketType.update({
        where: { id: freeTicketType.id },
        data: { quantityRemaining: { decrement: 1 } },
      });

      if (updated.quantityRemaining === 0) {
        await tx.ticketType.update({ where: { id: freeTicketType.id }, data: { isSoldOut: true } });
      }

      return tx.ticket.create({
        data: {
          userId,
          eventId,
          ticketTypeId: freeTicketType.id,
          code: generateTicketCode(),
          qrToken: generateQrToken(),
          status: 'ISSUED',
        },
        include: {
          event: { select: { title: true, startsAt: true, venueName: true } },
          user: { select: { displayName: true, email: true } },
        },
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
      throw new BadRequestException('School cannot request connection to its own event');
    }

    const existingRequest = await this.prisma.eventConnectionRequest.findFirst({
      where: { eventId, requestingSchoolId, status: { in: ['pending', 'approved'] } }
    });

    if (existingRequest) {
      throw new BadRequestException(`Connection request already exists with status: ${existingRequest.status}`);
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
