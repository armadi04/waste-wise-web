import { createFileRoute } from '@tanstack/react-router'
import { ChangelogPage } from '@/components/features/changelog/pages/changelog'
import { loadAdminRoute } from '@/lib/query/loaders'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/changelog')({
  loader: ({ context }) => loadAdminRoute(context, '/changelog', undefined),
  beforeLoad: requireAuth,
  component: ChangelogPage,
})
