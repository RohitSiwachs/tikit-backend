import { Module } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';

// Provides RedisThrottlerStorage as a proper NestJS provider so:
//   1. ConfigService (global) is injected via DI — no manual instantiation
//   2. OnModuleDestroy fires correctly on graceful shutdown
//   3. The instance is a singleton within the ThrottlerModule context
@Module({
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class ThrottlerRedisModule {}
