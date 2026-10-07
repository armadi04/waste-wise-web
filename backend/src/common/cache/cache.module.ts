import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInvalidationListener } from './cache-invalidation.listener';

@Global()
@Module({
  providers: [CacheService, CacheInvalidationListener],
  exports: [CacheService],
})
export class CacheModule {}
