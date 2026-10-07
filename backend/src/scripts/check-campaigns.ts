import { PortalCampaignReconciliationService } from '@/portal/campaigns/portal-campaign-reconciliation.service';
import { runScript } from './lib/script-runner';

void runScript(
  async (app) => {
    const report = await app.get(PortalCampaignReconciliationService).check();
    console.log(JSON.stringify(report));
    if (report.skipped)
      throw new Error('Campaign reconciliation already running; retry later');
    if (report.issueCount)
      throw new Error(
        'Campaign reconciliation detected inconsistencies; inspect report and review correction',
      );
  },
  { skipMigrations: true, synchronize: false },
);
