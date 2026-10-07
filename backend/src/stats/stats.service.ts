import {
  BUSINESS_TIME_ZONE,
  businessDateInputToISO,
  BUSINESS_TIME_ZONES,
  toBusinessDateInput,
} from '@/common/utils/business-time';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Media } from '../media/entities/media.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { UserSession } from '../sessions/entities/user-session.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

export interface StatsOverview {
  totalUsers: number;
  verifiedUsers: number;
  unverifiedUsers: number;
  newUsers7d: number;
  activeSessions: number;
  failedLogins24h: number;
  mediaCount: number;
  mediaTotalBytes: number;
  unreadNotifications: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

const dayjsAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/**
 * Read-only counters for the dashboard. Everything here is derived from tables
 * the other modules own — this module adds no schema of its own.
 */
@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Media) private readonly media: Repository<Media>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(UserSession)
    private readonly sessions: Repository<UserSession>,
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  async overview(): Promise<StatsOverview> {
    const [
      totalUsers,
      verifiedUsers,
      newUsers7d,
      activeSessions,
      failedLogins24h,
      mediaCount,
      unreadNotifications,
      mediaBytes,
    ] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { emailVerifiedAt: Not(IsNull()) } }),
      this.users.count({ where: { createdAt: MoreThan(dayjsAgo(7)) } }),
      this.sessions.count({
        where: { revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      }),
      this.auditLogs.count({
        where: {
          action: 'auth.login_failed',
          createdAt: MoreThan(dayjsAgo(1)),
        },
      }),
      this.media.count({ where: { state: 'ready' } }),
      this.notifications.count({ where: { isRead: false } }),
      this.media
        .createQueryBuilder('media')
        .select('COALESCE(SUM(media.size), 0)', 'total')
        .where('media.deletedAt IS NULL')
        .andWhere('media.state = :state', { state: 'ready' })
        .getRawOne<{ total: string }>(),
    ]);

    return {
      totalUsers,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      newUsers7d,
      activeSessions,
      failedLogins24h,
      mediaCount,
      // SUM over a bigint column comes back as a string from pg.
      mediaTotalBytes: Number(mediaBytes?.total ?? 0),
      unreadNotifications,
    };
  }

  /** Accounts created per day, oldest first, with empty days filled in. */
  async signupsTrend(
    days = 30,
    timeZone = BUSINESS_TIME_ZONE,
  ): Promise<Array<TrendPoint>> {
    if (!(BUSINESS_TIME_ZONES as readonly string[]).includes(timeZone))
      throw new BadRequestException('Invalid report timezone');
    const today = new Date(
      toBusinessDateInput(new Date(), timeZone).slice(0, 10) + 'T00:00:00Z',
    );
    const calendarStart = new Date(today.getTime() - (days - 1) * 86_400_000);
    const since = new Date(
      businessDateInputToISO(
        calendarStart.toISOString().slice(0, 10) + 'T00:00:00',
        timeZone,
      ),
    );
    const until = new Date(
      businessDateInputToISO(
        new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10) +
          'T00:00:00',
        timeZone,
      ),
    );

    const rows = await this.users
      .createQueryBuilder('user')
      .select(
        "to_char(user.createdAt AT TIME ZONE :timeZone, 'YYYY-MM-DD')",
        'day',
      )
      .addSelect('COUNT(*)', 'count')
      .where('user.createdAt >= :since AND user.createdAt < :until', {
        since,
        until,
        timeZone,
      })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; count: string }>();

    const counts = new Map(rows.map((row) => [row.day, Number(row.count)]));

    // A gap in the data is a day with no signups, not a missing day — the chart
    // would otherwise compress the timeline and misread as steady activity.
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(calendarStart.getTime() + index * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      return { label: key.slice(5), value: counts.get(key) ?? 0 };
    });
  }
}
