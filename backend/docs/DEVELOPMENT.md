# Backend development

## Setup

Use Bun 1.3.14+, PostgreSQL 14+ and a new database (suggested name `nestplate`). Redis is
optional. SDK packages are served through the checked-in `@univstekom` GitHub Packages registry.
Configure a package-read token through your user-level npm/Bun authentication or CI secret;
never commit it. Docker accepts the raw token through BuildKit `node_auth`.
Backend CI accepts `NODE_AUTH_TOKEN`; forks need a package-read token with access to both SDKs.

From `backend/`:

```bash
bun install --frozen-lockfile
cp .env.example .env
# Replace placeholders and configure the selected media provider.
bun run migration:run
bun run seed
bun run start:dev
```

Preserve an existing `.env`. API: `localhost:3000/api/v1`; frontend: `localhost:3001`.
Set `APP_URL` to the browser-facing origin so mail/media links use the frontend proxy.
Set exact `ALLOWED_ORIGINS` for cookie sessions; wildcard disables credentialed CORS.

## Environment

Source of truth: `src/config/env.ts`; template: `.env.example`. Invalid/missing values fail boot.

| Group | Configuration |
|---|---|
| Database (required) | DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME; DB_PORT=5432 |
| Identity (required) | JWT_SECRET (min 16 chars), ADMIN_EMAIL, ADMIN_PASSWORD (min 8 chars) |
| Storage | MEDIA_PROVIDER=depot; selected provider credentials required (see below) |
| Storage profiles | MEDIA_STORAGE_PROFILE optional; MEDIA_STORAGE_PROFILES JSON map of named locations/credentials |
| Upload limits | MEDIA_MAX_FILE_SIZE=20971520 bytes (max 100 MiB); MEDIA_MAX_CONCURRENT_UPLOADS=4 (1–16); MEDIA_ALLOWED_MIME_TYPES signature allowlist |
| Server | NODE_ENV=development, PORT=3000, APP_NAME=Nestplate, APP_URL; ALLOWED_ORIGINS, LOG_LEVEL=info |
| Database policy | DB_SYNCHRONIZE=false, DB_SEED=true; DB_SKIP_MIGRATIONS only bypasses app boot migrations |
| Sessions | SESSION_ADMIN_IDLE_MINUTES=120, SESSION_ADMIN_ABSOLUTE_HOURS=8 |
| Timezone | APP_DEFAULT_TIME_ZONE=Asia/Jakarta; reports also support Makassar/Jayapura |
| Proxy | TRUST_PROXY: unset/false, or verified proxy addresses/subnets; true/hop counts are rejected |
| Depot | DEPOT_BASE_URL (origin), DEPOT_API_KEY (write scope) |
| Direct S3 | S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY; optional S3_ENDPOINT, S3_FORCE_PATH_STYLE=false |
| Redis | REDIS_HOST optional; REDIS_PORT=6379, REDIS_TTL=3600 seconds, REDIS_USERNAME/PASSWORD |
| Google | GOOGLE_CLIENT_ID optional |
| CAPTCHA | TURNSTILE_ENABLED, TURNSTILE_SECRET, TURNSTILE_ALLOWED_HOSTNAMES; legacy TURNSTILE_SECRET_KEY alias |
| SSO | SSO_ISSUER, SSO_CLIENT_ID/SECRET, SSO_REDIRECT_URI, SSO_POST_LOGOUT_URI, SSO_SUCCESS_REDIRECT=/, SSO_DEFAULT_ROLE=user |
| SMTP | SMTP_HOST optional, SMTP_PORT=587, SMTP_SECURE=false, SMTP_USER/PASS, MAIL_FROM/NAME |
| Rate limits | THROTTLE_TTL=60000 ms, THROTTLE_LIMIT=100 |
| GraphQL | GRAPHQL_ENABLED=false; limits and flags in [GraphQL](GRAPHQL.md#enabling-it) |
| Releases | GITHUB_REPO (set to your fork), GITHUB_TOKEN optional |

Inactive storage credentials are not required. Keep them configured if existing records need
that provider. SMTP is required for real invitation/reset/verification delivery.
Turnstile is required in staging/production unless explicitly disabled; see [Auth](AUTH.md).

## Migrations and seeding

The single starter baseline creates only core tables and live uniqueness indexes. It refuses
an existing `users` table; this is a new-database template, not a legacy upgrade path.
Never rewrite an applied migration when extending your clone.

```bash
bun run migration:generate src/database/migrations/AddYourFeature
bun run migration:show
bun run migration:run
bun run schema:check
```

Review generated SQL. Keep `DB_SYNCHRONIZE=false`. Seeder is idempotent, non-production and
creates permissions, `superadmin`/`user` roles and the env-configured verified admin, without
business/demo data. Automatic boot seeding is gated by `DB_SEED`; explicit `seed` controls its
own run. `migrate:fresh[:seed]` drops schema and is only for explicitly authorized disposable DBs.

## Commands and generated output

- `start:dev`: Bun watch; `build`: Nest + tsc-alias; `start:prod`: Bun compiled output.
- `lint`: ESLint fixes; `format`: Prettier write. Review resulting diffs.
- `spec:generate`: regenerate `swagger.json` from real controller/DTO metadata with mocked dependencies, a sanitized environment and no database; preserve the artifact when semantically unchanged.
- `graphql:types`: regenerate SDL types. Frontend `api:generate` consumes Swagger.
- `schema:check`: read-only schema/naming/junction check; use a migrated disposable DB.

## Tests and isolation

Required checks: `bun run lint`, `bun run test`, `bun run build`.
For HTTP adapter/auth/upload/GraphQL/realtime changes also run `bun run test:http`.
This suite uses Fastify `inject()` with mocked services and the actual GraphQL module;
Socket.IO handshakes use an ephemeral loopback port. It never connects to a database
and does not run the opt-in database/E2E harness.
Default scripts target `test/unit/` only. The unit launcher creates an allowlisted child
environment with `--no-env-file`, dummy provider credentials and an unreachable DB port.
It never inherits developer DB/provider settings. Unit tests use fakes and do not need providers
or a live DB. Focused runs use `NESTPLATE_TEST_MODE=unit bun --no-env-file test test/unit/<file>`.
All tests live under `test/`.

`bun --no-env-file test/performance/http-benchmark.ts fastify` runs the transport
microbenchmark without providers or a database. See [Operations](OPERATIONS.md#fastify-migration-validation-and-rollback)
for the recorded Express comparison, limitations and rollback procedure.

E2E and database integration tests are opt-in, run only when explicitly requested.
Provision a separate disposable PostgreSQL instance/database named `nestplate_test` first.
Integration preload refuses implicit developer DB settings. Export `TEST_DB_HOST`,
`TEST_DB_PORT`, `TEST_DB_USERNAME`, `TEST_DB_PASSWORD` explicitly; `TEST_DB_NAME`, if supplied,
must be `nestplate_test`. Preload maps these to DB settings and replaces provider credentials
with dummies. Verify the disposable target. Harness applies migrations and deletes test rows.
Never point it at an active application database. External Mail/Turnstile/storage use fakes.

The optional `test/integration/fresh-database-migrations.spec.ts` requires an empty database;
it verifies the baseline, entity columns and live indexes without resetting an existing DB.

## REST URI versioning

The global prefix remains `api`. NestJS URI versioning uses default version `1`,
so REST operations are under `/api/v1`, including health and SSO. Do not put `v1`
in controller paths. Old `/api/*` and unsupported `/api/v2/*` REST URLs return 404.
URI API version and application release version are independent.
`DocumentBuilder.setVersion()` sets OpenAPI metadata only; routing versioning
is enabled separately by `app.enableVersioning()`. Swagger UI stays
at `/api/docs` outside production, with `/api/docs/openapi.json` and `/api/docs/openapi.yaml` documents.
Its OpenAPI document includes full `/api/v1/*`
operation paths without a duplicated server prefix. GraphQL `/graphql` and
Socket.IO are separate interfaces and keep their existing paths.
NestJS Swagger also adds `_v1` to generated operation IDs; regenerate external
SDKs if they depend on those identifiers. Request and response schemas are unchanged.

`configureApiRouting` is shared by the application, HTTP test bootstrap, and
OpenAPI generator. Regenerate contracts with `bun run spec:generate`, then run
`bun run api:generate` from the frontend package. Use a disposable database for
contract generation with `DB_SEED=false` and `DB_SKIP_MIGRATIONS=true` after applying
reviewed migrations; generation boots the application and opens a DB connection.

The opt-in migration test `test/integration/media-url-versioning.spec.ts` requires
an empty disposable `nestplate_test` database. It applies migrations, seeds 16
media fixtures and an avatar relation, checks origin filtering, URL preservation,
idempotency, and guarded rollback, then leaves the database migrated for inspection.
Run it with the explicit `TEST_DB_*` settings described above:

```bash
bun --no-env-file test ./test/integration/media-url-versioning.spec.ts --timeout=30000
```

Create a fresh disposable database before repeating this test; it refuses a
nonempty database. The test environment pins its application origin to
`http://localhost:3001`, uses dummy provider credentials, and never uses private env files.

### PostgreSQL health integration checks

`test/integration/health-database.spec.ts` requires an isolated disposable
`nestplate_test` PostgreSQL on port `55439`, `NESTPLATE_TEST_MODE=integration`, and
explicit test credentials. Run the spec with the sanitized integration environment
from `test/utils/test-environment.ts`, without loading private env files:

```sh
bun --no-env-file test/integration/run-health.ts
```

The launcher requires `TEST_DB_HOST=127.0.0.1`, `TEST_DB_PORT=55439`,
`TEST_DB_USERNAME`, and `TEST_DB_PASSWORD`. It checks real server cancellation,
acquisition timeout under pool exhaustion, concurrent probes, cleanup/recovery,
and isolation of probe session settings. It does not stop database services or
change business data. Do not substitute a development or production database.
