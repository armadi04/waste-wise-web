import {
  FormState,
  SuccessState,
} from '@/components/features/auth/pages/forgot-password/child'
import { AuthPageShell } from '@/components/layout/auth-page-shell'
import { useAuthGuard, useForgotPassword } from '@/hooks/auth'

export function ForgotPasswordPage() {
  useAuthGuard({ isAuthPage: true })

  const form = useForgotPassword()

  return (
    <AuthPageShell>
      <div className="flex flex-col gap-6">
        {form.submitted ? <SuccessState /> : <FormState form={form} />}
      </div>
    </AuthPageShell>
  )
}
