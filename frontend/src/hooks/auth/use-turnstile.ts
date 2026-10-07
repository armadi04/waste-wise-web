import { useCallback, useRef, useState } from 'react'
import type { TurnstileInstance } from '@marsidev/react-turnstile'

export function useTurnstile() {
  const enabled = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)
  const widgetRef = useRef<TurnstileInstance | null>(null)
  const [token, setToken] = useState<string>()
  const [error, setError] = useState<
    'expired' | 'challenge-failed' | 'script-failed'
  >()
  const scriptFailed = error === 'script-failed'
  const reset = useCallback(() => {
    if (scriptFailed) {
      window.location.reload()
      return
    }
    setToken(undefined)
    setError(undefined)
    widgetRef.current?.reset()
  }, [scriptFailed])

  return {
    enabled,
    token,
    widgetRef,
    error,
    scriptFailed,
    isReady: !enabled || Boolean(token),
    reset,
    isVerified: Boolean(token),
    onInvalidate: useCallback(() => setToken(undefined), []),
    onSuccess: useCallback((value: string) => {
      setToken(value)
      setError(undefined)
    }, []),
    onExpire: useCallback(() => {
      setToken(undefined)
      setError('expired')
    }, []),
    onError: useCallback(() => {
      setToken(undefined)
      setError('challenge-failed')
    }, []),
    onScriptError: useCallback(() => {
      setToken(undefined)
      setError('script-failed')
    }, []),
  }
}
