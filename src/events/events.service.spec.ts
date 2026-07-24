import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

const mockPrisma = {
  event: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  ticketType: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  ticket: { findMany: jest.fn(), count: jest.fn() },
  eventLike: { create: jest.fn(), delete: jest.fn(), findFirst: jest.fn() },
  eventComment: { create: jest.fn(), findMany: jest.fn() },
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPattern: jest.fn() } },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
