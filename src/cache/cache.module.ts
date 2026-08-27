import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * @Global so that CacheService is injectable in any module
 * without needing to import CacheModule explicitly.
 * Register this module once in AppModule.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
