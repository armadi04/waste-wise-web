# Backend architecture

## Boundaries

NestJS 12 runs on Bun with PostgreSQL/TypeORM, Express, structured Pino logging, JWT/cookie
sessions, RBAC, EventEmitter2, Socket.IO, optional Redis and schema-first optional GraphQL.
The portal Start server and admin SPA share this backend; frontend framework choice does not
change business logic, authorization or database ownership.

Controllers handle HTTP. Services own business logic; generic CRUD services extend
`BaseService<T>`. Guards authorize, DTOs validate/transform, entities define persistence.
Business resources are soft-deleted. Listeners own notification side effects; feature services
must not call NotificationsGateway directly. Existing auth/invitation mail flows use MailService.

## Bootstrap and request lifecycle

`src/main.ts` validates env before Nest initialization, installs Pino/global exception filter,
class-validator DI, cookie parser, CORS, `/api` prefix and a transforming/whitelisting
ValidationPipe. Swagger `/api/docs` is enabled only outside production.
Portal runtime values use `src/config/portal-runtime.config.ts`; resolver reads the environment
when called to preserve existing runtime overrides and defaults.
Middleware runs before guards; authorization precedes DTO pipes/controller/service execution.
Global ThrottlerGuard and per-route guards protect reads/writes. Decorator metadata alone does
not authorize a route: pair `@Permissions` with a permission-reading guard.

Success payloads are not globally wrapped. AllExceptionsFilter preserves known HTTP status/body
and adds a stable English status-based code; unknown errors are logged and masked as 500.
GraphQL errors are handled through Apollo. Frontend maps codes to UI copy, not business rules
based on prose messages. Tighten route rate limits using existing @Throttle conventions;
health probes skip throttling.

`app.module.ts` registers infrastructure and feature modules. Entities are discovered by the
`*.entity{.ts,.js}` glob; feature modules use TypeOrmModule.forFeature for injection.
DB_SYNCHRONIZE defaults false in every environment. Pending migrations run when synchronize
is false, unless the explicit DB_SKIP_MIGRATIONS switch is set. Development is migration-first;
production must never synchronize schema. Seed boot is non-production and gated by DB_SEED.

## Code map

| Location | Responsibility |
|---|---|
| `src/auth/`, `src/sso/`, `src/oauth/`, `src/sessions/` | Identity, providers, RBAC, machine clients, device sessions |
| `src/users/`, `src/roles/`, `src/permissions/`, `src/invitations/` | Administrative domain |
| `src/portal/` | Catalog, OTP/Google portal auth, owned resources, checkout and admin portal management |
| `src/media/`, `src/mail/`, `src/notifications/` | External storage, SMTP outbox and notification delivery |
| `src/audit/`, `src/stats/`, `src/health/` | Append-only audit, dashboard queries and health |
| `src/common/` | BaseService, pagination, cache, filters, validation and transport helpers |
| `src/config/` | Env validation and Swagger setup |
| `src/database/` | CLI DataSource, immutable migrations and permission/admin seeder |
| `src/graphql/` | SDL, resolvers, generated types, per-request DataLoaders and plugins |
| `src/scripts/` | Standalone migration/schema/seed/spec CLI tasks |
| `test/unit/`, `test/*.e2e.spec.ts` | Unit behavior and integration suites with shared test/utils helpers |

## Persistence and DTO contracts

Entities use explicit plural snake_case table names, camelCase physical columns and indexes
for actual lookups. Set explicit database types for nullable union fields; reflected Object
metadata can fail only in compiled builds otherwise. Preserve timestamps, soft-delete columns,
relation/junction names and immutable migration history. Raw SQL must quote camelCase names;
QueryBuilder uses entity property paths. Do not remove junction indexes without EXPLAIN/usage
and foreign-key workload evidence. Never serialize passwords/token hashes; use @Exclude and
review response projections/Swagger fields.

BaseService takes a repository, entity label and search columns. Reuse rather than reimplement:

| Method | Contract |
|---|---|
| `findAll`, `findOne` | List/detail; findOne throws NotFoundException on missing rows |
| `findAllPaginated` | ILIKE search, sort and relations; `{ data, meta: { total, page, lastPage } }` |
| `create`, `update` | Repository write, DB error mapping and generic system events |
| `remove`, `removeMany` | Soft-delete semantics and generic system events |
| `handleDbError` | Unique violation maps to ConflictException; other DB errors propagate |

Override only for domain logic or relation loading, following RolesService/UsersService.
PaginationParamsDto controls page/limit/search/sort/direction/paginated; numeric/boolean
coercion belongs in DTOs. Controllers retain the paginated/unpaginated branch and typed Swagger
responses. DTOs follow BaseXDto, CreateXDto with @IsUnique when needed, and PartialType update.
`@IsUnique` needs Nest validator DI; DB constraints still handle concurrency races (409).

## Events and integrations

BaseService emits `system.create`, `system.update`, `system.delete`; feature services emit
`user.created`, `user.invited`, `user.deleted`, `user.roles_updated`, `user.notification` and
`audit.record` as appropriate. Preserve payloads already consumed by listeners. Notifications
are persisted before delivery; pass actorId where the actor should not receive their own event.
NotificationsListener uses notifyAdmins/notifyUser/notifyByRoles. Socket.IO namespace
`notifications` authenticates cookie or explicit token/header and joins user/role rooms.
Clients consume `new_notification`; `app_refresh` signals application refresh. Do not assume
socket validation or role-room membership is identical to per-request JwtStrategy RBAC.

- MediaService delegates storage to DepotClient; local Media rows retain ownership/RBAC and
  depotFileId. Public view redirects and authenticated stream routes use signed URLs. Deletion
  soft-deletes local metadata with best-effort remote deletion. PortalAvatarService normalizes and
  transactionally replaces customer photos using MediaService durable staging.
  AvatarCleanupService claims only marked portal avatars using database leases and checks
  account references before remote deletion; failures remain queued across restarts.
  Google photo imports use a dedicated PostgreSQL queue, a session advisory lock for bounded
  worker concurrency, expiring leases and five attempts. Login only enqueues. User/avatar
  linking is transactional; external I/O happens outside transactions. Successful linking
  clears users and portal admin caches; retries repair invalidation without replacing photos.
  Apply AddPortalAvatarImports and the media cleanup migration before deployment.
- MailService renders emails and enqueues into outbound_emails. MailOutboxService claims due rows
  with SKIP LOCKED/leases every 30 seconds and retries failures with bounded backoff. No SMTP
  configuration means no successful delivery. Auth/invitation flows already call MailService;
  do not create competing SMTP senders.
- Redis is optional; connection failure falls back to local memory. CacheInterceptor handles
  selected reads; writes clear matching keys with CacheService.clearKeys. Shared cache ownership
  matters for authenticated data and multi-instance deployment. The cache key is the URL
  alone, so only cache reads whose response is the same for every caller who passes the
  guards. Never cache reads filtered by the caller or checked for ownership in the handler,
  as `/media` and `/media/:id` are.
- SSO protocol belongs to PassportClient/SsoService; GraphQL resolvers reuse REST domain services
  and permission names. DataLoaders are created per request, never shared across users.

## Generated artifacts and CLI

Use `@/` imports. `bun run build` performs Nest compilation and tsc-alias rewriting; a raw Nest
build followed by Bun dist execution cannot safely resolve src aliases. CLI scripts use
runScript for env validation, disabled seed, closure and exit codes; Swagger generation creates
an HTTP app for route introspection. Regenerate swagger.json/GraphQL typings from contracts.

Feature recipe: [AI agent guide](AI_AGENT_GUIDE.md#change-recipe).

### Portal service boundaries

`PortalService` preserves the public contract used by portal controllers, admin refunds,
and payment expiry. It delegates directly to injected domain services registered once in
`PortalModule`. The portal root contains only the module, controller, and facade.

Each domain owns its services, DTOs, entities, and domain helpers:

- `auth/`: portal authentication and email OTP.
- `catalog/`: coupon/event/bundle reads, categories, locations, FAQ, and public content.
- `campaigns/`: campaign catalog, rules, progress, reconciliation, ledger, and referrals.
- `commerce/`: purchase limits, checkout, payments, cancellation, refunds, order history,
  wallet mutations, and outbox delivery.
- `customer/`: profile, avatars, following, saved offers, notifications, and wallet summary.
- `reviews/`: eligibility, review writes, and review summaries. Catalog injects this service
  for review summaries.
- `gifts/`: creation, listing, public lookup, and redemption.
- `bookings/`: customer booking slots and bookings.
- `passes/`: free coupon claims, voucher/ticket views, QR validation, and voucher serialization.
- `time-zone/`: time-zone routes and conversion.
- `seed/`: portal seeding and seed datasets.
- `admin/`: administration controllers, DTOs, and services.
- `shared/`: pure pagination and date-label helpers.

Services inject only their own repositories and collaborators. Shared serializers are pure
functions; there is no shared repository base or facade execution context. Import directly
from the owning domain with `@/` paths. Keep transaction managers, lock ordering, and outbox
writes within the commerce transaction. Moving an entity does not change its table or discovery
pattern; retain `.entity.ts` names. Keep controller routes and DTO contracts stable during
structural refactoring.
Contracts: [Auth](AUTH.md), [Portal API](PORTAL_API.md), [GraphQL](GRAPHQL.md).
Operations and migrations: [Operations](OPERATIONS.md).


## Commerce concurrency and cache invalidation

Inventory edits lock current rows and preserve consumed stock by applying total/capacity
differences. Admin booking transitions and deletion move slot seats within the same
transaction. Gift revocation locks coupon before package, matching checkout lock order.
Wallet initialization inserts with conflict-ignore, then locks the user's wallet before
financial changes; refund reverses full cashback and may leave a negative balance.

Commerce outbox delivery records per-event failures and dead-letters after five unsuccessful
attempts (`attempts`, `lastError`, `failedAt`), while continuing later events. Apply migration
`1791221000000-AddCommerceOutboxDeadLetter` before this worker version. Durable event receipts
remain necessary because delivery can repeat after a transaction or worker failure.

`CacheInvalidationListener` clears users on account creation and role assignment events.
Role/permission controllers clear users and roles; `ClearCacheOnWrite` clears admin portal
read caches after successful customer mutations, preserving cached reads on GET/HEAD.
Partial live unique indexes introduced by `1791220000000-PartialUniqueIndexesForSoftDelete`
allow soft-deleted business keys to be reused, with case-insensitive account email uniqueness.
