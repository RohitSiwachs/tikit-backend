import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailsService } from '../emails/emails.service';
import { getQueueToken } from '@nestjs/bullmq';
import { CommunicationUsageService } from '../communication/communication-usage.service';

const mockPrisma = {
  campaign: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: { findMany: jest.fn() },
};
const mockEmailsService = { sendEmail: jest.fn() };
const mockQueue = { add: jest.fn() };

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailsService, useValue: mockEmailsService },
        { provide: CommunicationUsageService, useValue: { checkSmsLimit: jest.fn(), checkEmailLimit: jest.fn(), recordUsage: jest.fn() } },
        { provide: getQueueToken('campaigns'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
