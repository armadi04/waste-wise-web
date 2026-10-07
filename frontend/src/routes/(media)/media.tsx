import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { MediaPage } from '@/components/features/media/pages/media'
import { loadAdminRoute } from '@/lib/query/loaders'
import { mediaSearchSchema } from '@/lib/schemas/media'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/(media)/media')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => loadAdminRoute(context, '/media', deps),
  beforeLoad: requireAuth,
  validateSearch: zodValidator(mediaSearchSchema),
  component: MediaPage,
})
