import { Test, TestingModule } from '@nestjs/testing';
import { SegmentsService } from './segments.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: { findMany: jest.fn() },
  segment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('SegmentsService', () => {
  let service: SegmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SegmentsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SegmentsService>(SegmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
