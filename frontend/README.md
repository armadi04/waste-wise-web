# WasteWise frontend

React 19 SPA with Vite, TanStack Router/Query, HeroUI, Tailwind, Zustand and PWA support.
Backend remains the authority for identity, permissions and persistence. The same shell serves
Admin and User; navigation and actions follow backend permissions.

Reports live at `/reports`, `/reports/new`, and `/reports/:reportId`. The dashboard is `/`
and shows report counts/charts scoped by the backend (all reports for Admin, own for User).
Table filters, pagination, and sorting are URL state; report photos upload through the Media
Module before the report is created. The Users table shows derived account status
(Active/Inactive/Unverified/Locked) and role names. Admins with `users.manage_status` can
deactivate or reactivate other accounts; inactive users are signed out and cannot sign in. Report lifecycle changes appear in the audit trail
and the Admin dashboard activity feed.

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
