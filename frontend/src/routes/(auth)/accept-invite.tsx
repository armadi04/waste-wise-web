import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { invitationQueryOptions } from '@/lib/query/options'
import { AcceptInvitePage } from '@/components/features/auth/pages/accept-invite'

const searchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/accept-invite')({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: ({ context, deps }) => {
    if (deps.token)
      void context.queryClient.prefetchQuery(invitationQueryOptions(deps.token))
  },
  component: AcceptInvitePage,
})
