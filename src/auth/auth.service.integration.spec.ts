/**
 * Integration tests for AuthService security features.
 * Run against a real PostgreSQL instance — do NOT use mocks for DB.
 *
 * Covers: account lockout, OTP cooldown, OTP brute-force invalidation,
 * password reset (happy path, expired token, used token).
 *
 * Run with: TEST_DATABASE_URL=<url> npx jest auth.service.integration
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailsService } from '../emails/emails.service';
import * as crypto from 'crypto';
import {
  testPrisma,
  cleanDatabase,
  createTestSchool,
  createTestUser,
} from '../test/db-helpers';

// Stable JWT config — symmetric HS256 is fine for integration tests
const mockJwtService = {
  sign: jest.fn().mockReturnValue('test.access.token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      JWT_REFRESH_EXPIRATION_DAYS: '30',
      FRONTEND_URL: 'http://localhost:3001',
      'jwt.privateKey': 'test-secret',
    };
    return map[key] ?? null;
  }),
};

const mockEmailsService = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

// Render Singapore latency + cleanDatabase sequential deletes + bcrypt rounds
jest.setTimeout(30000);

describe('AuthService (integration)', () => {
  let service: AuthService;
  let school: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: testPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailsService, useValue: mockEmailsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    await testPrisma.$connect();
  });

  beforeEach(async () => {
    await cleanDatabase();
    school = await createTestSchool();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  // ─── Account lockout ──────────────────────────────────────────────────────────

  it('locks account after 5 consecutive failed login attempts', async () => {
    const user = await createTestUser(school); // default password: test-password-123

    for (let i = 0; i < 4; i++) {
      await expect(
        service.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toThrow(/invalid credentials/i);
    }

    // 5th failure triggers the lock
    await expect(
      service.login({ email: user.email, password: 'wrong-password' }),
    ).rejects.toThrow();

    // Now the account is locked — even the correct password should say "Account locked"
    await expect(
      service.login({ email: user.email, password: 'test-password-123' }),
    ).rejects.toThrow(/account locked/i);

    // Verify DB state
    const dbUser = await testPrisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.failedLoginCount).toBeGreaterThanOrEqual(5);
    expect(dbUser?.lockedUntil).not.toBeNull();
    expect(dbUser?.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('resets failure counter on successful login', async () => {
    const user = await createTestUser(school); // default password: test-password-123

    // 3 failures
    for (let i = 0; i < 3; i++) {
      await expect(
        service.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toThrow(/invalid credentials/i);
    }

    // Successful login resets the counter
    const result = await service.login({ email: user.email, password: 'test-password-123' });
    expect(result.access_token).toBeDefined();

    const dbUser = await testPrisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.failedLoginCount).toBe(0);
    expect(dbUser?.lockedUntil).toBeNull();
  });

  it('allows login after lockout expires', async () => {
    const user = await createTestUser(school); // default password: test-password-123

    // Set an expired lockout directly in the DB
    await testPrisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 5,
        lockedUntil: new Date(Date.now() - 1000), // already expired
      },
    });

    // Should succeed now that lockout has passed
    const result = await service.login({ email: user.email, password: 'test-password-123' });
    expect(result.access_token).toBeDefined();
  });

  // ─── OTP cooldown ─────────────────────────────────────────────────────────────

  it('enforces 60-second cooldown between OTP sends', async () => {
    const user = await createTestUser(school);

    // First OTP — should succeed
    await service.sendOtp({ userId: user.id });

    // Immediate second request — should be throttled
    await expect(service.sendOtp({ userId: user.id })).rejects.toThrow(
      /please wait/i,
    );

    // Verify cooldown message includes seconds remaining
    try {
      await service.sendOtp({ userId: user.id });
    } catch (e: any) {
      expect(e.message).toMatch(/\d+ second/i);
    }
  });

  it('allows OTP resend after cooldown expires', async () => {
    const user = await createTestUser(school);

    // Simulate an OTP sent 65 seconds ago (beyond the 60s cooldown)
    await testPrisma.user.update({
      where: { id: user.id },
      data: { otpSentAt: new Date(Date.now() - 65_000) },
    });

    await expect(service.sendOtp({ userId: user.id })).resolves.toMatchObject({
      message: 'OTP sent successfully',
    });
  });

  // ─── OTP brute-force protection ───────────────────────────────────────────────

  it('invalidates OTP after 5 failed verify attempts', async () => {
    const user = await createTestUser(school);

    // Set up a known OTP hash directly
    const bcrypt = require('bcrypt');
    const otpHash = await bcrypt.hash('123456', 10);
    await testPrisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: otpHash,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        otpAttempts: 0,
        otpSentAt: new Date(Date.now() - 65_000), // outside cooldown
      },
    });

    // 5 wrong attempts
    for (let i = 0; i < 5; i++) {
      await expect(
        service.verifyOtp({ userId: user.id, otpCode: '000000' }),
      ).rejects.toThrow(/invalid otp/i);
    }

    // 6th attempt — OTP should now be invalidated
    await expect(
      service.verifyOtp({ userId: user.id, otpCode: '123456' }), // even the correct code
    ).rejects.toThrow(/too many failed attempts/i);

    // OTP must be cleared from DB
    const dbUser = await testPrisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.otpCode).toBeNull();
    expect(dbUser?.otpExpiresAt).toBeNull();
  });

  // ─── Password reset ───────────────────────────────────────────────────────────

  it('resets password and revokes all refresh tokens on valid token', async () => {
    const user = await createTestUser(school); // default password: test-password-123

    // Create active refresh tokens
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await testPrisma.refreshToken.createMany({
      data: [
        { userId: user.id, token: 'token-a', expiresAt },
        { userId: user.id, token: 'token-b', expiresAt },
      ],
    });

    // Trigger forgot-password to generate a real token
    await service.forgotPassword({ email: user.email });

    // Read the hashed token from DB
    const dbUser = await testPrisma.user.findUnique({
      where: { id: user.id },
      select: { passwordResetToken: true },
    });
    expect(dbUser?.passwordResetToken).not.toBeNull();

    // We can't get the raw token from DB (it's hashed), so inject one directly
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await testPrisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const result = await service.resetPassword({ token: rawToken, newPassword: 'new-password-456' });
    expect(result.message).toMatch(/reset successfully/i);

    // New password should work
    const loginResult = await service.login({ email: user.email, password: 'new-password-456' });
    expect(loginResult.access_token).toBeDefined();

    // Old refresh tokens should be revoked
    const tokens = await testPrisma.refreshToken.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    // Only the new login token should be active — token-a and token-b are revoked
    const oldTokens = await testPrisma.refreshToken.findMany({
      where: { token: { in: ['token-a', 'token-b'] } },
    });
    expect(oldTokens.every((t) => t.revokedAt !== null)).toBe(true);

    // Reset token must be cleared
    const refreshedDbUser = await testPrisma.user.findUnique({ where: { id: user.id } });
    expect(refreshedDbUser?.passwordResetToken).toBeNull();
    expect(refreshedDbUser?.passwordResetExpiry).toBeNull();
  });

  it('rejects an expired password reset token', async () => {
    const user = await createTestUser(school);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await testPrisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpiry: new Date(Date.now() - 1000), // already expired
      },
    });

    await expect(
      service.resetPassword({ token: rawToken, newPassword: 'new-password-456' }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  it('rejects a used (already cleared) password reset token', async () => {
    const user = await createTestUser(school);
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Token is not in DB — already used or never set
    await expect(
      service.resetPassword({ token: rawToken, newPassword: 'new-password-456' }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  it('forgotPassword returns the same message whether email exists or not', async () => {
    const user = await createTestUser(school);

    const realResponse = await service.forgotPassword({ email: user.email });
    const fakeResponse = await service.forgotPassword({ email: 'nonexistent@test.com' });

    expect(realResponse.message).toBe(fakeResponse.message);
  });
});
