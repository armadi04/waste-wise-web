import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService } from './cache.service';

/**
 * Cache invalidation for writes that don't go through a controller that clears
 * its own keys: accounts are also created by Google sign-in, SSO
 * provisioning and invitation acceptance.
 */
@Injectable()
export class CacheInvalidationListener {
  constructor(private readonly cacheService: CacheService) {}

  @OnEvent('user.created')
  @OnEvent('user.roles_updated')
  async clearUsers() {
    await this.cacheService.clearKeys('*/users*');
  }
}
