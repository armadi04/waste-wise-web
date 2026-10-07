import { createFileRoute } from '@tanstack/react-router'
import { PortalDashboardPage } from '@/components/features/portal/pages/portal-dashboard'
import { loadAdminRoute } from '@/lib/query/loaders'

export const Route = createFileRoute('/(portal)/portal/')({
  loader: ({ context }) => loadAdminRoute(context, '/portal', undefined),
  component: PortalDashboardPage,
})
