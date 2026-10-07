# Adding a frontend feature

Start with the working Roles screen, its hooks, service, schemas and UI store. Backend owns
the contract and permissions; UI gates only presentation and preloading.

## 1. Contract and services

After backend `spec:generate`, run `bun run api:generate`. Keep hand-authored domain views
aligned with the generated response; list pagination is `{ data, meta: { total, page, lastPage } }`.

Create typed HTTP methods in `src/lib/services/project.service.ts` through shared helpers:

```ts
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'
import type { PaginatedData } from '@/types/api'

export type Project = { id: number; name: string; createdAt: string }
export type ProjectInput = { name: string }
export const getProjects = (params: Record<string, unknown>) =>
  apiGet<PaginatedData<Project>>('/api/projects', { params })
export const createProject = (data: ProjectInput) =>
  apiPost<Project>('/api/projects', data)
export const updateProject = (id: number, data: Partial<ProjectInput>) =>
  apiPatch<Project>(`/api/projects/${id}`, data)
export const deleteProject = (id: number) =>
  apiDelete<void>(`/api/projects/${id}`)
```

## 2. Shared Query and URL state

Add Zod form/search schemas under `lib/schemas/` using the Roles schema as a template.
Add query options to `lib/query/options.ts`: stable `['projects', normalizedSearch]` key,
typed service function and `keepPreviousData`. Add a permission-gated `/projects` branch to
`loadAdminRoute` using those same options. Query owns the fetched list; never store it in Zustand.

Create a thin TanStack route with `validateSearch`, `loaderDeps`, `requireAuth`, permission
guard and `loadAdminRoute`. Page/search/sort/limit remain URL state through `useDataTable`.
Vite generates routeTree; do not hand-edit it.

## 3. Modal state and page hook

`lib/stores/projects-ui.store.ts`:

```ts
import { createCrudModalStore } from '@/lib/stores/create-crud-modal-store'
import type { Project } from '@/lib/services/project.service'
export const useProjectsUiStore = createCrudModalStore<Project>(['form'])
```

Use narrow selectors. Stores own modal selection, not form fields or navigation.
Create hooks under `hooks/projects/`; the page hook combines shared queries, `useAppMutation`,
`useUserPermission`, `useConfirmation` and table/modal props. Mutations invalidate `projects`
and applicable dependent keys; failed mutations retain form drafts.

## 4. Views and permissions

Create owner-organized columns, form modal, page and skeleton under
`components/features/projects/`. Reuse shared DataTable, page header, confirmation and inputs.
Forms use react-hook-form/Zod. Feature pages read route state with `getRouteApi`, not route imports.

Gate create/edit/delete buttons with their backend permission. Synchronize `MENU_PERMISSIONS`
and `sidebarData` with backend PermissionType/seeder. Permission-gate queries and route loaders;
backend still authorizes each request. Follow [backend permission sync](../../backend/docs/AUTH.md#permission-sync).

## 5. Verification

Run lint, unit tests and build; build regenerates typed routes. Focus tests on permission-gated
preloading, URL filter preservation, mutation invalidation and meaningful form behavior.
Browser E2E is opt-in. Check mobile overflow, keyboard focus, loading/empty/error states and
light/dark modes after UI changes. Feature organization: [Naming](NAMING_CONVENTIONS.md).
