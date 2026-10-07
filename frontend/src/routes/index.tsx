import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '@/components/features/dashboard/pages/dashboard'
import { loadAdminRoute } from '@/lib/query/loaders'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/')({
  loader: ({ context }) => loadAdminRoute(context, '/', undefined),
  beforeLoad: requireAuth,
  component: Dashboard,
})
