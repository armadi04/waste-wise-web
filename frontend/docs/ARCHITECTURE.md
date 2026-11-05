# Admin architecture

## Runtime and boundaries

Admin is a React 19 SPA built with Vite/TanStack Router, TanStack Query, HeroUI 2.8,
Tailwind 4 and Zustand. It remains CSR and uses the NestJS backend. Backend owns sessions, RBAC, business
rules and persistence. Frontend permissions control presentation and preload, not authority.

## Data flow

Route validates URL search params and obtains session identity through `requireAuth`.
The loader calls permission-gated `loadAdminRoute`; it uses shared query options from
`src/lib/query/options.ts`. Hooks consume the same options and reuse fresh cache entries.
Default Query stale time is 30 seconds, with resource-specific overrides. Changing a filter
changes loaderDeps and the query key. Preserve mutation invalidation keys.

Services in `src/lib/services/` make typed calls through `src/lib/api.ts`. Axios sends cookies
with credentials and adds CSRF to unsafe methods. Concurrent 401s share refresh handling;
a rejected refresh lets the session guard redirect, while other requests use a full-page
login redirect. Network/server failures propagate to the root route error boundary for retry
without discarding the session. Auth transitions clear Query cache. Details: [Auth](AUTH.md).

A page hook combines server queries, mutations, permissions, confirmation and modal UI state,
then returns prop bundles such as `tableProps` and `modalProps`. Routes/components render
those bundles. Mutations use `useAppMutation` with relevant invalidation and success messages.

## State ownership

| State                                                     | Owner                                                  |
| --------------------------------------------------------- | ------------------------------------------------------ |
| Server lists/details, session query, profile, counts      | TanStack Query                                         |
| Table page/limit/search/sort, notification page           | Validated URL search params; `useDataTable` for tables |
| Form fields/errors                                        | react-hook-form with Zod                               |
| Theme, sidebar, background, confirmation, modal selection | Zustand                                                |
| Auth presentation                                         | Non-persisted auth store reflecting backend identity   |
| Notification dropdown page                                | Local state; independent from the notifications route  |

Never mirror fetched business data into persisted Zustand stores or reintroduce app-state
Context providers. Third-party providers (Query, HeroUI, Google) are intentional.
Use narrow selectors and `useShallow` for multiple selected fields. Persist only preferences.

`createCrudModalStore` owns modal open/entity/read-only and selection search/selected state.
Use `open`, `close`, `onOpenChange`, `setSearch`, `setSelected` and `toggleSelected` instead of
reset-on-open effects. Form values stay in react-hook-form. `ConfirmationRoot` renders one
promise-based confirmation dialog. Theme/background subscriptions apply appearance changes.
`SocketBridge` owns connect/disconnect effects; the socket store contains connection state.
It uses backend cookies, reacts to notifications and invalidates Query state.

## Bootstrap and code map

`src/main.tsx` creates/binds QueryClient and mounts optional GoogleOAuthProvider,
QueryProvider, HeroUIProvider, ConfirmationRoot and RouterProvider. Root route mounts
SocketBridge and separates auth pages from app layout/EmailVerificationGate.

| Location                    | Responsibility                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/routes/`               | Typed routes, validated search, session guards and loaders                                      |
| `src/lib/query/`            | Shared query options, loader mapping, auth cache binding                                        |
| `src/hooks/<domain>/`       | Domain queries, mutations and page orchestration; cross-feature hooks in `global/`              |
| `src/lib/services/`         | HTTP resource functions; no React logic                                                         |
| `src/lib/schemas/`          | Form and route validation                                                                       |
| `src/lib/stores/`           | Global and feature UI stores; barrel exports in index.ts                                        |
| `src/components/features/`  | Domain pages, reusable components, owned child views, modal/drawer views, helpers and skeletons |
| `src/components/layout/`    | Application shells, navigation, page headers, command palette and route pending views           |
| `src/components/shared/`    | Cross-feature controls, including datatable, action menu and confirmation dialog                |
| `src/components/providers/` | Runtime integrations, including the single SocketBridge; no app-state Context providers         |
| `src/types/`                | API/domain types, including generated OpenAPI types                                             |
| `test/`                     | Vitest unit tests and `test/e2e/` browser specs                                                 |

Route groups include auth, users, media, content, databases, audit and sessions.
`/profile?section=` owns profile/security/sessions/appearance/preferences; there is no separate
settings route. `src/routeTree.gen.ts` is Vite-generated and must not be manually edited.
The PWA production worker excludes API/socket navigation fallback; dev workers are disabled.

Feature pages consume route state through `getRouteApi`; they do not import route modules.
Domain-specific verification/role gates, impersonation banner, notification dropdown, and
profile drawer stay in their feature folders even when mounted by shared layout. Skeletons
stay with the component or feature they represent.
Selective public barrels expose cohesive view folders and hook domains. Internal and
hook-to-hook imports remain direct to preserve dependency boundaries. Folder conventions
are defined in [Naming conventions](NAMING_CONVENTIONS.md#feature-organization).

Feature implementation recipe: [AI agent guide](AI_AGENT_GUIDE.md#change-recipe).

## Users filters and export

The Users toolbar provides creation-window and registration-method dropdowns. `createdIn`
and `registerMethod` live in validated URL search state and participate in the shared query
key used by the loader and page hook. Changing a filter resets page to 1 and preserves other
search/sort/limit values. Selecting All removes that filter.

The Register Method column uses labeled badges for Email & OTP, Google, Undangan,
Seeder, and Tidak diketahui. It describes account creation, not the latest sign-in.
Users export fetches all matching rows with the active search, filters, and sorting, and
exports the registration-method label. No additional permission or menu is required.

## UI theme and shared controls

[DESIGN.md](../../DESIGN.md) owns the exact light/dark palette and interaction pairs.
Application tokens live in `src/styles/tokens.css`; `src/hero.ts` maps HeroUI roles and
complete shade ramps. Use `components/shared/controls` for buttons, inputs, selection
controls, chips, menus and overlays. These HeroUI variants retain native props and focus
management while `styles/controls.css` maps operational slots and states to explicit tokens.
Use `components/shared/controls/toast` for status toasts. Soft statuses use their background,
foreground and border together; solid status buttons use the separate solid token family.
Do not add opacity reductions or page-specific colors to these controls.
Modal and Drawer default to the same blurred backdrop (12 px blur with a 30% surface
tint and 150% saturation), matching Users and Invitations. Keep this shared default across forms and pages;
feature overlays may adjust stacking order without changing backdrop appearance.

The document receives exactly one `light` or `dark` class before first paint. Persisted
`theme-store` preferences take precedence over the legacy `theme` key and system preference.
The theme store maintains root classes, color scheme and browser chrome on changes. Plus
Jakarta Sans (400/500/600) is the application font; reduced motion disables appearance reveals.
DataTable accepts optional column `align` values (`start`, `center`, `end`); use `end` for
monetary amounts. Table numbers and dates use tabular numerals.
