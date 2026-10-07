import { z } from 'zod'

export const oauthClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  scopes: z.array(z.string()).min(1, 'Select at least one scope'),
  isActive: z.boolean().optional(),
})

export type OAuthClientFormData = z.infer<typeof oauthClientSchema>

export const oauthClientSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  sort: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
})

export type OAuthClientSearchParams = z.infer<typeof oauthClientSearchSchema>
