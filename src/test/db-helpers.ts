import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  generateQrToken,
  generateTicketCode,
} from '../tickets/tickets.service';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'FATAL: TEST_DATABASE_URL is not set. Refusing to run tests against production/development database.',
  );
}

// A single shared Prisma client for all integration tests.
// Tests must use TEST_DATABASE_URL — never point at a real DB.
export const testPrisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

export async function cleanDatabase() {
  // Sequential deletes inside a transaction, in FK-safe order.
  // $transaction([...array]) sends all queries in parallel and ignores order —
  // the callback form ensures each await completes before the next starts.
  await testPrisma.$transaction(
    async (tx) => {
      // Implicit many-to-many join tables first (no model, raw table name)
      await tx.$executeRawUnsafe('DELETE FROM "_UserFollows"');
      await tx.$executeRawUnsafe('DELETE FROM "_UserFriends"');
      await tx.$executeRawUnsafe('DELETE FROM "_EventConnectedSchools"');

      // Leaf rows that have RESTRICT FKs pointing at parent tables
      await tx.followRequest.deleteMany();
      await tx.postLike.deleteMany();
      await tx.postComment.deleteMany();
      await tx.eventLike.deleteMany();
      await tx.eventComment.deleteMany();
      await tx.eventConnectionRequest.deleteMany();
      await tx.refreshToken.deleteMany();
      await tx.cardCode.deleteMany();

      // Ticket and Voucher both RESTRICT on TicketType and User
      await tx.ticket.deleteMany();
      await tx.voucher.deleteMany();
      await tx.ticketType.deleteMany();

      // Card RESTRICT on School; Post RESTRICT on School and User
      await tx.card.deleteMany();
      await tx.post.deleteMany();

      // Class RESTRICT on School
      await tx.class.deleteMany();

      // No FK constraints
      await tx.segment.deleteMany();
      await tx.campaign.deleteMany();

      // Event RESTRICT on School
      await tx.event.deleteMany();

      // User → School is SET NULL (non-blocking), but delete User first for cleanliness
      await tx.user.deleteMany();
      await tx.school.deleteMany();
    },
    { timeout: 30000 },
  );
}

export async function createTestSchool(overrides: any = {}) {
  return testPrisma.school.create({
    data: {
      name: 'Test School',
      slug: `test-school-${crypto.randomBytes(4).toString('hex')}`,
      city: 'Stockholm',
      schoolCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
      isActive: true,
      ...overrides,
    },
  });
}

export async function createTestUser(school: any, overrides: any = {}) {
  const { password: rawPassword, ...rest } = overrides;
  const password = rawPassword ?? 'test-password-123';
  const hashedPassword = await bcrypt.hash(password, 10);

  return testPrisma.user.create({
    data: {
      email: `user-${crypto.randomBytes(4).toString('hex')}@test.com`,
      displayName: 'Test User',
      username: `testuser_${crypto.randomBytes(4).toString('hex')}`,
      password: hashedPassword,
      role: 'STUDENT',
      schoolId: school.id,
      accountStatus: 'ACTIVE',
      approvalStatus: 'approved',
      ...rest,
    },
  });
}

export async function createTestEvent(school: any, overrides: any = {}) {
  return testPrisma.event.create({
    data: {
      title: 'Test Event',
      schoolId: school.id,
      startsAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      endsAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      status: 'published',
      isPublished: true,
      ...overrides,
    },
  });
}

export async function createTestTicketType(event: any, overrides: any = {}) {
  const total = overrides.quantityTotal ?? 10;
  return testPrisma.ticketType.create({
    data: {
      eventId: event.id,
      name: 'General Admission',
      price: 0,
      quantityTotal: total,
      quantityRemaining: overrides.quantityRemaining ?? total,
      ...overrides,
    },
  });
}

export async function createTestTicket(
  user: any,
  event: any,
  ticketType: any,
  overrides: any = {},
) {
  return testPrisma.ticket.create({
    data: {
      userId: user.id,
      eventId: event.id,
      ticketTypeId: ticketType.id,
      code: generateTicketCode(),
      qrToken: generateQrToken(),
      status: 'ISSUED',
      ...overrides,
    },
  });
}
