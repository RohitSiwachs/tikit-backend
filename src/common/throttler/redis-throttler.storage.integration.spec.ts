/**
 * Integration tests for RedisThrottlerStorage.
 * Run against a real Redis instance — no mocks.
 *
 * Covers: limit boundary, 429 behaviour, counter persistence across restarts,
 * shared counters across instances, Redis outage fail-open, TTL window reset,
 * and blockDuration mechanics.
 *
 * Run:   TEST_REDIS_URL=redis://localhost:6379 npx jest redis-throttler.storage.integration
 *        (falls back to REDIS_URL when TEST_REDIS_URL is not set)
 */

import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

// ─── Prerequisites ─────────────────────────────────────────────────────────────

const REDIS_URL = process.env.TEST_REDIS_URL ?? process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error(
    'FATAL: TEST_REDIS_URL (or REDIS_URL) must be set to run Redis throttler integration tests.\n' +
      'Example: TEST_REDIS_URL=redis://localhost:6379 npx jest redis-throttler.storage.integration',
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Unique key prefix so test keys can be bulk-deleted without touching app data. */
const KEY_PREFIX = 'tikit-throttler-test';
let seq = 0;
const uniqueKey = (): string => `${KEY_PREFIX}:${Date.now()}:${++seq}`;

/**
 * Instantiate RedisThrottlerStorage without NestJS DI.
 * @Injectable() only adds DI metadata — direct instantiation is safe at runtime.
 */
const makeStorage = (url: string = REDIS_URL!): RedisThrottlerStorage =>
  new RedisThrottlerStorage({
    get: (key: string) => (key === 'redis.url' ? url : undefined),
  } as unknown as ConfigService);

/** Pause execution so Redis TTLs can expire in real time. */
const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── Suite ─────────────────────────────────────────────────────────────────────

// Allocate enough time for TTL-expiry tests (1.2 s wait) and CI overhead.
jest.setTimeout(20_000);

describe('RedisThrottlerStorage (integration)', () => {
  /** Primary storage instance, shared across tests that don't need isolation. */
  let storage: RedisThrottlerStorage;

  /**
   * Dedicated ioredis client used only for:
   *   - pre-test connectivity check (PING)
   *   - reading Redis state directly to assert internal invariants
   *   - between-test cleanup (SCAN + DEL)
   *
   * Kept separate from the storage under test so we never accidentally
   * exercise storage internals through the cleanup client.
   */
  let redis: Redis;

  // ─── Setup / teardown ──────────────────────────────────────────────────────

  beforeAll(async () => {
    storage = makeStorage();
    redis = new Redis(REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
    });
    // Fail the entire suite immediately if Redis is unreachable.
    await redis.ping();
  });

  afterEach(async () => {
    /**
     * Remove every key this test file could have created.
     * hitKey  pattern : throttle:tikit-throttler-test:*
     * blockKey pattern: throttle:block:tikit-throttler-test:*
     *
     * SCAN is used instead of KEYS to avoid blocking the Redis event loop.
     */
    for (const pattern of [
      `throttle:${KEY_PREFIX}:*`,
      `throttle:block:${KEY_PREFIX}:*`,
    ]) {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '200',
        );
        cursor = next;
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== '0');
    }
  });

  afterAll(async () => {
    await storage.onModuleDestroy();
    await redis.quit();
  });

  // ─── 1 + 2: Limit boundary ────────────────────────────────────────────────
  //
  // Scenario 1: 60 requests all succeed (totalHits ≤ limit, isBlocked: false)
  // Scenario 2: 61st request is blocked  (isBlocked: true → ThrottlerGuard → HTTP 429)
  // ─────────────────────────────────────────────────────────────────────────────

  describe('1 + 2 — limit boundary', () => {
    it('the first 60 requests within a window all succeed', async () => {
      const key = uniqueKey();

      for (let i = 1; i <= 60; i++) {
        const result = await storage.increment(key, 60_000, 60, 0, 'default');

        expect(result.totalHits).toBe(i);
        expect(result.isBlocked).toBe(false);
        expect(result.timeToBlockExpire).toBe(0);
        // timeToExpire should be a positive number throughout the window
        expect(result.timeToExpire).toBeGreaterThan(0);
      }
    });

    it('the 61st request is blocked — isBlocked: true causes ThrottlerGuard to return HTTP 429', async () => {
      const key = uniqueKey();

      // Exhaust the window
      for (let i = 0; i < 60; i++) {
        await storage.increment(key, 60_000, 60, 0, 'default');
      }

      const blocked = await storage.increment(key, 60_000, 60, 0, 'default');

      expect(blocked.totalHits).toBe(61);
      expect(blocked.isBlocked).toBe(true);
      // timeToExpire tells the client how long to wait before retrying
      expect(blocked.timeToExpire).toBeGreaterThan(0);
    });

    it('reports accurate timeToExpire for the window duration', async () => {
      const key = uniqueKey();
      const ttlMs = 10_000; // 10-second window

      const result = await storage.increment(key, ttlMs, 60, 0, 'default');

      // Math.ceil(pttl / 1000) with a fresh key and ttl=10000 → should be 10.
      // Allow ±1 s tolerance for Redis round-trip and scheduler jitter.
      expect(result.timeToExpire).toBeGreaterThanOrEqual(9);
      expect(result.timeToExpire).toBeLessThanOrEqual(10);
    });
  });

  // ─── 3: Counter persistence (simulated process restart) ───────────────────
  //
  // In-memory storage resets to zero on every Railway deploy/restart.
  // Redis storage survives because the keys live in an external process.
  // ─────────────────────────────────────────────────────────────────────────────

  describe('3 — counter survives process restart', () => {
    it('a new storage instance resumes from the existing counter — not from zero', async () => {
      const key = uniqueKey();

      // Instance 1: 30 requests
      for (let i = 0; i < 30; i++) {
        await storage.increment(key, 60_000, 60, 0, 'default');
      }

      // Simulate process restart: destroy the old instance and create a fresh one.
      // The fresh instance has no in-process state — it only knows the Redis URL.
      const afterRestart = makeStorage();
      try {
        const result = await afterRestart.increment(key, 60_000, 60, 0, 'default');

        // Must continue from 31, not restart at 1
        expect(result.totalHits).toBe(31);
        expect(result.isBlocked).toBe(false);
      } finally {
        await afterRestart.onModuleDestroy();
      }
    });

    it('a client near the limit before restart is blocked after restart — cannot exploit the gap', async () => {
      const key = uniqueKey();

      // Pre-restart: 58 requests
      for (let i = 0; i < 58; i++) {
        await storage.increment(key, 60_000, 60, 0, 'default');
      }

      const afterRestart = makeStorage();
      try {
        // Request 59 and 60 are still allowed
        const r59 = await afterRestart.increment(key, 60_000, 60, 0, 'default');
        const r60 = await afterRestart.increment(key, 60_000, 60, 0, 'default');
        // Request 61 is blocked even though the fresh instance has made 0 prior requests
        const r61 = await afterRestart.increment(key, 60_000, 60, 0, 'default');

        expect(r59.totalHits).toBe(59);
        expect(r59.isBlocked).toBe(false);
        expect(r60.totalHits).toBe(60);
        expect(r60.isBlocked).toBe(false);
        expect(r61.totalHits).toBe(61);
        expect(r61.isBlocked).toBe(true);
      } finally {
        await afterRestart.onModuleDestroy();
      }
    });
  });

  // ─── 4: Shared counters across instances ──────────────────────────────────
  //
  // Multiple Railway instances all increment the SAME Redis key.
  // The combined total enforces the limit regardless of which instance
  // handles each individual request.
  // ─────────────────────────────────────────────────────────────────────────────

  describe('4 — shared counters across instances', () => {
    it('two instances share one counter — combined 60 requests exhaust the limit', async () => {
      const key = uniqueKey();
      const instanceA = makeStorage();
      const instanceB = makeStorage();

      try {
        // 30 concurrent requests from each instance = 60 total, all in parallel.
        // Redis INCR is atomic: each of the 60 INCRs returns a unique value 1..60.
        const results = await Promise.all([
          ...Array.from({ length: 30 }, () =>
            instanceA.increment(key, 60_000, 60, 0, 'default'),
          ),
          ...Array.from({ length: 30 }, () =>
            instanceB.increment(key, 60_000, 60, 0, 'default'),
          ),
        ]);

        // The highest totalHits seen across all 60 concurrent calls must be exactly 60
        const maxHits = Math.max(...results.map((r) => r.totalHits));
        expect(maxHits).toBe(60);

        // None of the 60 calls should be blocked (all have totalHits ≤ 60)
        const blockedResults = results.filter((r) => r.isBlocked);
        expect(blockedResults).toHaveLength(0);

        // The 61st request from EITHER instance must be blocked
        const fromA = await instanceA.increment(key, 60_000, 60, 0, 'default');
        const fromB = await instanceB.increment(key, 60_000, 60, 0, 'default');
        expect(fromA.isBlocked).toBe(true);
        expect(fromB.isBlocked).toBe(true);
      } finally {
        await instanceA.onModuleDestroy();
        await instanceB.onModuleDestroy();
      }
    });

    it('an instance that has sent zero requests is still blocked if another instance exhausted the limit', async () => {
      const key = uniqueKey();
      const instanceA = makeStorage();
      const instanceB = makeStorage();

      try {
        // Instance A alone exhausts the full limit
        for (let i = 0; i < 60; i++) {
          await instanceA.increment(key, 60_000, 60, 0, 'default');
        }

        // Instance B has sent zero requests to this endpoint, but shares the counter.
        // Its very first request should be blocked.
        const result = await instanceB.increment(key, 60_000, 60, 0, 'default');
        expect(result.isBlocked).toBe(true);
        expect(result.totalHits).toBe(61);
      } finally {
        await instanceA.onModuleDestroy();
        await instanceB.onModuleDestroy();
      }
    });
  });

  // ─── 5: Redis outage — fail-open ──────────────────────────────────────────
  //
  // A Redis outage must NEVER take the API down. The storage catches all
  // ioredis errors and returns a permissive record (totalHits: 0, isBlocked: false)
  // so the ThrottlerGuard allows the request through.
  // ─────────────────────────────────────────────────────────────────────────────

  describe('5 — Redis outage: fail-open behaviour', () => {
    it('allows every request through when Redis is unreachable', async () => {
      // Port 1 produces an immediate ECONNREFUSED on any platform.
      // With enableOfflineQueue: false the ioredis command is rejected before
      // the TCP handshake completes, so this call returns in < 100 ms.
      const deadStorage = makeStorage('redis://127.0.0.1:1');

      try {
        const result = await deadStorage.increment(
          'unreachable-test',
          60_000,
          60,
          0,
          'default',
        );

        expect(result.totalHits).toBe(0);       // behaves as if no hits recorded
        expect(result.isBlocked).toBe(false);   // request is allowed through
        expect(result.timeToExpire).toBeGreaterThan(0);
        expect(result.timeToBlockExpire).toBe(0);
      } finally {
        await deadStorage.onModuleDestroy();
      }
    });

    it('swallows the ioredis error — increment never throws', async () => {
      const deadStorage = makeStorage('redis://127.0.0.1:1');

      try {
        // Must resolve, not reject, even with a dead Redis
        await expect(
          deadStorage.increment('swallow-test', 60_000, 60, 0, 'default'),
        ).resolves.toBeDefined();
      } finally {
        await deadStorage.onModuleDestroy();
      }
    });

    it('repeated calls all fail open — no progressive degradation without Redis', async () => {
      const deadStorage = makeStorage('redis://127.0.0.1:1');

      try {
        // Simulate 70 requests with dead Redis — each must be allowed (totalHits: 0)
        const results = await Promise.all(
          Array.from({ length: 70 }, () =>
            deadStorage.increment('flood-test', 60_000, 60, 0, 'default'),
          ),
        );

        expect(results.every((r) => r.isBlocked === false)).toBe(true);
        expect(results.every((r) => r.totalHits === 0)).toBe(true);
      } finally {
        await deadStorage.onModuleDestroy();
      }
    });

    it('live storage continues to enforce limits correctly while another instance is down', async () => {
      const key = uniqueKey();

      // Confirm live storage still increments properly
      const result = await storage.increment(key, 60_000, 10, 0, 'default');
      expect(result.totalHits).toBe(1);
      expect(result.isBlocked).toBe(false);

      // And the counter is actually in Redis
      const raw = await redis.get(`throttle:${key}`);
      expect(raw).toBe('1');
    });
  });

  // ─── 6: TTL window reset ──────────────────────────────────────────────────
  //
  // The counter key has a fixed-window TTL anchored to the first request.
  // After the TTL elapses, Redis deletes the key automatically and the next
  // increment starts a fresh window at totalHits: 1.
  // ─────────────────────────────────────────────────────────────────────────────

  describe('6 — TTL window reset', () => {
    it('resets the counter to 1 when the TTL window expires', async () => {
      const key = uniqueKey();
      const ttlMs = 500; // tiny window keeps the test fast

      // Fill part of the window
      for (let i = 0; i < 10; i++) {
        await storage.increment(key, ttlMs, 100, 0, 'default');
      }

      // Counter must be at 10 before the window expires
      const beforeExpiry = await storage.increment(key, ttlMs, 100, 0, 'default');
      expect(beforeExpiry.totalHits).toBe(11);

      // Wait past the TTL — Redis deletes the key automatically
      await wait(700);

      // The key must be gone
      const exists = await redis.exists(`throttle:${key}`);
      expect(exists).toBe(0);

      // First request in the new window starts at 1, not 12
      const afterExpiry = await storage.increment(key, ttlMs, 100, 0, 'default');
      expect(afterExpiry.totalHits).toBe(1);
      expect(afterExpiry.isBlocked).toBe(false);
    });

    it('the TTL is anchored to the FIRST request — subsequent requests do not extend it', async () => {
      const key = uniqueKey();
      const ttlMs = 1_000; // 1-second window

      // First request — sets the TTL anchor
      await storage.increment(key, ttlMs, 100, 0, 'default');

      // 9 more requests — must NOT reset the expiry
      for (let i = 0; i < 9; i++) {
        await storage.increment(key, ttlMs, 100, 0, 'default');
      }

      // After ~500 ms (half the window), the remaining TTL should be ~500 ms.
      // If subsequent requests were resetting the TTL it would still be ~1000 ms.
      await wait(500);
      const pttl = await redis.pttl(`throttle:${key}`);

      expect(pttl).toBeGreaterThan(0);   // key still exists (window not yet over)
      expect(pttl).toBeLessThan(700);    // at most ~600 ms left — not reset to 1000 ms
    });

    it('a new window starts cleanly — timeToExpire reflects the full TTL', async () => {
      const key = uniqueKey();
      const ttlMs = 500;

      // Use the window and wait for it to expire
      await storage.increment(key, ttlMs, 100, 0, 'default');
      await wait(700);

      // New window: first request should report timeToExpire ≈ ttlMs/1000 seconds
      const fresh = await storage.increment(key, ttlMs, 100, 0, 'default');

      expect(fresh.totalHits).toBe(1);
      // Math.ceil(500 / 1000) = 1, so timeToExpire should be 1
      expect(fresh.timeToExpire).toBeGreaterThanOrEqual(0);
      expect(fresh.timeToExpire).toBeLessThanOrEqual(1);
    });

    it('a client that was blocked before the window expires is unblocked after it', async () => {
      const key = uniqueKey();
      const ttlMs = 500;
      const limit = 3;

      // Exceed the limit
      for (let i = 0; i < 4; i++) {
        await storage.increment(key, ttlMs, limit, 0, 'default');
      }

      const stillBlocked = await storage.increment(key, ttlMs, limit, 0, 'default');
      expect(stillBlocked.isBlocked).toBe(true);

      // Wait for the window to expire
      await wait(700);

      // The block was carried by the hit counter (no blockDuration, no block key).
      // After TTL expiry the hit counter is gone → new window starts unblocked.
      const unblocked = await storage.increment(key, ttlMs, limit, 0, 'default');
      expect(unblocked.totalHits).toBe(1);
      expect(unblocked.isBlocked).toBe(false);
    });
  });

  // ─── blockDuration mechanics ──────────────────────────────────────────────
  //
  // When a @Throttle() decorator sets blockDuration > 0, a separate Redis key
  // (the "block key") is written on first violation. Subsequent requests hit the
  // fast-path check (PTTL on the block key) and return immediately without
  // incrementing the hit counter.
  // ─────────────────────────────────────────────────────────────────────────────

  describe('blockDuration mechanics', () => {
    it('writes a block key in Redis when the limit is exceeded with blockDuration > 0', async () => {
      const key = uniqueKey();
      const blockDuration = 5_000; // 5-second hard block
      const limit = 3;

      // Exactly 3 requests — within the limit
      for (let i = 0; i < limit; i++) {
        const result = await storage.increment(
          key,
          60_000,
          limit,
          blockDuration,
          'default',
        );
        expect(result.isBlocked).toBe(false);
      }

      // 4th request — exceeds the limit, block key is written
      const blocked = await storage.increment(
        key,
        60_000,
        limit,
        blockDuration,
        'default',
      );
      expect(blocked.isBlocked).toBe(true);
      expect(blocked.timeToBlockExpire).toBeGreaterThan(0);
      expect(blocked.timeToBlockExpire).toBeLessThanOrEqual(5);

      // Assert the block key actually exists in Redis with a positive TTL
      const blockPttl = await redis.pttl(`throttle:block:${key}`);
      expect(blockPttl).toBeGreaterThan(0);
      expect(blockPttl).toBeLessThanOrEqual(5_000);
    });

    it('blocked requests use the fast-path and do NOT increment the hit counter', async () => {
      const key = uniqueKey();
      const blockDuration = 5_000;
      const limit = 3;

      // Trigger the block (4 requests with limit 3)
      for (let i = 0; i < 4; i++) {
        await storage.increment(key, 60_000, limit, blockDuration, 'default');
      }

      // Read the hit counter before the fast-path call
      const counterBefore = await redis.get(`throttle:${key}`);
      expect(counterBefore).toBe('4');

      // Fast-path call: should detect the block key immediately and return
      // without touching the hit counter
      const fastPathResult = await storage.increment(
        key,
        60_000,
        limit,
        blockDuration,
        'default',
      );

      expect(fastPathResult.isBlocked).toBe(true);
      // Fast-path always returns limit + 1 (not the actual Redis counter)
      expect(fastPathResult.totalHits).toBe(limit + 1);

      // Hit counter must be unchanged — no INCR happened
      const counterAfter = await redis.get(`throttle:${key}`);
      expect(counterAfter).toBe(counterBefore);
    });
  });
});
