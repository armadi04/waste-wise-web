import { toBusinessDateInput } from '../../../src/common/utils/business-time';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { StatsService } from '../../../src/stats/stats.service';
import { User } from '../../../src/users/entities/user.entity';
import { Media } from '../../../src/media/entities/media.entity';
import { Notification } from '../../../src/notifications/entities/notification.entity';
import { UserSession } from '../../../src/sessions/entities/user-session.entity';
import { AuditLog } from '../../../src/audit/entities/audit-log.entity';

describe('StatsService', () => {
  let service: StatsService;
  let userRows: Array<{ day: string; count: string }>;

  const counting = (value: number) => ({
    count: jest.fn(() => Promise.resolve(value)),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(() => Promise.resolve({ total: '2048' })),
      getRawMany: jest.fn(() => Promise.resolve(userRows)),
    })),
  });

  beforeEach(async () => {
    userRows = [];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: getRepositoryToken(User), useValue: counting(10) },
        { provide: getRepositoryToken(Media), useValue: counting(4) },
        { provide: getRepositoryToken(Notification), useValue: counting(3) },
        { provide: getRepositoryToken(UserSession), useValue: counting(2) },
        { provide: getRepositoryToken(AuditLog), useValue: counting(1) },
      ],
    }).compile();

    service = module.get(StatsService);
  });

  it('derives the unverified count rather than querying twice', async () => {
    const overview = await service.overview();

    expect(overview.totalUsers).toBe(10);
    expect(overview.verifiedUsers).toBe(10);
    expect(overview.unverifiedUsers).toBe(0);
  });

  it('reads the media total as a number, not the string pg returns', async () => {
    const overview = await service.overview();

    expect(overview.mediaTotalBytes).toBe(2048);
  });

  it('fills days with no signups instead of dropping them', async () => {
    userRows = [
      { day: toBusinessDateInput(new Date()).slice(0, 10), count: '3' },
    ];

    const trend = await service.signupsTrend(7);

    expect(trend).toHaveLength(7);
    expect(trend[trend.length - 1].value).toBe(3);
    expect(trend[0].value).toBe(0);
  });
});
