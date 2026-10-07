import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { ForgotPasswordFormData } from '@/lib/schemas/auth'
import { useAppMutation } from '@/hooks/global/use-mutations'
import { forgotPasswordSchema } from '@/lib/schemas/auth'
import { forgotPassword } from '@/lib/services/auth.service'

/**
 * Form state and submission for the forgot-password page.
 */
export function useForgotPassword() {
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const { mutate, isPending } = useAppMutation({
    mutationFn: ({ email }: { email: string }) => forgotPassword(email),
    onSuccess: () => setSubmitted(true),
  })

  const onSubmit = form.handleSubmit((data) => mutate({ email: data.email }))

  return { ...form, isPending, submitted, onSubmit }
}
