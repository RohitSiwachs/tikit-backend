/**
 * HTTP Benchmark Script — Phases 2, 3, 4
 *
 * Usage:
 *   node scripts/http-benchmark.mjs --email your@email.com --password yourpass
 *   node scripts/http-benchmark.mjs --token "Bearer eyJhbGc..."
 *
 * Optional flags:
 *   --host   http://localhost:3000   (default)
 *   --runs   20                      (requests per endpoint, default 20)
 *   --redis-off                      (skip cache check — baseline mode)
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const require = createRequire(import.meta.url);
const Redis   = require('ioredis');

const __dir = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dir, '../.env'), 'utf8');

function getEnv(key) {
  const m = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim() : null;
}
const REDIS_URL = getEnv('REDIS_URL');

// ── CLI parsing ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i+1] : null; };
const has  = (flag) => args.includes(flag);

const HOST     = get('--host')     ?? 'http://localhost:3000';
const RUNS     = parseInt(get('--runs') ?? '20');
const EMAIL    = get('--email');
const PASSWORD = get('--password');
const TOKEN_IN = get('--token');
const REDIS_OFF = has('--redis-off');

// ── colours ───────────────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const B = (s) => `\x1b[34m${s}\x1b[0m`;
const W = (s) => `\x1b[1m${s}\x1b[0m`;

// ── get JWT token ─────────────────────────────────────────────────────────────
async function getToken() {
  if (TOKEN_IN) return TOKEN_IN;
  if (!EMAIL || !PASSWORD) {
    console.error(R('\nError: supply --email + --password, or --token'));
    console.error('  node scripts/http-benchmark.mjs --email you@school.se --password secret\n');
    process.exit(1);
  }
  const res = await fetch(`${HOST}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(R(`\nLogin failed (${res.status}): ${t}`));
    process.exit(1);
  }
  const body = await res.json();
  const token = body.accessToken ?? body.access_token ?? body.token;
  if (!token) {
    console.error(R('\nNo token in login response:'), JSON.stringify(body));
    process.exit(1);
  }
  console.log(G('  Authenticated successfully'));
  return `Bearer ${token}`;
}

// ── single timed request ──────────────────────────────────────────────────────
async function timedFetch(url, token) {
  const t0 = performance.now();
  const res = await fetch(url, {
    headers: { Authorization: token, 'Accept': 'application/json' },
  });
  const t1 = performance.now();
  const ok  = res.status < 400;
  // consume body
  await res.text().catch(() => {});
  return { ms: Math.round(t1 - t0), ok, status: res.status };
}

// ── percentile helper ─────────────────────────────────────────────────────────
function percentile(arr, p) {
  const sorted = [...arr].sort((a,b) => a-b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── benchmark one endpoint ────────────────────────────────────────────────────
async function benchmarkEndpoint(label, url, token, redis) {
  const coldTimes = [];
  const warmTimes = [];

  process.stdout.write(`  ${label.padEnd(28)} `);

  for (let i = 0; i < RUNS; i++) {
    // Cold: clear cache, first request
    if (redis && !REDIS_OFF) {
      const cacheKey = urlToCachePattern(url);
      if (cacheKey) {
        const keys = await redis.keys(cacheKey);
        if (keys.length > 0) await redis.del(...keys);
      }
    }

    const cold = await timedFetch(url, token);
    if (!cold.ok) {
      process.stdout.write(R(`[${cold.status}] `));
      continue;
    }
    coldTimes.push(cold.ms);

    // Warm: second request (should hit cache)
    const warm = await timedFetch(url, token);
    if (warm.ok) warmTimes.push(warm.ms);
  }

  if (coldTimes.length === 0) {
    console.log(R('ALL REQUESTS FAILED'));
    return null;
  }

  const coldAvg = Math.round(coldTimes.reduce((a,b)=>a+b,0) / coldTimes.length);
  const warmAvg = warmTimes.length
    ? Math.round(warmTimes.reduce((a,b)=>a+b,0) / warmTimes.length)
    : null;
  const p50 = percentile(coldTimes, 50);
  const p95 = percentile(coldTimes, 95);
  const p99 = percentile(coldTimes, 99);
  const improvement = warmAvg ? Math.round((1 - warmAvg / coldAvg) * 100) : null;

  const impStr = improvement !== null
    ? (improvement > 0 ? G(`${improvement}% faster`) : R(`${improvement}% slower`))
    : Y('N/A');

  console.log(
    `cold=${String(coldAvg).padStart(5)}ms  warm=${warmAvg !== null ? String(warmAvg).padStart(5) : ' ─   '}ms  improve=${impStr}  p50=${p50}ms p95=${p95}ms p99=${p99}ms`
  );

  return { label, coldAvg, warmAvg, p50, p95, p99, improvement };
}

// ── map URL to a Redis cache pattern ─────────────────────────────────────────
function urlToCachePattern(url) {
  const path = url.replace(HOST + '/v1', '');
  if (path.startsWith('/events?'))       return 'events:list:*';
  if (path.match(/^\/events\/[^/]+$/))   return null; // events:base:{id} — only clear after knowing the id
  if (path.startsWith('/schools?') || path === '/schools') return 'schools:list:*';
  if (path.match(/^\/schools\/[^/]+$/))  return null;
  if (path.startsWith('/posts/feed'))     return 'feed:base:*';
  if (path.startsWith('/posts?') || path === '/posts') return 'posts:list:*';
  if (path.match(/^\/posts\/[^/]+$/))    return null;
  return null;
}

// ── main ──────────────────────────────────────────────────────────────────────
console.log('\n' + W('════════════════════════════════════════════════════════════'));
console.log(W('         TiKit — Redis Cache HTTP Benchmark'));
console.log(W('════════════════════════════════════════════════════════════\n'));
console.log(`  Host:  ${HOST}`);
console.log(`  Runs:  ${RUNS} cold+warm pairs per endpoint`);
console.log(`  Mode:  ${REDIS_OFF ? Y('Redis OFF (baseline)') : G('Redis ON')}\n`);

// Connect Redis (for cache clearing between runs)
const redis = REDIS_URL && !REDIS_OFF
  ? new Redis(REDIS_URL, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 })
  : null;
if (redis) {
  redis.on('error', () => {});
  try { await redis.connect(); } catch {}
}

const token = await getToken();

console.log('\n  ' + W(`${'Endpoint'.padEnd(28)} ${'Cold avg'.padStart(9)}  ${'Warm avg'.padStart(9)}  Improvement               Percentiles`));
console.log('  ' + '─'.repeat(110));

// ── List of endpoints to benchmark ───────────────────────────────────────────
// Adjust the IDs below to real IDs in your database.
// If ID is unknown, the endpoint will return 404 and be skipped.
const endpoints = [
  ['GET /events',         `${HOST}/v1/events?page=1&limit=10`],
  ['GET /events/:id',     `${HOST}/v1/events/REPLACE_WITH_REAL_EVENT_ID`],
  ['GET /schools',        `${HOST}/v1/schools?page=1&limit=10`],
  ['GET /schools/:id',    `${HOST}/v1/schools/REPLACE_WITH_REAL_SCHOOL_ID`],
  ['GET /posts/feed',     `${HOST}/v1/posts/feed?page=1&limit=20`],
  ['GET /posts',          `${HOST}/v1/posts?page=1&limit=10`],
];

const allResults = [];
for (const [label, url] of endpoints) {
  const r = await benchmarkEndpoint(label, url, token, redis);
  if (r) allResults.push(r);
}

// ── Summary table ─────────────────────────────────────────────────────────────
if (allResults.length > 0) {
  console.log('\n' + W('  Summary Table'));
  console.log('  ' + '─'.repeat(70));
  console.log(`  ${'Endpoint'.padEnd(22)}  ${'Cold (ms)'.padStart(10)}  ${'Warm (ms)'.padStart(10)}  ${'Δ%'.padStart(8)}`);
  console.log('  ' + '─'.repeat(70));
  for (const r of allResults) {
    const impStr = r.improvement !== null
      ? (r.improvement > 0 ? G(`${r.improvement}%`) : R(`${r.improvement}%`))
      : Y('─');
    console.log(`  ${r.label.padEnd(22)}  ${String(r.coldAvg).padStart(10)}  ${r.warmAvg !== null ? String(r.warmAvg).padStart(10) : '         ─'}  ${impStr.padStart(8)}`);
  }
  const avgImprovements = allResults.filter(r => r.improvement !== null).map(r => r.improvement);
  if (avgImprovements.length > 0) {
    const avg = Math.round(avgImprovements.reduce((a,b)=>a+b,0) / avgImprovements.length);
    const best = allResults.reduce((a,b) => (b.improvement ?? -999) > (a.improvement ?? -999) ? b : a);
    console.log('\n  ' + W(`Average improvement: ${avg}%`));
    console.log('  ' + W(`Best endpoint:       ${best.label}  (${best.improvement}% faster)`));
  }
}

console.log('');
if (redis) await redis.quit().catch(() => {});
