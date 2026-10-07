import { createFileRoute, notFound } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { portalResourceConfig } from '@/components/features/portal/lib/config'
import { PortalResourcePage } from '@/components/features/portal/pages/portal-resource'
import { loadAdminRoute } from '@/lib/query/loaders'
import { portalSearchSchema } from '@/lib/schemas/portal'

export const Route = createFileRoute('/(portal)/portal/$resource')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, params }) =>
    loadAdminRoute(context, '/portal/$resource', deps, params.resource),
  beforeLoad: ({ params }) => {
    if (!portalResourceConfig(params.resource)) throw notFound()
  },
  validateSearch: zodValidator(portalSearchSchema),
  component: PortalResourcePage,
})
