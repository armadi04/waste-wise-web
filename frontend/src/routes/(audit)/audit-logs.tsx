import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { AuditLogsPage } from '@/components/features/audit/pages/audit-logs'
import { loadAdminRoute } from '@/lib/query/loaders'
import { auditSearchSchema } from '@/lib/schemas/audit'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/(audit)/audit-logs')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => loadAdminRoute(context, '/audit-logs', deps),
  beforeLoad: requireAuth,
  validateSearch: zodValidator(auditSearchSchema),
  component: AuditLogsPage,
})
