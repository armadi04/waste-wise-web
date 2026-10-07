import { z } from 'zod'

export const auditSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  sort: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  action: z.string().optional(),
})

export type AuditSearchParams = z.infer<typeof auditSearchSchema>
