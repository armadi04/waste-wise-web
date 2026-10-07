import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { ResetPasswordPage } from '@/components/features/auth/pages/reset-password'

const searchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/reset-password')({
  validateSearch: zodValidator(searchSchema),
  component: ResetPasswordPage,
})
