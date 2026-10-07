import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { InvitationsPage } from '@/components/features/invitations/pages/invitations'
import { loadAdminRoute } from '@/lib/query/loaders'
import { invitationSearchSchema } from '@/lib/schemas/invitations'

export const Route = createFileRoute('/(users)/invitations')({
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => loadAdminRoute(context, '/invitations', deps),
  validateSearch: zodValidator(invitationSearchSchema),
  component: InvitationsPage,
})
