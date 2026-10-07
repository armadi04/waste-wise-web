# Backend development

## Setup

Use Bun (frontend CI uses 1.3.14), PostgreSQL and valid backend configuration. Redis is
optional. Depot/SMTP/provider access is needed when testing real external integrations.
From backend/:

```bash
bun install --frozen-lockfile
cp .env.example .env
bun run migration:run
bun run seed
bun run start:dev
```

Copy the template only for a new environment. Fill required values before starting.
Seed is idempotent, non-production and gated by DB_SEED. Keep DB_SYNCHRONIZE=false for the
migration-first workflow. `migrate:fresh` and `migrate:fresh:seed` drop/recreate schema and are
only for explicitly authorized disposable development databases.

Local catalog seeding adds 15 synthetic `[Demo]` events alongside the original 3 events.
Fixtures span 7 cities and WIB/WITA/WIT, with full descriptions/photos, 3 ticket categories,
2 reservation slots and 3 unverified demo reviews per new event outside test mode. They include
limited stock, sold-out categories and one sold-out event. Stable slugs and relation keys make
reruns additive: existing records, consumed ticket stock and slot capacity are not reset.
No migration or database reset is needed; run `bun run seed` to add missing demo data.

API: localhost:3000/api; Swagger: localhost:3000/api/docs outside production; health:
localhost:3000/api/health. Portal uses localhost:3002, admin localhost:3001. For direct browser
requests include both exact origins in ALLOWED_ORIGINS; wildcard disables credentialed CORS.

## Environment

Source of truth is `src/config/env.ts`; templates are in `.env.example`. Missing/invalid
required values fail boot. Required groups: DB_HOST/DB_USERNAME/DB_PASSWORD/DB_NAME,
JWT_SECRET (at least 16 characters), ADMIN_EMAIL/ADMIN_PASSWORD (at least 8 characters),
DEPOT_BASE_URL/DEPOT_API_KEY. Required credential fields remain required even when their
integration is not exercised during local development.

| Group         | Configuration and defaults                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server        | NODE_ENV=development, PORT=3000, APP_URL=http://localhost:3000, APP_NAME=Kupon Malam, LOG_LEVEL=info; ALLOWED_ORIGINS defaults wildcard so override for browser sessions |
| Proxy         | TRUST_PROXY unset (direct client); set to a hop count or proxy addresses/subnets (e.g. the portal BFF) so `req.ip` uses X-Forwarded-For |
| Portal links  | PORTAL_APP_URL=http://localhost:3002; optional string read at request time and used for gift `redeemUrl` and gift emails (`/gifts/:code`) |
| Database      | DB_PORT=5432; DB_SYNCHRONIZE=false, DB_SEED=true; DB_SKIP_MIGRATIONS is an explicit application boot switch, not a substitute for migration management                   |
| Portal demo   | PORTAL_SEED_EMAIL/PORTAL_SEED_NAME; non-production only; tests disable the demo identity                                                                                 |
| Redis         | REDIS_HOST optional; REDIS_PORT=6379, REDIS_TTL=3600 seconds; optional username/password                                                                                 |
| OAuth/CAPTCHA | GOOGLE_CLIENT_ID and TURNSTILE_SECRET optional; TURNSTILE_SECRET_KEY is a legacy alias                                                                                                                           |
| SSO           | SSO_ISSUER, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, POST_LOGOUT_URI with SSO_ prefix; SUCCESS_REDIRECT defaults /, DEFAULT_ROLE defaults user                            |
| SMTP          | SMTP_HOST optional; PORT=587, SECURE=false; SMTP_USER/PASS, MAIL_FROM/NAME; port465 uses implicit TLS; SMTP credentials are not vendor API keys                          |
| Changelog     | GITHUB_REPO defaults univSTEKOM/nestplate, GITHUB_TOKEN optional for private repo/rate limit                                                                             |
| Throttling    | THROTTLE_TTL=60000 ms, THROTTLE_LIMIT=100                                                                                                                                |
| Sessions      | SESSION_ADMIN_IDLE_MINUTES=120, SESSION_ADMIN_ABSOLUTE_HOURS=8, SESSION_PORTAL_IDLE_DAYS=14, SESSION_PORTAL_ABSOLUTE_DAYS=30; see [Auth](AUTH.md#token-flow)           |
| Pass QR       | PASS_QR_SECRET optional (min 32; falls back to a key derived from JWT_SECRET, set explicitly in production); PASS_QR_TTL_SECONDS=60 (15-600)                             |
| GraphQL       | GRAPHQL_ENABLED=false; other flags/limits documented in [GraphQL](GRAPHQL.md#enabling-it)                                                                                |
| Payments      | PORTAL_PAYMENT_WEBHOOK_SECRET is an optional string consumed by the portal callback handler; configure the provider secret at runtime, never in frontend              |

Keep secrets in ignored `.env` locally and runtime secret management in production. Frontends
receive only public Vite values. Treat checked-in examples as placeholders, not credentials.

## Commands and generated output

- `start:dev`: Bun watcher; `build`: Nest plus tsc-alias; `start:prod`: Bun dist/main.js.
- `lint`: ESLint with fixes; `format`: Prettier write; review their changes.
- `migration:generate src/database/migrations/<Name>`: create schema diff, review SQL.
- `migration:run`, `migration:show`, `migration:revert`: apply/inspect/revert migrations in the
  intended database. Reverts are mutations requiring compatibility/backup review.
- `schema:check`: read-only schema naming check; `spec:generate`: generate swagger.json.
- `graphql:types`: regenerate types from SDL; frontend can generate OpenAPI types from Swagger.

## Tests and isolation

```bash
bun run test:unit
bun run test
bun run build
```

`test`, `test:unit`, `test:watch`, `test:cov` and `test:debug` target unit tests only. E2E is
optional and runs only when explicitly requested by the user:

```bash
bun run test:e2e
```

Unrequested E2E is not a required check or a reason to mark verification incomplete. If
requested E2E cannot run, report the exact limitation.

Bun preloads `test/utils/setup-env.ts` before modules. It pins NODE_ENV=test,
DB_NAME=kuponmalam_test and DB_SYNCHRONIZE=true, clears portal demo seed identity and quiets
logging. Unit/E2E scripts run serially with 30-second test timeout. Unit specs are in
`test/unit/`; integration specs are `test/*.e2e.spec.ts`.

Provision a separate disposable PostgreSQL instance/database and export DB_HOST, DB_PORT,
DB_USERNAME and DB_PASSWORD for it before E2E. The preload pins the name, not the host;
verify connection variables rather than relying on the name alone. Never run against active
application/production data. Test helpers clean rows and may synchronize schema.

setup-app uses deterministic Mail/Turnstile/Depot/throttler fakes; NotificationsListener is
neutralized to avoid asynchronous writes racing cleanup. Endpoint tests do not prove actual
SMTP/provider delivery. Test notification delivery/listener behavior separately when changed.

## Coupon package verification

`test/coupon-packages.e2e.spec.ts` exercises gallery validation, package ownership, concurrent last-unit claims, per-package idempotency, stable gift/voucher snapshots, stock-preserving admin edits and migration up/down in an isolated schema. It uses the dedicated test database.

If an explicitly requested E2E run on Bun 1.3.14 reports `require() async module` before Nest tests run, run each requested `test/*.e2e.spec.ts` separately with `bun test <file> --max-concurrency=1 --timeout=30000`. This isolates the module loader; report the failing command rather than claiming it passed. Run `bun run schema:check`, `bun run spec:generate` and `bun run build` after schema/contract changes.

Runtime and PostgreSQL sessions use UTC. Absolute API timestamps require RFC 3339 with an explicit offset and serialize as UTC `Z`. Product fallback is `Asia/Jakarta`; display preference is account/device-specific and shared between admin and portal. Coupon/event business zones support Jakarta, Makassar and Jayapura; local schedule inputs are converted by the backend with explicit zones and UTC previews. Date-only values remain calendar dates. Report filters specify their zone and use exclusive following midnight. See the portal `docs/TIMEZONE.md` for the full contract and guarded migration rollout.

Event stock regression tests cover concurrent final-ticket buyers and identical checkout
retries using a transaction/lock fake, failure rollback, admin partial-update stock bounds,
and catalog/detail availability consistency with bounded relation-query counts. These unit
tests do not prove PostgreSQL lock behavior; database concurrency/E2E verification remains
optional and runs only when explicitly requested.

Local campaign seeding adds 20 synthetic `[Demo]` campaigns alongside the original `demo` campaign (21 total). Stable slugs preserve existing campaign edits and user progress. Configured fixtures use real backend rules: +10 per paid order, +5 per verified paid voucher/ticket usage, and +20 for a referred friend's first paid order. Empty product filters match all products. Apply migrations with `bun run migration:run` before `bun run seed`; do not reset existing data. The original unconfigured campaign keeps its baseline without earning new points.

Portal admin data rules have a service-level suite in the same disposable-schema style:
`DB_SYNCHRONIZE=false DB_SEED=false NODE_ENV=test bun test ./test/integration/portal-admin.spec.ts --max-concurrency=1 --timeout=30000`.
It covers the category/city backfill migration, rename cascades and delete guards, concurrent
wallet adjustments (first wallet creation and key replays), concurrent gift revocation, customer
totals, broadcast fan-out/idempotency and the public category/city/slug-filter queries.

Session lifetime rules (idle sliding, absolute cut-off, audience backfill migration) run with
`DB_SYNCHRONIZE=false DB_SEED=false NODE_ENV=test bun test ./test/integration/session-policy.spec.ts --max-concurrency=1 --timeout=30000`.

Campaign service integration verification uses `bun test ./test/integration/campaign-points.spec.ts --max-concurrency=1 --timeout=30000`. These are service-level PostgreSQL tests, separate from HTTP E2E. The preload pins `kuponmalam_test`; each run creates and drops its own randomly named schema. Use the dedicated test PostgreSQL connection, never application or production credentials. Coverage includes concurrent payments/referrals, resource verification, personal reward reservation, refunds, immutable rules, and audited adjustments.

## Campaign hardening verification

Run `bun run test:campaigns:http` when campaign HTTP verification is requested. The real Nest
JWT/permission/CSRF guards, transforming DTO pipes and exception filter run against an injected
DataSource in a randomly named schema of `kuponmalam_test`; external integrations remain fakes.
The suite covers anonymous/invalid/expired JWT, unverified users, admin action permissions,
CSRF cookie/header matching, nested rules DTOs, owned orders/vouchers and personal rewards.
It creates/drops only its own schema and does not call the shared destructive cleanup helper.

`bun run test:campaigns:integration` also exercises read-only reconciliation, overlapping checks,
consistent snapshots, five-second lock timeout, connection termination inside an uncommitted
transaction, safe retries, concurrent referral confirmation/payment, and bounded load with
24 active campaigns, 12 buyers and four workers. The JSON `campaign_load_test` line reports
local p50/p95 duration and retry counts. This is a correctness regression under bounded local
load, not a production throughput SLA or real payment-provider test.

The opt-in suites are separate from default unit tests. Run required lint/unit/build checks
normally. `bun run campaigns:check` checks the configured application database read-only,
without running migrations or seeding; see Operations before interpreting a mismatch.

## VA sandbox development

`PORTAL_PAYMENT_MODE=sandbox` enables VA simulation in development/test; `disabled` disables it.
Development/test default to sandbox. Staging/production always refuse sandbox operations,
including when the variable is set to sandbox. Keep provider secrets in runtime configuration.
The Bank Sandbox number is not a real bank account. Use the explicitly labeled customer
simulation action to confirm payment. Coins use the existing cashback wallet; production VA
issuance is a separate provider integration.

Deploy migration `1791101000000-CompletePortalCheckout` before the backend, then deploy portal
and admin. It adds nullable order payment fields and nullable package snapshot/foreign key on
order items; historical paid orders are retained. Migration reversal removes these new fields,
so roll back application versions before reversing the schema.
Unit commerce coverage uses mocked transactions and cannot replace a live provider test.
Schema validation must use the dedicated test database. A synchronize-created test database
without migration history cannot replay the old migration chain; validate the new migration
separately without resetting the application database or fabricating applied migration records.

### Quantity checkout migration and database integration

Migration `1791150000000-IndexPortalOrderHistory` adds an index on user, creation time, and
order ID for nondeleted order history. Apply it through the normal migration runner;
the application database must not use synchronize. The commerce integration suite verifies
index up/down, paginated ownership and refund filtering, refund eligibility after voucher/ticket
usage, and legacy item fallback against PostgreSQL. It also verifies immutable price reads
after stored item edits.

Apply the reviewed migrations CompletePortalCheckout (if outstanding), CheckoutQuantity,
and CommerceEventReceipts before running new commerce code; do not use synchronize on the
application database. Legacy orders default quantity to 1 and retain their original issuance.
Migration `1791104000000-ConfigureLegacyBundles` records the existing default package/Early Bird
selection. `1791105000000-CommerceLimitConsistency` backfills only clear default or unique
components and assigns legacy pending orders a 24-hour deadline from creation.
`1791106000000-ReviewLegacyBundleComponents` flags older heuristic mappings for admin review;
affected bundles remain unavailable until an administrator confirms both components. The
migrations index per-user live-order counts. Configure future bundle
components and optional limits/sales windows through admin. Old coupon expiry/event start supply compatible sale cutoffs.

The explicitly requested commerce integration suite uses a random disposable schema only in
kuponmalam_test. It runs real PostgreSQL row/advisory locks with separate pooled connections;
campaign award calculation is separately unit-tested, while commerce/pass locks are real.
It does not execute browser/HTTP E2E or contact a real payment provider:

```sh
DB_NAME=kuponmalam_test DB_SYNCHRONIZE=false DB_SEED=false NODE_ENV=test bun test ./test/commerce-quantity.integration.spec.ts --timeout=30000
```

Tests cover expiry/payment, refund/redeem/check-in, shared wallet balance, idempotency mismatch,
partial issuance rollback, bundle snapshot changes, per-user limit reads/refresh, safe legacy
bundle inference, deadline backfill, and duration validity. Monitor
Pending expired reservations, LateSettled refunds, refund Failed states and undelivered
portal_commerce_outbox rows; resolve external provider refunds before confirming completion.

## Turnstile configuration and verification

`TURNSTILE_ENABLED` accepts true/false or 1/0. Omitted: enabled in staging/production,
or locally when `TURNSTILE_SECRET` (legacy `TURNSTILE_SECRET_KEY`) is nonempty.
Enabled deployments require a real secret and comma-separated `TURNSTILE_ALLOWED_HOSTNAMES`
(hostnames only, without scheme, port, path or wildcard). Both registered frontend hostnames
must be included when sharing a widget. Test secrets are forbidden in staging/production,
including when deliberately disabled. Locally use Cloudflare's official dummy key pair;
dummy validation does not prove action/hostname isolation. To deliberately disable protection,
set `TURNSTILE_ENABLED=false` and remove the public site keys from frontend builds.

The verifier has a 10-second provider timeout and never automatically reuses a token.
Unit tests cover config policy, context mismatch, duplicate/expired provider responses,
malformed responses, network/timeout handling and sanitized outcome logs. Frontend tests
exercise widget callbacks, theme remounts, script errors/loading timeouts and captured OTP
email identity. These tests mock Cloudflare; validate actual provider, cookies and trusted
proxy/client-IP behavior in staging before production.

### Fresh database migration regression

`test/integration/fresh-database-migrations.spec.ts` requires a newly provisioned disposable
PostgreSQL database named `kuponmalam_test`. Set DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD to
that isolated instance. The test refuses a nonempty public schema and never drops, synchronizes
or seeds it. Provision another disposable instance for each fresh-chain run.

```bash
DB_NAME=kuponmalam_test DB_SYNCHRONIZE=false DB_SEED=false LEGACY_TIMESTAMP_TIME_ZONE=UTC bun test ./test/integration/fresh-database-migrations.spec.ts ./test/integration/commerce-hardening-migrations.spec.ts --max-concurrency=1 --timeout=30000
```

Coverage includes migration ordering, replay as a no-op, entity table/column parity, historical
and schema-sync index names, redundant global indexes on upgraded databases, rejected missing
or unexpected index definitions, deleted-key reuse and up/down/reapply behavior. The compatibility
migration sorts before the existing partial-unique migration without changing its history.
Compiled production CLI verification runs `migration:run:prod` on a separate fresh disposable
database with the same UTC acknowledgement. Production administrator/role provisioning remains
a separate controlled bootstrap task; the development/demo seeder is not a production bootstrap.

## Google avatar import verification

Apply migration 1791230000000-AddPortalAvatarImports before deploying the backend.
The service-level PostgreSQL suite uses a random disposable schema in kuponmalam_test:

    bun test ./test/integration/portal-avatar-import.spec.ts --max-concurrency=1 --timeout=30000

It verifies actual row/advisory locks, manual-upload races, transaction rollback, durable
staging cleanup, restart recovery, retry exhaustion and URL redaction, and migration up/down.
It does not use HTTP/browser E2E or contact Google/Depot. Unit tests additionally cover a real
local streaming response stalled past the five-second download deadline and cache failures.
Schema parity verification uses bun run schema:check against an isolated migrated test
database. Monitor redacted failed jobs and warning counts; provider URLs are retained only
while a job is pending. Roll back application code before reverting the queue migration.

If Bun 1.3.14 reports an async-module require error during spec:generate, preload Nest first:

    bun run --preload=@nestjs/common src/scripts/generate-spec.ts

Use the same isolated migrated test database with DB_SEED=false, DB_SYNCHRONIZE=false,
and DB_SKIP_MIGRATIONS=true when generating the spec for verification.
