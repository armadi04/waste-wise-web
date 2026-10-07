# KuponMalam admin

React 19 SPA with Vite/TanStack Router, Query, HeroUI, Zustand and PWA support.
Shares the NestJS backend with the portal; session/RBAC authority stays in the API.

## Quick start

```bash
bun install --frozen-lockfile
bun run dev
```

Admin: localhost:3001. Backend: localhost:3000. Keep VITE_API_URL empty for the Vite /api proxy.
Run lint, test and build from this package. E2E (`bun run test:e2e`) is optional and runs only
when explicitly requested by the user. All tests live in test/.
Production static Caddy does not provide the Vite API proxy; configure edge routing explicitly.

## Documentation

- [Ai Agent Guide](docs/AI_AGENT_GUIDE.md) — Agent rules and change recipes.
- [Architecture](docs/ARCHITECTURE.md) — Boundaries, layers and data flow.
- [Naming Conventions](docs/NAMING_CONVENTIONS.md) — Identifier, route and schema conventions.
- [Development](docs/DEVELOPMENT.md) — Local setup, environment, commands and tests.
- [Operations](docs/OPERATIONS.md) — Deploy, diagnose, monitor and roll back.
- [Auth](docs/AUTH.md) — Session and permission contracts.
