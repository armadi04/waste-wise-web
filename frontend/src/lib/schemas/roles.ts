import { z } from 'zod'

export const roleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})

export type RoleFormData = z.infer<typeof roleSchema>

export const roleSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  sort: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
})

export type RoleSearchParams = z.infer<typeof roleSearchSchema>
