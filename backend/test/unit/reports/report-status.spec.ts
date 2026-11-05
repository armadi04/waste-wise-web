import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'bun:test';
import { ReportStatus } from '../../../src/reports/entities/report.entity';
import {
  REPORT_STATUS_TRANSITIONS,
  assertStatusTransition,
} from '../../../src/reports/report-status';

describe('report status transitions', () => {
  it('allows the documented forward paths', () => {
    expect(() =>
      assertStatusTransition(ReportStatus.PENDING, ReportStatus.IN_PROGRESS),
    ).not.toThrow();
    expect(() =>
      assertStatusTransition(ReportStatus.PENDING, ReportStatus.REJECTED),
    ).not.toThrow();
    expect(() =>
      assertStatusTransition(ReportStatus.IN_PROGRESS, ReportStatus.COMPLETED),
    ).not.toThrow();
    expect(() =>
      assertStatusTransition(ReportStatus.IN_PROGRESS, ReportStatus.REJECTED),
    ).not.toThrow();
  });

  it('rejects backwards and final-state changes', () => {
    expect(() =>
      assertStatusTransition(ReportStatus.IN_PROGRESS, ReportStatus.PENDING),
    ).toThrow(BadRequestException);
    expect(() =>
      assertStatusTransition(ReportStatus.COMPLETED, ReportStatus.IN_PROGRESS),
    ).toThrow(BadRequestException);
    expect(() =>
      assertStatusTransition(ReportStatus.REJECTED, ReportStatus.PENDING),
    ).toThrow(BadRequestException);
  });

  it('rejects changing to the same status', () => {
    expect(() =>
      assertStatusTransition(ReportStatus.PENDING, ReportStatus.PENDING),
    ).toThrow(BadRequestException);
  });

  it('has no transitions out of final statuses', () => {
    expect(REPORT_STATUS_TRANSITIONS.COMPLETED).toEqual([]);
    expect(REPORT_STATUS_TRANSITIONS.REJECTED).toEqual([]);
  });
});
