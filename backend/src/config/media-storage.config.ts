import { createHash } from 'node:crypto';
import { z } from 'zod';

const profileSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('depot'),
    baseUrl: z.string().url(),
    apiKey: z.string().min(1),
  }),
  z.object({
    provider: z.literal('s3'),
    endpoint: z.string().url().optional(),
    region: z.string().min(1),
    bucket: z.string().min(1),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
    forcePathStyle: z.boolean().default(false),
  }),
]);
const profilesSchema = z.record(
  z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/),
  profileSchema,
);
export type StorageProfile = z.infer<typeof profileSchema>;

export class StorageConfigurationError extends Error {}

export function resolveStorageProfiles(source: Record<string, unknown>) {
  const text = (key: string): string | undefined => {
    const value = source[key];
    return typeof value === 'string' ? value : undefined;
  };
  let input: unknown = {};
  const json = text('MEDIA_STORAGE_PROFILES');
  if (json) {
    try {
      input = JSON.parse(json);
    } catch {
      throw new StorageConfigurationError(
        'MEDIA_STORAGE_PROFILES must be valid JSON',
      );
    }
  }
  const parsed = profilesSchema.safeParse(input);
  if (!parsed.success)
    throw new StorageConfigurationError(
      'MEDIA_STORAGE_PROFILES contains an invalid profile; check provider credentials and location fields',
    );
  const profiles = new Map<string, StorageProfile>(Object.entries(parsed.data));
  const baseUrl = text('DEPOT_BASE_URL');
  const apiKey = text('DEPOT_API_KEY');
  if (!profiles.has('depot-default') && baseUrl && apiKey) {
    profiles.set('depot-default', {
      provider: 'depot',
      baseUrl,
      apiKey,
    });
  }
  const region = text('S3_REGION');
  const bucket = text('S3_BUCKET');
  const accessKeyId = text('S3_ACCESS_KEY_ID');
  const secretAccessKey = text('S3_SECRET_ACCESS_KEY');
  if (
    !profiles.has('s3-default') &&
    region &&
    bucket &&
    accessKeyId &&
    secretAccessKey
  ) {
    profiles.set('s3-default', {
      provider: 's3',
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      ...(text('S3_ENDPOINT') ? { endpoint: text('S3_ENDPOINT') } : {}),
      forcePathStyle:
        source.S3_FORCE_PATH_STYLE === true ||
        ['true', '1', 'yes', 'on'].includes(
          (text('S3_FORCE_PATH_STYLE') ?? 'false').toLowerCase(),
        ),
    });
  }
  const selected =
    text('MEDIA_STORAGE_PROFILE') ||
    `${text('MEDIA_PROVIDER') || 'depot'}-default`;
  if (!profiles.has(selected))
    throw new StorageConfigurationError(
      'Selected media storage profile is not configured',
    );
  return { profiles, selected };
}

/** Credentials may rotate; a profile's physical location may not. */
export function storageFingerprint(profile: StorageProfile): string {
  const location =
    profile.provider === 'depot'
      ? ['depot', new URL(profile.baseUrl).href.replace(/\/$/, '')]
      : [
          's3',
          profile.endpoint
            ? new URL(profile.endpoint).href.replace(/\/$/, '')
            : null,
          profile.region,
          profile.bucket,
          profile.forcePathStyle,
        ];
  return createHash('sha256').update(JSON.stringify(location)).digest('hex');
}
