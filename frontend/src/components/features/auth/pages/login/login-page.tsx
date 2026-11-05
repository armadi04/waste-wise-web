import { Divider } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { Building2, Eye, EyeOff, Lock, LogIn, User } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { Button, Input } from '@/components/shared/controls'
import { LoginTwoFactorForm } from '@/components/features/auth/pages/login/child/login-two-factor-form'
import {
  SSO_ERRORS,
  routeApi,
} from '@/components/features/auth/pages/login/lib/login-page-helpers'
import { AuthPageShell } from '@/components/layout/auth-page-shell'
import {
  GOOGLE_LOGIN_ENABLED,
  GoogleLoginButton,
} from '@/components/ui/google-login-button'
import { TurnstileWidget } from '@/components/ui/turnstile-widget'
import { useAuthGuard, useLogin, useSilentSso } from '@/hooks/auth'
import { turnstileErrorMessages } from '@/lib/config/turnstile'
import {
  BRAND_DESCRIPTION,
  BRAND_LOGO_SRC,
  BRAND_NAME_LEADING,
  BRAND_NAME_TRAILING,
} from '@/lib/constants/brand'

export function LoginPage() {
  useAuthGuard({ isAuthPage: true })
  useSilentSso()

  const { sso_error: ssoError } = routeApi.useSearch()
  const ssoFailure = ssoError ? SSO_ERRORS[ssoError] : null

  const {
    register,
    onSubmit,
    isLoading,
    isPasswordVisible,
    togglePasswordVisibility,
    formState: { errors },
    turnstileWidgetRef,
    onTurnstileSuccess,
    onTurnstileError,
    onTurnstileExpire,
    isTurnstileReady,
    onTurnstileInvalidate,
    onTurnstileScriptError,
    turnstileError,
    turnstileScriptFailed,
    resetTurnstile,
    isTwoFactorPending,
    twoFactorCode,
    setTwoFactorCode,
    onVerifyTwoFactor,
    cancelTwoFactor,
    onTwoFactorChallenge,
  } = useLogin()

  if (isTwoFactorPending) {
    return (
      <LoginTwoFactorForm
        isLoading={isLoading}
        twoFactorCode={twoFactorCode}
        setTwoFactorCode={setTwoFactorCode}
        onVerifyTwoFactor={onVerifyTwoFactor}
        cancelTwoFactor={cancelTwoFactor}
      />
    )
  }

  return (
    <AuthPageShell
      footerStart={
        // Cloudflare Turnstile — gates the submit button
        <TurnstileWidget
          widgetRef={turnstileWidgetRef}
          onSuccess={onTurnstileSuccess}
          onError={onTurnstileError}
          onExpire={onTurnstileExpire}
          onInvalidate={onTurnstileInvalidate}
          onScriptError={onTurnstileScriptError}
        />
      }
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <img
          src={BRAND_LOGO_SRC}
          alt=""
          aria-hidden="true"
          width={56}
          height={56}
          draggable={false}
          decoding="async"
          className="h-14 w-14 object-contain"
        />
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-default-500">
          {BRAND_DESCRIPTION}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
          Welcome back to{' '}
          <span className="whitespace-nowrap italic">
            <span className="text-[var(--app-link)]">{BRAND_NAME_LEADING}</span>
            <span className="text-foreground">{BRAND_NAME_TRAILING}</span>
          </span>
        </h1>
        <p className="text-sm text-default-500">
          Sign in to continue to your dashboard.
        </p>
      </div>

      <div className="space-y-6">
        {ssoFailure && (
          <div className="flex gap-3 rounded-large border border-[var(--app-danger-border)] app-status-danger bg-[var(--app-danger-background)] text-[var(--app-danger-foreground)] p-4">
            <ssoFailure.icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--app-danger)]" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--app-danger)]">
                {ssoFailure.title}
              </p>
              <p className="text-xs text-default-600">
                {ssoFailure.description}
              </p>
            </div>
          </div>
        )}

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <Input
            {...register('email')}
            label="Email"
            placeholder="Enter your email"
            type="email"
            startContent={<User className="w-4 h-4 text-default-400" />}
            variant="bordered"
            labelPlacement="outside"
            isRequired
            isInvalid={!!errors.email}
            errorMessage={errors.email?.message}
            classNames={{ inputWrapper: 'h-12 border-default-200' }}
          />

          <Input
            {...register('password')}
            label="Password"
            placeholder="••••••••••••"
            type={isPasswordVisible ? 'text' : 'password'}
            startContent={<Lock className="w-4 h-4 text-default-400" />}
            endContent={
              <button
                type="button"
                aria-label={
                  isPasswordVisible ? 'Hide password' : 'Show password'
                }
                onClick={togglePasswordVisibility}
                className="focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
              >
                {isPasswordVisible ? (
                  <EyeOff className="w-4 h-4 text-default-400" />
                ) : (
                  <Eye className="w-4 h-4 text-default-400" />
                )}
              </button>
            }
            variant="bordered"
            labelPlacement="outside"
            isRequired
            isInvalid={!!errors.password}
            errorMessage={errors.password?.message}
            classNames={{
              label: 'text-default-500 text-sm',
              input: 'text-foreground',
              inputWrapper: 'h-12 border-default-200',
            }}
          />

          <div className="flex justify-end -mt-1">
            <Link
              to="/forgot-password"
              className="text-xs text-[var(--app-link)] hover:text-[var(--app-link-hover)] hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {turnstileError && (
            <div>
              <p role="alert" className="text-sm text-[var(--app-danger)]">
                {turnstileErrorMessages[turnstileError]}
              </p>
              <Button type="button" variant="light" onPress={resetTurnstile}>
                {turnstileScriptFailed
                  ? 'Reload page'
                  : 'Try verification again'}
              </Button>
            </div>
          )}

          {/* Submit Button */}
          <Button
            color="primary"
            type="submit"
            className="w-full h-12 bg-primary hover:bg-primary-700 text-primary-foreground font-medium "
            isLoading={isLoading}
            isDisabled={isLoading || !isTurnstileReady}
            startContent={!isLoading && <LogIn className="w-4 h-4" />}
          >
            Sign In
          </Button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <Divider className="flex-1" />
          <span className="text-default-400 text-sm">or</span>
          <Divider className="flex-1" />
        </div>

        {/* Social / SSO login row */}
        <div className="flex gap-3">
          {/* Google — only when VITE_GOOGLE_CLIENT_ID is set */}
          {GOOGLE_LOGIN_ENABLED && (
            <GoogleLoginButton onChallenge={onTwoFactorChallenge} />
          )}

          {/* Passport SSO — full-page redirect into the OIDC flow */}
          <Button
            as="a"
            href={apiUrl('/auth/sso/login')}
            variant="flat"
            color="primary"
            className="flex-1"
            startContent={
              <Building2 className="w-5 h-5 text-[var(--app-link)]" />
            }
          >
            <span className="text-[var(--app-link)] font-medium">Passport</span>
          </Button>
        </div>
      </div>
    </AuthPageShell>
  )
}
