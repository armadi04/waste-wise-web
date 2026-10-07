import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { VerifyEmailPage } from '@/components/features/auth/pages/verify-email'

const searchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/verify-email')({
  validateSearch: zodValidator(searchSchema),
  component: VerifyEmailPage,
})
