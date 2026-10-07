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

Frontend Caddy proxies `/api`, `/socket.io` and `/graphql` to this service. Use HTTPS, exact
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

`GET /api/health` checks PostgreSQL and a 300 MiB heap threshold. It does not probe storage,
SMTP or OIDC. Verify health, migrations, cookies/CSRF, active-role permissions, media URLs,
real mail delivery and socket routing in the deployment environment.

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
DB health and resource usage. Auth/revocation contracts: [Auth](AUTH.md).
