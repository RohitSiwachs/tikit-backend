import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateQrToken,
  generateTicketCode,
} from '../tickets/tickets.service';
import {
  CreateEventDto,
  UpdateEventDto,
  CreateTicketTypeDto,
  UpdateTicketTypeDto,
} from './dto/create-event.dto';
import { CacheService } from '../cache/cache.service';
import { CK, TTL } from '../cache/cache-keys';
import { generateFormattedCode } from '../common/utils/code-generator';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async create(dto: CreateEventDto, requestingSchoolId?: string | null) {
    // Non-admin users can only create events for their own school
    if (
      requestingSchoolId &&
      dto.schoolId &&
      dto.schoolId !== requestingSchoolId
    ) {
      throw new ForbiddenException(
        'You can only create events for your own school',
      );
    }
    const {
      ticketTypes,
      connectedSchools,
      scheduledAt: scheduledAtStr,
      ...eventData
    } = dto;

    // Validate scheduledAt if provided
    let scheduledAt: Date | undefined;
    if (scheduledAtStr) {
      scheduledAt = new Date(scheduledAtStr);
      if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        throw new BadRequestException(
          'scheduledAt must be a valid date in the future',
        );
      }
    }

    // Internal events: all ticket types are always free
    const normalizedTicketTypes = ticketTypes.map((tt) =>
      dto.eventType === 'INTERNAL'
        ? { ...tt, price: 0, priceDisplay: 'Free' }
        : { ...tt, price: tt.price ?? 0 },
    );

    // Validate cards if provided
    if (dto.linkedCardIds?.length) {
      const validCardsCount = await this.prisma.card.count({
        where: { id: { in: dto.linkedCardIds } },
      });
      if (validCardsCount !== dto.linkedCardIds.length) {
        throw new BadRequestException('One or more linkedCardIds are invalid');
      }
    }

    const event = await this.prisma.event.create({
      data: {
        ...eventData,
        id: generateFormattedCode(),
        startsAt: new Date(eventData.startsAt),
        endsAt: new Date(eventData.endsAt),
        scheduledAt: scheduledAt ?? null,
        postedBySuperAdmin: requestingSchoolId === null,
        status: scheduledAt ? 'scheduled' : (eventData.status ?? 'draft'),
        connectedSchools: connectedSchools
          ? { connect: connectedSchools.map((id) => ({ id })) }
          : undefined,
        connectionStates: connectedSchools
          ? { create: connectedSchools.map((id) => ({ schoolId: id })) }
          : undefined,
        ticketTypes: {
          create: normalizedTicketTypes.map((tt) => ({
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

    // Invalidate all event list caches — new event changes every list variant
    await this.cache.delByPattern('events:list:*');

    return event;
  }

  async findAll(query: {
    schoolId?: string;
    isPublished?: boolean;
    page?: number;
    limit?: number;
    requestingUser?: { id?: string; schoolId?: string; role?: string };
  }) {
    const cacheKey = CK.eventsList(query);
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const {
      schoolId,
      isPublished,
      page = 1,
      limit = 10,
      requestingUser,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (schoolId) {
      where.OR = [
        { schoolId },
        { connectedSchools: { some: { id: schoolId } } },
      ];
    }
    if (isPublished !== undefined) where.isPublished = isPublished;

    // Visibility rules for students:
    // 1. INTERNAL events only visible to same-school students; EXTERNAL visible to all.
    // 2. Scheduled-but-not-yet-due events are hidden.
    // 3. Card-restricted events are hidden unless the student holds one of the linked cards.
    if (requestingUser?.role === 'STUDENT' && requestingUser?.schoolId) {
      const studentCardIds = requestingUser.id
        ? (
            await this.prisma.cardCode.findMany({
              where: { userId: requestingUser.id },
              select: { cardId: true },
            })
          ).map((c) => c.cardId)
        : [];

      where.AND = [
        // School / event-type visibility
        {
          OR: [
            { eventType: 'EXTERNAL' },
            { eventType: 'INTERNAL', schoolId: requestingUser.schoolId },
            {
              eventType: 'INTERNAL',
              connectedSchools: { some: { id: requestingUser.schoolId } },
              // Connected school must have published their side
              connectionStates: {
                some: {
                  schoolId: requestingUser.schoolId,
                  isPublished: true,
                },
              },
            },
          ],
        },
        // Scheduled visibility
        {
          OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
        },
        // Card restriction: unrestricted events OR events whose required cards the student holds
        {
          OR: [
            { restrictToCardHolders: false },
            ...(studentCardIds.length > 0
              ? [
                  {
                    restrictToCardHolders: true,
                    linkedCardIds: { hasSome: studentCardIds },
                  },
                ]
              : []),
          ],
        },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        include: {
          school: { select: { name: true } },
          connectionStates: true,
          _count: { select: { tickets: true } },
        },
        orderBy: { startsAt: 'asc' },
      }),
    ]);

    // Enrich each event with the connected school's own publish state + ticket count
    const enriched = data.map((ev: any) => {
      const { connectionStates, ...rest } = ev;
      if (requestingUser?.schoolId && requestingUser.schoolId !== ev.schoolId) {
        const cs = connectionStates?.find(
          (s: any) => s.schoolId === requestingUser.schoolId,
        );
        if (cs) {
          return {
            ...rest,
            viewerRelation: 'connected',
            connectionPublished: cs.isPublished,
            connectionPublishedAt: cs.publishedAt,
          };
        }
      }
      return { ...rest, viewerRelation: 'host' };
    });

    const result = {
      data: enriched,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cache.set(cacheKey, result, TTL.EVENTS_LIST);
    return result;
  }

  async findOne(id: string, requestingUserId?: string) {
    // Fetch the base event (school + ticketTypes + aggregate counts) from cache.
    // User-specific fields (hasLiked, userTicket, friendsAttending) are always
    // resolved fresh — they are cheap indexed lookups.
    const cachedEvent = await this.cache.get<any>(CK.eventBase(id));

    // Fan out ALL queries in parallel in a single DB round-trip.
    // When the event is cached we skip its query entirely.
    const [freshEvent, requestingUser, likeRecord, ticketRecord] =
      await Promise.all([
        // Base event — skipped on cache hit
        cachedEvent
          ? Promise.resolve(null)
          : this.prisma.event.findUnique({
              where: { id },
              include: {
                school: { select: { id: true, name: true, logoUrl: true } },
                ticketTypes: {
                  include: { connectionState: { select: { schoolId: true } } },
                },
                connectedSchools: {
                  select: { id: true, name: true, logoUrl: true },
                },
                connectionRequests: {
                  select: {
                    id: true,
                    requestingSchoolId: true,
                    status: true,
                    requestingSchool: { select: { name: true } },
                  },
                },
                connectionStates: true,
                _count: {
                  select: { tickets: true, likes: true, comments: true },
                },
              },
            }),

        // Requesting user's school/role + following list (for friendsAttending)
        requestingUserId
          ? this.prisma.user.findUnique({
              where: { id: requestingUserId },
              select: {
                schoolId: true,
                role: true,
                following: { select: { id: true } },
              },
            })
          : Promise.resolve(null),

        // Did this user like the event?
        requestingUserId
          ? this.prisma.eventLike.findFirst({
              where: { eventId: id, userId: requestingUserId },
            })
          : Promise.resolve(null),

        // Does this user hold a ticket?
        requestingUserId
          ? this.prisma.ticket.findFirst({
              where: { eventId: id, userId: requestingUserId },
              select: { id: true, status: true },
            })
          : Promise.resolve(null),
      ]);

    const event = cachedEvent ?? freshEvent;
    if (!event) throw new NotFoundException(`Event with ID ${id} not found`);

    // Populate cache on miss
    if (!cachedEvent && freshEvent) {
      await this.cache.set(CK.eventBase(id), freshEvent, TTL.EVENT_BASE);
    }

    if (requestingUserId && requestingUser) {
      // Access control: INTERNAL events are only visible to same-school students
      if (
        event.eventType === 'INTERNAL' &&
        requestingUser.role === 'STUDENT' &&
        requestingUser.schoolId !== event.schoolId &&
        !event.connectedSchools?.some((cs) => cs.id === requestingUser.schoolId)
      ) {
        throw new ForbiddenException(
          'This event is not available for your school',
        );
      }

      // Card restriction: if enabled, student must hold one of the linked cards
      if (event.restrictToCardHolders && requestingUser.role === 'STUDENT') {
        const holdsCard = await this.prisma.cardCode.findFirst({
          where: {
            userId: requestingUserId,
            cardId: { in: event.linkedCardIds },
          },
        });
        if (!holdsCard) {
          throw new ForbiddenException(
            'This event requires a specific card to access',
          );
        }
      }
    }

    // Friends attending — only if caller is authenticated and follows someone
    let friendsAttending: any[] = [];
    if (requestingUserId && requestingUser) {
      const followingIds = requestingUser.following.map((f: any) => f.id);
      if (followingIds.length > 0) {
        const friendTickets = await this.prisma.ticket.findMany({
          where: { eventId: id, userId: { in: followingIds } },
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } },
          },
        });
        friendsAttending = friendTickets.map((t) => t.user);
      }
    }

    // Determine viewer relation and filter ticket types
    let viewerRelation = 'host';
    let connectionState: any = null;
    let filteredTicketTypes = event.ticketTypes;

    if (requestingUser && requestingUser.schoolId !== event.schoolId) {
      const cs = event.connectionStates?.find(
        (s: any) => s.schoolId === requestingUser.schoolId,
      );
      if (cs) {
        viewerRelation = 'connected';
        connectionState = cs;
        // Show only this connected school's ticket types
        filteredTicketTypes = event.ticketTypes.filter(
          (tt: any) => tt.connectionState?.schoolId === requestingUser.schoolId,
        );
      }
    } else {
      // Host: show only host ticket types (connectionStateId is null)
      filteredTicketTypes = event.ticketTypes.filter(
        (tt: any) => !tt.connectionStateId,
      );
    }

    const totalCapacity = filteredTicketTypes.reduce(
      (acc: number, tt: any) => acc + tt.quantityTotal,
      0,
    );
    const soldTickets = filteredTicketTypes.reduce(
      (acc: number, tt: any) => acc + (tt.quantityTotal - tt.quantityRemaining),
      0,
    );

    const { _count, connectionStates, ...rest } = event as any;

    return {
      ...rest,
      ticketTypes: filteredTicketTypes,
      viewerRelation,
      ...(connectionState
        ? {
            connectionPublished: connectionState.isPublished,
            connectionPublishedAt: connectionState.publishedAt,
          }
        : {}),
      stats: {
        totalCapacity,
        soldTickets,
        attendees: _count.tickets,
        likes: _count.likes,
        comments: _count.comments,
      },
      hasLiked: requestingUserId ? !!likeRecord : null,
      userTicket: ticketRecord ?? null,
      friendsAttending,
    };
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    requestingSchoolId?: string | null,
  ) {
    await this.assertSchoolOwnership(id, requestingSchoolId ?? null);
    const {
      ticketTypes,
      connectedSchools,
      scheduledAt: scheduledAtStr,
      ...updateData
    } = dto;

    // Validate cards if provided
    if (updateData.linkedCardIds?.length) {
      const validCardsCount = await this.prisma.card.count({
        where: { id: { in: updateData.linkedCardIds } },
      });
      if (validCardsCount !== updateData.linkedCardIds.length) {
        throw new BadRequestException('One or more linkedCardIds are invalid');
      }
    }

    const data: any = { ...updateData };
    if (updateData.startsAt) data.startsAt = new Date(updateData.startsAt);
    if (updateData.endsAt) data.endsAt = new Date(updateData.endsAt);

    // Handle scheduledAt update
    if (scheduledAtStr !== undefined) {
      if (scheduledAtStr === null) {
        // Clear scheduling
        data.scheduledAt = null;
        // If the event was in scheduled status, revert to draft
        const currentEvent = await this.prisma.event.findUnique({
          where: { id },
          select: { status: true },
        });
        if (currentEvent?.status === 'scheduled') {
          data.status = 'draft';
        }
      } else {
        const scheduledAt = new Date(scheduledAtStr);
        if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
          throw new BadRequestException(
            'scheduledAt must be a valid date in the future',
          );
        }
        data.scheduledAt = scheduledAt;
        data.status = 'scheduled';
      }
    }

    if (connectedSchools) {
      data.connectedSchools = {
        set: connectedSchools.map((schoolId) => ({ id: schoolId })),
      };
    }

    const event = await this.prisma.event.update({
      where: { id },
      data,
      include: {
        connectedSchools: true,
      },
    });

    if (connectedSchools) {
      // Sync EventConnectionStates for the newly set connectedSchools
      await Promise.all(
        connectedSchools.map((schoolId) =>
          this.prisma.eventConnectionState.upsert({
            where: { eventId_schoolId: { eventId: id, schoolId } },
            create: { eventId: id, schoolId },
            update: {},
          }),
        ),
      );
      // Remove connection states for schools that are no longer connected
      await this.prisma.eventConnectionState.deleteMany({
        where: {
          eventId: id,
          schoolId: { notIn: connectedSchools },
        },
      });
    }

    await this.invalidateEventCaches(id);
    return event;
  }

  async getAttendees(
    id: string,
    callerRole: string,
    query?: { search?: string; status?: string; page?: number; limit?: number },
  ) {
    const isPrivileged = [
      'TIKIT_ADMIN',
      'SCHOOL_ADMIN',
      'SCHOOL_ADMIN',
      'EVENTANSVARIG',
    ].includes(callerRole);

    const search = query?.search;
    const status = query?.status;
    const page = query?.page ? parseInt(query.page as any) : 1;
    const limit = query?.limit ? parseInt(query.limit as any) : 50;
    const skip = (page - 1) * limit;

    const where: any = { eventId: id };

    if (status && isPrivileged) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        ...(isPrivileged
          ? [{ code: { contains: search, mode: 'insensitive' } }]
          : []),
        {
          user: {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              ...(isPrivileged
                ? [{ email: { contains: search, mode: 'insensitive' } }]
                : []),
            ],
          },
        },
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
              avatarUrl: true,
              ...(isPrivileged && { email: true, age: true }),
            },
          },
        },
        orderBy: { user: { displayName: 'asc' } },
      }),
    ]);

    const attendees = isPrivileged
      ? tickets.map((t) => ({
          id: t.user.id,
          displayName: t.user.displayName,
          firstName: t.user.firstName,
          lastName: t.user.lastName,
          avatarUrl: t.user.avatarUrl,
          email: (t.user as any).email,
          age: (t.user as any).age,
          ticketId: t.id,
          ticketCode: t.code,
          ticketStatus: t.status,
          ticketTypeName: t.ticketType?.name,
          checkedInAt: t.checkedInAt,
        }))
      : tickets.map((t) => ({
          id: t.user.id,
          displayName: t.user.displayName,
          avatarUrl: t.user.avatarUrl,
        }));

    return {
      data: attendees,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async remove(id: string, requestingSchoolId?: string | null) {
    await this.assertSchoolOwnership(id, requestingSchoolId ?? null);
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    const result = await this.prisma.event.delete({ where: { id } });
    await this.invalidateEventCaches(id);
    return result;
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

    const {
      id: oldId,
      createdAt,
      ticketTypes,
      connectedSchools,
      ...eventData
    } = eventToDuplicate;

    const event = await this.prisma.event.create({
      data: {
        ...eventData,
        id: generateFormattedCode(),
        title: `${eventData.title} (Copy)`,
        isPublished: false,
        status: 'draft',
        connectedSchools: {
          connect: connectedSchools.map((s) => ({ id: s.id })),
        },
        ticketTypes: {
          create: ticketTypes.map((tt) => {
            const { id: oldTtId, eventId, isSoldOut, ...ttData } = tt;
            // Internal events: enforce free pricing on the duplicate too
            const normalized =
              eventData.eventType === 'INTERNAL'
                ? {
                    ...ttData,
                    price: 0,
                    priceDisplay: 'Free',
                  }
                : ttData;
            return {
              ...normalized,
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

    await this.cache.delByPattern('events:list:*');
    return event;
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
    if (event.isCancelled)
      throw new BadRequestException('Cannot publish a cancelled event');

    // If event has a future scheduledAt, set status to 'scheduled' instead of immediate publish
    const result = await this.prisma.event.update({
      where: { id },
      data:
        event.scheduledAt && new Date(event.scheduledAt) > new Date()
          ? { status: 'scheduled' }
          : { isPublished: true, status: 'published', scheduledAt: null },
    });

    await this.invalidateEventCaches(id);
    return result;
  }

  async unpublishEvent(id: string) {
    return this.update(id, { isPublished: false, status: 'draft' } as any);
  }

  async cancelEvent(id: string, requestingSchoolId?: string | null) {
    await this.assertSchoolOwnership(id, requestingSchoolId ?? null);
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException(`Event with ID ${id} not found`);
    if (event.isCancelled)
      throw new BadRequestException('Event is already cancelled');
    const result = await this.prisma.event.update({
      where: { id },
      data: { isCancelled: true, isPublished: false, status: 'cancelled' },
    });
    await this.invalidateEventCaches(id);
    return result;
  }

  private async assertSchoolOwnership(
    eventId: string,
    requestingSchoolId: string | null,
  ) {
    if (!requestingSchoolId) return; // TIKIT_ADMIN has no schoolId — always allowed
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { schoolId: true },
    });
    if (event && event.schoolId !== requestingSchoolId) {
      throw new ForbiddenException(
        'You can only manage events belonging to your school',
      );
    }
  }

  /** Invalidate the base event cache entry + every list cache. */
  private async invalidateEventCaches(id: string) {
    await Promise.all([
      this.cache.del(CK.eventBase(id)),
      this.cache.delByPattern('events:list:*'),
    ]);
  }

  async createTicketType(
    eventId: string,
    dto: CreateTicketTypeDto,
    requestingSchoolId?: string | null,
  ) {
    await this.assertSchoolOwnership(eventId, requestingSchoolId ?? null);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { eventType: true },
    });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    // Internal events: price is always 0 regardless of what the caller sends
    const data =
      event.eventType === 'INTERNAL'
        ? { ...dto, price: 0, priceDisplay: 'Free' }
        : { ...dto, price: dto.price ?? 0 };

    const ticketType = await this.prisma.ticketType.create({
      data: {
        ...data,
        eventId,
        quantityRemaining: dto.quantityTotal,
      },
    });

    // TicketType changes affect event detail (capacity stats)
    await this.invalidateEventCaches(eventId);
    return ticketType;
  }

  async updateTicketType(
    ticketTypeId: string,
    dto: UpdateTicketTypeDto,
    requestingSchoolId?: string | null,
  ) {
    const tt = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      select: { eventId: true, event: { select: { eventType: true } } },
    });
    if (tt)
      await this.assertSchoolOwnership(tt.eventId, requestingSchoolId ?? null);

    // Internal events: freeForHostSchool must always remain true
    const data =
      tt?.event.eventType === 'INTERNAL'
        ? { ...dto, freeForHostSchool: true }
        : dto;

    const result = await this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data,
    });

    if (tt) await this.invalidateEventCaches(tt.eventId);
    return result;
  }

  async removeTicketType(
    eventId: string,
    ticketTypeId: string,
    requestingSchoolId?: string | null,
  ) {
    await this.assertSchoolOwnership(eventId, requestingSchoolId ?? null);
    const result = await this.prisma.ticketType.delete({
      where: { id: ticketTypeId },
    });
    await this.invalidateEventCaches(eventId);
    return result;
  }

  async markTicketTypeSoldOut(
    eventId: string,
    ticketTypeId: string,
    isSoldOut: boolean,
    requestingSchoolId?: string | null,
  ) {
    await this.assertSchoolOwnership(eventId, requestingSchoolId ?? null);
    const tt = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
    });
    if (!tt || tt.eventId !== eventId)
      throw new NotFoundException('Ticket type not found for this event');

    const result = await this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: { isSoldOut },
    });

    await this.invalidateEventCaches(eventId);
    return result;
  }

  // --- EVENT DETAIL FLOW ---

  async likeEvent(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event)
      throw new NotFoundException(`Event with ID ${eventId} not found`);

    const existing = await this.prisma.eventLike.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (existing) {
      await this.prisma.eventLike.delete({
        where: { eventId_userId: { eventId, userId } },
      });
      // Invalidate base event so _count.likes is refreshed on next fetch
      await this.cache.del(CK.eventBase(eventId));
      return { message: 'Unliked', liked: false };
    }

    await this.prisma.eventLike.create({ data: { eventId, userId } });
    await this.cache.del(CK.eventBase(eventId));
    return { message: 'Liked', liked: true };
  }

  async addComment(eventId: string, userId: string, body: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event)
      throw new NotFoundException(`Event with ID ${eventId} not found`);

    const comment = await this.prisma.eventComment.create({
      data: { eventId, userId, body },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Invalidate base event so _count.comments is refreshed on next fetch
    await this.cache.del(CK.eventBase(eventId));
    return comment;
  }

  async getComments(eventId: string) {
    return this.prisma.eventComment.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async rsvp(eventId: string, userId: string) {
    return this.fetchFreeTicket(eventId, userId);
  }

  async cancelRsvp(eventId: string, userId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { userId, eventId },
    });
    if (!ticket) throw new NotFoundException('No ticket found for this event');
    if (ticket.status === 'CHECKED_IN') {
      throw new BadRequestException(
        'Cannot cancel a ticket that has already been used',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: 'VOID' },
      });
      await tx.ticketType.update({
        where: { id: ticket.ticketTypeId },
        data: { quantityRemaining: { increment: 1 }, isSoldOut: false },
      });
    });

    // Ticket count changed — invalidate event base cache
    await this.cache.del(CK.eventBase(eventId));
    return { message: 'RSVP cancelled and capacity restored' };
  }

  async fetchFreeTicket(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        ticketTypes: {
          include: { connectionState: { select: { schoolId: true } } },
        },
        connectedSchools: { select: { id: true } },
        connectionStates: true,
      },
    });

    if (!event)
      throw new NotFoundException(`Event with ID ${eventId} not found`);

    if (event.eventType !== 'INTERNAL') {
      throw new BadRequestException(
        'Free tickets can only be fetched for internal events. External events redirect to ticket provider.',
      );
    }

    // School restriction: student must be from the host school or an approved connected school
    const student = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true, role: true },
    });
    const isHostStudent = student?.schoolId === event.schoolId;
    const isConnectedStudent =
      student?.schoolId &&
      event.connectedSchools.some((cs) => cs.id === student.schoolId);

    if (student?.role === 'STUDENT' && !isHostStudent && !isConnectedStudent) {
      throw new ForbiddenException(
        'This event is only available for students of the organizing or connected schools',
      );
    }

    // Card restriction: student must hold one of the linked cards
    if (
      event.restrictToCardHolders &&
      event.linkedCardIds.length > 0 &&
      student?.role === 'STUDENT'
    ) {
      const holdsCard = await this.prisma.cardCode.findFirst({
        where: { userId, cardId: { in: event.linkedCardIds } },
      });
      if (!holdsCard) {
        throw new ForbiddenException(
          'This event requires a specific card to access',
        );
      }
    }

    // Filter ticket types: host students get host tickets, connected students get their school's tickets
    let eligibleTicketTypes = event.ticketTypes;
    if (isConnectedStudent && student?.schoolId) {
      eligibleTicketTypes = event.ticketTypes.filter(
        (tt) => tt.connectionState?.schoolId === student.schoolId,
      );
    } else {
      // Host student: only host ticket types (connectionStateId is null)
      eligibleTicketTypes = event.ticketTypes.filter(
        (tt) => !tt.connectionStateId,
      );
    }

    // All internal event tickets are free — find the first available type
    const availableTicketType = eligibleTicketTypes.find(
      (tt) => tt.quantityRemaining > 0 && !tt.isSoldOut,
    );
    if (!availableTicketType)
      throw new BadRequestException('No tickets are available for this event');

    const ticket = await this.prisma.$transaction(async (tx) => {
      // Re-read inside transaction for consistent inventory state
      const freshType = await tx.ticketType.findUnique({
        where: { id: availableTicketType.id },
      });
      if (
        !freshType ||
        freshType.isSoldOut ||
        freshType.quantityRemaining <= 0
      ) {
        throw new BadRequestException('Tickets are sold out');
      }

      // Duplicate check — DB @@unique([userId, eventId]) is the final guard
      const existing = await tx.ticket.findFirst({
        where: { userId, eventId },
      });
      if (existing)
        throw new ConflictException('You already have a ticket for this event');

      const updated = await tx.ticketType.update({
        where: { id: availableTicketType.id },
        data: { quantityRemaining: { decrement: 1 } },
      });

      if (updated.quantityRemaining === 0) {
        await tx.ticketType.update({
          where: { id: availableTicketType.id },
          data: { isSoldOut: true },
        });
      }

      return tx.ticket.create({
        data: {
          userId,
          eventId,
          ticketTypeId: availableTicketType.id,
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

    // Inventory changed — invalidate event base cache
    await this.cache.del(CK.eventBase(eventId));
    return { message: 'Ticket issued and saved to Wallet', ticket };
  }

  async getExternalLink(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event)
      throw new NotFoundException(`Event with ID ${eventId} not found`);

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
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    if (event.schoolId === requestingSchoolId) {
      throw new BadRequestException(
        'School cannot request connection to its own event',
      );
    }

    const existingRequest = await this.prisma.eventConnectionRequest.findFirst({
      where: {
        eventId,
        requestingSchoolId,
        status: { in: ['pending', 'approved'] },
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        `Connection request already exists with status: ${existingRequest.status}`,
      );
    }

    return this.prisma.eventConnectionRequest.create({
      data: {
        eventId,
        requestingSchoolId,
      },
    });
  }

  async getConnectionRequests(eventId: string) {
    return this.prisma.eventConnectionRequest.findMany({
      where: { eventId },
      include: {
        requestingSchool: { select: { name: true, slug: true } },
      },
    });
  }

  async respondToConnectionRequest(requestId: string, status: string) {
    const allowed = ['approved', 'rejected'] as const;
    if (!allowed.includes(status as any)) {
      throw new BadRequestException(
        `Invalid status "${status}". Must be one of: ${allowed.join(', ')}`,
      );
    }

    const request = await this.prisma.eventConnectionRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException(
        `Connection request with ID ${requestId} not found`,
      );
    }

    if (status === 'approved') {
      // Connect the school to the event
      await this.prisma.event.update({
        where: { id: request.eventId },
        data: {
          connectedSchools: {
            connect: { id: request.requestingSchoolId },
          },
        },
      });

      // Create an EventConnectionState for this school (idempotent via upsert)
      await this.prisma.eventConnectionState.upsert({
        where: {
          eventId_schoolId: {
            eventId: request.eventId,
            schoolId: request.requestingSchoolId,
          },
        },
        create: {
          eventId: request.eventId,
          schoolId: request.requestingSchoolId,
        },
        update: {}, // no-op if already exists
      });

      // Invalidate event base cache since connectedSchools changed
      await this.invalidateEventCaches(request.eventId);
    } else if (status === 'rejected') {
      // If they were previously connected, we might want to disconnect them, but here we just update request status
      // We could add disconnect logic if needed.
    }

    return this.prisma.eventConnectionRequest.update({
      where: { id: requestId },
      data: { status },
    });
  }

  // --- CONNECTED SCHOOL MANAGEMENT ---

  /**
   * Resolves the EventConnectionState for a connected school,
   * verifying the requesting school matches.
   */
  private async getConnectionState(eventId: string, schoolId: string) {
    const state = await this.prisma.eventConnectionState.findUnique({
      where: { eventId_schoolId: { eventId, schoolId } },
    });
    if (!state) {
      throw new NotFoundException(
        'No connection state found — this school is not connected to this event',
      );
    }
    return state;
  }

  async createConnectionTicketType(
    eventId: string,
    schoolId: string,
    dto: CreateTicketTypeDto,
    requestingSchoolId?: string | null,
  ) {
    // Only the connected school (or TIKIT_ADMIN) can add their own ticket types
    if (requestingSchoolId && requestingSchoolId !== schoolId) {
      throw new ForbiddenException(
        'You can only manage ticket types for your own school connection',
      );
    }

    const connectionState = await this.getConnectionState(eventId, schoolId);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { eventType: true },
    });
    if (!event) throw new NotFoundException(`Event ${eventId} not found`);

    // Internal events: price is always 0
    const data =
      event.eventType === 'INTERNAL'
        ? { ...dto, price: 0, priceDisplay: 'Free' }
        : { ...dto, price: dto.price ?? 0 };

    const ticketType = await this.prisma.ticketType.create({
      data: {
        ...data,
        eventId,
        connectionStateId: connectionState.id,
        quantityRemaining: dto.quantityTotal,
      },
    });

    await this.invalidateEventCaches(eventId);
    return ticketType;
  }

  async updateConnectionTicketType(
    eventId: string,
    schoolId: string,
    ticketTypeId: string,
    dto: UpdateTicketTypeDto,
    requestingSchoolId?: string | null,
  ) {
    if (requestingSchoolId && requestingSchoolId !== schoolId) {
      throw new ForbiddenException(
        'You can only manage ticket types for your own school connection',
      );
    }

    const connectionState = await this.getConnectionState(eventId, schoolId);

    const tt = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      select: {
        eventId: true,
        connectionStateId: true,
        event: { select: { eventType: true } },
      },
    });
    if (!tt || tt.eventId !== eventId) {
      throw new NotFoundException('Ticket type not found for this event');
    }
    if (tt.connectionStateId !== connectionState.id) {
      throw new ForbiddenException(
        'This ticket type does not belong to your school connection',
      );
    }

    const result = await this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: dto,
    });

    await this.invalidateEventCaches(eventId);
    return result;
  }

  async removeConnectionTicketType(
    eventId: string,
    schoolId: string,
    ticketTypeId: string,
    requestingSchoolId?: string | null,
  ) {
    if (requestingSchoolId && requestingSchoolId !== schoolId) {
      throw new ForbiddenException(
        'You can only manage ticket types for your own school connection',
      );
    }

    const connectionState = await this.getConnectionState(eventId, schoolId);

    const tt = await this.prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      select: { eventId: true, connectionStateId: true },
    });
    if (!tt || tt.eventId !== eventId) {
      throw new NotFoundException('Ticket type not found for this event');
    }
    if (tt.connectionStateId !== connectionState.id) {
      throw new ForbiddenException(
        'This ticket type does not belong to your school connection',
      );
    }

    const result = await this.prisma.ticketType.delete({
      where: { id: ticketTypeId },
    });

    await this.invalidateEventCaches(eventId);
    return result;
  }

  async publishConnection(
    eventId: string,
    schoolId: string,
    requestingSchoolId?: string | null,
  ) {
    if (requestingSchoolId && requestingSchoolId !== schoolId) {
      throw new ForbiddenException(
        'You can only publish your own school connection',
      );
    }

    await this.getConnectionState(eventId, schoolId);

    const result = await this.prisma.eventConnectionState.update({
      where: { eventId_schoolId: { eventId, schoolId } },
      data: { isPublished: true, publishedAt: new Date() },
    });

    await this.invalidateEventCaches(eventId);
    return result;
  }

  async unpublishConnection(
    eventId: string,
    schoolId: string,
    requestingSchoolId?: string | null,
  ) {
    if (requestingSchoolId && requestingSchoolId !== schoolId) {
      throw new ForbiddenException(
        'You can only unpublish your own school connection',
      );
    }

    await this.getConnectionState(eventId, schoolId);

    const result = await this.prisma.eventConnectionState.update({
      where: { eventId_schoolId: { eventId, schoolId } },
      data: { isPublished: false, publishedAt: null },
    });

    await this.invalidateEventCaches(eventId);
    return result;
  }
}
