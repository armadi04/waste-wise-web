# Nestplate frontend

React 19 SPA with Vite, TanStack Router/Query, HeroUI, Tailwind, Zustand and PWA support.
Backend remains the authority for identity, permissions and persistence.

## Quick start

```bash
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

Frontend: `localhost:3001`; backend: `localhost:3000`. Leave `VITE_API_URL` empty so
Vite proxies API and Socket.IO. Public environment variables are listed in
[Development](docs/DEVELOPMENT.md#public-build-configuration).

Run lint, unit tests and build from this package. Browser E2E is opt-in. Caddy provides
production API/socket proxying; set `BACKEND_URL` to a backend address reachable from
the frontend container.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — Layers, routing, Query and state ownership.
- [Development](docs/DEVELOPMENT.md) — Setup, environment, generated types and checks.
- [Auth](docs/AUTH.md) — Identity, refresh, verification and permission checks.
- [Adding features](docs/ADDING_FEATURES.md) — CRUD recipe.
- [Operations](docs/OPERATIONS.md) — Docker, Caddy, PWA and diagnostics.
- [Naming conventions](docs/NAMING_CONVENTIONS.md) — Feature organization and barrels.
- [AI agent guide](docs/AI_AGENT_GUIDE.md) — Rules and verification.
