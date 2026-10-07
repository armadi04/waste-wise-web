import { DataSource, IsNull } from 'typeorm';
import { Media } from '@/media/entities/media.entity';
import { MediaStorageService } from '@/media/storage/media-storage.service';
import { runScript } from './lib/script-runner';

// Run with the ORIGINAL locations configured, before switching profiles/defaults.
void runScript(
  async (app) => {
    const storage = app.get(MediaStorageService);
    const count = await app.get(DataSource).transaction(async (manager) => {
      const repository = manager.getRepository(Media);
      const rows = await repository
        .createQueryBuilder('media')
        .withDeleted()
        .setLock('pessimistic_write')
        .where('media.storageFingerprint IS NULL')
        .getMany();
      for (const row of rows) {
        const selection = storage.forProfile(row.storageProfile);
        if (selection.provider !== row.provider)
          throw new Error('Media profile provider mismatch');
        await repository.update(
          { id: row.id, storageFingerprint: IsNull() },
          { storageFingerprint: selection.fingerprint },
        );
      }
      return rows.length;
    });
    console.log(`Bound storage locations for ${count} media records`);
  },
  { skipMigrations: true },
);
