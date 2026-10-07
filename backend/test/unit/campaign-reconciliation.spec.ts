import { afterEach, expect, it, mock, spyOn } from 'bun:test';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { PortalCampaignReconciliationService } from '@/portal/campaigns/portal-campaign-reconciliation.service';

afterEach(() => mock.restore());
it('emits an operational alert summary without personal samples or reward codes', async () => {
  const service = new PortalCampaignReconciliationService({} as DataSource);
  spyOn(service, 'check').mockResolvedValue({
    checkedAt: '2026-10-03T00:00:00Z',
    skipped: false,
    issueCount: 1,
    counts: { balance_mismatch: 1 },
    samples: [{ kind: 'balance_mismatch', campaignId: 99, userId: 456 }],
  });
  const error = spyOn(Logger.prototype, 'error').mockImplementation(
    () => undefined,
  );
  await service.scheduled();
  expect(error).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(error.mock.calls)).toContain(
    'campaign_reconciliation_mismatch',
  );
  expect(JSON.stringify(error.mock.calls)).not.toContain('456');
});
it('reports reconciliation failures and skips overlapping jobs without a false healthy signal', async () => {
  const service = new PortalCampaignReconciliationService({} as DataSource);
  const check = spyOn(service, 'check').mockResolvedValue({
    checkedAt: '2026-10-03T00:00:00Z',
    skipped: true,
    issueCount: 0,
    counts: {},
    samples: [],
  });
  const log = spyOn(Logger.prototype, 'log').mockImplementation(
    () => undefined,
  );
  const error = spyOn(Logger.prototype, 'error').mockImplementation(
    () => undefined,
  );
  await service.scheduled();
  expect(log).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
  check.mockRejectedValue(new Error('PRIVATE-CONNECTION-DETAILS'));
  await service.scheduled();
  expect(JSON.stringify(error.mock.calls)).toContain(
    'campaign_reconciliation_failed',
  );
  expect(JSON.stringify(error.mock.calls)).not.toContain(
    'PRIVATE-CONNECTION-DETAILS',
  );
});
