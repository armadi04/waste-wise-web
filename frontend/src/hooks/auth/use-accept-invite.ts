import { addToast } from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { AcceptInviteFormData } from '@/lib/schemas/auth'
import { acceptInvitation } from '@/lib/services/auth.service'
import { acceptInviteSchema } from '@/lib/schemas/auth'
import { invitationQueryOptions } from '@/lib/query/options'
import { useAppMutation } from '@/hooks/global/use-mutations'

/**
 * Resolves the invite (email prefill + validity), and manages the
 * account-setup form for the accept-invite page.
 */
export function useAcceptInvite(token?: string) {
  const navigate = useNavigate()
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    data: invitation,
    isLoading: isInviteLoading,
    isError: isInviteInvalid,
  } = useQuery(invitationQueryOptions(token))

  const form = useForm<AcceptInviteFormData>({
    resolver: zodResolver(acceptInviteSchema),
  })

  const { mutate, isPending } = useAppMutation({
    mutationFn: (data: AcceptInviteFormData) =>
      acceptInvitation(token!, {
        fullname: data.fullname,
        phone: data.phone,
        password: data.password,
      }),
    onSuccess: () => {
      addToast({
        title: 'Account created!',
        description: 'Your account is ready. Please log in.',
        color: 'success',
      })
      void navigate({ to: '/login' })
    },
    onError: (error: unknown) => {
      setApiError(
        error instanceof Error
          ? error.message
          : 'This invitation link is invalid or has expired.',
      )
    },
  })

  const onSubmit = form.handleSubmit((data) => {
    setApiError(null)
    mutate(data)
  })

  return {
    ...form,
    email: invitation?.email,
    isInviteLoading,
    isInviteInvalid,
    isPending,
    apiError,
    isPasswordVisible,
    isConfirmVisible,
    togglePasswordVisibility: () => setIsPasswordVisible((v) => !v),
    toggleConfirmVisibility: () => setIsConfirmVisible((v) => !v),
    onSubmit,
  }
}
