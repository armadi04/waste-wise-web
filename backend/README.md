# Nestplate backend

NestJS 12.1.2 with Fastify 5 on Bun, PostgreSQL and TypeORM. Owns auth/RBAC, users, invitations, 2FA,
sessions, media (Depot/direct S3), SMTP outbox, notifications, audit, health, generic
dashboard statistics and optional GraphQL.

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
{ "name": "Nestplate API", "apiVersion": "1", "docs": "/api/docs" }
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

`MEDIA_PROVIDER=depot` is default; use `s3` for direct S3-compatible storage. Required env
and optional integrations are listed in [Development](docs/DEVELOPMENT.md#environment).
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
