# Backend operations

## Build and deployment

Build from `backend/`. SDK installation uses a GitHub Packages package-read token:

```bash
docker build --secret id=node_auth,env=NODE_AUTH_TOKEN -t nestplate-api .
```

The secret contains the raw token, not an entire `.npmrc`. Runtime uses Bun and UTC.
Supply DB/JWT/storage and optional Redis/SMTP credentials at runtime.
Keep `NODE_ENV=production`, `DB_SYNCHRONIZE=false`, `DB_SEED=false`.
Entrypoint runs pending compiled migrations before starting the API on port 3000.
The starter baseline requires a new database with schema-creation privileges.

For initial account provisioning, run `migration:run` and `seed` in a controlled non-production
bootstrap environment against the new deployment database before opening traffic. Then switch
runtime to production and disable seed. Automatic production seeding is intentionally disabled.
Back up schema/data before later migrations; reverting an image does not revert a database.

Frontend Caddy proxies `/api` (including Swagger and its documents), `/socket.io` and `/graphql` to this service. Use HTTPS, exact
origins, browser-facing `APP_URL` and appropriate `TRUST_PROXY`.

## Media storage

Media uses S3-compatible storage (AWS or compatible endpoints):

```env
MEDIA_PROVIDER=s3
S3_REGION=us-east-1
S3_BUCKET=your_bucket
S3_ACCESS_KEY_ID=your_key
S3_SECRET_ACCESS_KEY=your_secret
# S3_ENDPOINT=https://s3.example.com
# S3_FORCE_PATH_STYLE=true
```

Direct S3 uses Bun S3Client, opaque per-user keys and 5-minute GET URLs. Path-style supports
compatible endpoints such as MinIO; AWS can infer the endpoint from region/bucket.
Legacy env keys create the `s3-default` profile. New rows record the selected
profile and a fingerprint of its physical location (not credentials). Reads/deletes fail closed
if the location changes or the profile disappears. Credential rotation remains supported.

For multiple locations, configure `MEDIA_STORAGE_PROFILES` as a JSON object keyed by immutable
profile IDs and choose `MEDIA_STORAGE_PROFILE`. Example shape:

```json
{
  "primary": { "provider": "s3", "region": "us-east-1", "bucket": "primary", "accessKeyId": "runtime-secret", "secretAccessKey": "runtime-secret", "forcePathStyle": false },
  "archive": { "provider": "s3", "region": "us-east-1", "bucket": "archive", "accessKeyId": "runtime-secret", "secretAccessKey": "runtime-secret", "forcePathStyle": false }
}
```

S3 profiles optionally accept `endpoint`. Switch to a NEW profile when changing a bucket or
storage service, retaining the old profile for its existing files/cleanup jobs. Never reuse an
existing ID for another location. Profiles/credentials load per process; restart on change.
Switching defaults does not migrate objects. Rotated keys must retain the same bucket
scope; location fingerprints do not identify a provider's credential scope.

### Media hardening migration

Apply `HardenMediaLifecycle` after the starter baseline. Existing rows receive their legacy
profile ID but deliberately have no guessed location fingerprint. Before changing storage
configuration, bind them with the ORIGINAL provider locations configured:

```bash
bun run migration:run
bun run media:bind-storage
```

Binding only fills missing fingerprints, locks rows and runs transactionally; it cannot
overwrite existing bindings. Until bound, legacy signed URLs return 503 and deletion remains
queued without touching remote storage. Fresh
installations need no binding. Invalid legacy provider/size/object data must be repaired before
adding CHECK constraints. Reverting hardening refuses active jobs/named live profiles;
drain/migrate them before an application/schema rollback.

### Upload and cleanup lifecycle

Default upload limit: 20 MiB, one file, at most 20 fields/21 multipart parts. Media uploads and
avatar updates share per-instance admission (four requests by default) before buffering.
Tune `MEDIA_MAX_FILE_SIZE` and `MEDIA_MAX_CONCURRENT_UPLOADS` together for the memory budget.
`MEDIA_ALLOWED_MIME_TYPES` controls content-signature detection; declared MIME is not trusted.
SVG/HTML/plain text are excluded by default. Signature detection is not malware scanning.
Missing/empty files return 400, oversize 413, unsupported content 415, saturated admission 429.

Before remote I/O, a pending row persists its UUID key/name and location identity. The
key is persisted before the PUT, so a crash is recovered by deleting that exact key.
S3 PUT/DELETE have abortable 30-second requests.
Only ready rows are listed or served. Failed/abandoned uploads are reclaimed after a 15-minute
safety window. The UTC worker runs every minute, uses SKIP LOCKED, renewable fenced leases and
bounded batches. Failed cleanup retries indefinitely with backoff capped at one hour.
Monitor pending/deleting age, cleanupAttempts and cleanupErrorCode; investigate sustained retries.

Local ownership and `media.read_all`/`media.delete_all` gates remain provider-independent.
OAuth clients cannot upload user-owned media; a client with only `media.read` has no owned
records. Global client lists require `media.read_all` in addition to `media.read`.
Public view redirects honor `isPrivate`; metadata/stream routes require authorization.
Deletion first durably marks the row deleting and detaches avatar references, then removes the
remote object and soft-deletes metadata. `queued` means the worker will retry; the file is already
hidden from the library. Repeated deletion is idempotent. Internal leases/fingerprints/errors
are excluded from serialized REST responses.

Single DELETE returns `{ id, status }`; bulk deletion returns `{ deleted, queued, failed, results }`
with per-item status/code. Batches accept 1–100 unique positive int4 IDs. Authorization is checked
before any item executes; partial provider/DB failures do not hide other outcomes.
GraphQL `deleteMediaWithResult` returns `MediaDeletionResult`. The existing Boolean
`deleteMedia` remains a deprecated compatibility alias; true means durable acceptance,
not necessarily completed remote cleanup. New clients should select status explicitly.

## Health and acceptance

`GET /api/v1/health` checks PostgreSQL connectivity (`SELECT 1`) and a 300 MiB heap
threshold. A dedicated `pg` pool allows at most two probe connections per application
instance. Acquisition (including queueing) is bounded to 1 second. PostgreSQL receives
`statement_timeout=1000` when each probe connection starts, so the server cancels slow
statements. A 1.5 second driver query timeout handles transport stalls; failed clients
are destroyed rather than returned to the pool. Successful clients are released, and
shutdown closes the pool. Allow up to 2.5 seconds for acquisition plus the transport
fallback when setting an external HTTP probe timeout.

Probe settings never modify the business pool or shared session configuration. Reserve
up to two extra database connections per replica when sizing PostgreSQL limits. Each
probe issues one query; choose a monitoring interval appropriate for the replica count.
Exhaustion of the business pool alone does not fail this connectivity check. Monitor
business latency, pool saturation, migration/schema readiness and error rates separately.

HTTP 200 means both checks succeeded; a failed or timed-out check returns HTTP 503.
The Terminus `status`, `info`, `error`, and `details` structure remains stable, with
sanitized failure messages. The exception filter adds `code: "SERVICE_UNAVAILABLE"`
on HTTP 503. This check does not validate schema or business operations, nor probe
storage, SMTP or Redis. Their operational acceptance checks remain separate.
Use `/api/v1/health` for dependency connectivity monitoring; `/api/v1` only identifies
the API. Choose readiness and restart policies according to these limited guarantees.

### Staging acceptance procedure

Use an isolated staging deployment, disposable data. Record the
release, browser, frontend/backend origins, date, expected result and observed result
for each step. Keep tokens, cookies, authorization codes and credential URLs out of
screenshots, exported network traces and logs.

1. Confirm `VITE_API_URL` is empty for the same-origin proxy, or an HTTP(S) backend
   origin. Verify the explicit CORS allowlist for any separate frontend origin.
2. Through the deployed proxy, request `/api/v1`, `/api/v1/health`, a protected REST
   route. Verify API responses are not the SPA fallback and the
   proxy preserves the path, HTTPS scheme and intended client IP under `TRUST_PROXY`.
   Verify legacy and unsupported version paths do not reach migrated handlers.
   Swagger is disabled in production mode; test `/api/docs`, its assets and documents
   only in the existing non-production mode, without enabling it for production.
3. In browser developer tools, check HTTPS `Secure`, token `HttpOnly`, cookie paths,
   CORS credential headers and preflight results. Exercise `/auth/me` (under the REST
   base), refresh, logout and a CSRF-protected mutation. Cross-origin and cross-site
   are different: the existing host-only cookies, readable CSRF/auth flags and
   `SameSite` policy do not automatically support arbitrary separate hosts/sites.
   Verify the actual intended topology; use the existing same-origin proxy if these
   tests fail. Do not loosen cookie/CORS policy solely to make a check pass.
4. Inject failures only into disposable dependencies owned by this staging test.
   Verify a PostgreSQL failure yields sanitized HTTP 503, root identity still yields
   HTTP 200, then restore connectivity and verify health, login, refresh and a real
   business read recover. Exercise a proxy/backend interruption
   separately; verify safe error handling and recovery. Do not stop shared or
   production services. Record timings, pool/connection counts and error rates.

Repository unit tests use mocks for HTTP behavior. The dedicated PostgreSQL
integration spec tests real server cancellation (SQLSTATE `57014`), full probe pool,
concurrent probes, terminated connections, cleanup, recovery and isolation from business query timeouts.
Neither proves the deployed proxy or browser cookie topology; those steps
remain pending until this staging procedure has recorded results.

## Integration diagnostics

| Symptom | Check |
|---|---|
| Startup validation fails | Required env and selected provider keys |
| Database error | Host/port/credentials, migration history, schema check |
| Redis unavailable | Connection logs; fallback is per-process memory |
| Cookies/CSRF fail | Exact origin, credentials, HTTPS, cookie/header match |
| Missing admin | New DB, controlled seed, ADMIN_EMAIL/PASSWORD |
| Email not delivered | SMTP setup, outbound_emails status/lastError and MAIL_FROM |
| Storage fails | Recorded provider, key scope, bucket/endpoint, network, signed URL |

SMTP dispatches every 30 seconds using SKIP LOCKED leases and bounded retries (five attempts).
OTP helper messages expire and redact after delivery/failure. Queued is not delivered.
JWT_SECRET also protects encrypted 2FA secrets; key rotation needs a data migration strategy.
Logs omit credential headers/query strings. Observe request IDs, error rates, queue failures,
DB health and resource usage. Use `/api/v1/health` for connectivity probes; `/api/v1` only identifies the API. Auth/revocation contracts: [Auth](AUTH.md).

## Deploying REST URI version 1

Deploy backend and rebuilt frontend together. No legacy aliases are provided.
Configure the following before deployment, keeping the deployment origin unchanged:

| Consumer | Previous path | New path | Action |
|---|---|---|---|
| Hosting/load balancer probe | `/api/health` | `/api/v1/health` | Change the HTTP probe path; retain the existing port and response criteria. |
| Machine token consumer | `/api/oauth/token` | `/api/v1/oauth/token` | Update the token endpoint configuration and all REST resource URLs. |
| External REST clients | `/api/<resource>` | `/api/v1/<resource>` | Update the configured API base or operation paths exactly once. |

The Caddy and Vite `/api` matchers already cover `/api/v1`; do not strip or
rewrite the version. `VITE_API_URL` and `APP_URL` are origins, without `/api/v1`.
Private environment files and external hosting settings are not edited by this change.

### Stored media URL migration and rollback

`VersionMediaUrls1791350000000` updates only `media.url` values with the explicit
`APP_URL` origin and exact `/api/media/<row-id>/view` path. Set `APP_URL` explicitly
to the verified browser-facing origin before running migrations. Historical origins
require separate review; they are not inferred from CDN URLs or rewritten globally.
The URL query and fragment, filenames, storage keys, provider URLs, and null values
are preserved. Avatars reference media rows, so no user-field rewrite is needed.
The migration prints the affected row count. New uploads generate version 1 URLs.

The migration retains old/new URLs and IDs in
`api_migration_backup.media_v1_urls`, outside the application schema. Keep this
backup for rollback; it can contain private query parameters, so do not export its
contents into logs. To inspect counts without exposing URLs:

```sql
SELECT count(*) FROM api_migration_backup.media_v1_urls;
```

Before rollback, stop application writes and restore the matching previous backend
and frontend release in a coordinated maintenance window. Verify that this is the
latest applied migration with `bun run migration:show`, then run
`bun run migration:revert` using the reviewed deployment database configuration.
Rollback restores only recorded rows still containing the migration's new URL,
then removes its backup table. Changed or missing rows abort the entire rollback
and preserve the backup for manual review; do not overwrite those rows blindly.
Restore hosting probe paths with the previous release.
Version 1 uploads created after migration are not in the backup; review them before
rolling back to a release that cannot serve version 1 URLs.

Verify migration and rollback first on a separate disposable `nestplate_test`
database, including existing avatars, external URLs, and already versioned URLs.
No development or production row count can be inferred from fixture results.

Swagger remains non-production and is mounted at the stable `/api/docs` path,
independently of REST URI versioning. JSON and YAML documents are
`/api/docs/openapi.json` and `/api/docs/openapi.yaml`. Update external documentation
bookmarks from `/docs` to `/api/docs`; live-spec consumers move from `/docs-json`
and `/docs-yaml` (or the older `/api/docs-json` and `/api/docs-yaml`) to the new
JSON/YAML URLs. No documentation aliases or version 2 document are provided. The checked-in
`swagger.json` filename and frontend `api:generate` input remain unchanged.
Swagger Bearer authentication remains configured; operation paths contain the
complete `/api/v1` prefix and `servers` contains no extra prefix. Thus Swagger
"Try it out" executes versioned operations at the origin serving the docs.


## Fastify migration validation and rollback

Nest common/core/testing and the Socket.IO platform packages are pinned to 12.1.2;
Fastify is pinned to 5.12.5. Further Nest minor upgrades require compatibility analysis.
REST/OpenAPI, cookie routes, optional `/graphql` and `/socket.io` paths are unchanged.
The frontend and database schema need no changes.

### Compatibility audit

| Surface | Migration and evidence |
|---|---|
| Cookies / Passport | Fastify request/reply, cookie hook, seconds conversion at the serialization boundary; isolated HTTP tests cover legacy unsigned cookies, JWT signatures, cookie flags/lifetimes, redirects and logout. No signed-cookie secret existed; none is introduced. |
| CSRF | Global SessionCsrfGuard runs before throttling and Passport on refresh/logout/switch-role, including Bearer requests. Conditional CookieCsrfGuard semantics remain unchanged. |
| Multipart | Native Nest Fastify interceptors; media/avatar memory storage explicitly retains fileSize from MEDIA_MAX_FILE_SIZE, files=1, fields=20, parts=21. Form-only routes retain their previous module/default limits. Admission precedes buffering. HTTP tests check exact limit boundaries, statuses and error payloads; unexpected-field wording is normalized to the previous Multer wording. |
| Parsers / errors | 100 KiB JSON/urlencoded limit, empty JSON bodies and indexed form arrays are preserved. Known HTTP status/error codes and masking of unknown errors remain. |
| GraphQL | Apollo Fastify integration receives request/reply separately; req/res context and fresh DataLoaders remain. Tests boot the actual GraphQL module/schema with feature modules mocked and exercise JWT, ownership and rate-limit headers. |
| Socket.IO | Gateway remains on the same underlying HTTP server. Loopback HTTP polling tests exercise the namespace, cookie/auth-token/Bearer handshake, refresh replay and rejection of invalid/refresh/2FA JWTs. |
| Logging / middleware | No application Express middleware remains. nestjs-pino still uses supported Nest middleware over raw Node request/response through Fastify middie; request URL/header redaction is retained; injected and loopback HTTP tests verify correlation and credential redaction. |
| Dependencies | Direct platform-express, Apollo Express integration, Multer, cookie-parser and their direct types were removed after all callers were migrated. Bun retains optional Express peer packages in its resolved tree; they are not application imports or a runtime adapter fallback. |

The controller/DTO OpenAPI comparison before and after migration is structurally identical
(72 paths), and regeneration preserves the checked-in document byte for byte. Baseline
SHA-256: `aa1259fcdfd115de8223ff0a8eae636166cc8b832620fa11b831ee1ee7918748`.
`bun run test:http` compares current real-controller metadata with `swagger.json` without a DB.

### Reverse proxy acceptance

The repository Caddy config proxies to the backend, but an additional upstream proxy was
reported and its topology/CIDRs/header rewriting rules have not been supplied. Actual
deployment proxy acceptance remains pending; synthetic tests cannot establish it.

Leave TRUST_PROXY unset/false until the chain is verified. Set an explicit comma-separated
allowlist of the actual proxy IPs/CIDRs; do not invent addresses or trust all private networks.
Blanket true and numeric hop counts fail startup validation because they cannot authenticate
the immediate peer. Existing deployments using those values must replace them with their
verified proxy allowlist before starting this backend.

Record the complete Internet → ingress/CDN → Caddy → backend chain and backend port exposure.
Require each trusted ingress to overwrite or sanitize incoming forwarding headers, and
restrict backend network access to intended proxies. Through that chain verify the observed
client IP used for throttling/session/audit, HTTPS scheme and host. Also send forged
X-Forwarded-For/Proto/Host directly from an untrusted peer: they must not alter those values.
Synthetic HTTP tests cover this direct attack and a two-proxy allowlist chain that stops
at the first untrusted address, ignoring attacker-supplied addresses further left.

### Transport microbenchmark

Recorded on 2026-10-26 with Bun 1.3.14. Both adapters serve the same deterministic JSON
endpoint with ten items: 1,000 warmup requests, then three trials of 10,000 requests,
concurrency 20. No database or external services. Raw trials and the baseline Git commit
are in [transport-comparison.json](../test/performance/transport-comparison.json); the
repeatable harness is [http-benchmark.ts](../test/performance/http-benchmark.ts).

| Median metric | Express / Nest 12.0.1 | Fastify / Nest 12.1.2 |
|---|---:|---:|
| Throughput (requests/s) | 5,268 | 5,993 |
| p50 latency (ms) | 2.782 | 2.286 |
| p95 latency (ms) | 9.138 | 9.260 |
| CPU per 10,000 requests (ms) | 3,441 | 3,129 |
| CPU utilization (% of one core) | 181.25 | 187.53 |
| RSS (MiB) | 128.38 | 129.23 |
| Heap used (MiB) | 21.31 | 24.57 |

Client fetches and server run in one process, so CPU/memory include both; CPU can exceed
100% across cores. RSS/heap are sampled after each trial, not peak usage. Adapter runs
were sequential on a shared host and variance is substantial: throughput medians improve,
but p95 and memory do not. This microbenchmark does not establish a production speedup
or measure real auth, uploads, GraphQL, logging or database workloads. Repeat on controlled
hardware with representative traffic before making capacity claims.

### Git and lockfile rollback

The pre-migration source/manifest/lockfile is retained on `backup/express-before-fastify`
at `59fc731acf7bc371dd3cd72673ce7fbb3766fe6b`; migration commits are on `refactor/backend-fastify`.
Preserve any later work before switching branches. For a fresh clone without the local
backup branch, recreate it with `git branch backup/express-before-fastify 59fc731acf7bc371dd3cd72673ce7fbb3766fe6b`.
For an uncommitted checkout, from backend/ use a named stash including untracked backend
files, record its stash ID, then switch to the backup branch:

```bash
git stash push --include-untracked -m fastify-rollback-checkpoint -- .
git switch backup/express-before-fastify
bun install --frozen-lockfile
bun run build
```

Restart only when explicitly authorized, using the previous runtime configuration and
`DB_SKIP_MIGRATIONS=true DB_SEED=false` to avoid startup migrations/seeding. Do not run
migration:revert, reset the database, change frontend assets, or rotate JWT_SECRET for
this transport rollback. Returning to the migration branch and applying the recorded
stash restores uncommitted migration work. Deployment/real-proxy acceptance and full
E2E remain separate, explicitly authorized operations.
