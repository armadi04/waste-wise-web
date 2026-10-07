import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { ProfilePage } from '@/components/features/profile/pages/profile'
import { loadAdminRoute } from '@/lib/query/loaders'
import { requireAuth } from '@/lib/utils/route-guard'

const searchSchema = z.object({
  section: z.enum(['profile', 'security', 'sessions', 'settings']).optional(),
})

export const Route = createFileRoute('/profile')({
  loaderDeps: ({ search }) => search,
  loader: ({ context }) => loadAdminRoute(context, '/profile'),
  beforeLoad: requireAuth,
  validateSearch: zodValidator(searchSchema),
  component: ProfilePage,
})
