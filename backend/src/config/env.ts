import '@/database/business-time.config';
process.env.TZ = 'UTC';

import { z } from 'zod';
import { resolveTurnstileConfig } from '@/auth/turnstile-config';

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
  PORTAL_PAYMENT_MODE: z
    .enum(['disabled', 'sandbox'])
    .default(
      ['production', 'staging'].includes(process.env.NODE_ENV ?? '')
        ? 'disabled'
        : 'sandbox',
    ),
  PORTAL_PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  PORTAL_APP_URL: z.string().optional(),

  // Database
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_SYNCHRONIZE: boolFromEnv(false),
  DB_SEED: boolFromEnv(true),
  PORTAL_SEED_EMAIL: z.string().email().optional(),
  PORTAL_SEED_NAME: z.string().min(1).max(120).optional(),

  // JWT
  JWT_SECRET: z.string().min(16),

  // Session lifetimes (see sessions/session-policy.ts). Idle = longest gap
  // between refreshes; absolute = hard limit since login.
  SESSION_ADMIN_IDLE_MINUTES: z.coerce.number().int().positive().default(120),
  SESSION_ADMIN_ABSOLUTE_HOURS: z.coerce.number().int().positive().default(8),
  SESSION_PORTAL_IDLE_DAYS: z.coerce.number().int().positive().default(14),
  SESSION_PORTAL_ABSOLUTE_DAYS: z.coerce.number().int().positive().default(30),

  // Customer voucher/ticket QR tokens. Optional: falls back to a key derived
  // from JWT_SECRET (never the login secret itself). Set explicitly in production.
  PASS_QR_SECRET: z.string().min(32).optional(),
  PASS_QR_TTL_SECONDS: z.coerce.number().int().min(15).max(600).default(60),

  // Admin seed
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),

  // Depot media service (required)
  DEPOT_BASE_URL: z.string().url(),
  DEPOT_API_KEY: z.string().min(1),

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

  // SSO / OIDC (optional — enables "Sign in with SSO"). Omit SSO_ISSUER to disable.
  SSO_ISSUER: z.string().url().optional(),
  SSO_CLIENT_ID: z.string().optional(),
  SSO_CLIENT_SECRET: z.string().optional(),
  SSO_REDIRECT_URI: z.string().url().optional(),
  SSO_POST_LOGOUT_URI: z.string().url().optional(),
  SSO_SUCCESS_REDIRECT: z.string().default('/'),
  SSO_DEFAULT_ROLE: z.string().default('user'),

  // Mail (optional — omit SMTP_HOST to leave delivery disabled)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  // Implicit TLS (port 465). Port 587 upgrades with STARTTLS on its own.
  SMTP_SECURE: boolFromEnv(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().email().optional(),
  MAIL_FROM_NAME: z.string().optional(),

  // Release notes for the in-app changelog come from this repo's GitHub
  // Releases. Both are optional so a fresh clone still boots — without a token
  // the API is rate-limited by IP (and a private fork returns nothing), and the
  // page then renders empty.
  GITHUB_REPO: z.string().default('univSTEKOM/nestplate'),
  GITHUB_TOKEN: z.string().optional(),

  // Rate limiting
  THROTTLE_TTL: z.coerce.number().default(60000),
  THROTTLE_LIMIT: z.coerce.number().default(100),

  // GraphQL (optional — opt-in API surface beside REST)
  GRAPHQL_ENABLED: boolFromEnv(false),
  GRAPHQL_PLAYGROUND: boolFromEnv(false),
  GRAPHQL_MAX_COMPLEXITY: z.coerce.number().default(1000),
  GRAPHQL_MAX_DEPTH: z.coerce.number().default(10),
  GRAPHQL_PERSISTED_ONLY: boolFromEnv(false),

  // App
  APP_URL: z.string().url().default('http://localhost:3000'),
  // Shown as the issuer in authenticator apps for two-factor codes.
  APP_NAME: z.string().default('Kupon Malam'),
  ALLOWED_ORIGINS: z.string().default('*'),
  // Express `trust proxy`: unset/false, a hop count or proxy addresses/subnets.
  TRUST_PROXY: z.string().optional(),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
});

export const envSchema = baseEnvSchema.superRefine((env, context) => {
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
