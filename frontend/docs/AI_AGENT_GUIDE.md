# Admin AI agent guide

Read repo-wide [working rules](../../CLAUDE.md), [Architecture](ARCHITECTURE.md),
[Naming conventions](NAMING_CONVENTIONS.md) and [Auth](AUTH.md) for the relevant change.

## Rules

- Query owns server state; Zustand owns UI; URL owns table state; react-hook-form owns fields.
  No app-state Context providers, persisted auth or server lists in Zustand.
- Reuse shared query options for loaders/hooks. Keep keys, URL filters and mutation invalidation
  aligned. Permission-gate preload and primary queries; backend still authorizes every request.
- Cookies are the session source; do not decode/store JWT or make Axios read the auth store.
  Identity comes from backend `/api/auth/me`, not the readable authenticated flag alone.
- Keep routes thin; page hooks orchestrate prop bundles. Reuse `useAppMutation`, `useDataTable`,
  `useConfirmation`, `useUserPermission` and `createCrudModalStore`.
- Keep route views in feature `pages/`; organize reusable views, owned child sections,
  modal/drawer views, helpers, and skeletons by responsibility. More than 100 lines is
  a review signal, not a mandatory split. Follow [Naming conventions](NAMING_CONVENTIONS.md).
- Group shared shells/navigation in `components/layout/`, cross-feature controls in
  `components/shared/`, and runtime integrations in `components/providers/`. Keep domain
  gates, banners, dropdowns and drawers in their feature; skeletons stay with their owner.
- Keep custom hooks in `src/hooks/<domain>/`, with cross-feature hooks in `global/`.
  Keep one mounted state owner; view modules receive controlled values and callbacks.
- Use selective public barrels for external view imports. Internal and hook-to-hook
  dependencies, lazy imports, Query/services, and test mocks remain direct. Audit import
  cycles when adding or changing entry points; preserve generated module ownership.
- Use narrow Zustand selectors/useShallow; persist only theme/sidebar/background preferences.
  Feature UI stores own modal selection; forms own form values. Stores do not navigate.
- HeroUI is v2.8: use Popover/PopoverTrigger/PopoverContent, not v3 dot notation.
- Do not hand-edit routeTree.gen.ts or generated API types; regenerate from the source contract.
- Put all tests in `test/`, browser specs in `test/e2e/`. Check existing dependencies before
  introducing another. Public Vite variables must not contain secrets.

## Change recipe

1. Confirm the backend contract/types; regenerate OpenAPI types when routes/DTOs change.
2. Add typed service functions with `/api/...` paths through the shared Axios helpers.
3. Add Zod form/search schemas and query options. Preserve paginated `{ data, meta }` contracts,
   `keepPreviousData`, stable resource keys and any resource-specific staleness/polling.
4. Add permission-gated loader mapping, route guard, search validation and loaderDeps. Hooks
   must use the same query options; do not duplicate the queryFn/key in the page hook.
5. Add a feature modal store where needed, then a page hook returning table/modal prop bundles.
6. Add columns, forms and route UI using existing components. Reuse mutation invalidation,
   confirmation, permission UI and truncation conventions (`truncate: true`, `maxWidth`).
7. Synchronize sidebar/menu permissions with backend union and seeder. Definitions and the
   four-place permission checklist are in [backend Auth](../../backend/docs/AUTH.md#permission-sync).
8. Regenerate routes with Vite; add focused unit/browser behavior checks and update guides.

For a modal, register its name in createCrudModalStore and seed selection with `open`.
For socket effects, update the single SocketBridge instead of creating competing connections.

## Verification

Run `bun run lint`, `bun run test` and `bun run build`. E2E coverage is optional; run
`bun run test:e2e` or individual browser specs only when explicitly requested by the user.
Route, session, data-loader and UI changes do not trigger E2E automatically. Skipping
unrequested E2E does not block completion. Browser API fixtures are not proof of live provider
integration. [Development](DEVELOPMENT.md) explains commands and ports.
`bun run check` rewrites formatting and applies lint fixes; it is not a read-only check.

For documentation-only work, verify local links/headings and `git diff --check`.
Follow repo-wide commit/release policy; never report a failing/unrun check as passed.

Portal forms serialize create and update separately: coupon creation includes extension-derived price/stock/cover summaries, voucher/ticket creation sends `Issued`, and voucher/ticket updates send changed normalized fields. Orders remain checkout-owned.

Portal field configuration declares `createWritable` and `createDefault`; `readOnly` controls presentation and normal update serialization. Only voucher/ticket resources opt into `partialUpdate`; other resource editors preserve their full schedule, package, image and rules payloads. Nullable numeric fields preserve null.
