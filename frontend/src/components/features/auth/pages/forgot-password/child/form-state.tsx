import { Mail, User } from 'lucide-react'
import type { useForgotPassword } from '@/hooks/auth'
import { Button, Input } from '@/components/shared/controls'
import { BackToLogin } from '@/components/features/auth/pages/forgot-password/child/back-to-login'

export function FormState({
  form,
}: {
  form: ReturnType<typeof useForgotPassword>
}) {
  const {
    register,
    onSubmit,
    isPending,
    formState: { errors },
  } = form

  return (
    <>
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-[var(--app-selected-background)] flex items-center justify-center">
            <Mail className="w-6 h-6 text-[var(--app-link)]" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Forgot Password?
        </h1>
        <p className="text-sm text-default-500">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
        />

        <Button
          color="primary"
          type="submit"
          className="w-full h-12 bg-primary hover:bg-primary-700 text-primary-foreground font-medium mt-2 "
          isLoading={isPending}
          isDisabled={isPending}
        >
          Send Reset Link
        </Button>
      </form>

      <BackToLogin />
    </>
  )
}
