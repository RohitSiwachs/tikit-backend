/**
 * Integration tests for ScannerService.
 * These tests run against a real PostgreSQL instance — do NOT use mocks.
 * The race condition test is the most important test in this codebase:
 * it verifies that concurrent scans of the same QR code produce exactly one check-in.
 *
 * Run with: TEST_DATABASE_URL=<url> npx jest scanner.service.integration
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ScannerService } from './scanner.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../gateway/events.gateway';
import {
  testPrisma,
  cleanDatabase,
  createTestSchool,
  createTestUser,
  createTestEvent,
  createTestTicketType,
  createTestTicket,
} from '../test/db-helpers';

// Minimal gateway mock — we don't test WebSocket behaviour here
const mockGateway = { emitCheckinUpdate: jest.fn() };

// Render Singapore latency + cleanDatabase sequential deletes
jest.setTimeout(30000);

describe('ScannerService (integration)', () => {
  let service: ScannerService;
  let school: any;
  let event: any;
  let ticketType: any;
  let user: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScannerService,
        { provide: PrismaService, useValue: testPrisma },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<ScannerService>(ScannerService);
    await testPrisma.$connect();
  });

  beforeEach(async () => {
    await cleanDatabase();
    school = await createTestSchool();
    user = await createTestUser(school);
    event = await createTestEvent(school);
    ticketType = await createTestTicketType(event, { quantityTotal: 50, quantityRemaining: 50 });
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  // ─── Happy path ───────────────────────────────────────────────────────────────

  it('checks in a valid ISSUED ticket', async () => {
    const ticket = await createTestTicket(user, event, ticketType);

    const result = await service.scan(ticket.qrToken) as any;

    expect(result.type).toBe('TICKET');
    expect(result.isCheckedIn).toBe(true);
    expect(result.message).toBe('Check-in successful');

    const dbTicket = await testPrisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.status).toBe('CHECKED_IN');
    expect(dbTicket?.checkedInAt).not.toBeNull();
  });

  it('verifyOnly=true validates without checking in', async () => {
    const ticket = await createTestTicket(user, event, ticketType);

    const result = await service.scan(ticket.qrToken, true) as any;

    expect(result.type).toBe('TICKET');
    expect(result.message).toBe('Ticket is valid');
    expect(result.isCheckedIn).toBe(false);

    const dbTicket = await testPrisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.status).toBe('ISSUED'); // unchanged
  });

  it('emits a WebSocket check-in update on successful scan', async () => {
    const ticket = await createTestTicket(user, event, ticketType);
    await service.scan(ticket.qrToken);
    expect(mockGateway.emitCheckinUpdate).toHaveBeenCalledTimes(1);
    expect(mockGateway.emitCheckinUpdate).toHaveBeenCalledWith(
      event.id,
      expect.objectContaining({ userId: user.id }),
    );
  });

  // ─── Race condition ───────────────────────────────────────────────────────────

  it('concurrent scans of the same QR code produce exactly ONE check-in', async () => {
    const ticket = await createTestTicket(user, event, ticketType);

    // Fire 10 concurrent scans of the same token
    const results = await Promise.allSettled(
      Array.from({ length: 10 }).map(() => service.scan(ticket.qrToken)),
    );

    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(9);

    // DB must have exactly one CHECKED_IN record
    const dbTicket = await testPrisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(dbTicket?.status).toBe('CHECKED_IN');
    expect(dbTicket?.checkedInAt).not.toBeNull();

    // Gateway should only fire once
    expect(mockGateway.emitCheckinUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects scan of a VOID ticket', async () => {
    const ticket = await createTestTicket(user, event, ticketType, { status: 'VOID' });
    await expect(service.scan(ticket.qrToken)).rejects.toThrow('This ticket has been voided');
  });

  it('rejects scan of an already CHECKED_IN ticket', async () => {
    const ticket = await createTestTicket(user, event, ticketType, {
      status: 'CHECKED_IN',
      checkedInAt: new Date(),
    });
    await expect(service.scan(ticket.qrToken)).rejects.toThrow(/already checked in/i);
  });

  it('rejects scan for a cancelled event', async () => {
    const cancelledEvent = await createTestEvent(school, { isCancelled: true });
    const cancelledTicketType = await createTestTicketType(cancelledEvent);
    const ticket = await createTestTicket(user, cancelledEvent, cancelledTicketType);
    await expect(service.scan(ticket.qrToken)).rejects.toThrow('This event has been cancelled');
  });

  it('rejects scan for an unknown QR token', async () => {
    await expect(service.scan('qr_nonexistent')).rejects.toThrow('ticket not found');
  });

  it('throws when qrToken is empty', async () => {
    await expect(service.scan('')).rejects.toThrow('QR token is required');
  });
});
