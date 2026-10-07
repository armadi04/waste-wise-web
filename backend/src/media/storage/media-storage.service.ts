import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  resolveStorageProfiles,
  storageFingerprint,
} from '@/config/media-storage.config';
import type { MediaProvider, MediaStorage } from './media-storage';
import { DepotStorageProvider } from './depot-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';

export interface StorageSelection {
  profile: string;
  provider: MediaProvider;
  fingerprint: string;
  adapter: MediaStorage;
}

@Injectable()
export class MediaStorageService {
  private readonly adapters = new Map<string, StorageSelection>();
  constructor(private readonly config: ConfigService) {}

  private configuration() {
    const keys = [
      'MEDIA_PROVIDER',
      'MEDIA_STORAGE_PROFILE',
      'MEDIA_STORAGE_PROFILES',
      'DEPOT_BASE_URL',
      'DEPOT_API_KEY',
      'S3_ENDPOINT',
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'S3_FORCE_PATH_STYLE',
    ];
    try {
      return resolveStorageProfiles(
        Object.fromEntries(
          keys.map((key) => [key, this.config.get<unknown>(key)]),
        ),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Media storage configuration is unavailable',
      );
    }
  }
  get selected(): StorageSelection {
    return this.forProfile(this.configuration().selected);
  }

  forProfile(id: string): StorageSelection {
    const cached = this.adapters.get(id);
    if (cached) return cached;
    const profile = this.configuration().profiles.get(id);
    if (!profile)
      throw new ServiceUnavailableException(
        'Recorded storage profile is not configured',
      );
    const adapter =
      profile.provider === 'depot'
        ? new DepotStorageProvider(profile.baseUrl, profile.apiKey)
        : new S3StorageProvider({
            endpoint: profile.endpoint,
            region: profile.region,
            bucket: profile.bucket,
            accessKeyId: profile.accessKeyId,
            secretAccessKey: profile.secretAccessKey,
            virtualHostedStyle: !profile.forcePathStyle,
          });
    const selection = {
      profile: id,
      provider: profile.provider,
      fingerprint: storageFingerprint(profile),
      adapter,
    };
    this.adapters.set(id, selection);
    return selection;
  }

  forMedia(media: {
    storageProfile: string;
    provider: MediaProvider;
    storageFingerprint: string | null;
  }): MediaStorage {
    const selection = this.forProfile(media.storageProfile);
    if (
      media.provider !== selection.provider ||
      !media.storageFingerprint ||
      media.storageFingerprint !== selection.fingerprint
    )
      throw new ServiceUnavailableException(
        'Recorded storage location does not match its profile',
      );
    return selection.adapter;
  }
}
