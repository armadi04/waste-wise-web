# Backend operations

## Build and deployment

Install with frozen lockfile; run lint, tests against the test database, build and schema:check.
Review migration SQL and environment before deploying. Build uses tsc-alias; deploy compiled
dist output through the backend Dockerfile, not a bare Nest build.

Private package installation uses a BuildKit node_auth secret:

```bash
docker build --secret id=node_auth,src="$HOME/.npmrc" -t kuponmalam-api .
```

Keep NODE_ENV=production, DB_SYNCHRONIZE=false and DB_SEED=false. Production seed boot is
skipped; import business/catalog data through controlled processes. Container entrypoint
applies pending migrations with migration:run:prod before starting Bun dist/main.js.
App boot also checks pending migrations when synchronize is disabled. Do not edit applied
migrations or use migrate:fresh in production. Schema rollback needs backup/compatibility
review; reverting an image alone does not revert the database.

Fresh database deployment requires an existing PostgreSQL database with schema creation
privileges. Set `LEGACY_TIMESTAMP_TIME_ZONE=UTC` for the historical timezone conversion even
when there are no rows yet. Never enable synchronize or fabricate migration history.
Migration `1791219000000-NormalizeLegacyCommerceIndexes` deliberately sorts before
`1791220000000-PartialUniqueIndexesForSoftDelete`: it bridges explicit historical index names
and schema-sync generated names without changing applied migrations. Existing partial indexes
are preserved; redundant global indexes are removed so deleted keys can be reused. Rollback of
the partial-unique migration requires resolving duplicates allowed by its soft-delete policy.
Production seeding remains disabled; provision initial roles, permissions and the administrator
through a controlled bootstrap process before opening admin access.

Supply PostgreSQL, JWT, Depot and any configured Redis/SMTP/OIDC/payment credentials through
runtime secret management. Set exact ALLOWED_ORIGINS for credentialed browser requests.
Use HTTPS and correct public APP_URL/SSO callback/logout URLs. Never log tokens or credentials.

## Health and acceptance

GET `/api/health` checks PostgreSQL and a 300 MiB heap threshold and skips rate throttling.
It does not prove SMTP, Depot, OIDC or payment providers are healthy. Swagger is non-production;
generate static OpenAPI only in a suitable environment if needed.

Before traffic promotion, verify migration completion, health, admin/portal auth and ownership,
refresh/CSRF, active-role permissions, notification websocket routing, media redirects,
real email/provider delivery and payment callback verification. Portal Start receives public
traffic separately; its proxy deliberately excludes provider webhook/admin routes.

Rollback the backend image only if current schema/contracts remain compatible. Destructive
migrations require a separate reviewed restore/rollback procedure. Observe error rates,
request IDs, latency, DB health, queue failures and resource usage across canary traffic.

## Integration diagnostics

| Symptom | Checks/action |
|---|---|
| Env validation failure | Run from backend root; compare required keys with env schema/template; do not hardcode a secret |
| PostgreSQL failure | Host/port/credentials/database, network, migration:show/run after connection is restored |
| Schema mismatch | Entity/migration diff and schema:check; never enable production synchronize to hide drift |
| Redis unavailable | Connection logs and credentials; fallback is per-process memory, not shared multi-instance cache |
| Cookie/CORS/CSRF failure | Exact origin, credentials, HTTPS, csrfToken versus X-CSRF-Token; inspect actual protected endpoint policy |
| Missing seed | Non-production NODE_ENV, DB_SEED, migrations, demo email configuration; authorized seed rerun is idempotent |
| Missing OTP/email | SMTP setup, outbound_emails status/lastError/retry/lease and MAIL_FROM; queued is not delivered |
| Media failure | DEPOT_BASE_URL is origin without /api/v1, API key scope, network, signed URL and ownership |
| SSO unavailable | SSO_ISSUER/client/callback configuration, discovery logs, provider machine-endpoint network/WAF policy |
| Payment callback rejection | Secret configured and matching, verified provider adapter, backend routing (not portal proxy) |

Depot owns object storage; this API delegates through DepotClient. Local Media metadata is
soft-deleted; remote deletion is best-effort and remote 404 must not block local removal.
Public media view redirects are intentionally different from authenticated stream/metadata.

MailOutboxService dispatches every 30 seconds, leases rows with SKIP LOCKED for multiple workers,
and retries with 1m/5m/15m/60m backoff up to five attempts. Without SMTP_HOST messages fail
rather than falsely succeeding. Investigate lastError before resending; avoid duplicate manual
SMTP senders. JWT_SECRET also protects encrypted 2FA secrets: rotation requires a key/data
migration strategy, not an arbitrary value swap.

For read caching use existing CacheInterceptor/CacheService conventions and invalidate writes
with resource patterns such as */users*. Check authenticated cache partitioning before extending
shared caching. SSO discovery failure leaves SSO disabled; do not treat graceful startup as
provider availability. Auth protocol and revocation details: [Auth](AUTH.md).


## Campaign reconciliation and transaction signals

A read-only reconciliation runs hourly in UTC. A PostgreSQL advisory transaction lock prevents
multiple app replicas from scanning simultaneously. It uses a repeatable-read snapshot and
15-second statement timeout; concurrent uncommitted awards do not create false mismatches.
The job compares signed ledger totals with progress, frozen targets/status, missing rewards,
discount terms, consumption counts, eligibility and checkout reservations. Expired/consumed
reward policy and legacy baseline-only campaigns are respected. No balances are rewritten and
no replacement codes are issued.

Run `bun run campaigns:check` for an on-demand report. It prints category counts and at most
20 internal campaign/user ID samples, without reward/referral codes, tokens or personal contact
data. Exit 0 means no inconsistencies; exit 1 means mismatch, failure or an overlapping check
that should be retried. Application DB access is required, but the task disables migrations,
synchronize and seeding. Deploy the campaign migration before enabling this feature.

Structured backend log events are the monitoring contract:

| Event | Action |
|---|---|
| `campaign_reconciliation_ok` | Record hourly completion; investigate absence across two expected runs |
| `campaign_reconciliation_mismatch` | Alert on any nonzero count; inspect the CLI report and impacted orders |
| `campaign_reconciliation_failed` | Alert on failed scan; check database access/schema/query latency |
| `campaign_lock_wait` | Tracks waits of at least 250ms; investigate sustained contention |
| `campaign_transaction_slow` | Tracks successful commerce/campaign operations taking at least 1000ms |
| `campaign_transaction_failed` | Track failure rate and safe database/connection codes, without query/secret payloads |

These signals use existing structured logging. Configure the deployment's log collector to
route alerts; no external notification destination is provisioned by this change. Compare
latency/failure baselines during staging/canary traffic and keep the local load report separate
from production capacity measurements.

On mismatch, preserve logs and take a reviewed backup/snapshot before correction. Fix the
underlying source path first. Incorrect business credits use audited adjustments with a stable
key; projection drift requires a reviewed rebuild from the ledger, since adding an adjustment
to both ledger and progress cannot repair an existing difference. Missing reward or reservation
state also needs case review; do not directly reset points, replay historical payments, mint
replacement discounts, or enable synchronize as a repair.

Transient failures return 503 with bounded five-second lock waits and fifteen-second statement
limits. Retry the original request/key after contention or connection recovery. Never retry
with a fresh key simply because the client timed out; a committed transaction may already exist.

## Auth and admin pass update rollout

Deploy backend before admin/portal: it accepts the complete Following type set and returns
the notification read-all message expected by the portal. Refresh tokens without `jti` remain
valid until normal expiry/revocation; do not clear sessions as part of rollout.
Pass metadata edits use a row lock and selective updates. Compare 409/500 rates and request
latency during staging/canary traffic. Exercise metadata edits alongside redeem/check-in and
refund in the isolated test environment before production promotion. Unit transaction fixtures
cover ordering but do not establish actual PostgreSQL contention behavior or browser cookie
behavior. No schema migration is required for these changes.
