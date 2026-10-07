import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { LoginFormData } from '@/lib/schemas/auth'
import { addToast } from '@/components/shared/controls/toast'
import { loginSchema } from '@/lib/schemas/auth'
import { useTurnstile } from '@/hooks/auth/use-turnstile'
import { useAuth } from '@/hooks/auth/use-auth'

const TURNSTILE_ENABLED = !!import.meta.env.VITE_TURNSTILE_SITE_KEY

export function useLogin() {
  const { login, verifyTwoFactor, isLoading } = useAuth()
  const navigate = useNavigate()
  const submitting = useRef(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  // Set once the password is accepted but a second factor is still owed. Held
  // in memory only: it expires in minutes and is useless without a code.
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')

  const {
    token: turnstileToken,
    widgetRef: turnstileWidgetRef,
    isVerified: isTurnstileVerified,
    onSuccess: onTurnstileSuccess,
    onError: onTurnstileError,
    onExpire: onTurnstileExpire,
    reset: resetTurnstile,
    onInvalidate: onTurnstileInvalidate,
    onScriptError: onTurnstileScriptError,
    error: turnstileError,
    scriptFailed: turnstileScriptFailed,
  } = useTurnstile()

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  })

  useEffect(() => {
    const persistedError = sessionStorage.getItem('auth_error')
    if (persistedError) {
      addToast({
        title: 'Login Failed',
        description: persistedError,
        color: 'danger',
      })
      sessionStorage.removeItem('auth_error')
    }
  }, [])

  const onSubmit = async (data: LoginFormData) => {
    if (TURNSTILE_ENABLED && !isTurnstileVerified) {
      addToast({
        title: 'Security Check Required',
        description:
          'Please complete the security verification before signing in.',
        color: 'warning',
      })
      return
    }

    if (submitting.current) return
    submitting.current = true
    let result
    try {
      result = await login(data, turnstileToken ?? undefined)
    } finally {
      submitting.current = false
      resetTurnstile()
    }

    if (result.twoFactorRequired && result.challengeToken) {
      setChallengeToken(result.challengeToken)
      setTwoFactorCode('')
      return
    }

    if (result.success) {
      void navigate({ to: '/' })
      addToast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
        color: 'primary',
      })
    } else {
      addToast({
        title: 'Login Failed',
        description:
          result.error || 'Invalid email or password. Please try again.',
        color: 'danger',
      })
    }
  }

  const onVerifyTwoFactor = async () => {
    if (!challengeToken) return

    const result = await verifyTwoFactor(challengeToken, twoFactorCode.trim())

    if (result.success) {
      setChallengeToken(null)
      void navigate({ to: '/' })
      addToast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
        color: 'primary',
      })
    } else {
      setTwoFactorCode('')
      addToast({
        title: 'Verification Failed',
        description:
          result.error || 'That code is not valid. Please try again.',
        color: 'danger',
      })
    }
  }

  // Abandoning the challenge means starting from the password again — the
  // challenge token is single-purpose and short-lived.
  const cancelTwoFactor = () => {
    setChallengeToken(null)
    setTwoFactorCode('')
    resetTurnstile()
  }

  const togglePasswordVisibility = () => setIsPasswordVisible((v) => !v)

  return {
    ...form,
    isLoading,
    isPasswordVisible,
    togglePasswordVisibility,
    onSubmit: form.handleSubmit(onSubmit),
    // Two-factor step
    onTwoFactorChallenge: (token: string) => {
      setChallengeToken(token)
      setTwoFactorCode('')
    },
    isTwoFactorPending: !!challengeToken,
    twoFactorCode,
    setTwoFactorCode,
    onVerifyTwoFactor,
    cancelTwoFactor,
    // Turnstile
    turnstileWidgetRef,
    onTurnstileInvalidate,
    onTurnstileScriptError,
    turnstileError,
    turnstileScriptFailed,
    resetTurnstile,
    onTurnstileSuccess,
    onTurnstileError,
    onTurnstileExpire,
    isTurnstileReady: !TURNSTILE_ENABLED || isTurnstileVerified,
  }
}
