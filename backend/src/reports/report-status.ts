import { BadRequestException } from '@nestjs/common';
import { ReportStatus } from './entities/report.entity';

export const REPORT_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  [ReportStatus.PENDING]: [ReportStatus.IN_PROGRESS, ReportStatus.REJECTED],
  [ReportStatus.IN_PROGRESS]: [ReportStatus.COMPLETED, ReportStatus.REJECTED],
  [ReportStatus.COMPLETED]: [],
  [ReportStatus.REJECTED]: [],
};

export function assertStatusTransition(
  from: ReportStatus,
  to: ReportStatus,
): void {
  if (from === to) {
    throw new BadRequestException(`Report is already ${from}`);
  }
  if (!REPORT_STATUS_TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(
      `Cannot change report status from ${from} to ${to}`,
    );
  }
}
