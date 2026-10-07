import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import sharp from 'sharp';
import { Media } from '@/media/entities/media.entity';
import { MediaService } from '@/media/media.service';
import { User } from '@/users/entities/user.entity';
import { CacheService } from '@/common/cache/cache.service';
import { googlePhotoUrl } from '@/portal/customer/google-photo-url';

@Injectable()
export class PortalAvatarService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mediaService: MediaService,
    private readonly cacheService: CacheService,
  ) {}

  async upload(userId: number, file: Express.Multer.File): Promise<void> {
    const buffer = await this.normalizeImage(file.buffer, ['jpeg']);
    await this.storeAvatar(userId, buffer, false);
  }

  /** Called only with the picture claim from a verified Google ID token. */
  async importGooglePhoto(userId: number, picture: string): Promise<void> {
    const url = googlePhotoUrl(picture);
    const owners = await this.dataSource.query<
      Array<{ avatarId: number | null }>
    >(
      'SELECT "avatarId" FROM "users" WHERE "id" = $1 AND "deletedAt" IS NULL',
      [userId],
    );
    if (!owners.length) return;
    if (owners[0].avatarId !== null) {
      // A previous attempt may have committed before cache invalidation or acknowledgement failed.
      await this.invalidateCaches();
      return;
    }
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
    });
    const maxBytes = 10 * 1024 * 1024;
    if (
      !response.ok ||
      !response.body ||
      Number(response.headers.get('content-length')) > maxBytes
    ) {
      await response.body?.cancel();
      throw new BadRequestException('Google photo download failed');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes)
          throw new BadRequestException('Google photo too large');
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
    const buffer = await this.normalizeImage(Buffer.concat(chunks), [
      'jpeg',
      'png',
      'webp',
    ]);
    await this.storeAvatar(userId, buffer, true);
  }

  private async normalizeImage(
    input: Buffer,
    formats: string[],
  ): Promise<Buffer> {
    try {
      const image = sharp(input, {
        limitInputPixels: 16_000_000,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      if (!metadata.format || !formats.includes(metadata.format)) {
        throw new Error('Unsupported image format');
      }
      const buffer = await image
        .rotate()
        .resize(512, 512, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .timeout({ seconds: 3 })
        .toBuffer();
      if (buffer.length >= 1024 * 1024) throw new Error('Output too large');
      return buffer;
    } catch {
      throw new BadRequestException(
        'Invalid image or image exceeds 16 megapixels',
      );
    }
  }

  private async storeAvatar(
    userId: number,
    buffer: Buffer,
    onlyIfEmpty: boolean,
  ): Promise<void> {
    const media = await this.mediaService.uploadAvatar(
      { buffer, size: buffer.length },
      userId,
    );
    let linked: boolean;
    try {
      linked = await this.dataSource.transaction(async (manager) => {
        await manager.query("SET LOCAL statement_timeout = '5000ms'");
        const owners = await manager.query<Array<{ avatarId: number | null }>>(
          'SELECT "avatarId" FROM "users" WHERE "id" = $1 AND "deletedAt" IS NULL FOR UPDATE',
          [userId],
        );
        if (!owners.length) throw new NotFoundException('User not found');
        if (onlyIfEmpty && owners[0].avatarId !== null) return false;
        const staged = await manager.findOne(Media, {
          where: { id: media.id, userId, managedAvatar: true },
          lock: { mode: 'pessimistic_write' },
        });
        if (!staged || staged.cleanupLeaseUntil)
          throw new ConflictException('Avatar upload expired');
        await manager.update(User, userId, { avatar: { id: media.id } });
        await manager.update(Media, media.id, { cleanupAt: null });
        const previous = owners[0].avatarId;
        if (previous && previous !== media.id) {
          await manager.update(
            Media,
            { id: previous, userId, managedAvatar: true },
            { cleanupAt: new Date() },
          );
        }
        return true;
      });
    } catch (error) {
      // Staging was persisted before storage upload, so the worker can retry even
      // if this immediate scheduling attempt fails during a database outage.
      await this.mediaService
        .scheduleAvatarCleanup(media.id)
        .catch(() => undefined);
      throw error;
    }
    // Cache failures must not schedule deletion of a successfully linked photo.
    if (linked) await this.invalidateCaches();
    else await this.mediaService.scheduleAvatarCleanup(media.id);
  }

  private async invalidateCaches(): Promise<void> {
    await this.cacheService.clearKeys('*/users*');
    await this.cacheService.clearKeys('*/portal/admin*');
  }
}
