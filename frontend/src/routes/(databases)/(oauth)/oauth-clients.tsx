import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { OAuthClientsPage } from '@/components/features/oauth-clients/pages/o-auth-clients'
import { loadAdminRoute } from '@/lib/query/loaders'
import { oauthClientSearchSchema } from '@/lib/schemas/oauth-clients'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/(databases)/(oauth)/oauth-clients')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    loadAdminRoute(context, '/oauth-clients', deps),
  beforeLoad: requireAuth,
  validateSearch: zodValidator(oauthClientSearchSchema),
  component: OAuthClientsPage,
})
