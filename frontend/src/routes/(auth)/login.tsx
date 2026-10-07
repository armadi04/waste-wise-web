import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { LoginPage } from '@/components/features/auth/pages/login'

const searchSchema = z.object({
  sso_error: z
    .enum(['not_configured', 'session_expired', 'exchange_failed'])
    .optional(),
})

export const Route = createFileRoute('/(auth)/login')({
  validateSearch: zodValidator(searchSchema),
  component: LoginPage,
})
