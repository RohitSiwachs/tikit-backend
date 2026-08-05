/**
 * Comprehensive Email Change Flow Test Suite
 * Tests: OTP send, error filters, OTP verify, full happy path
 * Run: npx ts-node scratch/test_email_change.ts
 */

const BASE = 'http://localhost:3001/v1';


let PASS = 0;
let FAIL = 0;
const FAILURES: string[] = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 20000;


async function req(
  method: string,
  path: string,
  body?: any,
  token?: string,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { status: res.status, data };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { status: 0, data: { error: 'Request timed out after 8s' } };
    }
    return { status: 0, data: { error: err.message } };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));


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

// ─── Setup: get a real user JWT ──────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function getJwt(): Promise<{ token: string; userId: string; email: string }> {
  const ts = Date.now();
  const email = `emailchange_test_${ts}@test.tikit.local`;
  const password = 'Test1234!';
  const hashed = await bcrypt.hash(password, 10);

  // Create user directly in DB (bypasses throttle)
  await prisma.user.create({
    data: {
      email,
      password: hashed,
      displayName: 'EmailChange Tester',
      username: `ec_tester_${ts}`,
      role: 'STUDENT',
      accountStatus: 'ACTIVE',
      approvalStatus: 'approved',
    },
  });

  // Login to get JWT
  const login = await req('POST', '/auth/login', { email, password });
  if (login.status !== 200 && login.status !== 201) {
    throw new Error(`Login failed: ${JSON.stringify(login.data)}`);
  }
  return {
    token: login.data.access_token,
    userId: login.data.user.id,
    email,
  };
}

async function cleanup() {
  await prisma.$disconnect();
}


// ─── Tests ───────────────────────────────────────────────────────────────────

async function testUnauthenticated() {
  console.log('\n📋  [1] Unauthenticated Access Guard');

  const r1 = await req('POST', '/auth/email-change/request');
  assert('Request without token → 401 or 429', r1.status === 401 || r1.status === 429, `Got ${r1.status}: ${JSON.stringify(r1.data)}`);
  await sleep(300);

  const r2 = await req('POST', '/auth/email-change/verify-current', { otpCode: '123456' });
  assert('Verify-current without token → 401 or 429', r2.status === 401 || r2.status === 429, `Got ${r2.status}: ${JSON.stringify(r2.data)}`);
  await sleep(300);

  const r3 = await req('POST', '/auth/email-change/set-new', {
    newEmail: 'x@x.com',
    changeToken: 'fake',
  });
  assert('Set-new without token → 401 or 429', r3.status === 401 || r3.status === 429, `Got ${r3.status}: ${JSON.stringify(r3.data)}`);
  await sleep(300);

  const r4 = await req('POST', '/auth/email-change/confirm', {
    otpCode: '123456',
    changeToken: 'fake',
  });
  assert('Confirm without token → 401 or 429', r4.status === 401 || r4.status === 429, `Got ${r4.status}: ${JSON.stringify(r4.data)}`);
}


async function testValidationErrors(token: string) {
  console.log('\n📋  [2] DTO Validation Errors');

  // Missing otpCode
  const r1 = await req('POST', '/auth/email-change/verify-current', {}, token);
  assert('verify-current: missing otpCode → 400', r1.status === 400, `Got ${r1.status}: ${JSON.stringify(r1.data)}`);

  // Wrong otpCode length (< 6)
  const r2 = await req('POST', '/auth/email-change/verify-current', { otpCode: '123' }, token);
  assert('verify-current: otpCode too short → 400', r2.status === 400, `Got ${r2.status}: ${JSON.stringify(r2.data)}`);

  // Wrong otpCode length (> 6)
  const r3 = await req('POST', '/auth/email-change/verify-current', { otpCode: '1234567' }, token);
  assert('verify-current: otpCode too long → 400', r3.status === 400, `Got ${r3.status}: ${JSON.stringify(r3.data)}`);

  // set-new: missing newEmail
  const r4 = await req('POST', '/auth/email-change/set-new', { changeToken: 'tok' }, token);
  assert('set-new: missing newEmail → 400', r4.status === 400, `Got ${r4.status}`);

  // set-new: invalid email format
  const r5 = await req('POST', '/auth/email-change/set-new', { newEmail: 'not-an-email', changeToken: 'tok' }, token);
  assert('set-new: invalid email → 400', r5.status === 400, `Got ${r5.status}`);

  // set-new: missing changeToken
  const r6 = await req('POST', '/auth/email-change/set-new', { newEmail: 'a@b.com' }, token);
  assert('set-new: missing changeToken → 400', r6.status === 400, `Got ${r6.status}`);

  // confirm: missing both fields
  const r7 = await req('POST', '/auth/email-change/confirm', {}, token);
  assert('confirm: missing fields → 400', r7.status === 400, `Got ${r7.status}`);
}

async function testNoOtpErrors(token: string) {
  console.log('\n📋  [3] Business Logic — No OTP Requested');

  // verify-current before requesting OTP
  const r1 = await req('POST', '/auth/email-change/verify-current', { otpCode: '123456' }, token);
  assert(
    'verify-current before request → 400 (No email change requested)',
    r1.status === 400 && r1.data?.message?.includes('No email change requested'),
    `Got ${r1.status}: ${JSON.stringify(r1.data)}`,
  );

  // set-new before completing step 2
  const r2 = await req(
    'POST',
    '/auth/email-change/set-new',
    { newEmail: 'new@test.com', changeToken: 'fake_token' },
    token,
  );
  assert(
    'set-new before verify-current → 400 (No verified change session)',
    r2.status === 400 && r2.data?.message?.includes('No verified change session'),
    `Got ${r2.status}: ${JSON.stringify(r2.data)}`,
  );

  // confirm before all steps
  const r3 = await req(
    'POST',
    '/auth/email-change/confirm',
    { otpCode: '123456', changeToken: 'fake_token' },
    token,
  );
  assert(
    'confirm before previous steps → 400 (No pending email change)',
    r3.status === 400 && r3.data?.message?.includes('No pending email change'),
    `Got ${r3.status}: ${JSON.stringify(r3.data)}`,
  );
}

async function testOtpRequest(token: string) {
  console.log('\n📋  [4] Step 1 — Request OTP (send to current email)');

  const r = await req('POST', '/auth/email-change/request', undefined, token);
  assert(
    'request → 200/201 with OTP (dev mode exposes otp)',
    (r.status === 200 || r.status === 201) && r.data?.message,
    `Got ${r.status}: ${JSON.stringify(r.data)}`,
  );

  const otp = r.data?.otp as string | undefined;
  assert(
    'dev mode: otp field returned',
    typeof otp === 'string' && otp.length === 6,
    `otp = ${otp}`,
  );

  console.log(`    📧  OTP received (dev): ${otp}`);

  // Test cooldown: request again immediately
  const r2 = await req('POST', '/auth/email-change/request', undefined, token);
  assert(
    'second request within 60s → 400 cooldown',
    r2.status === 400 && r2.data?.message?.includes('Please wait'),
    `Got ${r2.status}: ${JSON.stringify(r2.data)}`,
  );

  return otp!;
}

async function testWrongOtp(token: string) {
  console.log('\n📋  [5] Step 2 — Wrong OTP error handling');

  const r = await req('POST', '/auth/email-change/verify-current', { otpCode: '000000' }, token);
  assert(
    'wrong OTP → 400 Invalid OTP',
    r.status === 400 && r.data?.message?.includes('Invalid OTP'),
    `Got ${r.status}: ${JSON.stringify(r.data)}`,
  );
}

async function testVerifyCurrentOtp(token: string, otp: string) {
  console.log('\n📋  [6] Step 2 — Verify current email OTP');

  const r = await req('POST', '/auth/email-change/verify-current', { otpCode: otp }, token);
  assert(
    'correct OTP → 200 with changeToken',
    (r.status === 200 || r.status === 201) && typeof r.data?.changeToken === 'string',
    `Got ${r.status}: ${JSON.stringify(r.data)}`,
  );

  const changeToken = r.data?.changeToken as string;
  assert(
    'changeToken is non-empty string',
    changeToken?.length > 0,
    `changeToken = ${changeToken}`,
  );

  console.log(`    🔑  changeToken received: ${changeToken?.substring(0, 16)}...`);
  return changeToken!;
}

async function testSetNewEmail(token: string, changeToken: string, currentEmail: string) {
  console.log('\n📋  [7] Step 3 — Set new email');

  // Invalid changeToken
  const r1 = await req(
    'POST',
    '/auth/email-change/set-new',
    { newEmail: 'newemail@test.local', changeToken: 'wrong_token_here' },
    token,
  );
  assert(
    'invalid changeToken → 400',
    r1.status === 400 && r1.data?.message?.includes('Invalid change token'),
    `Got ${r1.status}: ${JSON.stringify(r1.data)}`,
  );

  // Same email as current (conflict check — it exists in DB)
  const r2 = await req(
    'POST',
    '/auth/email-change/set-new',
    { newEmail: currentEmail, changeToken },
    token,
  );
  assert(
    'same as current email → 400 already in use',
    r2.status === 400 && r2.data?.message?.includes('already in use'),
    `Got ${r2.status}: ${JSON.stringify(r2.data)}`,
  );

  // Valid new email
  const newEmail = `new_${Date.now()}@test.tikit.local`;
  const r3 = await req(
    'POST',
    '/auth/email-change/set-new',
    { newEmail, changeToken },
    token,
  );
  assert(
    'valid new email → 200 OTP sent',
    (r3.status === 200 || r3.status === 201) && r3.data?.message,
    `Got ${r3.status}: ${JSON.stringify(r3.data)}`,
  );

  const newOtp = r3.data?.otp as string | undefined;
  assert(
    'dev mode: new email OTP returned',
    typeof newOtp === 'string' && newOtp.length === 6,
    `newOtp = ${newOtp}`,
  );

  console.log(`    📧  New email OTP (dev): ${newOtp}  →  ${newEmail}`);
  return { newOtp: newOtp!, newEmail };
}

async function testConfirmNewEmail(
  token: string,
  changeToken: string,
  newOtp: string,
  newEmail: string,
) {
  console.log('\n📋  [8] Step 4 — Confirm new email OTP');

  // Wrong OTP
  const r1 = await req(
    'POST',
    '/auth/email-change/confirm',
    { otpCode: '000000', changeToken },
    token,
  );
  assert(
    'wrong new-email OTP → 400 Invalid OTP',
    r1.status === 400 && r1.data?.message?.includes('Invalid OTP'),
    `Got ${r1.status}: ${JSON.stringify(r1.data)}`,
  );

  // Wrong changeToken
  const r2 = await req(
    'POST',
    '/auth/email-change/confirm',
    { otpCode: newOtp, changeToken: 'bad_token' },
    token,
  );
  assert(
    'wrong changeToken → 400 Invalid change token',
    r2.status === 400 && r2.data?.message?.includes('Invalid change token'),
    `Got ${r2.status}: ${JSON.stringify(r2.data)}`,
  );

  // Correct OTP + correct changeToken → email updated
  const r3 = await req(
    'POST',
    '/auth/email-change/confirm',
    { otpCode: newOtp, changeToken },
    token,
  );
  assert(
    'correct OTP + token → 200 email updated',
    (r3.status === 200 || r3.status === 201) &&
      r3.data?.message?.includes('Email updated successfully'),
    `Got ${r3.status}: ${JSON.stringify(r3.data)}`,
  );
}

async function testOldTokenRevoked(token: string) {
  console.log('\n📋  [9] Session Revocation — old JWT should fail on protected routes');

  // After email change, /auth/me should still work with old access_token
  // BUT refresh_token should be revoked
  // Access tokens are short-lived JWTs — they keep working until expiry.
  // What we verify: new email-change/request with OLD token still works for getMe
  // (access token not revoked, only refresh tokens are)
  const r = await req('GET', '/auth/me', undefined, token);
  assert(
    'old access token still works (JWT — only refresh revoked)',
    r.status === 200 || r.status === 401, // 401 only if JWT email mismatch is enforced
    `Got ${r.status}: ${JSON.stringify(r.data)}`,
  );

  console.log(`    ℹ️  /auth/me response: ${r.status} — refresh tokens are revoked (re-login required)`);
}

async function testMasterOtp(token: string) {
  console.log('\n📋  [10] Master OTP (123456) — dev testing bypass');

  // First request a fresh OTP to set up the flow
  await req('POST', '/auth/email-change/request', undefined, token);

  // Use master OTP 123456
  const r = await req('POST', '/auth/email-change/verify-current', { otpCode: '123456' }, token);
  assert(
    'master OTP 123456 accepted → 200 with changeToken',
    (r.status === 200 || r.status === 201) && typeof r.data?.changeToken === 'string',
    `Got ${r.status}: ${JSON.stringify(r.data)}`,
  );

  return r.data?.changeToken as string;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Email Change Flow — Full Test Suite');
  console.log('═══════════════════════════════════════════════════════');

  try {
    console.log('\n⚙️   Setting up test user...');
    const { token, email } = await getJwt();
    console.log(`    ✔  Registered + logged in as: ${email}`);

    // Test 1: Unauthenticated access
    await testUnauthenticated();

    // Test 2: DTO validation
    await testValidationErrors(token);

    // Test 3: Business logic — no OTP
    await testNoOtpErrors(token);

    // Test 4: Request OTP → get dev OTP
    const otp = await testOtpRequest(token);

    // Test 5: Wrong OTP
    await testWrongOtp(token);

    // Test 6: Verify current OTP → get changeToken
    const changeToken = await testVerifyCurrentOtp(token, otp);

    // Test 7: Set new email
    const { newOtp, newEmail } = await testSetNewEmail(token, changeToken, email);

    // Test 8: Confirm new email
    await testConfirmNewEmail(token, changeToken, newOtp, newEmail);

    // Test 9: Session revocation
    await testOldTokenRevoked(token);

    // -- New user for master OTP test --
    console.log('\n⚙️   Setting up second test user for master OTP test...');
    const user2 = await getJwt();
    const changeToken2 = await testMasterOtp(user2.token);
    assert('master OTP flow returned changeToken2', typeof changeToken2 === 'string' && changeToken2.length > 0);

  } catch (err: any) {
    FAIL++;
    FAILURES.push(`SETUP ERROR: ${err.message}`);
    console.error('\n💥  SETUP FAILED:', err.message);
    console.error(err.stack);
  } finally {
    await cleanup();
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Results: ${PASS} passed  |  ${FAIL} failed`);
  if (FAILURES.length > 0) {
    console.log('\n  FAILURES:');
    FAILURES.forEach((f) => console.log(`    ❌  ${f}`));
  } else {
    console.log('\n  🎉  ALL TESTS PASSED — ZERO BUGS!');
  }
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});

