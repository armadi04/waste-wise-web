import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { SessionsPage } from '@/components/features/sessions/pages/sessions'
import { loadAdminRoute } from '@/lib/query/loaders'
import { sessionSearchSchema } from '@/lib/schemas/sessions'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/(sessions)/sessions')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => loadAdminRoute(context, '/sessions', deps),
  beforeLoad: requireAuth,
  validateSearch: zodValidator(sessionSearchSchema),
  component: SessionsPage,
})
