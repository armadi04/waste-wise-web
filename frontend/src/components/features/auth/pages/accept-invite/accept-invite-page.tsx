import { Button, Input, Spinner } from '@heroui/react'
import { AlertTriangle, Mail, Phone, User } from 'lucide-react'
import { routeApi } from '@/components/features/auth/pages/accept-invite/lib/accept-invite-page-helpers'
import { AuthPageShell } from '@/components/layout/auth-page-shell'
import { useAcceptInvite, useAuthGuard } from '@/hooks/auth'

import {
  BackToLogin,
  InvalidInviteState,
  PasswordInput,
} from '@/components/features/auth/pages/accept-invite/child'

export function AcceptInvitePage() {
  useAuthGuard({ isAuthPage: true })

  const { token } = routeApi.useSearch()
  const {
    register,
    onSubmit,
    email,
    isInviteLoading,
    isInviteInvalid,
    isPending,
    apiError,
    isPasswordVisible,
    isConfirmVisible,
    togglePasswordVisibility,
    toggleConfirmVisibility,
    formState: { errors },
  } = useAcceptInvite(token)

  const showInvalid = !token || isInviteInvalid

  return (
    <AuthPageShell>
      <div className="flex flex-col gap-6">
        {showInvalid ? (
          <InvalidInviteState />
        ) : isInviteLoading ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Spinner size="lg" color="success" />
            <p className="text-sm text-default-500">
              Validating your invitation…
            </p>
          </div>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Set Up Your Account
              </h1>
              <p className="text-sm text-default-500">
                Complete the form below to finish creating your account
              </p>
            </div>

            {apiError && (
              <div className="flex items-start gap-2 rounded-large bg-danger/10 border border-danger-200 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                <p className="text-sm text-danger">{apiError}</p>
              </div>
            )}

            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              <Input
                label="Email"
                value={email ?? ''}
                isReadOnly
                startContent={<Mail className="w-4 h-4 text-default-400" />}
                variant="bordered"
                labelPlacement="outside"
              />

              <Input
                {...register('fullname')}
                label="Full Name"
                placeholder="Enter your full name"
                startContent={<User className="w-4 h-4 text-default-400" />}
                variant="bordered"
                labelPlacement="outside"
                isRequired
                isInvalid={!!errors.fullname}
                errorMessage={errors.fullname?.message}
              />

              <Input
                {...register('phone')}
                label="Phone (optional)"
                placeholder="Enter your phone number"
                startContent={<Phone className="w-4 h-4 text-default-400" />}
                variant="bordered"
                labelPlacement="outside"
                isInvalid={!!errors.phone}
                errorMessage={errors.phone?.message}
              />

              <PasswordInput
                label="Password"
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
                Create Account
              </Button>
            </form>

            <BackToLogin />
          </>
        )}
      </div>
    </AuthPageShell>
  )
}
