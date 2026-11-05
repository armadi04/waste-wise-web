# Frontend development

## Setup

Use Bun 1.3.14+. Start backend at localhost:3000, then from `frontend/`:

```bash
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

Vite uses `http://localhost:3001` (strict port) and proxies `/api` (including Swagger `/api/docs`, its assets and OpenAPI documents)
plus `/socket.io` to the
backend. Leave `VITE_API_URL` empty. Preserve existing env files.

## Public build configuration

| Variable                | Purpose                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| VITE_API_URL            | Empty for same-origin API/socket; optional absolute backend origin, without `/api` or `/api/v1` |
| VITE_GOOGLE_CLIENT_ID   | Public Google client ID; optional Google button                                                 |
| VITE_TURNSTILE_SITE_KEY | Public CAPTCHA site key                                                                         |

All VITE values ship to browsers; secrets stay backend-side. Rebuild after changing them.
Cross-origin access requires cookie credentials and exact backend `ALLOWED_ORIGINS`.
`BACKEND_URL` is Caddy runtime configuration, not a browser build variable.

## Commands and tests

Required: `bun run lint`, `bun run test`, `bun run build`.
`check` applies Prettier and ESLint fixes; `build` runs Vite then TypeScript.
Vitest discovers unit tests under `test/`, excluding `test/e2e/`.

Browser E2E is optional, only run when explicitly requested: `bun run test:e2e`.
Playwright uses mocked browser API responses and its own Vite port; it does not prove live
Google/SMTP/storage integration. Local execution can use
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` (default `/usr/bin/google-chrome`).

## Generated contracts

Backend `bun run spec:generate` produces `swagger.json`, then:

```bash
bun run api:generate
```

This generates `src/types/api.generated.ts`; never hand-edit it. Vite generates the route
tree. Fix sources/contracts rather than editing generated modules. Pagination uses `lastPage`.

## Media deletion outcomes

Media DELETE returns `deleted`, `queued` or `already-deleted`. Bulk deletion includes per-item
results and `deleted/queued/failed` counts. The mutation hook refreshes media, users, profile
and stats queries on settlement, including transport failures with ambiguous server outcomes.
UI distinguishes completed deletion from queued remote cleanup and retains only failed IDs
still visible on the current page. Do not show unconditional success for partial results.

## Timezone preferences

Backend and database use UTC. Display preference uses account/device timezone through
`/api/v1/time-zone/preferences`; configuration and explicit-zone preview are under the same
prefix. Report zones currently support Jakarta, Makassar and Jayapura. Date-only values
remain calendar dates. Preserve explicit offsets on absolute timestamp inputs.

## Turnstile deployment

Production builds reject official dummy site keys. Configure real keys and matching backend
secret/allowed hostnames for deployment. Development keys belong in `.env.development.local`;
leave the shared `.env` key unset because Bun-forwarded values override mode-specific files.
Password widgets use action `admin-login`. Challenge expiration/failure clears the token;
API failure resets the widget. See [Auth](AUTH.md) for the lifecycle and provider policy.

`VITE_API_URL` is validated in Vite and the client. Empty preserves same-origin REST
requests; configured values must be HTTP(S) origins without credentials, non-root
paths, queries or fragments. A root trailing slash is normalized. REST services
use paths such as `/users`; `src/lib/config/api-url.ts` supplies `/api/v1` once.
