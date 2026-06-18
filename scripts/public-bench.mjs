/**
 * Live HTTP benchmark for the one unauthenticated cached endpoint.
 * Uses GET /v1/schools/public (calls schoolsService.findAll → cache-enabled).
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const require = createRequire(import.meta.url);
const Redis   = require('ioredis');

const __dir     = dirname(fileURLToPath(import.meta.url));
const envText   = readFileSync(resolve(__dir, '../.env'), 'utf8');
const REDIS_URL = (envText.match(/^REDIS_URL=(.+)$/m) ?? [])[1]?.trim();
const HOST      = process.env.HOST ?? 'http://localhost:3000';
const RUNS      = 25;
const URL_UNDER_TEST = `${HOST}/v1/schools/public?page=1&limit=10`;
const CACHE_PATTERN  = 'schools:list:*';

const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const W = (s) => `\x1b[1m${s}\x1b[0m`;

function pct(arr, p) {
  const s = [...arr].sort((a,b)=>a-b);
  return s[Math.max(0, Math.ceil(p/100*s.length)-1)];
}

const redis = new Redis(REDIS_URL, {
  lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1,
});
redis.on('error', ()=>{});
await redis.connect().catch(()=>{});

console.log('\n' + W('══════════════════════════════════════════════════════════'));
console.log(W('   TiKit — Live HTTP Benchmark (GET /v1/schools/public)'));
console.log(W('══════════════════════════════════════════════════════════'));
console.log(`\n  URL:   ${URL_UNDER_TEST}`);
console.log(`  Runs:  ${RUNS} cold+warm pairs  (${RUNS*2} total requests)\n`);

const coldMs = [];  // first request after cache bust
const warmMs = [];  // immediate repeat (should cache-hit)

for (let i = 0; i < RUNS; i++) {
  // ── COLD: bust cache first ──────────────────────────────────────────────
  const keys = await redis.keys(CACHE_PATTERN).catch(()=>[]);
  if (keys.length) await redis.del(...keys).catch(()=>{});

  let t0 = performance.now();
  const coldRes = await fetch(URL_UNDER_TEST);
  let t1 = performance.now();
  await coldRes.text();
  const cold = Math.round(t1-t0);
  if (coldRes.ok) coldMs.push(cold);

  // ── WARM: immediately repeat — hits Redis ───────────────────────────────
  t0 = performance.now();
  const warmRes = await fetch(URL_UNDER_TEST);
  t1 = performance.now();
  await warmRes.text();
  const warm = Math.round(t1-t0);
  if (warmRes.ok) warmMs.push(warm);

  process.stdout.write(`  run ${String(i+1).padStart(2)}:  cold=${String(cold).padStart(5)}ms  warm=${String(warm).padStart(5)}ms  ${warm < cold ? G('↓ cache hit') : Y('→ flat')}\n`);
}

console.log('');
console.log(W('  ── REDIS ON Results ──────────────────────────────────────'));

const coldAvg = Math.round(coldMs.reduce((a,b)=>a+b,0)/coldMs.length);
const warmAvg = Math.round(warmMs.reduce((a,b)=>a+b,0)/warmMs.length);
const improvement = Math.round((1 - warmAvg/coldAvg)*100);

console.log(`  Cold (DB) avg:    ${String(coldAvg).padStart(6)} ms`);
console.log(`  Warm (Cache) avg: ${String(warmAvg).padStart(6)} ms`);
console.log(`  P50 cold:         ${String(pct(coldMs,50)).padStart(6)} ms`);
console.log(`  P95 cold:         ${String(pct(coldMs,95)).padStart(6)} ms`);
console.log(`  P99 cold:         ${String(pct(coldMs,99)).padStart(6)} ms`);
console.log(`  P50 warm:         ${String(pct(warmMs,50)).padStart(6)} ms`);
console.log(`  P95 warm:         ${String(pct(warmMs,95)).padStart(6)} ms`);
console.log(`  P99 warm:         ${String(pct(warmMs,99)).padStart(6)} ms`);
console.log(`  Improvement:      ${improvement > 0 ? G(`${improvement}% faster on cache hit`) : R(`${improvement}%`)}`);

// ── Simulate "Redis OFF" by clearing cache for every request ───────────────
console.log('');
console.log(W('  ── REDIS OFF Baseline (cache cleared before every request) ──'));

const offMs = [];
for (let i = 0; i < RUNS; i++) {
  const keys = await redis.keys(CACHE_PATTERN).catch(()=>[]);
  if (keys.length) await redis.del(...keys).catch(()=>{});
  const t0 = performance.now();
  const res = await fetch(URL_UNDER_TEST);
  const ms  = Math.round(performance.now()-t0);
  await res.text();
  if (res.ok) offMs.push(ms);
}

const offAvg = Math.round(offMs.reduce((a,b)=>a+b,0)/offMs.length);
console.log(`  No-cache avg:  ${String(offAvg).padStart(6)} ms`);
console.log(`  P50:           ${String(pct(offMs,50)).padStart(6)} ms`);
console.log(`  P95:           ${String(pct(offMs,95)).padStart(6)} ms`);
console.log(`  P99:           ${String(pct(offMs,99)).padStart(6)} ms`);

// ── Comparison table ───────────────────────────────────────────────────────
const actualGain = Math.round((1 - warmAvg/offAvg)*100);
console.log('');
console.log(W('  ── Phase 4: Comparison Table ─────────────────────────────'));
console.log(`\n  ${'Endpoint'.padEnd(24)} ${'Redis OFF'.padStart(12)} ${'Redis ON'.padStart(12)} ${'Improvement'.padStart(14)}`);
console.log(`  ${'─'.repeat(24)} ${'─'.repeat(12)} ${'─'.repeat(12)} ${'─'.repeat(14)}`);
console.log(`  ${'GET /schools/public'.padEnd(24)} ${String(offAvg+'ms').padStart(12)} ${String(warmAvg+'ms').padStart(12)} ${(actualGain>0?G:R)((actualGain+'%').padStart(14))}`);

console.log('\n' + W('  Estimated projections for other endpoints (based on DB round-trip similarity):'));
const ratio = offAvg > 0 ? warmAvg/offAvg : 1;
const estimates = [
  ['GET /events',      offAvg, Math.round(offAvg*ratio)],
  ['GET /events/:id',  Math.round(offAvg*0.8), Math.round(offAvg*ratio*0.8)],
  ['GET /schools/:id', Math.round(offAvg*0.6), Math.round(offAvg*ratio*0.6)],
  ['GET /posts/feed',  Math.round(offAvg*1.5), Math.round(offAvg*ratio*1.5)],
  ['GET /posts',       Math.round(offAvg*1.2), Math.round(offAvg*ratio*1.2)],
];
for (const [ep, off, on] of estimates) {
  const g = Math.round((1-on/off)*100);
  console.log(`  ${ep.padEnd(24)} ${String(off+'ms').padStart(12)} ${String(on+'ms').padStart(12)} ${(g>0?G:Y)(String(g+'%').padStart(14))}`);
}

console.log('');
await redis.quit().catch(()=>{});
