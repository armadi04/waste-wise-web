# WasteWise backend

NestJS 12.1.2 with Fastify 5 on Bun, PostgreSQL and TypeORM. Owns auth/RBAC, users, invitations, 2FA,
sessions, media (Depot/direct S3), waste reports with ML-assisted classification,
SMTP outbox, notifications, audit, health, dashboard statistics and optional GraphQL.

## Quick start

```bash
bun install --frozen-lockfile
cp .env.example .env
# Fill required credentials and point DB_NAME at a new database.
bun run migration:run
bun run seed
bun run start:dev
```

GitHub Packages authentication is required for the SDK dependencies. API:
`localhost:3000/api/v1`; Swagger: `/api/docs` outside production; health: `/api/v1/health`.

`GET /api/v1` is public and returns only API identity:

```json
{ "name": "WasteWise API", "apiVersion": "1", "docs": "/api/docs" }
```

`apiVersion` follows the shared REST URI version configuration, independently of the
application release version. `docs` follows the shared Swagger location; the UI is available
outside production. Use `GET /api/v1/health` for monitoring: HTTP 200 means the PostgreSQL
connectivity ping and 300 MiB heap check succeeded; HTTP 503 means a check failed.
Probe connections use a dedicated pool with a 1 second acquisition timeout, a 1 second
server statement timeout and a 1.5 second transport fallback. Business query timeouts
are unchanged. Health errors omit internal details; schema and business readiness
are not tested. See [Operations](docs/OPERATIONS.md#health-and-acceptance).

```sh
curl http://localhost:3000/api/v1
curl http://localhost:3000/api/v1/health
```

Keep `DB_SYNCHRONIZE=false`. Baseline supports new databases only.

`MEDIA_PROVIDER=depot` is default; use `s3` for direct S3-compatible storage. Reports call
the internal ML service at `ML_SERVICE_URL` (`POST /api/v1/predict`) and still save with
`classificationStatus=FAILED` when it is unavailable. Required env and optional integrations
are listed in [Development](docs/DEVELOPMENT.md#environment).

Development/test seeding creates a verified User demo account
(`user@smart-waste.local` / `DemoUser123!` by default). Report mutations write `report.created`,
`report.updated`, `report.status_updated`, and `report.deleted` into the audit trail. Status
changes by staff also send the reporter an in-app notification linking to the report.

User accounts can be deactivated with `PATCH /api/v1/users/:id/status` (`users.manage_status`).
Inactive users cannot sign in, refresh, switch roles or use existing access tokens; all sessions
are revoked. Self-deactivation is rejected and superadmin accounts remain superadmin-only.

Report resources:

```text
GET    /api/v1/reports                 list (own or all by permission)
GET    /api/v1/reports/:id             detail
POST   /api/v1/reports                 create (mediaId from Media Module upload)
PATCH  /api/v1/reports/:id             update; new mediaId re-runs classification
PATCH  /api/v1/reports/:id/status      admin status transition
DELETE /api/v1/reports/:id             soft delete
GET    /api/v1/stats/reports           role-scoped dashboard aggregation
```

Photo flow: upload through `POST /api/v1/media/upload`, then pass `mediaId` to Reports.
The backend fetches the stored image from media storage and forwards it to the ML service;
the browser never calls the ML service directly.
Run `bun run build` before `start:prod` so imports are rewritten by tsc-alias.
Default tests are unit-only; requested integration/E2E work uses `nestplate_test`.
`bun run test:http` tests HTTP/GraphQL with Fastify injection and mocked dependencies,
plus loopback Socket.IO handshakes, without a database.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — Layers, code map, request lifecycle and integrations.
- [Development](docs/DEVELOPMENT.md) — Setup, environment, migrations and checks.
- [Auth](docs/AUTH.md) — Sessions, providers, verification, RBAC and security contracts.
- [Adding features](docs/ADDING_FEATURES.md) — CRUD recipe.
- [Operations](docs/OPERATIONS.md) — Storage providers, SMTP, Docker and diagnostics.
- [GraphQL](docs/GRAPHQL.md) — Optional API and machine clients.
- [Naming conventions](docs/NAMING_CONVENTIONS.md) — Files, identifiers and schema names.
- [AI agent guide](docs/AI_AGENT_GUIDE.md) — Rules and verification.
