import { z } from 'zod'
import { REGISTER_METHODS } from '@/lib/constants/register-method'

const baseUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullname: z.string().min(1, 'Full name is required'),
  phone: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
})

export const createUserSchema = baseUserSchema.extend({
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const updateUserSchema = baseUserSchema

export const updateProfileSchema = baseUserSchema.extend({
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .optional()
    .or(z.literal('')),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const userSchema = createUserSchema

export type UserFormData = z.infer<typeof updateUserSchema>
export type CreateUserFormData = z.infer<typeof createUserSchema>
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

export const userSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  sort: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  timeZone: z
    .enum(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'])
    .optional(),
  createdIn: z.enum(['today', '7d', '1m', '3m']).optional(),
  registerMethod: z.enum(REGISTER_METHODS).optional(),
})

export type UserSearchParams = z.infer<typeof userSearchSchema>
