import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { PortalContentPage } from '@/components/features/portal/pages/portal-content'
import { loadAdminRoute } from '@/lib/query/loaders'
import { portalContentSearchSchema } from '@/lib/schemas/portal'

export const Route = createFileRoute('/(portal)/portal/content')({
  validateSearch: zodValidator(portalContentSearchSchema),
  loader: ({ context }) =>
    loadAdminRoute(context, '/portal/content', undefined),
  component: PortalContentPage,
})
