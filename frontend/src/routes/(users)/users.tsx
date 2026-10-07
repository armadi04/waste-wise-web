import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { UsersPage } from '@/components/features/users/pages/users'
import { loadAdminRoute } from '@/lib/query/loaders'
import { userSearchSchema } from '@/lib/schemas/users'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/(users)/users')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => loadAdminRoute(context, '/users', deps),
  beforeLoad: requireAuth,
  validateSearch: zodValidator(userSearchSchema),
  component: UsersPage,
})
