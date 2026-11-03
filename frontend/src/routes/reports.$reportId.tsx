import { createFileRoute, notFound } from '@tanstack/react-router'
import { ReportDetailPage } from '@/components/features/reports/pages/report-detail'
import { loadReportRoute } from '@/lib/query/loaders'
import { requirePermission } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/reports/$reportId')({
  loader: ({ context, params }) => {
    const reportId = Number(params.reportId)
    if (!Number.isInteger(reportId) || reportId < 1) throw notFound()
    return loadReportRoute(context, reportId)
  },
  beforeLoad: requirePermission('reports.read.all', 'reports.read.own'),
  component: ReportDetailPage,
})
