import '@/database/business-time.config';
process.env.TZ = 'UTC';

import { z } from 'zod';
import { resolveTurnstileConfig } from '@/auth/turnstile-config';
import { resolveStorageProfiles } from './media-storage.config';
import { parseTrustProxy } from '@/common/utils/request-logging';

/**
 * Strict boolean env parser. `z.coerce.boolean()` uses `Boolean(string)`, which
 * makes ANY non-empty string — including the literal "false" — true. This maps
 * only "true"/"1"/"yes"/"on" (case-insensitive) to true, everything else false.
 */
const boolFromEnv = (defaultValue: boolean) =>
  z
    .preprocess(
      (v) =>
        typeof v === 'string'
          ? ['true', '1', 'yes', 'on'].includes(v.toLowerCase())
          : defaultValue,
      z.boolean(),
    )
    .default(defaultValue);

const baseEnvSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  APP_DEFAULT_TIME_ZONE: z
    .enum(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'])
    .default('Asia/Jakarta'),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_SYNCHRONIZE: boolFromEnv(false),
  DB_SEED: boolFromEnv(true),

  // JWT
  JWT_SECRET: z.string().min(16),

  // Session lifetimes (see sessions/session-policy.ts). Idle = longest gap
  // between refreshes; absolute = hard limit since login.
  SESSION_ADMIN_IDLE_MINUTES: z.coerce.number().int().positive().default(120),
  SESSION_ADMIN_ABSOLUTE_HOURS: z.coerce.number().int().positive().default(8),

  // Admin seed
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  DEMO_USER_EMAIL: z.string().email().optional(),
  DEMO_USER_PASSWORD: z.string().min(8).optional(),

  // Only the selected storage provider requires credentials at startup.
  MEDIA_PROVIDER: z.enum(['s3']).default('s3'),
  MEDIA_STORAGE_PROFILE: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/)
    .optional(),
  MEDIA_STORAGE_PROFILES: z.string().optional(),
  MEDIA_MAX_FILE_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(100 * 1024 * 1024)
    .default(20 * 1024 * 1024),
  MEDIA_MAX_CONCURRENT_UPLOADS: z.coerce
    .number()
    .int()
    .min(1)
    .max(16)
    .default(4),
  MEDIA_ALLOWED_MIME_TYPES: z
    .string()
    .min(1)
    .default(
      'image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,audio/mpeg,audio/wav,application/zip',
    ),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: boolFromEnv(false),

  // Redis (optional)
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_TTL: z.coerce.number().default(3600),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // OAuth / CAPTCHA (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  TURNSTILE_ENABLED: z.enum(['true', 'false', '1', '0']).optional(),
  TURNSTILE_ALLOWED_HOSTNAMES: z.string().optional(),
  TURNSTILE_SECRET: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(), // Legacy alias; TURNSTILE_SECRET takes precedence.

  // Mail (optional — omit SMTP_HOST to leave delivery disabled)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  // Implicit TLS (port 465). Port 587 upgrades with STARTTLS on its own.
  SMTP_SECURE: boolFromEnv(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().email().optional(),
  MAIL_FROM_NAME: z.string().optional(),

  // Rate limiting
  THROTTLE_TTL: z.coerce.number().default(60000),
  THROTTLE_LIMIT: z.coerce.number().default(100),

  // GraphQL (optional — opt-in API surface beside REST)
  GRAPHQL_ENABLED: boolFromEnv(false),
  GRAPHQL_PLAYGROUND: boolFromEnv(false),
  GRAPHQL_MAX_COMPLEXITY: z.coerce.number().default(1000),
  GRAPHQL_MAX_DEPTH: z.coerce.number().default(10),
  GRAPHQL_PERSISTED_ONLY: boolFromEnv(false),

  // ML service (optional; reports still save when unavailable)
  ML_SERVICE_URL: z.string().url().optional(),
  ML_SERVICE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60000)
    .default(15000),

  // App
  APP_URL: z.string().url().default('http://localhost:3001'),
  // Shown as the issuer in authenticator apps for two-factor codes.
  APP_NAME: z.string().default('WasteWise'),
  ALLOWED_ORIGINS: z.string().default('*'),
  // Unset/false ignores forwarded headers. Otherwise use actual proxy addresses/CIDRs.
  TRUST_PROXY: z.string().optional(),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
});

export const envSchema = baseEnvSchema.superRefine((env, context) => {
  try {
    parseTrustProxy(env.TRUST_PROXY);
  } catch (error) {
    context.addIssue({
      code: 'custom',
      path: ['TRUST_PROXY'],
      message: (error as Error).message,
    });
  }
  try {
    resolveStorageProfiles(env);
  } catch (error) {
    context.addIssue({
      code: 'custom',
      path: ['MEDIA_STORAGE_PROFILE'],
      message:
        error instanceof Error
          ? error.message
          : 'Invalid media storage configuration',
    });
  }
  try {
    resolveTurnstileConfig(env);
  } catch (error) {
    context.addIssue({
      code: 'custom',
      path: ['TURNSTILE_ENABLED'],
      message:
        error instanceof Error
          ? error.message
          : 'Invalid Turnstile configuration',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const messages = result.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`❌  Environment validation failed:\n${messages}`);
}

export default result.data;
