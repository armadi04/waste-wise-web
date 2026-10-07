import { z } from 'zod'

export const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  roleIds: z.array(z.number()).optional(),
})

export type InviteFormData = z.infer<typeof inviteSchema>

export const invitationSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  sort: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
})

export type InvitationSearchParams = z.infer<typeof invitationSearchSchema>
