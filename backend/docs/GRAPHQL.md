# GraphQL API

An **opt-in** GraphQL surface that sits beside the REST API, sharing the same
service layer, guards, RBAC and soft-delete semantics. It exists so heterogeneous
clients (web SPA, native mobile, third-party integrations) can shape their own
payloads instead of the API shipping per-device REST variants.

REST stays the default. GraphQL is mounted only when `GRAPHQL_ENABLED=true`.

## Enabling it

Set in `.env` (all validated in [`config/env.ts`](../src/config/env.ts)):

| Var | Default | Purpose |
|-----|---------|---------|
| `GRAPHQL_ENABLED` | `false` | Mount the API at `/graphql`. |
| `GRAPHQL_PLAYGROUND` | `false` | Allow production introspection (controls production introspection override). |
| `GRAPHQL_MAX_COMPLEXITY` | `1000` | Reject queries above this estimated cost. |
| `GRAPHQL_MAX_DEPTH` | `10` | Reject queries nested deeper than this. |
| `GRAPHQL_PERSISTED_ONLY` | `false` | Require APQ hash requests when enabled, in any environment. |

When `GRAPHQL_ENABLED=false` GraphqlApiModule is not registered in the Nest imports list; the GraphQL endpoint is not enabled.

## Where things live

```
src/graphql/
  graphql-api.module.ts    # Apollo driver, config, wiring (env-gated in app.module.ts)
  schema/*.graphql         # SDL — the contract and source of truth
  generated/graphql.ts     # TS types generated from SDL (bun run graphql:types)
  resolvers/*.resolver.ts  # thin wrappers over the existing feature services
  dataloaders/             # per-request DataLoaders (batch relation lookups)
  plugins/                 # complexity limit, persisted-queries-only
  decorators/              # @GqlCurrentUser
  helpers/                 # paginationArgs
```

Schema-first: you write SDL, then `bun run graphql:types` regenerates
`generated/graphql.ts` so resolvers stay bound to the contract at compile time
(drift fails `bun run build`). The SDL files are copied into `dist` on build via
the nest-cli `assets` glob.

## Auth

REST and GraphQL share JwtStrategy and domain permission checks. Bearer tokens are supported
for mobile/third-party clients; the strategy also accepts backend accessToken cookies.
The browser application uses REST with HttpOnly cookies, not a decoded
JWT sent from JavaScript. Do not document a browser token extraction flow.

Bearer-only requests do not rely on ambient cookies. Cookie-authenticated GraphQL requires explicit origin/CSRF review;
REST auth middleware for refresh/logout/switch-role is not GraphQL mutation protection.
This guide does not introduce a new browser GraphQL integration.

Guards are GraphQL-aware: a shared `getRequest(context)` helper
([`common/helpers/execution-context.util.ts`](../src/common/helpers/execution-context.util.ts))
resolves the request from either transport, so `JwtAuthGuard`, `PermissionsGuard`,
`RolesGuard`, `OwnerOrPermissionGuard` and the rate-limit guard all work unchanged.
Resolvers reuse the **same `@Permissions()` strings** as the REST controllers.

## What stays REST-only

- **Media upload** (`POST /api/v1/media/upload`) — multipart; GraphQL upload is not
  worth the complexity. Media metadata (list/read/delete) is on GraphQL.
- **Invitation accept** — a public token flow (`/api/v1/invitations/accept`).
- **Login and token issuance** — the auth endpoints themselves.
- The four internal auth-token tables are never exposed on GraphQL.

## Media deletion lifecycle

Use `deleteMediaWithResult(id:) { id status code }` for durable outcomes. `queued` means
metadata is hidden and remote cleanup will retry; `deleted` and `already-deleted` mean
completion. Authorization remains ownership or `media.delete_all`/superadmin with `media.delete`.
The existing Boolean `deleteMedia` is deprecated but retained for compatibility; true means
acceptance, not necessarily completed remote removal. Upload limits, storage profiles and
recovery semantics are shared with REST; see [Operations](OPERATIONS.md#media-providers).
