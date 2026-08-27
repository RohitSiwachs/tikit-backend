import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// ThrottlerStorageRecord is not re-exported from the @nestjs/throttler package root in v6.
// Defined locally here — the shape is authoritative from the installed .d.ts file.
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(config.get<string>('redis.url')!, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });
    this.redis.on('error', (err: Error) =>
      this.logger.warn(`[Throttler] Redis error: ${err.message}`),
    );
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `throttle:${key}`;
    const blockKey = `throttle:block:${key}`;

    try {
      // Fast-path: client is currently in a hard-block window
      const blockPttl = await this.redis.pttl(blockKey);
      if (blockPttl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: 0,
          isBlocked: true,
          timeToBlockExpire: Math.ceil(blockPttl / 1000),
        };
      }

      // Atomically increment the counter and read back the remaining TTL.
      // Using a pipeline keeps both operations in a single round-trip.
      const pipeline = this.redis.pipeline();
      pipeline.incr(hitKey);
      pipeline.pttl(hitKey);
      const results = await pipeline.exec();
      const totalHits = (results![0][1] as number) ?? 1;
      let pttl = (results![1][1] as number) ?? -1;

      // pttl == -1 means the key exists but has no expiry (first hit in this window).
      // pttl == -2 means the key vanished between INCR and PTTL — treat as first hit.
      if (pttl < 0) {
        await this.redis.pexpire(hitKey, ttl);
        pttl = ttl;
      }

      const isBlocked = totalHits > limit;
      let timeToBlockExpire = 0;

      if (isBlocked && blockDuration > 0) {
        await this.redis.set(blockKey, '1', 'PX', blockDuration);
        timeToBlockExpire = Math.ceil(blockDuration / 1000);
      }

      return {
        totalHits,
        timeToExpire: Math.max(0, Math.ceil(pttl / 1000)),
        isBlocked,
        timeToBlockExpire,
      };
    } catch {
      // Redis unavailable — fail open so a Redis outage never takes the API down.
      // Matches the fail-open pattern used by CacheService.
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  onModuleDestroy(): void {
    this.redis.quit().catch(() => {});
  }
}
