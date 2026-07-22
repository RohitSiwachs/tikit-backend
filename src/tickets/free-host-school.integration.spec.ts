/**
 * Integration tests for freeForHostSchool ticket eligibility.
 * Run against a real PostgreSQL instance — do NOT use mocks.
 *
 * Run with: TEST_DATABASE_URL=<url> npx jest free-host-school.integration
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
} from '../test/db-helpers';

const mockEmailsService = {
  sendTicketReceiptEmail: jest.fn().mockResolvedValue(undefined),
};

jest.setTimeout(30000);

describe('freeForHostSchool (integration)', () => {
  let service: TicketsService;
  let hostSchool: any;
  let externalSchool: any;
  let event: any;
  let hostStudent: any;
  let externalStudent: any;

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
    hostSchool = await createTestSchool({ name: 'Host School' });
    externalSchool = await createTestSchool({ name: 'External School' });
    hostStudent = await createTestUser(hostSchool, {
      displayName: 'Host Student',
    });
    externalStudent = await createTestUser(externalSchool, {
      displayName: 'External Student',
    });
    event = await createTestEvent(hostSchool, { eventType: 'INTERNAL' });
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  // ─── Case 1: Host-school student + freeForHostSchool=true ──────────────────

  it('Case 1: host-school student CAN claim a ticket with freeForHostSchool=true', async () => {
    const ticketType = await createTestTicketType(event, {
      name: 'Standard Admission',
      price: 200,
      freeForHostSchool: true,
      quantityTotal: 10,
      quantityRemaining: 10,
    });

    const ticket = await service.claimFreeTicket(
      hostStudent.id,
      event.id,
      ticketType.id,
      hostStudent.schoolId,
    );

    expect(ticket).toBeDefined();
    expect(ticket.id).toBeDefined();
    expect(ticket.status).toBe('ISSUED');
    expect(ticket.userId).toBe(hostStudent.id);
    expect(ticket.ticketTypeId).toBe(ticketType.id);
  });

  // ─── Case 2: Host-school student + freeForHostSchool=false ─────────────────

  it('Case 2: host-school student CANNOT free-claim a ticket with freeForHostSchool=false', async () => {
    const ticketType = await createTestTicketType(event, {
      name: 'VIP Backstage',
      price: 500,
      freeForHostSchool: false,
      quantityTotal: 10,
      quantityRemaining: 10,
    });

    await expect(
      service.claimFreeTicket(
        hostStudent.id,
        event.id,
        ticketType.id,
        hostStudent.schoolId,
      ),
    ).rejects.toThrow(/not available for free claim/i);
  });

  // ─── Case 3: External student + freeForHostSchool=true ─────────────────────

  it('Case 3: external student CANNOT claim internally even with freeForHostSchool=true', async () => {
    const ticketType = await createTestTicketType(event, {
      name: 'Early Bird',
      price: 100,
      freeForHostSchool: true,
      quantityTotal: 10,
      quantityRemaining: 10,
    });

    await expect(
      service.claimFreeTicket(
        externalStudent.id,
        event.id,
        ticketType.id,
        externalStudent.schoolId,
      ),
    ).rejects.toThrow(/not available for free claim/i);
  });

  // ─── Case 4: External student + freeForHostSchool=false ────────────────────

  it('Case 4: external student CANNOT claim internally with freeForHostSchool=false', async () => {
    const ticketType = await createTestTicketType(event, {
      name: 'VIP',
      price: 500,
      freeForHostSchool: false,
      quantityTotal: 10,
      quantityRemaining: 10,
    });

    await expect(
      service.claimFreeTicket(
        externalStudent.id,
        event.id,
        ticketType.id,
        externalStudent.schoolId,
      ),
    ).rejects.toThrow(/not available for free claim/i);
  });

  // ─── Case 5: Inventory decrement still works ──────────────────────────────

  it('Case 5: inventory decrements correctly after free host-school claim', async () => {
    const ticketType = await createTestTicketType(event, {
      name: 'Standard',
      price: 150,
      freeForHostSchool: true,
      quantityTotal: 5,
      quantityRemaining: 5,
    });

    await service.claimFreeTicket(
      hostStudent.id,
      event.id,
      ticketType.id,
      hostStudent.schoolId,
    );

    const freshType = await testPrisma.ticketType.findUnique({
      where: { id: ticketType.id },
    });
    expect(freshType?.quantityRemaining).toBe(4); // 5 - 1
  });

  // ─── Case 6: QR generation still works ────────────────────────────────────

  it('Case 6: QR token is generated correctly for freeForHostSchool ticket', async () => {
    const ticketType = await createTestTicketType(event, {
      name: 'Standard',
      price: 150,
      freeForHostSchool: true,
      quantityTotal: 10,
      quantityRemaining: 10,
    });

    const ticket = await service.claimFreeTicket(
      hostStudent.id,
      event.id,
      ticketType.id,
      hostStudent.schoolId,
    );

    expect(ticket.qrToken).toBeDefined();
    expect(ticket.qrToken).toMatch(/^qr_/); // Must start with qr_ prefix
    expect(ticket.code).toBeDefined();
    expect(ticket.code.length).toBeGreaterThan(0);
  });

  // ─── Case 7: Guest list still works ───────────────────────────────────────

  it('Case 7: free host-school ticket appears in guest list', async () => {
    const ticketType = await createTestTicketType(event, {
      name: 'Standard',
      price: 150,
      freeForHostSchool: true,
      quantityTotal: 10,
      quantityRemaining: 10,
    });

    await service.claimFreeTicket(
      hostStudent.id,
      event.id,
      ticketType.id,
      hostStudent.schoolId,
    );

    const tickets = await testPrisma.ticket.findMany({
      where: { eventId: event.id },
      include: { user: { select: { id: true, displayName: true } } },
    });

    expect(tickets).toHaveLength(1);
    expect(tickets[0].userId).toBe(hostStudent.id);
    expect(tickets[0].user.displayName).toBe('Host Student');
  });

  // ─── Case 8: Scanner validation still works ───────────────────────────────

  it('Case 8: scanner can validate a freeForHostSchool ticket via qrToken', async () => {
    const ticketType = await createTestTicketType(event, {
      name: 'Standard',
      price: 150,
      freeForHostSchool: true,
      quantityTotal: 10,
      quantityRemaining: 10,
    });

    const ticket = await service.claimFreeTicket(
      hostStudent.id,
      event.id,
      ticketType.id,
      hostStudent.schoolId,
    );

    // Verify the ticket can be found by qrToken (scanner lookup)
    const scanned = await testPrisma.ticket.findUnique({
      where: { qrToken: ticket.qrToken },
      include: { event: true, ticketType: { select: { name: true } } },
    });

    expect(scanned).toBeDefined();
    expect(scanned?.id).toBe(ticket.id);
    expect(scanned?.status).toBe('ISSUED');
    expect(scanned?.event.id).toBe(event.id);
  });

  // ─── Backward compat: price=0 tickets remain claimable ────────────────────

  it('price=0 ticket with freeForHostSchool=false is still claimable (backward compat)', async () => {
    const ticketType = await createTestTicketType(event, {
      name: 'Free Entry',
      price: 0,
      freeForHostSchool: false,
      quantityTotal: 10,
      quantityRemaining: 10,
    });

    const ticket = await service.claimFreeTicket(
      hostStudent.id,
      event.id,
      ticketType.id,
      hostStudent.schoolId,
    );

    expect(ticket).toBeDefined();
    expect(ticket.status).toBe('ISSUED');
  });
});
