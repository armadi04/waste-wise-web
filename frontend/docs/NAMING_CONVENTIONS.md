# Admin naming conventions

Application identifiers, files, folders, routes and custom API fields use English.
Keep UI/email/notification copy in the language of the existing screen or product requirement.

| Scope                    | Convention                                   | Example                                |
| ------------------------ | -------------------------------------------- | -------------------------------------- |
| Files/folders            | kebab-case                                   | `notification-dropdown.tsx`            |
| Hooks                    | `use-*.ts`; exported name starts with use    | `use-users.ts`, `useUserPage`          |
| Stores                   | `*.store.ts`; feature UI uses `-ui.store.ts` | `users-ui.store.ts`, `useUsersUiStore` |
| Services                 | `*.service.ts`                               | `user.service.ts`, `getUsers`          |
| Variables/functions/JSON | camelCase                                    | `queryClient`, `lastPage`              |
| Components/classes/types | PascalCase                                   | `UserFormModal`, `CurrentUser`         |
| Constants                | UPPER_SNAKE_CASE                             | `MENU_PERMISSIONS`                     |
| Arrays                   | `Array<T>`                                   | `Array<UserProfile>`                   |
| Query keys               | Stable resource prefix and filter object     | `['users', { page, search }]`          |

Match existing Prettier/ESLint style: two spaces, single quotes, no semicolons, trailing
commas and import ordering. Use `@/` for src imports. TanStack `(group)` and `$resource`
route filenames follow framework syntax. Do not rename API fields or database identifiers
as a formatting change. OAuth fields retain protocol spelling (`access_token`, etc.).

## Feature organization

Keep feature UI in `src/components/features/<domain>/`. Use `pages/<page>/` for route
views, `components/<component>/` for reusable feature views, `modal/<modal>/` and
`drawer/<drawer>/` for actual overlays, `skeletons/` for loading views, and `lib/` for
feature-specific helpers and models. Create folders only when they contain modules.

Parts owned by one page or component belong in its `child/` folder. Keep shared props
and types in an owner-specific `types.ts`; pure helpers belong in the owner's `lib/`.
Avoid nested generic `child/child/` folders. Shared components are grouped by responsibility:

- `layout/` owns application shells, navigation, page headers, command palette, and route
  pending views. Use `app-layout/` for the application shell and `router-pending/` for
  route transition views.
- `shared/` owns reusable controls such as datatable, action menu, and confirmation dialog.
- `providers/` owns runtime integrations such as SocketBridge. This grouping does not
  introduce app-state Context providers or change state ownership.
- `ui/` and `atoms/` retain their existing UI responsibilities.

Domain-specific gates, banners, dropdowns, and drawers belong to their feature, even when
mounted by the shared layout. Keep skeletons with their owner: table skeletons under
datatable, statistic card skeletons under dashboard, and page header skeletons under
page header. Group related modules under the owner's named folder.

More than 100 lines is a review signal, not a hard limit. Split mixed responsibilities,
independent views, and reusable sections. Keep cohesive forms and state lifecycles together.
Routes own TanStack configuration, guards, validated search, and loaders; feature pages
render the route view. Pages use `getRouteApi` rather than importing the route module.
Shared page/search configuration belongs in a pure module, not in an imported route.

## Hook organization

Keep custom hooks in `src/hooks/<domain>/`.
Domains are `auth`, `profile`, `users`, `invitations`, `roles`, `permissions`, `oauth-clients`,
`media`, `notifications`, `sessions`, `audit`, and `dashboard`, plus `global/` helpers.
Use `global/` for cross-feature mutation, table, export, confirmation, navigation,
appearance, PWA, and utility hooks. Do not embed custom hook declarations in view modules.

Page hooks orchestrate queries, mutations, permissions, and UI state, returning controlled
prop bundles. Keep one mounted state owner and pass values/callbacks into child views.
Zustand store definitions and store selectors remain in `src/lib/stores/`; services,
shared Query contracts, and form/search schemas keep their existing responsibilities.

## Barrel exports

Expose cohesive public folders through selective `index.ts` entry points. External view
consumers use the nearest public entry point, including hook domains, named page/component
folders, and feature skeleton groups. Group multiple child views behind a child barrel
when consumed together; keep single-child imports direct.

- Export only symbols needed by external consumers, using named exports and `export type`.
  Avoid `export *`, default wrappers, and root/feature-wide component or hook aggregation.
- Internal modules import siblings directly. Never import a folder's own barrel internally.
- Hook-to-hook dependencies use implementation modules, including across domains, to avoid
  cycles through eagerly evaluated hook barrels. Hooks consuming feature column factories
  or form extensions also use direct implementation imports.
- Keep lazy/dynamic imports, shared Query options, services, generated modules, and test
  mock targets direct. Mocks target implementation modules rather than a domain barrel.
- Keep `usePwaUpdate` outside the global barrel: its virtual module requires the Vite PWA
  plugin and must not be eagerly loaded by unrelated views or unit tests.
- Preserve the established stores barrel documented in Architecture. State ownership does
  not change when a module moves.
