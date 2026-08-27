import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from './prisma/prisma.service';

const mockHealthCheckService = { check: jest.fn() };
const mockPrismaHealthIndicator = { pingCheck: jest.fn() };
const mockPrismaService = {};

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaHealthIndicator, useValue: mockPrismaHealthIndicator },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    jest.clearAllMocks();
  });

  describe('health', () => {
    it('should call health.check and return its result', async () => {
      const healthResult = {
        status: 'ok',
        info: { database: { status: 'up' } },
      };
      mockHealthCheckService.check.mockResolvedValue(healthResult);

      const result = await appController.checkHealth();

      expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);
      expect(result).toEqual(healthResult);
    });
  });
});
