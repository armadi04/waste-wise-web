# KuponMalam backend

NestJS 12 on Bun/PostgreSQL/TypeORM. Serves admin and portal REST APIs, session/RBAC,
OTP/Google/OIDC, transactional portal resources, Depot media, SMTP outbox, notifications,
audit, cache and optional GraphQL.

## Quick start

```bash
bun install --frozen-lockfile
cp .env.example .env
bun run migration:run
bun run seed
bun run start:dev
```

Fill required configuration; preserve an existing .env. API localhost:3000/api; Swagger
localhost:3000/api/docs outside production; health localhost:3000/api/health.
Migration-first: DB_SYNCHRONIZE=false. Production uses reviewed migrations and no demo seed.
Use bun run build before start:prod so tsc-alias rewrites imports.

Default test commands run unit tests in test/unit/. E2E (`bun run test:e2e`) is optional and
runs only when explicitly requested by the user, using a separate kuponmalam_test database.
Never run the integration harness against active application data. See Development before
running tests.

## Documentation

- [Ai Agent Guide](docs/AI_AGENT_GUIDE.md) — Agent rules and change recipes.
- [Architecture](docs/ARCHITECTURE.md) — Boundaries, layers and data flow.
- [Naming Conventions](docs/NAMING_CONVENTIONS.md) — Identifier, route and schema conventions.
- [Development](docs/DEVELOPMENT.md) — Local setup, environment, commands and tests.
- [Operations](docs/OPERATIONS.md) — Deploy, diagnose, monitor and roll back.
- [Auth](docs/AUTH.md) — Session and permission contracts.
- [Portal Api](docs/PORTAL_API.md) — Portal REST contract.
- [Graphql](docs/GRAPHQL.md) — Optional GraphQL and machine clients.
