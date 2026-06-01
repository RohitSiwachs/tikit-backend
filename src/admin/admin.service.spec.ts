import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  school: { count: jest.fn() },
  user: { count: jest.fn() },
  event: { count: jest.fn() },
  card: { count: jest.fn() },
  ticket: { count: jest.fn() },
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStats', () => {
    it('should return dashboard statistics', async () => {
      mockPrisma.school.count.mockResolvedValue(5);
      mockPrisma.user.count.mockResolvedValue(120);
      mockPrisma.event.count.mockResolvedValue(8);
      mockPrisma.card.count.mockResolvedValue(30);
      mockPrisma.ticket.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(45);

      const result = await service.getStats();

      expect(result.totalSchools).toBe(5);
      expect(result.totalStudents).toBe(120);
      expect(result.upcomingEvents).toBe(8);
      expect(result.activeCards).toBe(30);
      expect(result.checkinRate).toBe(45);
    });

    it('should return 0 checkinRate when no tickets exist', async () => {
      mockPrisma.school.count.mockResolvedValue(0);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.event.count.mockResolvedValue(0);
      mockPrisma.card.count.mockResolvedValue(0);
      mockPrisma.ticket.count.mockResolvedValue(0);

      const result = await service.getStats();

      expect(result.checkinRate).toBe(0);
    });
  });
});
