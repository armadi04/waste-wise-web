import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/auth/use-auth'
import { refreshAccessToken, verifyEmail } from '@/lib/services/auth.service'

export type VerifyEmailStatus = 'loading' | 'success' | 'error' | 'no-token'

/**
 * Drives the email-verification flow for the verify-email page: consumes the
 * token from the URL, verifies it, then refreshes the JWT and profile cache so
 * the verification gate unblocks immediately.
 */
export function useVerifyEmail(token?: string) {
  const { syncAuth } = useAuth()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<VerifyEmailStatus>(
    token ? 'loading' : 'no-token',
  )
  const [message, setMessage] = useState('')
  const calledRef = useRef(false)

  useEffect(() => {
    if (!token || calledRef.current) return
    calledRef.current = true

    verifyEmail(token)
      .then(async (res) => {
        setMessage(res.message)
        // Refresh the JWT and auth state so the gate sees emailVerified via the
        // fast token path; invalidate the profile cache for the authoritative
        // value on the next fetch.
        try {
          await refreshAccessToken()
          syncAuth()
        } catch {
          // If the refresh fails, the profile invalidation below still unblocks
          // the gate once the profile re-fetches.
        }
        await queryClient.invalidateQueries({ queryKey: ['profile'] })
        setStatus('success')
      })
      .catch((err: unknown) => {
        setMessage(
          err instanceof Error
            ? err.message
            : 'Verification failed. The link may be expired or already used.',
        )
        setStatus('error')
      })
  }, [token, syncAuth, queryClient])

  return { status, message }
}
