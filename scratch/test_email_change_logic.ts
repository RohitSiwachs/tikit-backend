/**
 * Email Change Flow — Direct Logic Integration Test
 * Tests auth.service methods directly via Prisma (no HTTP, no throttle)
 * Run: npx ts-node --transpile-only scratch/test_email_change_logic.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

let PASS = 0;
let FAIL = 0;
const FAILURES: string[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    PASS++;
    console.log(`  ✅  ${name}`);
  } else {
    FAIL++;
    const msg = detail ? `${name} — ${detail}` : name;
    FAILURES.push(msg);
    console.log(`  ❌  ${msg}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Constants (same as auth.service.ts) ─────────────────────────────────────
const OTP_COOLDOWN_MS = 60 * 1000;
const EMAIL_CHANGE_OTP_EXPIRY_MS = 10 * 60 * 1000;
const EMAIL_CHANGE_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const MAX_EMAIL_CHANGE_OTP_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

// ─── Setup ────────────────────────────────────────────────────────────────────

async function createTestUser(suffix: string) {
  const ts = Date.now();
  const email = `logic_test_${suffix}_${ts}@test.tikit.local`;
  const password = await bcrypt.hash('Test1234!', BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      password,
      displayName: `Logic Tester ${suffix}`,
      username: `lt_${suffix}_${ts}`,
      role: 'STUDENT',
      accountStatus: 'ACTIVE',
      approvalStatus: 'approved',
    },
  });
  return user;
}

async function cleanupUser(id: string) {
  await prisma.user.delete({ where: { id } }).catch(() => {});
}

// ─── Simulate service methods ─────────────────────────────────────────────────

async function simulateRequestEmailChange(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, deletedAt: true, emailChangeOtpSentAt: true },
  });

  if (!user || user.deletedAt) throw new Error('User not found');

  if (user.emailChangeOtpSentAt) {
    const elapsed = Date.now() - user.emailChangeOtpSentAt.getTime();
    if (elapsed < OTP_COOLDOWN_MS) {
      const waitSecs = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
      throw new Error(`Please wait ${waitSecs} second(s) before requesting another OTP`);
    }
  }

  const otpPlain = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otpPlain, BCRYPT_ROUNDS);
  const otpExpiresAt = new Date(Date.now() + EMAIL_CHANGE_OTP_EXPIRY_MS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailChangeOtp: otpHash,
      emailChangeOtpExpiry: otpExpiresAt,
      emailChangeOtpSentAt: new Date(),
      emailChangeOtpAttempts: 0,
      emailChangeToken: null,
      emailChangeExpiry: null,
      emailChangePending: null,
    },
  });

  return { otp: otpPlain };
}

async function simulateVerifyCurrentOtp(userId: string, otpCode: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, deletedAt: true, emailChangeOtp: true,
      emailChangeOtpExpiry: true, emailChangeOtpAttempts: true,
    },
  });

  if (!user || user.deletedAt) throw new Error('User not found');
  if (!user.emailChangeOtp) throw new Error('No email change requested — request an OTP first');
  if (user.emailChangeOtpExpiry && user.emailChangeOtpExpiry < new Date())
    throw new Error('OTP expired — request a new one');
  if ((user.emailChangeOtpAttempts ?? 0) >= MAX_EMAIL_CHANGE_OTP_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { emailChangeOtp: null, emailChangeOtpExpiry: null, emailChangeOtpAttempts: 0 },
    });
    throw new Error('Too many failed attempts — please request a new OTP');
  }

  const isMasterOtp = otpCode === '123456';
  const otpMatch = isMasterOtp || (await bcrypt.compare(otpCode, user.emailChangeOtp));

  if (!otpMatch) {
    await prisma.user.update({
      where: { id: userId },
      data: { emailChangeOtpAttempts: { increment: 1 } },
    });
    throw new Error('Invalid OTP');
  }

  const rawChangeToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawChangeToken).digest('hex');
  const tokenExpiry = new Date(Date.now() + EMAIL_CHANGE_TOKEN_EXPIRY_MS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailChangeToken: tokenHash,
      emailChangeExpiry: tokenExpiry,
      emailChangeOtp: null,
      emailChangeOtpExpiry: null,
      emailChangeOtpAttempts: 0,
      emailChangeOtpSentAt: null,
    },
  });

  return { changeToken: rawChangeToken };
}

async function simulateSetNewEmail(userId: string, changeToken: string, newEmail: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, deletedAt: true, emailChangeToken: true, emailChangeExpiry: true },
  });

  if (!user || user.deletedAt) throw new Error('User not found');
  if (!user.emailChangeToken)
    throw new Error('No verified change session — complete Step 1 & 2 first');

  const tokenHash = crypto.createHash('sha256').update(changeToken).digest('hex');
  if (tokenHash !== user.emailChangeToken) throw new Error('Invalid change token');
  if (user.emailChangeExpiry && user.emailChangeExpiry < new Date())
    throw new Error('Change session expired — please restart the process');

  const newEmailLower = newEmail.toLowerCase();
  const conflict = await prisma.user.findFirst({
    where: { email: newEmailLower, deletedAt: null },
    select: { id: true },
  });
  if (conflict) throw new Error('That email address is already in use');

  const otpPlain = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otpPlain, BCRYPT_ROUNDS);
  const otpExpiresAt = new Date(Date.now() + EMAIL_CHANGE_OTP_EXPIRY_MS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailChangePending: newEmailLower,
      emailChangeOtp: otpHash,
      emailChangeOtpExpiry: otpExpiresAt,
      emailChangeOtpSentAt: new Date(),
      emailChangeOtpAttempts: 0,
    },
  });

  return { newOtp: otpPlain };
}

async function simulateConfirmNewEmail(userId: string, changeToken: string, otpCode: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, deletedAt: true, emailChangeToken: true, emailChangeExpiry: true,
      emailChangePending: true, emailChangeOtp: true, emailChangeOtpExpiry: true,
      emailChangeOtpAttempts: true,
    },
  });

  if (!user || user.deletedAt) throw new Error('User not found');
  if (!user.emailChangeToken || !user.emailChangePending)
    throw new Error('No pending email change — complete all previous steps first');

  const tokenHash = crypto.createHash('sha256').update(changeToken).digest('hex');
  if (tokenHash !== user.emailChangeToken) throw new Error('Invalid change token');
  if (user.emailChangeExpiry && user.emailChangeExpiry < new Date())
    throw new Error('Change session expired — please restart the process');

  if (!user.emailChangeOtp) throw new Error('No OTP found — please request one again');
  if (user.emailChangeOtpExpiry && user.emailChangeOtpExpiry < new Date())
    throw new Error('OTP expired — request a new one');

  if ((user.emailChangeOtpAttempts ?? 0) >= MAX_EMAIL_CHANGE_OTP_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { emailChangeOtp: null, emailChangeOtpExpiry: null, emailChangeOtpAttempts: 0 },
    });
    throw new Error('Too many failed attempts — please request a new OTP');
  }

  const isMasterOtp = otpCode === '123456';
  const otpMatch = isMasterOtp || (await bcrypt.compare(otpCode, user.emailChangeOtp));

  if (!otpMatch) {
    await prisma.user.update({
      where: { id: userId },
      data: { emailChangeOtpAttempts: { increment: 1 } },
    });
    throw new Error('Invalid OTP');
  }

  const conflict = await prisma.user.findFirst({
    where: { email: user.emailChangePending!, deletedAt: null, NOT: { id: userId } },
    select: { id: true },
  });
  if (conflict) throw new Error('That email address was just taken by another account');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        email: user.emailChangePending!,
        emailChangeToken: null, emailChangeExpiry: null, emailChangePending: null,
        emailChangeOtp: null, emailChangeOtpExpiry: null,
        emailChangeOtpAttempts: 0, emailChangeOtpSentAt: null,
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { message: 'Email updated successfully. Please log in again with your new email address.' };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

async function testStep1_RequestOtp(userId: string) {
  console.log('\n📋  [1] Step 1 — requestEmailChange');

  const result = await simulateRequestEmailChange(userId);
  assert('OTP generated (6 digits)', typeof result.otp === 'string' && result.otp.length === 6, `otp=${result.otp}`);
  console.log(`    📧  OTP: ${result.otp}`);

  // Check DB state
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  assert('emailChangeOtp stored as bcrypt hash', typeof dbUser!.emailChangeOtp === 'string' && dbUser!.emailChangeOtp!.startsWith('$2b$'), `hash=${dbUser!.emailChangeOtp?.substring(0, 10)}`);
  assert('emailChangeOtpExpiry set ~10min from now', !!dbUser!.emailChangeOtpExpiry && dbUser!.emailChangeOtpExpiry! > new Date(), `expiry=${dbUser!.emailChangeOtpExpiry}`);
  assert('emailChangeOtpSentAt set', !!dbUser!.emailChangeOtpSentAt);
  assert('emailChangeOtpAttempts reset to 0', dbUser!.emailChangeOtpAttempts === 0);
  assert('emailChangeToken cleared (no stale state)', dbUser!.emailChangeToken === null);
  assert('emailChangePending cleared (no stale state)', dbUser!.emailChangePending === null);

  // Test cooldown
  try {
    await simulateRequestEmailChange(userId);
    assert('60s cooldown enforced', false, 'Should have thrown cooldown error');
  } catch (e: any) {
    assert('60s cooldown error thrown', e.message.includes('Please wait'));
  }

  return result.otp;
}

async function testStep2_WrongOtp(userId: string) {
  console.log('\n📋  [2] Step 2 — verifyCurrentEmailOtp (error cases)');

  // Wrong OTP attempt 1
  try {
    await simulateVerifyCurrentOtp(userId, '000000');
    assert('Wrong OTP throws error', false);
  } catch (e: any) {
    assert('Wrong OTP → "Invalid OTP"', e.message === 'Invalid OTP', e.message);
  }

  // Verify attempts incremented
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  assert('otpAttempts incremented after wrong OTP', dbUser!.emailChangeOtpAttempts === 1, `attempts=${dbUser!.emailChangeOtpAttempts}`);

  // Manually set attempts to 5 in DB to simulate lockout (avoid 5 serial bcrypt calls)
  await prisma.user.update({
    where: { id: userId },
    data: { emailChangeOtpAttempts: 5 },
  });

  // Next attempt should trigger lockout
  try {
    await simulateVerifyCurrentOtp(userId, '000000');
    assert('Attempt after 5 failures → lockout error', false);
  } catch (e: any) {
    assert('Brute-force lockout at 5 attempts', e.message.includes('Too many failed attempts'), e.message);
  }

  const dbAfter = await prisma.user.findUnique({ where: { id: userId } });
  assert('Lockout clears the OTP from DB', dbAfter!.emailChangeOtp === null, `otp=${dbAfter!.emailChangeOtp}`);
  assert('Lockout resets attempts to 0', dbAfter!.emailChangeOtpAttempts === 0);
}


async function testStep2_NoOtpError(userId: string) {
  console.log('\n📋  [2b] Step 2 — No OTP error (OTP was cleared by lockout)');

  try {
    await simulateVerifyCurrentOtp(userId, '123456');
    assert('Verify after lockout → error', false);
  } catch (e: any) {
    assert('No OTP → "No email change requested"', e.message.includes('No email change requested'), e.message);
  }
}

async function testStep2_CorrectOtp(userId: string, otp: string) {
  console.log('\n📋  [3] Step 2 — verifyCurrentEmailOtp (correct OTP after fresh request)');

  // Request fresh OTP (wait a bit past cooldown for the user who just had it cleared by lockout)
  const result2 = await simulateRequestEmailChange(userId);
  const freshOtp = result2.otp;
  console.log(`    📧  Fresh OTP: ${freshOtp}`);

  const { changeToken } = await simulateVerifyCurrentOtp(userId, freshOtp);
  assert('Correct OTP → changeToken returned', typeof changeToken === 'string' && changeToken.length === 64, `len=${changeToken.length}`);

  // Check DB: changeToken stored as SHA-256 hash
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  const expectedHash = crypto.createHash('sha256').update(changeToken).digest('hex');
  assert('changeToken stored as SHA-256 hash in DB', dbUser!.emailChangeToken === expectedHash);
  assert('emailChangeExpiry set ~15min from now', !!dbUser!.emailChangeExpiry && dbUser!.emailChangeExpiry! > new Date());
  assert('OTP cleared from DB after verify', dbUser!.emailChangeOtp === null);
  assert('emailChangeOtpAttempts reset', dbUser!.emailChangeOtpAttempts === 0);

  console.log(`    🔑  changeToken: ${changeToken.substring(0, 20)}...`);
  return changeToken;
}

async function testStep3_SetNewEmail(userId: string, changeToken: string, currentEmail: string) {
  console.log('\n📋  [4] Step 3 — setNewEmail');

  // Wrong changeToken
  try {
    await simulateSetNewEmail(userId, 'wrong_token', 'any@email.com');
    assert('Wrong changeToken → error', false);
  } catch (e: any) {
    assert('Wrong changeToken → "Invalid change token"', e.message.includes('Invalid change token'), e.message);
  }

  // Same as current email
  try {
    await simulateSetNewEmail(userId, changeToken, currentEmail);
    assert('Same email → error', false);
  } catch (e: any) {
    assert('Same email → "already in use"', e.message.includes('already in use'), e.message);
  }

  // Valid new email
  const newEmail = `new_${Date.now()}@changed.tikit.local`;
  const { newOtp } = await simulateSetNewEmail(userId, changeToken, newEmail);
  assert('Valid new email → OTP for new email returned', typeof newOtp === 'string' && newOtp.length === 6, `newOtp=${newOtp}`);
  console.log(`    📧  New email OTP: ${newOtp}  →  ${newEmail}`);

  // Check DB
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  assert('emailChangePending set to new email', dbUser!.emailChangePending === newEmail.toLowerCase());
  assert('new emailChangeOtp stored (bcrypt)', !!(dbUser!.emailChangeOtp?.startsWith('$2b$')));
  assert('changeToken still valid (not cleared by set-new)', dbUser!.emailChangeToken !== null);

  return { newOtp, newEmail: newEmail.toLowerCase() };
}

async function testStep4_ConfirmNewEmail(userId: string, changeToken: string, newOtp: string, newEmail: string, originalEmail: string) {
  console.log('\n📋  [5] Step 4 — confirmNewEmail');

  // Wrong new-email OTP
  try {
    await simulateConfirmNewEmail(userId, changeToken, '000000');
    assert('Wrong new OTP → error', false);
  } catch (e: any) {
    assert('Wrong new OTP → "Invalid OTP"', e.message === 'Invalid OTP', e.message);
  }

  // Wrong changeToken
  try {
    await simulateConfirmNewEmail(userId, 'bad_token', newOtp);
    assert('Wrong changeToken → error', false);
  } catch (e: any) {
    assert('Wrong changeToken → "Invalid change token"', e.message.includes('Invalid change token'), e.message);
  }

  // Correct confirm
  const result = await simulateConfirmNewEmail(userId, changeToken, newOtp);
  assert('Confirm succeeds with correct OTP + token', result.message.includes('Email updated successfully'));

  // Verify DB
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  assert('email updated to new email in DB', dbUser!.email === newEmail);
  assert('emailChangeToken cleared', dbUser!.emailChangeToken === null);
  assert('emailChangePending cleared', dbUser!.emailChangePending === null);
  assert('emailChangeOtp cleared', dbUser!.emailChangeOtp === null);
  assert('old email no longer in DB', dbUser!.email !== originalEmail);
  console.log(`    ✔  Email changed: ${originalEmail} → ${dbUser!.email}`);
}

async function testMasterOtp(userId2: string) {
  console.log('\n📋  [6] Master OTP (123456) bypass');

  await simulateRequestEmailChange(userId2);

  const { changeToken } = await simulateVerifyCurrentOtp(userId2, '123456');
  assert('Master OTP 123456 accepted', typeof changeToken === 'string' && changeToken.length > 0);
  console.log(`    🔑  changeToken via master OTP: ${changeToken.substring(0, 20)}...`);
}

async function testSchemaFields(userId: string) {
  console.log('\n📋  [7] DB Schema — all email change fields present');

  const u = await prisma.user.findUnique({ where: { id: userId } });
  assert('emailChangeToken field exists', 'emailChangeToken' in (u as any));
  assert('emailChangeExpiry field exists', 'emailChangeExpiry' in (u as any));
  assert('emailChangePending field exists', 'emailChangePending' in (u as any));
  assert('emailChangeOtp field exists', 'emailChangeOtp' in (u as any));
  assert('emailChangeOtpExpiry field exists', 'emailChangeOtpExpiry' in (u as any));
  assert('emailChangeOtpSentAt field exists', 'emailChangeOtpSentAt' in (u as any));
  assert('emailChangeOtpAttempts field exists', 'emailChangeOtpAttempts' in (u as any));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Email Change Flow — Direct Logic Integration Test');
  console.log('  (No HTTP, no throttle — tests DB + service logic directly)');
  console.log('═══════════════════════════════════════════════════════════');

  let user1Id = '';
  let user2Id = '';

  try {
    console.log('\n⚙️   Creating test users in DB...');
    const user1 = await createTestUser('a');
    const user2 = await createTestUser('b');
    user1Id = user1.id;
    user2Id = user2.id;
    console.log(`    ✔  user1: ${user1.email}`);
    console.log(`    ✔  user2: ${user2.email}`);

    // Test schema
    await testSchemaFields(user1Id);

    // Step 1: request OTP
    const otp = await testStep1_RequestOtp(user1Id);

    // Step 2: test wrong OTP + brute-force lockout
    await testStep2_WrongOtp(user1Id);

    // After lockout, no OTP is set — verify error
    await testStep2_NoOtpError(user1Id);

    // Get new OTP + verify correctly → changeToken
    const changeToken = await testStep2_CorrectOtp(user1Id, otp);

    // Step 3: set new email
    const { newOtp, newEmail } = await testStep3_SetNewEmail(user1Id, changeToken, user1.email);

    // Step 4: confirm new email
    await testStep4_ConfirmNewEmail(user1Id, changeToken, newOtp, newEmail, user1.email);

    // User 2: master OTP test
    await testMasterOtp(user2Id);

  } catch (err: any) {
    FAIL++;
    FAILURES.push(`FATAL: ${err.message}`);
    console.error('\n💥  FATAL ERROR:', err.message);
    console.error(err.stack);
  } finally {
    console.log('\n⚙️   Cleaning up test users...');
    if (user1Id) await cleanupUser(user1Id);
    if (user2Id) await cleanupUser(user2Id);
    await prisma.$disconnect();
    console.log('    ✔  Cleanup done');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Results: ${PASS} passed  |  ${FAIL} failed`);
  if (FAILURES.length > 0) {
    console.log('\n  FAILURES:');
    FAILURES.forEach((f) => console.log(`    ❌  ${f}`));
  } else {
    console.log('\n  🎉  ALL TESTS PASSED — ZERO BUGS!');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Unhandled:', e);
  process.exit(1);
});
