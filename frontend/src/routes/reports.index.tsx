import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { ReportsPage } from '@/components/features/reports/pages/reports'
import { loadAdminRoute } from '@/lib/query/loaders'
import { reportSearchSchema } from '@/lib/schemas/reports'
import { requirePermission } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/reports/')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => loadAdminRoute(context, '/reports', deps),
  beforeLoad: requirePermission('reports.read.all', 'reports.read.own'),
  validateSearch: zodValidator(reportSearchSchema),
  component: ReportsPage,
})
