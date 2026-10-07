import { createFileRoute } from '@tanstack/react-router'
import { PortalScanPage } from '@/components/features/portal/pages/portal-scan'
import { loadAdminRoute } from '@/lib/query/loaders'

export const Route = createFileRoute('/(portal)/portal/scan')({
  loader: ({ context }) => loadAdminRoute(context, '/portal/scan', undefined),
  component: PortalScanPage,
})
