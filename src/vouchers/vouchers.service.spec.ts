import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  event: { findUnique: jest.fn() },
  ticketType: { findUnique: jest.fn(), update: jest.fn() },
  voucher: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  ticket: { create: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(),
};

const baseEvent = { id: 'event-1', title: 'Test Event' };
const baseTicketType = { id: 'tt-1', eventId: 'event-1', quantityRemaining: 10, isSoldOut: false };
const baseVoucher = {
  id: 'v-1', code: 'VCH-ABC123', isUsed: false, expiresAt: null,
  assignedToId: null, eventId: 'event-1', ticketTypeId: 'tt-1',
};

describe('VouchersService', () => {
  let service: VouchersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VouchersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<VouchersService>(VouchersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── create ────────────────────────────────────────────────

  describe('create', () => {
    const dto = { eventId: 'event-1', ticketTypeId: 'tt-1' };

    it('throws NotFoundException when event does not exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null);
      mockPrisma.ticketType.findUnique.mockResolvedValue(baseTicketType);

      await expect(service.create(dto as any, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when ticket type does not exist', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(baseEvent);
      mockPrisma.ticketType.findUnique.mockResolvedValue(null);

      await expect(service.create(dto as any, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when ticket type does not belong to event', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(baseEvent);
      mockPrisma.ticketType.findUnique.mockResolvedValue({ ...baseTicketType, eventId: 'other-event' });

      await expect(service.create(dto as any, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('creates a voucher with a generated code when inputs are valid', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(baseEvent);
      mockPrisma.ticketType.findUnique.mockResolvedValue(baseTicketType);
      mockPrisma.voucher.create.mockResolvedValue({ ...baseVoucher });

      const result = await service.create(dto as any, 'user-1');

      expect(mockPrisma.voucher.create).toHaveBeenCalledTimes(1);
      const createArg = mockPrisma.voucher.create.mock.calls[0][0].data;
      expect(createArg.code).toMatch(/^VCH-[A-F0-9]+$/);
      expect(result).toEqual(baseVoucher);
    });
  });

  // ── redeem ────────────────────────────────────────────────

  describe('redeem', () => {
    it('throws NotFoundException when voucher code does not exist', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue(null);

      await expect(service.redeem({ code: 'BAD-CODE' }, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when voucher is already used', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue({ ...baseVoucher, isUsed: true });

      await expect(service.redeem({ code: 'VCH-ABC123' }, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when voucher is expired', async () => {
      const past = new Date(Date.now() - 1000);
      mockPrisma.voucher.findUnique.mockResolvedValue({ ...baseVoucher, expiresAt: past });

      await expect(service.redeem({ code: 'VCH-ABC123' }, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when voucher is assigned to a different user', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue({ ...baseVoucher, assignedToId: 'other-user' });

      await expect(service.redeem({ code: 'VCH-ABC123' }, 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── findAll ───────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all vouchers when no eventId filter is given', async () => {
      mockPrisma.voucher.findMany.mockResolvedValue([baseVoucher]);

      const result = await service.findAll();

      expect(mockPrisma.voucher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result).toHaveLength(1);
    });

    it('filters by eventId when provided', async () => {
      mockPrisma.voucher.findMany.mockResolvedValue([baseVoucher]);

      await service.findAll('event-1');

      expect(mockPrisma.voucher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: 'event-1' } }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when voucher id does not exist', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns voucher when found', async () => {
      mockPrisma.voucher.findUnique.mockResolvedValue(baseVoucher);

      const result = await service.findOne('v-1');

      expect(result).toEqual(baseVoucher);
    });
  });
});
