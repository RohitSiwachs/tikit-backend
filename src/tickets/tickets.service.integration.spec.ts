/**
 * Integration tests for TicketsService.
 * Run against a real PostgreSQL instance — do NOT use mocks.
 *
 * Critical tests: concurrent ticket claims (inventory race) and voidTicket
 * capacity restoration logic.
 *
 * Run with: TEST_DATABASE_URL=<url> npx jest tickets.service.integration
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailsService } from '../emails/emails.service';
import {
  testPrisma,
  cleanDatabase,
  createTestSchool,
  createTestUser,
  createTestEvent,
  createTestTicketType,
  createTestTicket,
} from '../test/db-helpers';

const mockEmailsService = {
  sendTicketReceiptEmail: jest.fn().mockResolvedValue(undefined),
};

// Render Singapore latency + cleanDatabase sequential deletes
jest.setTimeout(30000);

describe('TicketsService (integration)', () => {
  let service: TicketsService;
  let school: any;
  let event: any;
  let user: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: testPrisma },
        { provide: EmailsService, useValue: mockEmailsService },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    await testPrisma.$connect();
  });

  beforeEach(async () => {
    await cleanDatabase();
    school = await createTestSchool();
    user = await createTestUser(school);
    event = await createTestEvent(school);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  // ─── claimFreeTicket — concurrent claims ─────────────────────────────────────

  it('concurrent claims for 1 remaining ticket produce exactly ONE success', async () => {
    const ticketType = await createTestTicketType(event, {
      quantityTotal: 1,
      quantityRemaining: 1,
    });

    // 5 different users all try to claim the last ticket simultaneously
    const users = await Promise.all(
      Array.from({ length: 5 }).map(() => createTestUser(school)),
    );

    const results = await Promise.allSettled(
      users.map((u) => service.claimFreeTicket(u.id, event.id, ticketType.id)),
    );

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(4);

    // DB must show exactly 1 ISSUED ticket and 0 remaining
    const tickets = await testPrisma.ticket.findMany({
      where: { eventId: event.id },
    });
    expect(tickets).toHaveLength(1);
    expect(tickets[0].status).toBe('ISSUED');

    const freshType = await testPrisma.ticketType.findUnique({
      where: { id: ticketType.id },
    });
    expect(freshType?.quantityRemaining).toBe(0);
    expect(freshType?.isSoldOut).toBe(true);
  });

  it('prevents duplicate ticket for the same user+event', async () => {
    const ticketType = await createTestTicketType(event, {
      quantityTotal: 5,
      quantityRemaining: 5,
    });

    await service.claimFreeTicket(user.id, event.id, ticketType.id);
    await expect(
      service.claimFreeTicket(user.id, event.id, ticketType.id),
    ).rejects.toThrow(/already have a ticket/i);
  });

  it('rejects claim when tickets are sold out', async () => {
    const ticketType = await createTestTicketType(event, {
      quantityTotal: 1,
      quantityRemaining: 0,
      isSoldOut: true,
    });
    await expect(
      service.claimFreeTicket(user.id, event.id, ticketType.id),
    ).rejects.toThrow(/sold out/i);
  });

  // ─── voidTicket — capacity restoration ───────────────────────────────────────

  it('voidTicket on ISSUED ticket restores quantityRemaining', async () => {
    const ticketType = await createTestTicketType(event, {
      quantityTotal: 10,
      quantityRemaining: 7,
    });
    const ticket = await createTestTicket(user, event, ticketType, {
      status: 'ISSUED',
    });

    await service.voidTicket(ticket.id);

    const dbTicket = await testPrisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(dbTicket?.status).toBe('VOID');

    const freshType = await testPrisma.ticketType.findUnique({
      where: { id: ticketType.id },
    });
    expect(freshType?.quantityRemaining).toBe(8); // 7 + 1
    expect(freshType?.isSoldOut).toBe(false);
  });

  it('voidTicket on CHECKED_IN ticket does NOT restore quantityRemaining', async () => {
    const ticketType = await createTestTicketType(event, {
      quantityTotal: 10,
      quantityRemaining: 5,
    });
    const ticket = await createTestTicket(user, event, ticketType, {
      status: 'CHECKED_IN',
      checkedInAt: new Date(),
    });

    await service.voidTicket(ticket.id);

    const dbTicket = await testPrisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(dbTicket?.status).toBe('VOID');

    const freshType = await testPrisma.ticketType.findUnique({
      where: { id: ticketType.id },
    });
    expect(freshType?.quantityRemaining).toBe(5); // unchanged — ticket was already consumed
  });

  it('voidTicket throws when ticket is already VOID', async () => {
    const ticketType = await createTestTicketType(event);
    const ticket = await createTestTicket(user, event, ticketType, {
      status: 'VOID',
    });

    await expect(service.voidTicket(ticket.id)).rejects.toThrow(
      /already voided/i,
    );
  });

  it('voidTicket throws for unknown ticket id', async () => {
    await expect(service.voidTicket('nonexistent-id')).rejects.toThrow(
      /not found/i,
    );
  });

  // ─── cancelTicket ─────────────────────────────────────────────────────────────

  it('cancelTicket restores quantityRemaining and marks ticket VOID', async () => {
    const ticketType = await createTestTicketType(event, {
      quantityTotal: 10,
      quantityRemaining: 4,
    });
    await createTestTicket(user, event, ticketType, { status: 'ISSUED' });

    await service.cancelTicket(user.id, event.id);

    const tickets = await testPrisma.ticket.findMany({
      where: { userId: user.id, eventId: event.id },
    });
    expect(tickets[0].status).toBe('VOID');

    const freshType = await testPrisma.ticketType.findUnique({
      where: { id: ticketType.id },
    });
    expect(freshType?.quantityRemaining).toBe(5); // 4 + 1
    expect(freshType?.isSoldOut).toBe(false);
  });

  it('cancelTicket throws when trying to cancel a CHECKED_IN ticket', async () => {
    const ticketType = await createTestTicketType(event);
    await createTestTicket(user, event, ticketType, {
      status: 'CHECKED_IN',
      checkedInAt: new Date(),
    });

    await expect(service.cancelTicket(user.id, event.id)).rejects.toThrow(
      /already been used/i,
    );
  });

  it('cancelTicket throws when no ticket exists', async () => {
    await expect(service.cancelTicket(user.id, event.id)).rejects.toThrow(
      /no ticket found/i,
    );
  });
});
