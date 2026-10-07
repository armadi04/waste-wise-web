import { z } from 'zod'

export const permissionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})

export type PermissionFormData = z.infer<typeof permissionSchema>

export const permissionSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  sort: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
})

export type PermissionSearchParams = z.infer<typeof permissionSearchSchema>
