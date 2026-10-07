# Nestplate backend

NestJS 12 on Bun, PostgreSQL and TypeORM. Owns auth/RBAC, users, invitations, 2FA,
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
`localhost:3000/api`; Swagger: `/api/docs` outside production; health: `/api/health`.
Keep `DB_SYNCHRONIZE=false`. Baseline supports new databases only.

`MEDIA_PROVIDER=depot` is default; use `s3` for direct S3-compatible storage. Required env
and optional integrations are listed in [Development](docs/DEVELOPMENT.md#environment).
Run `bun run build` before `start:prod` so imports are rewritten by tsc-alias.
Default tests are unit-only; requested integration/E2E work uses `nestplate_test`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — Layers, code map, request lifecycle and integrations.
- [Development](docs/DEVELOPMENT.md) — Setup, environment, migrations and checks.
- [Auth](docs/AUTH.md) — Sessions, providers, verification, RBAC and security contracts.
- [Adding features](docs/ADDING_FEATURES.md) — CRUD recipe.
- [Operations](docs/OPERATIONS.md) — Storage providers, SMTP, Docker and diagnostics.
- [GraphQL](docs/GRAPHQL.md) — Optional API and machine clients.
- [Naming conventions](docs/NAMING_CONVENTIONS.md) — Files, identifiers and schema names.
- [AI agent guide](docs/AI_AGENT_GUIDE.md) — Rules and verification.
