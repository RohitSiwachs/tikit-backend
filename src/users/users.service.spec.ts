import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Prisma mock — every method used by assignCards() is listed here.
// ---------------------------------------------------------------------------
const mockPrisma = {
  card: { findUnique: jest.fn() },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  cardCode: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
  },
  followRequest: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
  // $transaction: immediately invoke the callback with the mock (no real DB)
  $transaction: jest.fn((cb) => cb(mockPrisma)),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeCard = (codeGenerationType: 'individual' | 'batch') => ({
  schoolId: 'school-1',
  codeGenerationType,
});

const makeUsers = (ids: string[]) =>
  ids.map((id) => ({ id, schoolId: 'school-1' }));

// ---------------------------------------------------------------------------
describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // =========================================================================
  // assignCards — individual mode
  // =========================================================================
  describe('assignCards() — individual card', () => {
    const cardId = 'card-individual-1';
    const userId = 'user-1';

    beforeEach(() => {
      mockPrisma.card.findUnique.mockResolvedValue(makeCard('individual'));
      mockPrisma.user.findMany.mockResolvedValue(makeUsers([userId]));
    });

    // ── Happy path ──────────────────────────────────────────────────────────
    it('should UPDATE the existing unused code — not create a new one (bug fix)', async () => {
      // No prior assignment for this user
      mockPrisma.cardCode.findMany.mockResolvedValue([]);
      // Pre-generated unused code exists on the card
      mockPrisma.cardCode.findFirst.mockResolvedValue({ id: 'code-existing-1' });
      mockPrisma.cardCode.update.mockResolvedValue({});

      const result = await service.assignCards(cardId, [userId]);

      // MUST NOT create any new CardCode rows
      expect(mockPrisma.cardCode.createMany).not.toHaveBeenCalled();

      // MUST update the existing pre-generated code
      expect(mockPrisma.cardCode.update).toHaveBeenCalledWith({
        where: { id: 'code-existing-1' },
        data: { userId, assignedAt: expect.any(Date) },
      });

      expect(result.assigned).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should skip a user who is already assigned the card', async () => {
      mockPrisma.cardCode.findMany.mockResolvedValue([{ userId }]);

      const result = await service.assignCards(cardId, [userId]);

      expect(mockPrisma.cardCode.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.cardCode.update).not.toHaveBeenCalled();
      expect(result.assigned).toBe(0);
      expect(result.skipped).toBe(1);
    });

    // ── Error cases ─────────────────────────────────────────────────────────
    it('should throw BadRequestException when no unused code exists on the card', async () => {
      mockPrisma.cardCode.findMany.mockResolvedValue([]);
      mockPrisma.cardCode.findFirst.mockResolvedValue(null); // pool exhausted

      await expect(service.assignCards(cardId, [userId])).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.cardCode.createMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the card does not exist', async () => {
      mockPrisma.card.findUnique.mockResolvedValue(null);

      await expect(service.assignCards(cardId, [userId])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when a user belongs to a different school', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: userId, schoolId: 'other-school' },
      ]);

      await expect(service.assignCards(cardId, [userId])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when a userId does not exist', async () => {
      // findMany returns fewer rows than requested — some IDs are invalid
      mockPrisma.user.findMany.mockResolvedValue([]);

      await expect(service.assignCards(cardId, [userId])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // =========================================================================
  // assignCards — batch mode
  // =========================================================================
  describe('assignCards() — batch card', () => {
    const cardId = 'card-batch-1';
    const userIds = ['user-a', 'user-b'];

    beforeEach(() => {
      mockPrisma.card.findUnique.mockResolvedValue(makeCard('batch'));
      mockPrisma.user.findMany.mockResolvedValue(makeUsers(userIds));
    });

    it('should assign pool codes to each user', async () => {
      mockPrisma.cardCode.count.mockResolvedValue(2);
      mockPrisma.cardCode.findMany.mockResolvedValue([]); // none pre-assigned
      mockPrisma.cardCode.findFirst
        .mockResolvedValueOnce({ id: 'pool-code-1' })
        .mockResolvedValueOnce({ id: 'pool-code-2' });
      mockPrisma.cardCode.update.mockResolvedValue({});

      const result = await service.assignCards(cardId, userIds);

      expect(mockPrisma.cardCode.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.cardCode.update).toHaveBeenCalledTimes(2);
      expect(result.assigned).toBe(2);
    });

    it('should throw BadRequestException when the pool is too small', async () => {
      mockPrisma.cardCode.count.mockResolvedValue(1); // only 1 available for 2 users
      mockPrisma.cardCode.findMany.mockResolvedValue([]);

      await expect(service.assignCards(cardId, userIds)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should skip already-assigned users and consume codes only for the rest', async () => {
      mockPrisma.cardCode.count.mockResolvedValue(1);
      mockPrisma.cardCode.findMany.mockResolvedValue([{ userId: 'user-a' }]); // user-a already assigned
      mockPrisma.cardCode.findFirst.mockResolvedValue({ id: 'pool-code-1' });
      mockPrisma.cardCode.update.mockResolvedValue({});

      const result = await service.assignCards(cardId, userIds);

      expect(mockPrisma.cardCode.update).toHaveBeenCalledTimes(1); // only user-b
      expect(result.assigned).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should return early with assigned=0 if all users already have the card', async () => {
      mockPrisma.cardCode.count.mockResolvedValue(0);
      mockPrisma.cardCode.findMany.mockResolvedValue([
        { userId: 'user-a' },
        { userId: 'user-b' },
      ]);

      const result = await service.assignCards(cardId, userIds);

      expect(result.assigned).toBe(0);
      expect(result.skipped).toBe(2);
      expect(mockPrisma.cardCode.update).not.toHaveBeenCalled();
    });
  });
});
