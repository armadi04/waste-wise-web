import { describe, expect, it, jest } from 'bun:test';
import { DataSource } from 'typeorm';
import { PortalAvatarImportService } from '@/portal/customer/portal-avatar-import.service';
import { PortalAvatarService } from '@/portal/customer/portal-avatar.service';

describe('avatar import enqueue boundary', () => {
  it('finishes enqueue without invoking or awaiting unavailable storage', async () => {
    const storage = {
      importGooglePhoto: jest.fn(() => new Promise<void>(() => undefined)),
    };
    const manager = { query: jest.fn().mockResolvedValue([]) };
    const db = {
      transaction: jest.fn(
        (callback: (value: typeof manager) => Promise<void>) =>
          callback(manager),
      ),
    };
    const queue = new PortalAvatarImportService(
      db as unknown as DataSource,
      storage as unknown as PortalAvatarService,
    );
    await queue.enqueue(42, 'https://lh3.googleusercontent.com/photo');
    expect(storage.importGooglePhoto).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO'),
      [42, 'https://lh3.googleusercontent.com/photo'],
    );
  });

  it('rejects an invalid provider URL before persisting a job', async () => {
    const db = { transaction: jest.fn() };
    const queue = new PortalAvatarImportService(
      db as unknown as DataSource,
      {} as PortalAvatarService,
    );
    await expect(
      queue.enqueue(42, 'https://attacker.test/photo'),
    ).rejects.toThrow();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
