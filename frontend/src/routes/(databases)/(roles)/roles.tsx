import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { RolesPage } from '@/components/features/roles/pages/roles'
import { loadAdminRoute } from '@/lib/query/loaders'
import { roleSearchSchema } from '@/lib/schemas/roles'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/(databases)/(roles)/roles')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => loadAdminRoute(context, '/roles', deps),
  beforeLoad: requireAuth,
  validateSearch: zodValidator(roleSearchSchema),
  component: RolesPage,
})
