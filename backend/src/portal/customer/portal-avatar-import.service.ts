import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import { PortalAvatarImport } from '@/portal/customer/entities/portal-avatar-import.entity';
import { PortalAvatarService } from '@/portal/customer/portal-avatar.service';
import { googlePhotoUrl } from '@/portal/customer/google-photo-url';
import { portalRuntimeConfig } from '@/config/portal-runtime.config';

const MAX_ATTEMPTS = 5;
const LEASE_MS = 5 * 60_000;
const WORKER_LOCK = 1791230000;

@Injectable()
export class PortalAvatarImportService {
  private readonly logger = new Logger(PortalAvatarImportService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly avatars: PortalAvatarService,
  ) {}

  /** Await only this short database write at login, never external storage. */
  async enqueue(userId: number, picture: string): Promise<void> {
    const url = googlePhotoUrl(picture).href;
    await this.dataSource.transaction(async (manager) => {
      await manager.query("SET LOCAL statement_timeout = '1000ms'");
      await manager.query(
        `INSERT INTO "portal_avatar_imports" ("userId", "pictureUrl") VALUES ($1, $2)
        ON CONFLICT ("userId") DO UPDATE SET "pictureUrl" = EXCLUDED."pictureUrl",
          "attempts" = 0, "availableAt" = now(), "completedAt" = NULL, "failedAt" = NULL, "updatedAt" = now()
        WHERE "portal_avatar_imports"."pictureUrl" IS NULL AND "portal_avatar_imports"."leaseUntil" IS NULL`,
        [userId, url],
      );
    });
  }

  @Cron(CronExpression.EVERY_10_SECONDS, {
    timeZone: 'UTC',
    disabled: portalRuntimeConfig().disableScheduledJobs,
    waitForCompletion: true,
  })
  async dispatchPending(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const runner = this.dataSource.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      const rows = (await runner.query(
        'SELECT pg_try_advisory_lock($1, 1) AS locked',
        [WORKER_LOCK],
      )) as Array<{ locked: boolean }>;
      locked = rows[0].locked;
      if (!locked) return;
      // One active importer across all instances; no transaction is held during I/O.
      for (let count = 0; count < 2; count++) {
        const job = await this.claimDue(runner.manager);
        if (!job) break;
        await this.deliver(job, runner.manager);
      }
    } catch {
      this.logger.warn(
        'Google photo worker failed; leased jobs remain recoverable',
      );
    } finally {
      try {
        if (locked)
          await runner.query('SELECT pg_advisory_unlock($1, 1)', [WORKER_LOCK]);
      } catch {
        this.logger.warn('Google photo worker connection lost during unlock');
      } finally {
        try {
          await runner.release();
        } finally {
          this.running = false;
        }
      }
    }
  }

  private async claimDue(
    manager: EntityManager,
  ): Promise<PortalAvatarImport | null> {
    return manager.transaction(async (transaction) => {
      await transaction.query("SET LOCAL statement_timeout = '5000ms'");
      const now = new Date();
      const repo = transaction.getRepository(PortalAvatarImport);
      // Repeated crashes count as attempts too; redact exhausted jobs after their lease expires.
      await repo
        .createQueryBuilder()
        .update()
        .set({ pictureUrl: null, leaseUntil: null, failedAt: now })
        .where(
          '"pictureUrl" IS NOT NULL AND "attempts" >= :max AND ("leaseUntil" IS NULL OR "leaseUntil" <= :now)',
          { max: MAX_ATTEMPTS, now },
        )
        .execute();
      const job = await repo
        .createQueryBuilder('job')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('job.pictureUrl IS NOT NULL AND job.attempts < :max', {
          max: MAX_ATTEMPTS,
        })
        .andWhere(
          'job.availableAt <= :now AND (job.leaseUntil IS NULL OR job.leaseUntil <= :now)',
          { now },
        )
        .orderBy('job.availableAt', 'ASC')
        .take(1)
        .getOne();
      if (!job) return null;
      job.attempts++;
      job.leaseUntil = new Date(Date.now() + LEASE_MS);
      await repo.save(job);
      return job;
    });
  }

  private async deliver(
    job: PortalAvatarImport,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(PortalAvatarImport);
    const owner = { userId: job.userId, leaseUntil: job.leaseUntil! };
    try {
      await this.avatars.importGooglePhoto(job.userId, job.pictureUrl!);
      await repo.update(owner, {
        pictureUrl: null,
        leaseUntil: null,
        completedAt: new Date(),
        failedAt: null,
      });
    } catch {
      const exhausted = job.attempts >= MAX_ATTEMPTS;
      await repo.update(owner, {
        leaseUntil: null,
        availableAt: new Date(Date.now() + 30_000 * 2 ** (job.attempts - 1)),
        ...(exhausted ? { pictureUrl: null, failedAt: new Date() } : {}),
      });
      this.logger.warn(
        { userId: job.userId, attempt: job.attempts, exhausted },
        'Google photo import will retry or await another Google login',
      );
    }
  }
}
