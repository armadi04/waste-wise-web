import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Media } from '@/media/entities/media.entity';
import { MediaService } from '@/media/media.service';
import { CacheService } from '@/common/cache/cache.service';

@Injectable()
export class AvatarCleanupService {
  private readonly logger = new Logger(AvatarCleanupService.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly mediaService: MediaService,
    private readonly cacheService: CacheService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    timeZone: 'UTC',
    disabled: process.env.NODE_ENV === 'test',
    waitForCompletion: true,
  })
  async dispatchPending(): Promise<void> {
    const lease = new Date(Date.now() + 15 * 60_000);
    const due = await this.dataSource.transaction(async (manager) => {
      // Recover portal avatars detached through other account-management paths.
      await manager.query(
        `UPDATE "media" m SET "cleanupAt" = now() WHERE m."managedAvatar" = true AND m."deletedAt" IS NULL AND m."cleanupAt" IS NULL AND m."createdAt" < now() - interval '1 hour' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."avatarId" = m."id")`,
      );
      const rows = await manager
        .createQueryBuilder(Media, 'media')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('media.managedAvatar = true')
        .andWhere('media.cleanupAt <= :now', { now: new Date() })
        .andWhere(
          '(media.cleanupLeaseUntil IS NULL OR media.cleanupLeaseUntil <= :now)',
          { now: new Date() },
        )
        .orderBy('media.cleanupAt', 'ASC')
        .take(20)
        .getMany();
      const claimed: Media[] = [];
      for (const media of rows) {
        const references = await manager.query<Array<{ id: number }>>(
          'SELECT "id" FROM "users" WHERE "avatarId" = $1 LIMIT 1',
          [media.id],
        );
        if (references.length) {
          await manager.update(Media, media.id, {
            cleanupAt: null,
            cleanupLeaseUntil: null,
          });
          continue;
        }
        await manager.update(Media, media.id, { cleanupLeaseUntil: lease });
        claimed.push(media);
      }
      return claimed;
    });
    for (const media of due) {
      try {
        await this.mediaService.deleteAvatarRemote(media);
        await this.dataSource
          .getRepository(Media)
          .update(
            { id: media.id, cleanupLeaseUntil: lease },
            { deletedAt: new Date(), cleanupAt: null, cleanupLeaseUntil: null },
          );
        await this.cacheService.clearKeys('*/media*');
      } catch {
        await this.dataSource.getRepository(Media).update(
          { id: media.id, cleanupLeaseUntil: lease },
          {
            cleanupAt: new Date(Date.now() + 5 * 60_000),
            cleanupLeaseUntil: null,
          },
        );
        this.logger.warn(`Avatar cleanup will retry for media ${media.id}`);
      }
    }
  }
}
