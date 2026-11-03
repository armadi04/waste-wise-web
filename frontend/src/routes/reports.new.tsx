import { createFileRoute } from '@tanstack/react-router'
import { ReportCreatePage } from '@/components/features/reports/pages/report-create'
import { loadAdminRoute } from '@/lib/query/loaders'
import { requirePermission } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/reports/new')({
  loader: ({ context }) => loadAdminRoute(context, '/reports/new'),
  beforeLoad: requirePermission('reports.create'),
  component: ReportCreatePage,
})
