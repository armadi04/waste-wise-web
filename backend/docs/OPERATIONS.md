# Backend operations

## Build and deployment

Build from `backend/`. SDK installation uses a GitHub Packages package-read token:

```bash
docker build --secret id=node_auth,env=NODE_AUTH_TOKEN -t nestplate-api .
```

The secret contains the raw token, not an entire `.npmrc`. Runtime uses Bun and UTC.
Supply DB/JWT/storage and optional Redis/SMTP/OIDC credentials at runtime.
Keep `NODE_ENV=production`, `DB_SYNCHRONIZE=false`, `DB_SEED=false`.
Entrypoint runs pending compiled migrations before starting the API on port 3000.
The starter baseline requires a new database with schema-creation privileges.

For initial account provisioning, run `migration:run` and `seed` in a controlled non-production
bootstrap environment against the new deployment database before opening traffic. Then switch
runtime to production and disable seed. Automatic production seeding is intentionally disabled.
Back up schema/data before later migrations; reverting an image does not revert a database.

Frontend Caddy proxies `/api` (including Swagger and its documents), `/socket.io` and `/graphql` to this service. Use HTTPS, exact
origins, browser-facing `APP_URL`, matching SSO callback/logout URLs and appropriate `TRUST_PROXY`.

## Media providers

Default:

```env
MEDIA_PROVIDER=depot
DEPOT_BASE_URL=https://depot.example.com
DEPOT_API_KEY=your_write_scoped_key
```

`DEPOT_BASE_URL` is an origin without `/api/v1`. Depot owns its S3 configuration.

Direct AWS or compatible storage:

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
Legacy env keys create `depot-default` and `s3-default` profiles. New rows record the selected
profile and a fingerprint of its physical location (not credentials). Reads/deletes fail closed
if the location changes or the profile disappears. Credential rotation remains supported.

For multiple locations, configure `MEDIA_STORAGE_PROFILES` as a JSON object keyed by immutable
profile IDs and choose `MEDIA_STORAGE_PROFILE`. Example shape:

```json
{
  "primary": { "provider": "depot", "baseUrl": "https://depot.example.com", "apiKey": "runtime-secret" },
  "archive": { "provider": "s3", "region": "us-east-1", "bucket": "archive", "accessKeyId": "runtime-secret", "secretAccessKey": "runtime-secret", "forcePathStyle": false }
}
```

S3 profiles optionally accept `endpoint`. Switch to a NEW profile when changing a bucket or
Depot service, retaining the old profile for its existing files/cleanup jobs. Never reuse an
existing ID for another location. Profiles/credentials load per process; restart on change.
Switching defaults does not migrate objects. Rotated keys must retain the same bucket/Depot app
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

Before remote I/O, a pending row persists its UUID key/name and location identity. Depot stores
the reservation ID before PUT; crashes before that write recover by exact name and owner.
S3 PUT/DELETE have abortable 30-second requests; Depot requests have 15-second timeouts.
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
storage, SMTP, Redis or OIDC. Their operational acceptance checks remain separate.
Use `/api/v1/health` for dependency connectivity monitoring; `/api/v1` only identifies
the API. Choose readiness and restart policies according to these limited guarantees.

### Staging acceptance procedure

Use an isolated staging deployment, disposable data and a test IdP client. Record the
release, browser, frontend/backend origins, date, expected result and observed result
for each step. Keep tokens, cookies, authorization codes and credential URLs out of
screenshots, exported network traces and logs.

1. Confirm `VITE_API_URL` is empty for the same-origin proxy, or an HTTP(S) backend
   origin. Register the exact `SSO_REDIRECT_URI` ending in
   `/api/v1/auth/sso/callback` and backchannel URL ending in
   `/api/v1/auth/sso/backchannel-logout` in the test IdP. Verify frontend success/logout
   targets and the explicit CORS allowlist for any separate frontend origin.
2. Through the deployed proxy, request `/api/v1`, `/api/v1/health`, a protected REST
   route and an SSO navigation. Verify API responses are not the SPA fallback and the
   proxy preserves the path, HTTPS scheme and intended client IP under `TRUST_PROXY`.
   Verify legacy and unsupported version paths do not reach migrated handlers.
   Swagger is disabled in production mode; test `/api/docs`, its assets and documents
   only in the existing non-production mode, without enabling it for production.
3. Complete interactive SSO against the actual test IdP. Verify the callback path,
   successful session identity, PKCE cookie cleanup and frontend redirect. Test an
   expired attempt, invalid state and silent login without an IdP session; each must
   fail safely without an authentication loop. Test logout and a real signed
   backchannel logout event, then verify session revocation.
4. In browser developer tools, check HTTPS `Secure`, token `HttpOnly`, cookie paths,
   CORS credential headers and preflight results. Exercise `/auth/me` (under the REST
   base), refresh, logout and a CSRF-protected mutation. Cross-origin and cross-site
   are different: the existing host-only cookies, readable CSRF/auth flags and
   `SameSite` policy do not automatically support arbitrary separate hosts/sites.
   Verify the actual intended topology; use the existing same-origin proxy if these
   tests fail. Do not loosen cookie/CORS policy solely to make a check pass.
5. Inject failures only into disposable dependencies owned by this staging test.
   Verify a PostgreSQL failure yields sanitized HTTP 503, root identity still yields
   HTTP 200, then restore connectivity and verify health, login, refresh and a real
   business read recover. Exercise unavailable IdP and a proxy/backend interruption
   separately; verify safe error handling and recovery. Do not stop shared or
   production services. Record timings, pool/connection counts and error rates.

Repository unit tests use mocks for HTTP/SSO behavior. The dedicated PostgreSQL
integration spec tests real server cancellation (SQLSTATE `57014`), full probe pool,
concurrent probes, terminated connections, cleanup, recovery and isolation from business query timeouts.
Neither proves the actual IdP, deployed proxy or browser cookie topology; those steps
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
| SSO unavailable | Discovery/client/callback configuration and provider connectivity |

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
| OIDC callback | `/api/auth/sso/callback` | `/api/v1/auth/sso/callback` | Set runtime `SSO_REDIRECT_URI` and register exactly the same complete URL in the IdP client's allowed redirect URIs. |
| OIDC backchannel logout | `/api/auth/sso/backchannel-logout` | `/api/v1/auth/sso/backchannel-logout` | Update the IdP client's backchannel logout URL to the complete new URL. |
| Machine token consumer | `/api/oauth/token` | `/api/v1/oauth/token` | Update the token endpoint configuration and all REST resource URLs. |
| External REST clients | `/api/<resource>` | `/api/v1/<resource>` | Update the configured API base or operation paths exactly once. |

The local callback example is `http://localhost:3001/api/v1/auth/sso/callback`.
Keep `SSO_POST_LOGOUT_URI` and `SSO_SUCCESS_REDIRECT` as their existing frontend
URLs. The Caddy and Vite `/api` matchers already cover `/api/v1`; do not strip or
rewrite the version. `VITE_API_URL` and `APP_URL` are origins, without `/api/v1`.
Private environment files and external IdP/hosting settings are not edited by this change.

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
Restore IdP callback/backchannel and hosting probe paths with the previous release.
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
