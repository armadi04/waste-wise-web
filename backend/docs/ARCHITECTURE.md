# Backend architecture

## Boundaries

NestJS 12.1.2 runs on Bun with Fastify 5, PostgreSQL/TypeORM, Pino logging, cookie/JWT sessions,
RBAC, EventEmitter2, Socket.IO, optional Redis and opt-in schema-first GraphQL.
Controllers handle transport. Services own logic; generic CRUD extends `BaseService<T>`.
Guards authorize, DTOs validate, entities define persistence. Business resources are soft-deleted.

## Bootstrap and request lifecycle

`main.ts` validates env before initialization, installs cookie parsing, CORS, global exception
handling, class-validator DI, the `/api` global prefix, URI versioning with default version `1`, and transforming/whitelisting ValidationPipe.
Swagger `/api/docs` is non-production. Fastify cookie hooks precede session CSRF guards,
authentication, DTO pipes and services. `config/http.ts` shares adapter/parser/CORS setup.
Media uses native `@nestjs/platform-fastify/multipart` interceptors and memory storage;
admission runs before buffering. JSON/urlencoded bodies retain the 100 KiB limit and
urlencoded indexed arrays; media uploads retain their independent configured limits.
Global throttling defaults to 100 requests/minute; credential/upload routes use tighter limits.
Health probes skip throttling. Permission metadata needs a matching guard.

Responses are returned directly. `AllExceptionsFilter` preserves HTTP errors, supplies stable
English status codes and masks unknown errors. Clients map codes to UI copy.

Entities use `*.entity.ts` discovery. Modules register repositories with `forFeature`.
`DB_SYNCHRONIZE=false`; pending migrations run at boot unless `DB_SKIP_MIGRATIONS=true`.
The starter baseline requires a new database. Applied migrations are immutable.

## Code map

| Location | Responsibility |
|---|---|
| `auth/`, `sso/`, `oauth/`, `sessions/` | Identity, factors, providers, RBAC, machine clients, device sessions |
| `users/`, `roles/`, `permissions/`, `invitations/` | Administrative resources |
| `media/` | Ownership and Depot/direct S3 adapters |
| `mail/` | Templates, SMTP outbox, retries and redaction |
| `notifications/`, `app-refresh/` | Persisted notifications, realtime and refresh signals |
| `audit/`, `stats/`, `health/`, `changelog/` | Audit, generic dashboard, probes, release notes |
| `time-zone/` | Account display preferences and explicit-zone time previews |
| `common/` | BaseService, pagination, cache, filters, validation and utilities |
| `config/`, `database/` | Env/Swagger, CLI DataSource, migrations and seed |
| `graphql/` | SDL, resolvers, generated types, request-local DataLoaders |
| `scripts/` | Schema, migration, seed and contract tooling |
| `test/unit/`, `test/integration/`, `test/*.e2e.spec.ts` | Unit and opt-in database/HTTP tests |

## Persistence and DTO contracts

Tables use plural snake_case; physical columns use explicit camelCase. Nullable unions need
explicit database types. Preserve timestamps, soft-delete, foreign keys and junction indexes.
Raw SQL quotes camelCase. Never serialize passwords or token hashes.

`BaseService` supplies `findAll`, `findOne`, paginated ILIKE search, create/update, soft-delete
and DB error mapping. Pagination returns `{ data, meta: { total, page, lastPage } }`.
Override for relation/domain behavior only. DTOs validate/transform numeric and optional inputs;
database constraints handle concurrent uniqueness. Live email uniqueness uses a baseline SQL
index on `LOWER(email) WHERE deletedAt IS NULL`; role names use a partial entity index.

Runtime and PostgreSQL use UTC; stored timestamps use timestamptz. Display preferences stay
account/device-specific. Generic report zones currently support Jakarta, Makassar and Jayapura.

## Events and integrations

Services emit domain events; listeners persist notifications and push them through the gateway.
`system.create/update/delete`, `user.created/invited/deleted/roles_updated`, `user.notification`,
`report.status_changed` and `audit.record` are existing contracts. Feature services do not call
the gateway directly. `report.status_changed` (`src/reports/report-events.ts`) notifies the
reporter, unless they changed it themselves, with a `/reports/:id` link and the idempotent event
id `report:<id>:status:<status>`; a failed notification never fails the status update.
Socket.IO namespace `notifications` accepts cookie or explicit token auth and emits
`new_notification` and `app_refresh`. HTTP polling supplies a notification fallback.

Media rows retain their immutable storage profile/location fingerprint, object key and optional
Depot ID. Upload admission/size/content limits precede storage. Pending records exist before
I/O; only ready rows are public. Deleting rows are hidden and retried by a persistent UTC
cleanup worker with SKIP LOCKED and fenced leases. Reads/deletes use recorded profiles, never
the new default. Keep archived profiles configured for existing files and cleanup jobs.
Provider configuration: [Operations](OPERATIONS.md#media-providers).

Mail templates enqueue `outbound_emails`; the worker claims rows with SKIP LOCKED and retries.
Redis is optional and falls back to per-process memory. URL-keyed caching is only safe for
responses identical for every authorized caller; never cache ownership-filtered media lists.
Writes invalidate matching resource keys.

## Generated artifacts and CLI

Use `@/` imports. Build runs Nest plus tsc-alias before Bun executes `dist`.
Regenerate Swagger from routes/DTOs, frontend API types from Swagger, and GraphQL types from SDL.
Scripts own app shutdown and migration/seed switches; verify the target database before mutation.

Next: [Adding features](ADDING_FEATURES.md), [Auth](AUTH.md), [GraphQL](GRAPHQL.md).
