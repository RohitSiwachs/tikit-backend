/**
 * Integration tests: External events must never create TiKit tickets.
 *
 * Business rule: External events are always handled by the external ticket provider.
 * No TiKit ticket, wallet entry, or QR code should ever be created for an external event.
 *
 * Run with: TEST_DATABASE_URL=<url> npx jest external-event-block.integration
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailsService } from '../emails/emails.service';
import {
  testPrisma,
  cleanDatabase,
  createTestSchool,
  createTestUser,
  createTestEvent,
  createTestTicketType,
} from '../test/db-helpers';
import * as crypto from 'crypto';
import { generateQrToken, generateTicketCode } from './tickets.service';

const mockEmailsService = {
  sendTicketReceiptEmail: jest.fn().mockResolvedValue(undefined),
};

jest.setTimeout(30000);

describe('External Event Blocking (integration)', () => {
  let ticketsService: TicketsService;
  let vouchersService: VouchersService;

  let school: any;
  let admin: any;
  let student: any;
  let internalEvent: any;
  let externalEvent: any;
  let internalTicketType: any;
  let externalTicketType: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        VouchersService,
        { provide: PrismaService, useValue: testPrisma },
        { provide: EmailsService, useValue: mockEmailsService },
      ],
    }).compile();

    ticketsService = module.get<TicketsService>(TicketsService);
    vouchersService = module.get<VouchersService>(VouchersService);
    await testPrisma.$connect();
  });

  beforeEach(async () => {
    await cleanDatabase();

    school = await createTestSchool({ name: 'Test School' });
    admin = await createTestUser(school, { role: 'KARORDFORANDE' });
    student = await createTestUser(school, { role: 'STUDENT' });

    internalEvent = await createTestEvent(school, { eventType: 'INTERNAL' });
    externalEvent = await createTestEvent(school, {
      eventType: 'EXTERNAL',
      externalBuyUrl: 'https://tickets.example.com/event/123',
    });

    internalTicketType = await createTestTicketType(internalEvent, {
      name: 'General Admission',
      price: 0,
      quantityTotal: 10,
      quantityRemaining: 10,
    });

    externalTicketType = await createTestTicketType(externalEvent, {
      name: 'General Admission',
      price: 0,
      quantityTotal: 10,
      quantityRemaining: 10,
    });

    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  // ─── INTERNAL EVENT — all paths must succeed ─────────────────────────────

  describe('INTERNAL event', () => {
    it('claimFreeTicket creates a ticket for an internal event', async () => {
      const ticket = await ticketsService.claimFreeTicket(
        student.id,
        internalEvent.id,
        internalTicketType.id,
      );

      expect(ticket.id).toBeDefined();
      expect(ticket.status).toBe('ISSUED');
      expect(ticket.eventId).toBe(internalEvent.id);
      expect(ticket.qrToken).toMatch(/^qr_/);

      const dbTicket = await testPrisma.ticket.findUnique({
        where: { id: ticket.id },
      });
      expect(dbTicket).not.toBeNull();
    });

    it('voucher creation succeeds for an internal event', async () => {
      const voucher = await vouchersService.create(
        { eventId: internalEvent.id, ticketTypeId: internalTicketType.id },
        admin.id,
      );

      expect(voucher.id).toBeDefined();
      expect(voucher.eventId).toBe(internalEvent.id);
      expect(voucher.code).toMatch(/^VCH-/);
    });

    it('voucher redemption creates a ticket for an internal event', async () => {
      const voucher = await vouchersService.create(
        { eventId: internalEvent.id, ticketTypeId: internalTicketType.id },
        admin.id,
      );

      const result = await vouchersService.redeem({ code: voucher.code }, student.id);

      expect(result.ticket).toBeDefined();
      expect(result.ticket.status).toBe('ISSUED');
      expect(result.ticket.eventId).toBe(internalEvent.id);
      expect(result.ticket.qrToken).toMatch(/^qr_/);

      const dbTicket = await testPrisma.ticket.findUnique({
        where: { id: result.ticket.id },
      });
      expect(dbTicket).not.toBeNull();
    });
  });

  // ─── EXTERNAL EVENT — all paths must be blocked ──────────────────────────

  describe('EXTERNAL event', () => {
    it('claimFreeTicket throws for an external event', async () => {
      await expect(
        ticketsService.claimFreeTicket(
          student.id,
          externalEvent.id,
          externalTicketType.id,
        ),
      ).rejects.toThrow(
        /purchased through the external ticket provider/i,
      );
    });

    it('claimFreeTicket creates NO ticket row for an external event', async () => {
      await expect(
        ticketsService.claimFreeTicket(
          student.id,
          externalEvent.id,
          externalTicketType.id,
        ),
      ).rejects.toThrow();

      const tickets = await testPrisma.ticket.findMany({
        where: { eventId: externalEvent.id },
      });
      expect(tickets).toHaveLength(0);
    });

    it('voucher creation throws for an external event', async () => {
      await expect(
        vouchersService.create(
          { eventId: externalEvent.id, ticketTypeId: externalTicketType.id },
          admin.id,
        ),
      ).rejects.toThrow(/cannot be created for external events/i);
    });

    it('voucher creation creates NO voucher row for an external event', async () => {
      await expect(
        vouchersService.create(
          { eventId: externalEvent.id, ticketTypeId: externalTicketType.id },
          admin.id,
        ),
      ).rejects.toThrow();

      const vouchers = await testPrisma.voucher.findMany({
        where: { eventId: externalEvent.id },
      });
      expect(vouchers).toHaveLength(0);
    });

    it('voucher redemption throws for an external event voucher', async () => {
      // Insert a voucher for the external event directly — bypasses the service
      // guard to simulate a pre-existing or migrated voucher.
      const rawVoucher = await testPrisma.voucher.create({
        data: {
          code: `VCH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
          eventId: externalEvent.id,
          ticketTypeId: externalTicketType.id,
          createdById: admin.id,
        },
      });

      await expect(
        vouchersService.redeem({ code: rawVoucher.code }, student.id),
      ).rejects.toThrow(
        /cannot be redeemed through TiKit/i,
      );
    });

    it('voucher redemption creates NO ticket row for an external event voucher', async () => {
      const rawVoucher = await testPrisma.voucher.create({
        data: {
          code: `VCH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
          eventId: externalEvent.id,
          ticketTypeId: externalTicketType.id,
          createdById: admin.id,
        },
      });

      await expect(
        vouchersService.redeem({ code: rawVoucher.code }, student.id),
      ).rejects.toThrow();

      const tickets = await testPrisma.ticket.findMany({
        where: { eventId: externalEvent.id },
      });
      expect(tickets).toHaveLength(0);
    });

    it('inventory is not decremented when claimFreeTicket is blocked for external event', async () => {
      await expect(
        ticketsService.claimFreeTicket(
          student.id,
          externalEvent.id,
          externalTicketType.id,
        ),
      ).rejects.toThrow();

      const tt = await testPrisma.ticketType.findUnique({
        where: { id: externalTicketType.id },
      });
      expect(tt?.quantityRemaining).toBe(10);
      expect(tt?.isSoldOut).toBe(false);
    });
  });
});
