import { Button, Divider, Input } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { Building2, Eye, EyeOff, Lock, LogIn, User } from 'lucide-react'
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
    <AuthPageShell>
      {/* Header */}
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Welcome back to <span className="text-primary italic">Nest</span>
          <span className="text-foreground italic">plate </span>
          <span className="text-primary italic">Admin</span>
        </h1>
        <p className="text-sm text-default-500">
          Sign in to continue to your dashboard.
        </p>
      </div>

      <div className="space-y-6">
        {ssoFailure && (
          <div className="flex gap-3 rounded-large border border-danger-200 bg-danger/10 p-4">
            <ssoFailure.icon className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-danger">
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
                onClick={togglePasswordVisibility}
                className="focus:outline-none"
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
              className="text-xs text-primary hover:text-primary-700 hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Cloudflare Turnstile — gates the submit button */}
          <div className="flex justify-center">
            <TurnstileWidget
              widgetRef={turnstileWidgetRef}
              onSuccess={onTurnstileSuccess}
              onError={onTurnstileError}
              onExpire={onTurnstileExpire}
              onInvalidate={onTurnstileInvalidate}
              onScriptError={onTurnstileScriptError}
            />
          </div>

          {turnstileError && (
            <div>
              <p role="alert" className="text-sm text-danger">
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
            type="submit"
            className="w-full h-12 bg-primary hover:bg-primary-700 text-primary-foreground font-medium disabled:opacity-60"
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
            href="/api/auth/sso/login"
            variant="flat"
            color="primary"
            className="flex-1"
            startContent={<Building2 className="w-5 h-5 text-primary" />}
          >
            <span className="text-primary font-medium">Passport</span>
          </Button>
        </div>
      </div>
    </AuthPageShell>
  )
}
