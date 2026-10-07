import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { Media } from './entities/media.entity';
import { MediaStorageService } from './storage/media-storage.service';
import { CacheService } from '@/common/cache/cache.service';
import { MediaDeletionResultDto } from './dto/media-deletion.dto';

export const MEDIA_LEASE_MS = 15 * 60_000;

@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);
  constructor(
    @InjectRepository(Media) private readonly repository: Repository<Media>,
    private readonly dataSource: DataSource,
    private readonly storage: MediaStorageService,
    private readonly cache: CacheService,
    private readonly events: EventEmitter2,
  ) {}

  async requestDeletion(id: number): Promise<MediaDeletionResultDto> {
    const media = await this.dataSource.transaction(async (manager) => {
      const row = await manager
        .createQueryBuilder(Media, 'media')
        .withDeleted()
        .setLock('pessimistic_write')
        .where('media.id = :id', { id })
        .getOne();
      if (!row) throw new NotFoundException('Media not found');
      if (row.deletedAt) return row;
      if (row.state === 'pending')
        throw new ConflictException('Upload is not ready');
      // A concurrent request/worker already owns deletion. Do not steal its lease.
      if (row.state === 'deleting') return null;
      row.state = 'deleting';
      row.cleanupAt = new Date();
      row.cleanupLeaseToken = randomUUID();
      row.cleanupLeaseUntil = new Date(Date.now() + MEDIA_LEASE_MS);
      await manager.getRepository(Media).save(row);
      await manager.query(
        'UPDATE "users" SET "avatarId" = NULL WHERE "avatarId" = $1',
        [id],
      );
      return row;
    });
    if (!media) return { id, status: 'queued' };
    if (media.deletedAt) return { id, status: 'already-deleted' };
    await this.invalidateCaches();
    return { id, status: (await this.execute(media)) ? 'deleted' : 'queued' };
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    timeZone: 'UTC',
    disabled: process.env.NODE_ENV === 'test',
    waitForCompletion: true,
  })
  async dispatchPending(): Promise<void> {
    const due = await this.dataSource.transaction(async (manager) => {
      const rows = await manager
        .createQueryBuilder(Media, 'media')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('media.state IN (:...states)', {
          states: ['pending', 'deleting'],
        })
        .andWhere('media.cleanupAt <= :now', { now: new Date() })
        .andWhere(
          '(media.cleanupLeaseUntil IS NULL OR media.cleanupLeaseUntil <= :now)',
          { now: new Date() },
        )
        .orderBy('media.cleanupAt', 'ASC')
        .limit(10)
        .getMany();
      for (const row of rows) {
        row.cleanupLeaseToken = randomUUID();
        row.cleanupLeaseUntil = new Date(Date.now() + MEDIA_LEASE_MS);
        await manager.getRepository(Media).save(row);
      }
      return rows;
    });
    for (const media of due) await this.execute(media);
  }

  async execute(media: Media): Promise<boolean> {
    const token = media.cleanupLeaseToken;
    if (!token) return false;
    try {
      // Serial batches may outlive their initial lease. Renew/fence each item before I/O.
      const owned = await this.repository.update(
        { id: media.id, cleanupLeaseToken: token, deletedAt: IsNull() },
        { cleanupLeaseUntil: new Date(Date.now() + MEDIA_LEASE_MS) },
      );
      if (!owned.affected) return false;
      await this.storage.forMedia(media).delete(media);
      const updated = await this.repository.update(
        { id: media.id, cleanupLeaseToken: token, deletedAt: IsNull() },
        {
          deletedAt: new Date(),
          cleanupAt: null,
          cleanupLeaseUntil: null,
          cleanupLeaseToken: null,
          cleanupErrorCode: null,
        },
      );
      if (!updated.affected) return false;
      await this.invalidateCaches();
      if (media.state === 'deleting') {
        try {
          this.events.emit('system.delete', {
            title: 'Media Deleted',
            message: `Media #${media.id} has been deleted.`,
          });
        } catch {
          this.logger.warn(
            `Media deletion event #${media.id} could not be emitted`,
          );
        }
      }
      return true;
    } catch {
      const attempts = media.cleanupAttempts + 1;
      // Never log provider errors: they may contain signed URLs or credentials.
      await this.repository
        .update(
          { id: media.id, cleanupLeaseToken: token, deletedAt: IsNull() },
          {
            cleanupAt: new Date(
              Date.now() +
                Math.min(60, 2 ** Math.min(attempts - 1, 6)) * 60_000,
            ),
            cleanupAttempts: attempts,
            cleanupErrorCode: 'CLEANUP_RETRY',
            cleanupLeaseUntil: null,
            cleanupLeaseToken: null,
          },
        )
        .catch(() => undefined);
      this.logger.warn(
        `Media cleanup #${media.id} queued for retry (attempt ${attempts})`,
      );
      return false;
    }
  }

  private async invalidateCaches() {
    for (const pattern of [
      '*/media*',
      '*/users*',
      '*/auth/profile*',
      '*/stats*',
    ])
      await this.cache
        .clearKeys(pattern)
        .catch(() =>
          this.logger.warn(
            'Media cache invalidation will be retried on subsequent changes',
          ),
        );
  }
}
