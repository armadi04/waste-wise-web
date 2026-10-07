import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PortalService } from '@/portal/portal.service';
import { CacheService } from '@/common/cache/cache.service';
import { portalRuntimeConfig } from '@/config/portal-runtime.config';

@Injectable()
export class PortalPaymentExpiryService {
  private readonly logger = new Logger(PortalPaymentExpiryService.name);
  constructor(
    private readonly portal: PortalService,
    private readonly cacheService: CacheService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    disabled: portalRuntimeConfig().disableScheduledJobs,
    waitForCompletion: true,
    timeZone: 'UTC',
  })
  async scheduled() {
    try {
      await this.portal.deliverCommerceEvents();
      if (await this.portal.expirePendingOrders())
        await this.cacheService.clearKeys('*/portal*');
    } catch (error) {
      this.logger.error({
        event: 'portal_payment_expiry_failed',
        errorType: error instanceof Error ? error.name : 'Unknown',
      });
    }
  }
}
