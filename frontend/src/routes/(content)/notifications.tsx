import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { NotificationsPage } from '@/components/features/notifications/pages/notifications'
import { loadAdminRoute } from '@/lib/query/loaders'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/(content)/notifications')({
  loader: ({ context, deps }) =>
    loadAdminRoute(context, '/notifications', deps),
  validateSearch: zodValidator(
    z.object({
      page: z.coerce.number().int().positive().catch(1),
      limit: z.coerce.number().int().min(1).max(100).catch(10),
    }),
  ),
  loaderDeps: ({ search }) => search,
  beforeLoad: requireAuth,
  component: NotificationsPage,
})
