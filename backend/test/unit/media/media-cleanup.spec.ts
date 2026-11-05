import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MediaCleanupService } from '@/media/media-cleanup.service';
import { Media } from '@/media/entities/media.entity';
import { MediaStorageService } from '@/media/storage/media-storage.service';
import { CacheService } from '@/common/cache/cache.service';

describe('durable media cleanup', () => {
  let row: Media;
  let remove: ReturnType<typeof mock>;
  let update: ReturnType<typeof mock>;
  let events: { emit: ReturnType<typeof mock> };
  let service: MediaCleanupService;
  let query: ReturnType<typeof mock>;
  beforeEach(() => {
    row = {
      id: 1,
      state: 'ready',
      storageProfile: 's3-default',
      cleanupAttempts: 0,
      cleanupLeaseToken: null,
      deletedAt: null,
    } as unknown as Media;
    remove = mock(async () => undefined);
    update = mock(async (where: Partial<Media>, fields: Partial<Media>) => {
      if (where.cleanupLeaseToken !== row.cleanupLeaseToken || row.deletedAt)
        return { affected: 0 };
      Object.assign(row, fields);
      return { affected: 1 };
    });
    query = mock(async () => undefined);
    const save = mock(async (value: Media) => {
      Object.assign(row, value);
      return row;
    });
    const builder = {
      withDeleted: () => builder,
      setLock: () => builder,
      where: () => builder,
      getOne: async () => ({ ...row }),
    };
    const source = {
      transaction: async (run: (manager: unknown) => Promise<unknown>) =>
        run({
          createQueryBuilder: () => builder,
          getRepository: () => ({ save }),
          query,
        }),
    } as unknown as DataSource;
    events = { emit: mock(() => undefined) };
    service = new MediaCleanupService(
      { update } as unknown as Repository<Media>,
      source,
      {
        forMedia: () => ({ delete: remove }),
      } as unknown as MediaStorageService,
      { clearKeys: mock(async () => undefined) } as unknown as CacheService,
      events as unknown as EventEmitter2,
    );
  });
  it('persists deletion before remote I/O, detaches avatar references and makes retries idempotent', async () => {
    remove.mockImplementation(async () => {
      expect(row.state).toBe('deleting');
      expect(row.cleanupLeaseToken).toBeTruthy();
    });
    expect(await service.requestDeletion(1)).toEqual({
      id: 1,
      status: 'deleted',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('avatarId'),
      [1],
    );
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(await service.requestDeletion(1)).toEqual({
      id: 1,
      status: 'already-deleted',
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it('keeps failed deletion durable and succeeds when a restarted worker retries', async () => {
    remove.mockRejectedValue(new Error('Provider unavailable'));
    expect(await service.requestDeletion(1)).toEqual({
      id: 1,
      status: 'queued',
    });
    expect(row.deletedAt).toBeNull();
    expect(row.cleanupAttempts).toBe(1);
    expect(row.cleanupAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await service.requestDeletion(1)).toEqual({
      id: 1,
      status: 'queued',
    });
    row.cleanupLeaseToken = 'restart-worker';
    remove.mockResolvedValue(undefined);
    expect(await service.execute({ ...row })).toBe(true);
    expect(row.deletedAt).toBeInstanceOf(Date);
  });
  it('fences stale workers before remote deletion and does not emit duplicate completion', async () => {
    row.state = 'deleting';
    row.cleanupLeaseToken = 'new-worker';
    expect(
      await service.execute({ ...row, cleanupLeaseToken: 'old-worker' }),
    ).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
  it('reclaims an abandoned upload without publishing or notifying users', async () => {
    row.state = 'pending';
    row.cleanupLeaseToken = 'cleanup-worker';
    expect(await service.execute({ ...row })).toBe(true);
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(events.emit).not.toHaveBeenCalled();
  });
  it('retains a retryable job after remote success but local completion fails', async () => {
    row.state = 'deleting';
    row.cleanupLeaseToken = 'cleanup-worker';
    update.mockImplementation(
      async (where: Partial<Media>, fields: Partial<Media>) => {
        if (fields.deletedAt) throw new Error('Database unavailable');
        Object.assign(row, fields);
        return { affected: 1 };
      },
    );
    expect(await service.execute({ ...row })).toBe(false);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(row.cleanupAt).toBeInstanceOf(Date);
    expect(row.deletedAt).toBeNull();
  });
});
