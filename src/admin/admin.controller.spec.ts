import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

const mockAdminService = { getStats: jest.fn() };

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getStats should delegate to AdminService.getStats', async () => {
    const stats = { totalSchools: 3, totalStudents: 60, upcomingEvents: 2, activeCards: 10, checkinRate: 50 };
    mockAdminService.getStats.mockResolvedValue(stats);

    const result = await controller.getStats();

    expect(mockAdminService.getStats).toHaveBeenCalledTimes(1);
    expect(result).toEqual(stats);
  });
});
