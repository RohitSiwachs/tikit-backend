import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ForbiddenException } from '@nestjs/common';

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn(),
  del: jest.fn(),
  delByPattern: jest.fn(),
};

function buildMockPrisma(overrides: Record<string, any> = {}) {
  return {
    event: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    ticketType: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    ticket: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
    eventLike: { create: jest.fn(), delete: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    eventComment: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    cardCode: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    follow: { findMany: jest.fn().mockResolvedValue([]) },
    eventConnectionState: { findFirst: jest.fn().mockResolvedValue(null) },
    school: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: buildMockPrisma() },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Check 1: findAll – student list card filter ───────────────────────────
  describe('findAll – card-restricted event visibility (Check 1)', () => {
    const requestingUser = {
      id: 'student-1',
      role: 'STUDENT',
      schoolId: 'school-1',
    };

    it('should query cardCode with isUsed: true when fetching student card IDs', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.cardCode.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);
      mockPrisma.event.findMany.mockResolvedValue([]);

      const module = await Test.createTestingModule({
        providers: [
          EventsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CacheService, useValue: mockCache },
        ],
      }).compile();

      const svc = module.get<EventsService>(EventsService);
      await svc.findAll({ requestingUser });

      // cardCode.findMany MUST have been called with isUsed: true
      expect(mockPrisma.cardCode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'student-1',
            isUsed: true,
          }),
        }),
      );
    });

    it('should NOT query cardCode without isUsed: true (regression guard)', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.cardCode.findMany.mockResolvedValue([]);
      mockPrisma.event.count.mockResolvedValue(0);
      mockPrisma.event.findMany.mockResolvedValue([]);

      const module = await Test.createTestingModule({
        providers: [
          EventsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CacheService, useValue: mockCache },
        ],
      }).compile();

      const svc = module.get<EventsService>(EventsService);
      await svc.findAll({ requestingUser });

      // The call must NOT have been made with only userId (old buggy behaviour)
      const calls = mockPrisma.cardCode.findMany.mock.calls;
      for (const [args] of calls) {
        expect(args?.where).not.toEqual({ userId: 'student-1' });
      }
    });
  });

  // ── Check 2: findOne – card restriction access gate ───────────────────────
  describe('findOne – card-restriction access check (Check 2)', () => {
    const restrictedEvent = {
      id: 'event-1',
      title: 'VIP Event',
      schoolId: 'school-1',
      eventType: 'INTERNAL',
      restrictToCardHolders: true,
      linkedCardIds: ['card-1'],
      isPublished: true,
      isCancelled: false,
      deletedAt: null,
      status: 'active',
      ticketTypes: [],
      likes: [],
      comments: [],
      description: null,
      coverUrl: null,
      venueName: null,
      venueAddress: null,
      startsAt: new Date(),
      endsAt: new Date(),
      ageLimit: null,
      externalBuyUrl: null,
      externalTicketStatus: null,
      isPinned: false,
      sortOrder: 1,
      showImGoingButton: true,
      attendanceVisibility: 'school',
      externalPriceDisplay: null,
      scheduledAt: null,
      postedBySuperAdmin: false,
      _count: { tickets: 0, likes: 0, comments: 0 },
    };

    it('should call cardCode.findFirst with isUsed: true when checking card restriction', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.event.findUnique.mockResolvedValue(restrictedEvent);
      // Service internally fetches requestingUser via user.findUnique
      mockPrisma.user.findUnique.mockResolvedValue({
        schoolId: 'school-1',
        role: 'STUDENT',
        following: [],
      });
      // Student holds an ACTIVATED card → access granted
      mockPrisma.cardCode.findFirst.mockResolvedValue({ id: 'cc-1', isUsed: true });

      const module = await Test.createTestingModule({
        providers: [
          EventsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CacheService, useValue: mockCache },
        ],
      }).compile();

      const svc = module.get<EventsService>(EventsService);
      await svc.findOne('event-1', 'student-1');

      // cardCode.findFirst MUST be called with isUsed: true
      expect(mockPrisma.cardCode.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'student-1',
            cardId: { in: ['card-1'] },
            isUsed: true,
          }),
        }),
      );
    });

    it('should throw ForbiddenException if student only has an UNACTIVATED card (isUsed: false)', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.event.findUnique.mockResolvedValue(restrictedEvent);
      // Service internally fetches requestingUser via user.findUnique
      mockPrisma.user.findUnique.mockResolvedValue({
        schoolId: 'school-1',
        role: 'STUDENT',
        following: [],
      });
      // findFirst returns null because isUsed: true filter finds nothing (card not activated)
      mockPrisma.cardCode.findFirst.mockResolvedValue(null);

      const module = await Test.createTestingModule({
        providers: [
          EventsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CacheService, useValue: mockCache },
        ],
      }).compile();

      const svc = module.get<EventsService>(EventsService);

      await expect(svc.findOne('event-1', 'student-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── Event & TicketType Fields (Create / Update / Nested TicketTypes) ────────
  describe('Event and TicketType field handling', () => {
    it('create should persist latitude, longitude, placeId and ticketType sales dates, trackQuantity, status, label', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.event.create.mockImplementation((args) => Promise.resolve({ id: 'evt-created', ...args.data }));

      const module = await Test.createTestingModule({
        providers: [
          EventsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CacheService, useValue: mockCache },
        ],
      }).compile();

      const svc = module.get<EventsService>(EventsService);

      const createDto: any = {
        title: 'Festival 2026',
        eventType: 'EXTERNAL',
        schoolId: 'school-1',
        venueName: 'Arena',
        venueAddress: '123 Main St',
        latitude: 59.3293,
        longitude: 18.0686,
        placeId: 'place-abc-123',
        startsAt: '2026-10-01T18:00:00.000Z',
        endsAt: '2026-10-01T23:00:00.000Z',
        ticketTypes: [
          {
            name: 'Early Bird',
            price: 150,
            quantityTotal: 100,
            salesStartsAt: '2026-09-01T00:00:00.000Z',
            salesEndsAt: '2026-09-20T23:59:59.000Z',
            trackQuantity: true,
            status: 'available',
            label: 'sellingFast',
          },
        ],
      };

      await svc.create(createDto, 'school-1');

      expect(mockPrisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            latitude: 59.3293,
            longitude: 18.0686,
            placeId: 'place-abc-123',
            ticketTypes: {
              create: [
                expect.objectContaining({
                  name: 'Early Bird',
                  price: 150,
                  quantityTotal: 100,
                  quantityRemaining: 100,
                  salesStartsAt: new Date('2026-09-01T00:00:00.000Z'),
                  salesEndsAt: new Date('2026-09-20T23:59:59.000Z'),
                  trackQuantity: true,
                  status: 'available',
                  label: 'sellingFast',
                }),
              ],
            },
          }),
          include: expect.objectContaining({
            ticketTypes: true,
          }),
        }),
      );
    });

    it('update should update event fields and sync nested ticketTypes', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', schoolId: 'school-1', eventType: 'EXTERNAL' });
      mockPrisma.ticketType.findMany.mockResolvedValue([
        {
          id: 'tt-1',
          name: 'Old Ticket',
          quantityTotal: 50,
          quantityRemaining: 40,
          connectionStateId: null,
          _count: { tickets: 10, vouchers: 0 },
        },
      ]);
      mockPrisma.ticketType.update.mockResolvedValue({ id: 'tt-1' });
      mockPrisma.ticketType.create.mockResolvedValue({ id: 'tt-2' });
      mockPrisma.event.update.mockResolvedValue({ id: 'event-1' });

      const module = await Test.createTestingModule({
        providers: [
          EventsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CacheService, useValue: mockCache },
        ],
      }).compile();

      const svc = module.get<EventsService>(EventsService);

      await svc.update(
        'event-1',
        {
          latitude: 57.7089,
          longitude: 11.9746,
          placeId: 'place-gothenburg',
          ticketTypes: [
            {
              id: 'tt-1',
              name: 'Updated Ticket',
              quantityTotal: 80,
              salesStartsAt: '2026-09-10T00:00:00.000Z',
              trackQuantity: false,
              status: 'fewLeft',
              label: 'mostPopular',
            },
            {
              name: 'New VIP Ticket',
              quantityTotal: 20,
              price: 300,
              status: 'available',
            },
          ],
        },
        'school-1',
      );

      // Verify existing ticket type updated with recalculation of remaining
      expect(mockPrisma.ticketType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tt-1' },
          data: expect.objectContaining({
            name: 'Updated Ticket',
            quantityTotal: 80,
            quantityRemaining: 70, // 80 - (50 - 40)
            salesStartsAt: new Date('2026-09-10T00:00:00.000Z'),
            trackQuantity: false,
            status: 'fewLeft',
            label: 'mostPopular',
          }),
        }),
      );

      // Verify new ticket type created
      expect(mockPrisma.ticketType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New VIP Ticket',
            quantityTotal: 20,
            quantityRemaining: 20,
            price: 300,
            status: 'available',
          }),
        }),
      );

      // Verify event updated with coordinates and placeId
      expect(mockPrisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'event-1' },
          data: expect.objectContaining({
            latitude: 57.7089,
            longitude: 11.9746,
            placeId: 'place-gothenburg',
          }),
          include: expect.objectContaining({
            ticketTypes: true,
          }),
        }),
      );
    });

    it('updateTicketType should parse sales dates and update TicketType', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.ticketType.findUnique.mockResolvedValue({
        id: 'tt-1',
        eventId: 'event-1',
        event: { eventType: 'EXTERNAL' },
      });
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', schoolId: 'school-1' });
      mockPrisma.ticketType.update.mockResolvedValue({ id: 'tt-1' });

      const module = await Test.createTestingModule({
        providers: [
          EventsService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: CacheService, useValue: mockCache },
        ],
      }).compile();

      const svc = module.get<EventsService>(EventsService);

      await svc.updateTicketType(
        'tt-1',
        {
          salesStartsAt: '2026-09-01T10:00:00.000Z',
          salesEndsAt: '2026-09-15T18:00:00.000Z',
          status: 'fewLeft',
          label: 'sellingFast',
          trackQuantity: true,
        },
        'school-1',
      );

      expect(mockPrisma.ticketType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tt-1' },
          data: expect.objectContaining({
            salesStartsAt: new Date('2026-09-01T10:00:00.000Z'),
            salesEndsAt: new Date('2026-09-15T18:00:00.000Z'),
            status: 'fewLeft',
            label: 'sellingFast',
            trackQuantity: true,
          }),
        }),
      );
    });
  });
});
