import { describe, expect, it } from 'bun:test';
import { ReportStatus } from '../../../src/reports/entities/report.entity';
import { reportStatusNotification } from '../../../src/reports/report-events';

describe('reportStatusNotification', () => {
  it('describes each handled status for the reporter', () => {
    expect(reportStatusNotification(7, ReportStatus.IN_PROGRESS)).toEqual({
      title: 'Report in progress',
      message: 'Your report #7 is now being handled.',
      tone: 'info',
    });
    expect(reportStatusNotification(7, ReportStatus.COMPLETED).tone).toBe(
      'success',
    );
    expect(reportStatusNotification(7, ReportStatus.REJECTED)).toMatchObject({
      title: 'Report rejected',
      tone: 'warning',
    });
  });
});
