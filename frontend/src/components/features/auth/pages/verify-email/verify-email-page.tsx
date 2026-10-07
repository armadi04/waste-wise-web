import { routeApi } from '@/components/features/auth/pages/verify-email/lib/verify-email-page-helpers'
import { AuthPageShell } from '@/components/layout/auth-page-shell'
import { useVerifyEmail } from '@/hooks/auth'

import {
  ErrorState,
  LoadingState,
  SuccessState,
} from '@/components/features/auth/pages/verify-email/child'

export function VerifyEmailPage() {
  const { token } = routeApi.useSearch()
  const { status, message } = useVerifyEmail(token)

  return (
    <AuthPageShell>
      <div className="flex flex-col gap-6">
        {status === 'loading' && <LoadingState />}
        {status === 'success' && <SuccessState message={message} />}
        {(status === 'error' || status === 'no-token') && (
          <ErrorState message={message} />
        )}
      </div>
    </AuthPageShell>
  )
}
