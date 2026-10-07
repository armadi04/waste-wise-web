import { useState } from 'react'
import { resendVerification } from '@/lib/services/auth.service'

export type ResendState = 'idle' | 'loading' | 'sent' | 'error'

/**
 * Manages the "resend verification email" action and its UI state.
 * Shared by the verification gate and the verify-email error screen.
 */
export function useResendVerification() {
  const [state, setState] = useState<ResendState>('idle')

  const resend = async (email: string) => {
    const trimmed = email.trim()
    if (!trimmed) return

    setState('loading')
    try {
      await resendVerification(trimmed)
      setState('sent')
    } catch {
      setState('error')
    }
  }

  return { state, resend }
}
