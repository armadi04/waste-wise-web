import { ReportStatus } from './entities/report.entity';

/** Emitted by ReportsService after a report's handling status changes. */
export const REPORT_STATUS_CHANGED = 'report.status_changed';

export interface ReportStatusChangedEvent {
  reportId: number;
  reporterId: number;
  actorId: number;
  from: ReportStatus;
  to: ReportStatus;
}

export type ReportStatusNotificationTone = 'info' | 'success' | 'warning';

/**
 * Reporter-facing copy for a status change. Kept with the reports domain so
 * the notification listener stays a thin transport.
 */
export function reportStatusNotification(
  reportId: number,
  to: ReportStatus,
): { title: string; message: string; tone: ReportStatusNotificationTone } {
  switch (to) {
    case ReportStatus.IN_PROGRESS:
      return {
        title: 'Report in progress',
        message: `Your report #${reportId} is now being handled.`,
        tone: 'info',
      };
    case ReportStatus.COMPLETED:
      return {
        title: 'Report completed',
        message: `Your report #${reportId} has been handled. Thank you for reporting!`,
        tone: 'success',
      };
    case ReportStatus.REJECTED:
      return {
        title: 'Report rejected',
        message: `Your report #${reportId} was rejected. Check the report for details.`,
        tone: 'warning',
      };
    default:
      return {
        title: 'Report updated',
        message: `Your report #${reportId} is pending again.`,
        tone: 'info',
      };
  }
}
