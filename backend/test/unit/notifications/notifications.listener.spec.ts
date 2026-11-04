import { describe, beforeEach, expect, it, jest } from 'bun:test';
import { NotificationsListener } from '../../../src/notifications/notifications.listener';
import { NotificationType } from '../../../src/notifications/entities/notification.entity';
import { ReportStatus } from '../../../src/reports/entities/report.entity';

describe('NotificationsListener report status', () => {
  let service: { createOnce: jest.Mock; create: jest.Mock };
  let gateway: { sendNotification: jest.Mock };
  let listener: NotificationsListener;

  beforeEach(() => {
    service = {
      createOnce: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({ id: 1, ...data }),
      ),
      create: jest.fn(),
    };
    gateway = { sendNotification: jest.fn(() => Promise.resolve()) };
    listener = new NotificationsListener(service as never, gateway as never);
  });

  it('notifies the reporter once per status with a report link', async () => {
    await listener.handleReportStatusChanged({
      reportId: 12,
      reporterId: 3,
      actorId: 9,
      from: ReportStatus.IN_PROGRESS,
      to: ReportStatus.COMPLETED,
    });

    expect(service.createOnce).toHaveBeenCalledWith({
      userId: 3,
      eventId: 'report:12:status:COMPLETED',
      title: 'Report completed',
      message: 'Your report #12 has been handled. Thank you for reporting!',
      type: NotificationType.SUCCESS,
      link: '/reports/12',
      actorId: 9,
    });
    expect(gateway.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('skips reporters changing their own report', async () => {
    await listener.handleReportStatusChanged({
      reportId: 12,
      reporterId: 3,
      actorId: 3,
      from: ReportStatus.PENDING,
      to: ReportStatus.REJECTED,
    });
    expect(service.createOnce).not.toHaveBeenCalled();
  });

  it('never throws when the notification cannot be stored', async () => {
    service.createOnce.mockRejectedValue(new Error('db down'));
    await expect(
      listener.handleReportStatusChanged({
        reportId: 12,
        reporterId: 3,
        actorId: 9,
        from: ReportStatus.PENDING,
        to: ReportStatus.IN_PROGRESS,
      }),
    ).resolves.toBeUndefined();
    expect(gateway.sendNotification).not.toHaveBeenCalled();
  });
});
