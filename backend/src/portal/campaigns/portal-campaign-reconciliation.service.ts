import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { portalRuntimeConfig } from '@/config/portal-runtime.config';
import { DataSource, EntityManager } from 'typeorm';
import { PortalCampaignLedger } from '@/portal/campaigns/entities/portal-campaign-ledger.entity';
import { PortalCampaignProgress } from '@/portal/campaigns/entities/portal-campaign-progress.entity';
import { PortalPromoCode } from '@/portal/commerce/entities/portal-promo-code.entity';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';

export interface CampaignReconciliationReport {
  checkedAt: string;
  skipped: boolean;
  issueCount: number;
  counts: Record<string, number>;
  samples: Array<{ kind: string; campaignId: number; userId: number }>;
}

@Injectable()
export class PortalCampaignReconciliationService {
  private readonly logger = new Logger(
    PortalCampaignReconciliationService.name,
  );
  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_HOUR, {
    timeZone: 'UTC',
    disabled: portalRuntimeConfig().disableScheduledJobs,
    waitForCompletion: true,
  })
  async scheduled(): Promise<void> {
    try {
      const report = await this.check();
      if (!report.skipped) {
        const summary = {
          event: report.issueCount
            ? 'campaign_reconciliation_mismatch'
            : 'campaign_reconciliation_ok',
          checkedAt: report.checkedAt,
          issueCount: report.issueCount,
          counts: report.counts,
        };
        if (report.issueCount) this.logger.error(summary);
        else this.logger.log(summary);
      }
    } catch (error) {
      this.logger.error({
        event: 'campaign_reconciliation_failed',
        errorType: error instanceof Error ? error.name : 'Unknown',
      });
    }
  }

  // Detection only: a consistent snapshot cannot repair balances or mint discounts.
  // Corrections remain explicit, reviewed and auditable through the adjustment API.
  async check(): Promise<CampaignReconciliationReport> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      await manager.query("SET LOCAL statement_timeout = '15s'");
      const [lease] = await manager.query<Array<{ acquired: boolean }>>(
        'SELECT pg_try_advisory_xact_lock(71404, 0) AS acquired',
      );
      const checkedAt = new Date().toISOString();
      if (!lease.acquired)
        return {
          checkedAt,
          skipped: true,
          issueCount: 0,
          counts: {},
          samples: [],
        };
      const issues = this.issuesSql(manager);
      const grouped = await manager.query<
        Array<{ kind: string; count: string }>
      >(
        `${issues} SELECT kind, count(*)::text AS count FROM issues GROUP BY kind ORDER BY kind`,
      );
      const samples = await manager.query<
        CampaignReconciliationReport['samples']
      >(
        `${issues} SELECT kind, "campaignId", "userId" FROM issues ORDER BY kind, "campaignId", "userId" LIMIT 20`,
      );
      const counts = Object.fromEntries(
        grouped.map((row) => [row.kind, Number(row.count)]),
      );
      return {
        checkedAt,
        skipped: false,
        issueCount: Object.values(counts).reduce(
          (sum, value) => sum + value,
          0,
        ),
        counts,
        samples,
      };
    });
  }

  private issuesSql(manager: EntityManager): string {
    const table = (entity: Parameters<EntityManager['getRepository']>[0]) =>
      manager.connection
        .getMetadata(entity)
        .tablePath.split('.')
        .map((part) => `"${part.replaceAll('"', '""')}"`)
        .join('.');
    return `WITH ledger AS (
      SELECT "campaignId", "userId", sum(points)::bigint AS points,
        bool_or(kind != 'baseline') AS activity FROM ${table(PortalCampaignLedger)} GROUP BY "campaignId", "userId"
    ), balances AS (
      SELECT coalesce(l."campaignId", p."campaignId") AS "campaignId", coalesce(l."userId", p."userId") AS "userId",
        coalesce(l.points, 0) AS expected, l.activity, p.id, p.points, p."targetPoints", p.status, p."deletedAt"
      FROM ledger l FULL JOIN ${table(PortalCampaignProgress)} p USING ("campaignId", "userId")
    ), issues AS (
      SELECT 'balance_mismatch' AS kind, "campaignId", "userId" FROM balances WHERE id IS NOT NULL AND points != expected
      UNION ALL SELECT 'progress_missing', "campaignId", "userId" FROM balances WHERE id IS NULL OR "deletedAt" IS NOT NULL
      UNION ALL SELECT 'progress_status', "campaignId", "userId" FROM balances WHERE activity AND status != CASE WHEN expected >= "targetPoints" THEN 'eligible' ELSE 'pending' END
      UNION ALL SELECT 'target_mismatch', b."campaignId", b."userId" FROM balances b JOIN ${table(PortalCampaign)} c ON c.id = b."campaignId" WHERE b.activity IS NOT NULL AND b."targetPoints" != c."targetPoints"
      UNION ALL SELECT 'reward_missing', b."campaignId", b."userId" FROM balances b JOIN ${table(PortalCampaign)} c ON c.id = b."campaignId"
        WHERE b.activity AND b.expected >= b."targetPoints" AND c.rules IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${table(PortalPromoCode)} r WHERE r."campaignId" = b."campaignId" AND r."ownerUserId" = b."userId")
      UNION ALL SELECT 'reward_eligibility', r."campaignId", r."ownerUserId" FROM ${table(PortalPromoCode)} r LEFT JOIN balances b ON b."campaignId" = r."campaignId" AND b."userId" = r."ownerUserId"
        WHERE r."campaignId" IS NOT NULL AND r."ownerUserId" IS NOT NULL AND r."deletedAt" IS NULL AND r."consumedAt" IS NULL AND r."expiresAt" > now()
        AND (b.id IS NULL OR (b.expected < b."targetPoints" AND (r.active OR r."revokedAt" IS NULL)) OR (b.expected >= b."targetPoints" AND (NOT r.active OR r."revokedAt" IS NOT NULL)))
      UNION ALL SELECT 'reward_consumption', r."campaignId", r."ownerUserId" FROM ${table(PortalPromoCode)} r
        WHERE r."campaignId" IS NOT NULL AND r."ownerUserId" IS NOT NULL AND (r."usageCount" > 1 OR r."usageCount" < 0 OR (r."consumedAt" IS NULL AND r."reservedOrderId" IS NULL AND r."usageCount" != 0) OR (r."consumedAt" IS NOT NULL AND (r."usageCount" != 1 OR r."reservedOrderId" IS NOT NULL)))
      UNION ALL SELECT 'reward_terms', r."campaignId", r."ownerUserId" FROM ${table(PortalPromoCode)} r JOIN ${table(PortalCampaign)} c ON c.id = r."campaignId"
        WHERE r."ownerUserId" IS NOT NULL AND c.rules IS NOT NULL AND (r.kind IS DISTINCT FROM c.rules->'reward'->>'kind' OR r.value IS DISTINCT FROM (c.rules->'reward'->>'value')::int OR r."minimumOrder" IS DISTINCT FROM (c.rules->'reward'->>'minimumOrder')::int OR r."maximumDiscount" IS DISTINCT FROM (c.rules->'reward'->>'maximumDiscount')::int)
      UNION ALL SELECT 'reward_reservation', r."campaignId", r."ownerUserId" FROM ${table(PortalPromoCode)} r LEFT JOIN ${table(PortalOrder)} o ON o.id = r."reservedOrderId"
        WHERE r."campaignId" IS NOT NULL AND r."ownerUserId" IS NOT NULL AND r."reservedOrderId" IS NOT NULL
        AND (o.id IS NULL OR o.status != 'Pending' OR o."userId" != r."ownerUserId" OR o."promoCode" IS DISTINCT FROM r.code OR r."usageCount" != 1 OR o."deletedAt" IS NOT NULL)
    )`;
  }
}
