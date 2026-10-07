import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { PermissionsPage } from '@/components/features/permissions/pages/permissions'
import { loadAdminRoute } from '@/lib/query/loaders'
import { permissionSearchSchema } from '@/lib/schemas/permissions'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/(databases)/(permissions)/permissions')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => loadAdminRoute(context, '/permissions', deps),
  beforeLoad: requireAuth,
  validateSearch: zodValidator(permissionSearchSchema),
  component: PermissionsPage,
})
