# WasteWise

Smart Waste Management Platform built on **NestJS 12 + Bun** and **React 19 + Vite**.
Authentication, RBAC, media management, real-time notifications, responsive navigation,
waste reports with ML-assisted classification, and a role-aware dashboard are included.

This README is a summary. Start with each package's `docs/ARCHITECTURE.md`, then read
the task-oriented guide linked below. Backend and frontend are independent Bun packages;
there is no root package-manager workspace.

## What's included

| Feature | Details |
|---|---|
| Authentication | JWT access/refresh cookies, Google OAuth, token blacklisting |
| Account security | TOTP 2FA, recovery codes, account lockout, idle/absolute session deadlines, refresh rotation and reuse detection |
| Email verification | Token-based verification with 24-hour expiry; server guard and client gate |
| Invitations | Admin invites; invitee chooses a password and receives an auto-verified account |
| CSRF | Double-submit cookie on refresh, logout and role switching |
| RBAC | Roles, direct permissions, active-role scoping, grant ceiling, API guards and UI gates |
| Media | S3-compatible storage; per-user ownership and admin override |
| Notifications | Socket.IO, polling fallback and browser desktop notifications |
| Audit and sessions | Append-only audit trail, device session management and controlled impersonation |
| Rate limiting | Global IP throttle (100/min by default), stricter credential/upload endpoints |
| Configuration | Zod startup validation; Redis optional with in-memory fallback |
| API identity | `GET /api/v1`: name, URI API version, documentation URL |
| Health | `GET /api/v1/health`: PostgreSQL ping and heap memory check |
| Reports | Role-scoped report CRUD, URL-driven filters, status transitions, media photos, ML classification results and audit trail |
| Users | Existing user management plus activate/deactivate, session revocation, account status and role names |
| Dashboard and tables | Role-aware report statistics, Recharts distributions, sortable/searchable/paginated DataTable, Excel export |
| PWA | Installable frontend, production service worker and update handling |
| GraphQL | Optional schema-first API, DataLoaders and RBAC-guarded resolvers |
| Email | SMTP outbox with retries; no mail-provider API dependency |

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Bun **1.3.14+** |
| Backend | NestJS 12 · TypeORM 1.1 · PostgreSQL 14+ · Socket.IO 4.8 |
| Cache | Redis, or per-process memory |
| Storage | Bun S3Client (AWS / compatible endpoints) |
| Frontend | React 19 · Vite 8 · TanStack Router 1 · TanStack Query 5 |
| State | Zustand (client) · Query (server) · URL params (tables) · react-hook-form (forms) |
| UI | HeroUI 2.8 · Tailwind CSS 4 |
| Validation | Zod (configuration/frontend) · class-validator DTOs (API) |

## Repository layout

```text
waste-wise-web/
├── backend/      # NestJS API, schema, integrations, unit/integration tests
├── frontend/     # React admin/user SPA, shared UI, typed routes, unit/browser tests
├── docs/         # Static API reference (published with GitHub Pages)
├── CLAUDE.md     # Shared working rules
├── AGENTS.md     # Agent entry point
└── DESIGN.md     # UI conventions
```

## Related repositories

WasteWise is three independent projects that talk through the backend REST API:

| Repository | Role |
|---|---|
| [`waste-wise-web`](https://github.com/armadi04/waste-wise-web) (this repo) | Backend API (NestJS + PostgreSQL) and the admin/user website |
| [`waste-wise-apk`](https://github.com/armadi04/waste-wise-apk) | Mobile app (Expo React Native): Google sign-in, photo + GPS reports, report history |
| [`waste-wise-ml`](https://github.com/armadi04/waste-wise-ml) | Image classifier (MobileNetV2) served by FastAPI; called only by the backend |

Flow: the mobile app uploads a photo to the backend, the backend sends it to the ML service,
and the predicted category and confidence are stored with the report. Clients cannot set
those values.

## Getting started

Prerequisites: Bun 1.3.14+, a **new PostgreSQL database**, and S3 media storage credentials. Redis is optional.

```bash
# Terminal 1
cd backend
bun install --frozen-lockfile
cp .env.example .env
# Configure database, JWT, admin and S3 credentials.
bun run migration:run
bun run seed
bun run start:dev

# Terminal 2, from the repository root
cd frontend
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

The optional ML service runs separately from its own repository; set `ML_SERVICE_URL` on the
backend (default service API: `POST /api/v1/predict`). Backend: **localhost:3000**, REST base `/api/v1`. Frontend: **localhost:3001**; Vite proxies
`/api` and `/socket.io` to the backend. Leave `VITE_API_URL` empty for same-origin requests.
Swagger UI is `/api/docs` outside production; OpenAPI documents are `/api/docs/openapi.json` and `/api/docs/openapi.yaml`.
A static, read-only API reference built from `backend/swagger.json` lives in `docs/index.html` (published with GitHub Pages at https://armadi04.github.io/waste-wise-web/). Regenerate it with `bun run docs:api` in `backend` after `bun run spec:generate`.
Sign in with the admin email/password configured in the backend env.

The starter baseline is for **new databases only**, not an upgrade path for the original
application. Setup does not require a database reset. Keep `DB_SYNCHRONIZE=false`.
SMTP is optional at boot, but actual verification/invitation/reset delivery requires it.

### Common scripts

| Task | Backend (`backend/`) | Frontend (`frontend/`) |
|---|---|---|
| Dev | `bun run start:dev` | `bun run dev` |
| Build | `bun run build` | `bun run build` |
| Lint | `bun run lint` (fixes) | `bun run lint` |
| Unit tests | `bun run test` | `bun run test` |
| Seed | `bun run seed` | — |
| Migrations | `bun run migration:run` | — |
| Schema check | `bun run schema:check` | — |
| API contract | `bun run spec:generate` | `bun run api:generate` |

Destructive `migrate:fresh[:seed]` commands are for disposable development databases only.
E2E suites are opt-in; default test scripts run unit tests.

## Documentation map

| Backend guide | Read when you need to… |
|---|---|
| [Architecture](backend/docs/ARCHITECTURE.md) | Understand layers, request lifecycle, data and event boundaries |
| [Development](backend/docs/DEVELOPMENT.md) | Configure env, migrations, scripts and isolated tests |
| [Auth](backend/docs/AUTH.md) | Change sessions, providers, 2FA, verification or RBAC |
| [Adding features](backend/docs/ADDING_FEATURES.md) | Implement a CRUD resource end-to-end |
| [Operations](backend/docs/OPERATIONS.md) | Configure media providers, SMTP and deployment |
| [Database and ERD](backend/docs/DATABASE.md) | See the schema diagram, tables, relations and the DBML for dbdiagram.io |
| [GraphQL](backend/docs/GRAPHQL.md) | Enable the optional API |
| [Naming](backend/docs/NAMING_CONVENTIONS.md) | Choose filenames, identifiers and schema names |
| [Agent guide](backend/docs/AI_AGENT_GUIDE.md) | Follow implementation and verification conventions |

| Frontend guide | Read when you need to… |
|---|---|
| [Architecture](frontend/docs/ARCHITECTURE.md) | Understand routing, Query, services, stores and component ownership |
| [Development](frontend/docs/DEVELOPMENT.md) | Configure public env, generate API types and run checks |
| [Auth](frontend/docs/AUTH.md) | Change identity, login/logout, refresh or permission UI |
| [Adding features](frontend/docs/ADDING_FEATURES.md) | Add a typed, permission-gated CRUD screen |
| [Operations](frontend/docs/OPERATIONS.md) | Build the static image and configure Caddy |
| [Naming](frontend/docs/NAMING_CONVENTIONS.md) | Organize hooks, views, stores and barrels |
| [Agent guide](frontend/docs/AI_AGENT_GUIDE.md) | Follow implementation and verification conventions |

Repository-wide: [Design](DESIGN.md), [Working rules](CLAUDE.md).

## Two rules to remember

**Backend:** controllers stay thin; services own logic; guards authorize; DTOs validate;
entities define the schema; business resources use soft-delete.

**Frontend:** Zustand owns client state; Query owns server state; URL params own table state;
react-hook-form owns form fields.

## Deployment

Each package ships a multi-stage Dockerfile. Backend uses Bun; frontend builds with Bun and
serves through Caddy on container port 3000. Caddy proxies `/api`, `/socket.io` and `/graphql`
to `BACKEND_URL` before SPA fallback. No root Compose file is included; orchestrate externally.

Minimum services: PostgreSQL, backend, frontend, selected storage provider, and optionally
Redis/SMTP. Configure HTTPS, runtime backend secrets and public frontend build values through
your deployment. See both Operations guides for exact setup and initial account provisioning.

First production deploy checklist:

1. Run the backend once so migrations apply (the container entrypoint does this).
2. Seed roles, permissions and the admin account **once** from a non-production runtime pointed
   at the production database (`NODE_ENV=development bun run seed` in `backend/`); the seed refuses
   to run with `NODE_ENV=production`, and the Google sign-in 503s until the `user` role exists.
3. Backend env: `GOOGLE_CLIENT_ID` (comma-separated web/mobile client IDs), `TURNSTILE_SECRET` and
   `TURNSTILE_ALLOWED_HOSTNAMES` (hostnames only, no scheme/port/path), `APP_URL` (public frontend
   URL), `ALLOWED_ORIGINS`, `TRUST_PROXY`, and `ML_SERVICE_URL` + `ML_SERVICE_TOKEN`.
4. Keep the ML service on a private network and give it the same secret as `INTERNAL_TOKEN`.
5. Frontend build args: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_TURNSTILE_SITE_KEY`; runtime
   env `BACKEND_URL`.
