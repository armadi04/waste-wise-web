import { Button } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Lock } from 'lucide-react'
import { routeApi } from '@/components/features/auth/pages/reset-password/lib/reset-password-page-helpers'
import { AuthPageShell } from '@/components/layout/auth-page-shell'
import { useAuthGuard, useResetPassword } from '@/hooks/auth'

import {
  BackToLogin,
  MissingTokenState,
  PasswordInput,
} from '@/components/features/auth/pages/reset-password/child'

export function ResetPasswordPage() {
  useAuthGuard({ isAuthPage: true })

  const { token } = routeApi.useSearch()
  const {
    register,
    onSubmit,
    isPending,
    apiError,
    isPasswordVisible,
    isConfirmVisible,
    togglePasswordVisibility,
    toggleConfirmVisibility,
    formState: { errors },
  } = useResetPassword(token)

  return (
    <AuthPageShell>
      <div className="flex flex-col gap-6">
        {!token ? (
          <MissingTokenState />
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Set New Password
              </h1>
              <p className="text-sm text-default-500">
                Choose a strong password for your account
              </p>
            </div>

            {apiError && (
              <div className="flex items-start gap-2 rounded-large bg-danger/10 border border-danger-200 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                <p className="text-sm text-danger">
                  {apiError}{' '}
                  <Link
                    to="/forgot-password"
                    className="underline hover:text-danger"
                  >
                    Request a new link.
                  </Link>
                </p>
              </div>
            )}

            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              <PasswordInput
                label="New Password"
                registration={register('password')}
                isVisible={isPasswordVisible}
                onToggle={togglePasswordVisibility}
                isInvalid={!!errors.password}
                errorMessage={errors.password?.message}
              />

              <PasswordInput
                label="Confirm Password"
                registration={register('confirmPassword')}
                isVisible={isConfirmVisible}
                onToggle={toggleConfirmVisibility}
                isInvalid={!!errors.confirmPassword}
                errorMessage={errors.confirmPassword?.message}
              />

              <Button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary-700 text-primary-foreground font-medium mt-2 disabled:opacity-60"
                isLoading={isPending}
                isDisabled={isPending}
              >
                Reset Password
              </Button>
            </form>

            <BackToLogin />
          </>
        )}
      </div>
    </AuthPageShell>
  )
}
