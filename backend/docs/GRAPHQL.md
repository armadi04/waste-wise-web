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

Machine clients use the OAuth2 client-credentials grant below. Bearer-only requests do not
rely on ambient cookies. Cookie-authenticated GraphQL requires explicit origin/CSRF review;
REST auth middleware for refresh/logout/switch-role is not GraphQL mutation protection.
This guide does not introduce a new browser GraphQL integration.

Guards are GraphQL-aware: a shared `getRequest(context)` helper
([`common/helpers/execution-context.util.ts`](../src/common/helpers/execution-context.util.ts))
resolves the request from either transport, so `JwtAuthGuard`, `PermissionsGuard`,
`RolesGuard`, `OwnerOrPermissionGuard` and the rate-limit guard all work unchanged.
Resolvers reuse the **same `@Permissions()` strings** as the REST controllers.

## OAuth2 client-credentials (third-party)

For machine clients with no user. See [`AUTH.md`](./AUTH.md) for the wider auth
model; the flow:

1. An admin (holding `oauth.clients.create`) registers a client:
   `POST /api/oauth/clients { "name": "...", "scopes": ["users.read", ...] }`.
   The response contains the `clientSecret` **once** — it is stored only as a
   bcrypt hash and never returned again.
2. The client exchanges its credentials for a token:
   `POST /api/oauth/token { "grant_type": "client_credentials", "client_id": "...", "client_secret": "..." }`
   → `{ access_token, token_type, expires_in, scope }`. Requested `scope` (space
   -delimited) must be a subset of the client's grant; omit it to get all of them.
3. The client calls `/graphql` (or REST) with the token as a Bearer header.

A client token's scopes become its `permissions`, so `@Permissions()` guards
enforce them uniformly. Disabling or deleting a client (`isActive=false` /
soft-delete) revokes its outstanding tokens immediately — the JWT strategy
re-checks the client on every request.

## Hardening

- **Complexity** — every field costs 1; queries above `GRAPHQL_MAX_COMPLEXITY`
  are rejected before execution (`plugins/complexity.plugin.ts`).
- **Depth** — queries deeper than `GRAPHQL_MAX_DEPTH` are rejected.
- **Persisted queries** — with `GRAPHQL_PERSISTED_ONLY`, only Automatic Persisted
  Query (hash-based) requests are accepted; ad-hoc query text is rejected.
- **Introspection** — off in production unless `GRAPHQL_PLAYGROUND=true`.
- **Errors** — `AllExceptionsFilter` hands errors to Apollo; `HttpException`s pass
  through, anything else is masked. Stack traces are never sent in production.

## Adding a resolver for a new entity

1. Add `schema/<entity>.graphql`: the type, an `<Entity>Connection { data, meta }`
   for lists, and `extend type Query` / `extend type Mutation`.
2. `bun run graphql:types` to regenerate typings.
3. Add `resolvers/<entity>.resolver.ts` — inject the existing service, reuse the
   same `@Permissions()` strings as its REST controller, and return
   `service.findAllPaginated(...paginationArgs(pagination))` for lists.
4. For relations, add a `@ResolveField` that returns the eager-loaded value or
   falls back to a DataLoader: `parent.rel ?? ctx.loaders.<loader>.load(parent.id)`.
   Register new loaders in `dataloaders/dataloader.service.ts`.
5. Register the resolver (and the feature module) in `graphql-api.module.ts`.
6. `bun run build` and `bun run test`.

## What stays REST-only

- **Media upload** (`POST /api/media/upload`) — multipart; GraphQL upload is not
  worth the complexity. Media metadata (list/read/delete) is on GraphQL.
- **Invitation accept** — a public token flow (`/api/invitations/accept`).
- **Login / OAuth token issuance** — the token endpoints themselves.
- The four internal auth-token tables are never exposed on GraphQL.

## Media deletion lifecycle

Use `deleteMediaWithResult(id:) { id status code }` for durable outcomes. `queued` means
metadata is hidden and remote cleanup will retry; `deleted` and `already-deleted` mean
completion. Authorization remains ownership or `media.delete_all`/superadmin with `media.delete`.
The existing Boolean `deleteMedia` is deprecated but retained for compatibility; true means
acceptance, not necessarily completed remote removal. Upload limits, storage profiles and
recovery semantics are shared with REST; see [Operations](OPERATIONS.md#media-providers).
