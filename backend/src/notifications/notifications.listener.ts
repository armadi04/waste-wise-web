import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationType } from './entities/notification.entity';
import {
  REPORT_STATUS_CHANGED,
  reportStatusNotification,
  type ReportStatusChangedEvent,
} from '../reports/report-events';

const ADMIN_ROLES = ['superadmin', 'admin'] as const;

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * An operator asked every client to reload (see `AppRefreshController`). The
   * gateway is reached from here rather than from the feature service, like
   * every other side-effect in this listener.
   */
  @OnEvent('app.force-refresh')
  onForceRefresh(payload: { issuedAt: string }): void {
    this.notificationsGateway.broadcastRefresh(payload.issuedAt);
  }

  private async notifyByRoles(
    roles: readonly string[],
    dto: {
      title: string;
      message: string;
      type?: NotificationType;
      link?: string;
    },
    actorId?: number,
  ): Promise<void> {
    for (const role of roles) {
      const notification = await this.notificationsService.create({
        targetRole: role,
        title: dto.title,
        message: dto.message,
        type: dto.type ?? NotificationType.INFO,
        link: dto.link,
        actorId,
      });
      await this.notificationsGateway.sendNotification(notification);
    }
  }

  private async notifyUser(
    userId: number,
    dto: {
      title: string;
      message: string;
      type?: NotificationType;
      link?: string;
    },
    actorId?: number,
    eventId?: string,
  ): Promise<void> {
    const data = {
      userId,
      ...(eventId ? { eventId } : {}),
      title: dto.title,
      message: dto.message,
      type: dto.type ?? NotificationType.INFO,
      link: dto.link,
      actorId,
    };
    const notification = eventId
      ? await this.notificationsService.createOnce(data)
      : await this.notificationsService.create(data);
    await this.notificationsGateway.sendNotification(notification);
  }

  private notifyAdmins(
    dto: {
      title: string;
      message: string;
      type?: NotificationType;
      link?: string;
    },
    actorId?: number,
  ): Promise<void> {
    return this.notifyByRoles(ADMIN_ROLES, dto, actorId);
  }

  // ─── Manual Notification ─────────────────────────────────────────────────────

  @OnEvent('user.notification', { suppressErrors: false })
  async handleUserNotification(payload: {
    userId: number;
    eventId?: string;
    title: string;
    message: string;
    type?: NotificationType;
    link?: string;
    actorId?: number;
  }) {
    await this.notifyUser(
      payload.userId,
      {
        title: payload.title,
        message: payload.message,
        type: payload.type,
        link: payload.link,
      },
      payload.actorId,
      payload.eventId,
    );
  }

  // ─── Report Events ───────────────────────────────────────────────────────────

  /**
   * Tells the reporter their report moved on. Skipped when reporters change
   * their own report (they already know). The event id makes redelivery
   * idempotent; status transitions never revisit a status.
   */
  @OnEvent(REPORT_STATUS_CHANGED)
  async handleReportStatusChanged(payload: ReportStatusChangedEvent) {
    if (payload.reporterId === payload.actorId) return;
    const copy = reportStatusNotification(payload.reportId, payload.to);
    const type =
      copy.tone === 'success'
        ? NotificationType.SUCCESS
        : copy.tone === 'warning'
          ? NotificationType.WARNING
          : NotificationType.INFO;
    try {
      await this.notifyUser(
        payload.reporterId,
        {
          title: copy.title,
          message: copy.message,
          type,
          link: `/reports/${payload.reportId}`,
        },
        payload.actorId,
        `report:${payload.reportId}:status:${payload.to}`,
      );
    } catch (error) {
      // A failed notification must never surface as a failed status update.
      this.logger.error(
        `Could not notify reporter of report #${payload.reportId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  // ─── User Events ─────────────────────────────────────────────────────────────

  @OnEvent('user.created')
  async handleUserCreated(payload: {
    userId: number;
    fullname: string;
    email: string;
  }) {
    await this.notifyAdmins(
      {
        title: 'New User Registered',
        message: `${payload.fullname || payload.email} has joined the platform.`,
        type: NotificationType.INFO,
        link: `/users`,
      },
      payload.userId,
    );
  }

  @OnEvent('user.invited')
  async handleUserInvited(payload: { email: string; invitedBy?: number }) {
    await this.notifyAdmins(
      {
        title: 'User Invited',
        message: `An invitation was sent to ${payload.email}.`,
        type: NotificationType.INFO,
        link: `/invitations`,
      },
      payload.invitedBy,
    );
  }

  @OnEvent('user.deleted')
  async handleUserDeleted(payload: { userId: number; fullname: string }) {
    await this.notifyAdmins({
      title: 'User Removed',
      message: `User "${payload.fullname}" has been removed from the platform.`,
      type: NotificationType.WARNING,
      link: `/users`,
    });
  }

  @OnEvent('user.roles_updated')
  async handleUserRolesUpdated(payload: { userId: number; fullname: string }) {
    await this.notifyAdmins({
      title: 'User Roles Updated',
      message: `Roles for "${payload.fullname}" have been updated.`,
      type: NotificationType.INFO,
      link: `/users`,
    });

    await this.notifyUser(payload.userId, {
      title: 'Your Roles Have Been Updated',
      message:
        'Your roles and permissions have been updated. Please re-login to apply changes.',
      type: NotificationType.WARNING,
      link: `/profile`,
    });
  }
}
