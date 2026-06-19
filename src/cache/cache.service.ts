import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin Redis wrapper used exclusively for application-level caching.
 * All methods swallow errors so that a Redis outage never breaks the API —
 * the app simply falls back to hitting the database on every request.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('redis.url');

    this.client = new Redis(redisUrl!, {
      lazyConnect: true,
      enableOfflineQueue: false, // fail fast when Redis is down
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
    });

    this.client.on('error', (err: Error) => {
      this.logger.warn(`[Cache] Redis error: ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('[Cache] Redis connected');
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err: any) {
      this.logger.warn(`[Cache] get("${key}") failed: ${err?.message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`[Cache] set("${key}") failed: ${err?.message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`[Cache] del("${key}") failed: ${err?.message}`);
    }
  }

  /**
   * Delete every key that matches a glob pattern using non-blocking SCAN.
   * Avoids the O(N) KEYS command that blocks the Redis event loop.
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '100',
        );
        cursor = next;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err: any) {
      this.logger.warn(`[Cache] delByPattern("${pattern}") failed: ${err?.message}`);
    }
  }
}
