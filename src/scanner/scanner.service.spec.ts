import { Test, TestingModule } from '@nestjs/testing';
import { ScannerService } from './scanner.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';

const mockPrisma = {
  ticket: { findFirst: jest.fn(), update: jest.fn() },
  cardCode: { findFirst: jest.fn(), update: jest.fn() },
};
const mockEventsGateway = {
  emitToSchool: jest.fn(),
  server: { to: jest.fn() },
};

describe('ScannerService', () => {
  let service: ScannerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScannerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockEventsGateway },
      ],
    }).compile();

    service = module.get<ScannerService>(ScannerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
