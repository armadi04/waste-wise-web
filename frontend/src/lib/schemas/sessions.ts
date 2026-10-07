import { z } from 'zod'

export const sessionSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  sort: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
})

export type SessionSearchParams = z.infer<typeof sessionSearchSchema>
