import { z } from 'zod'
import {
  CATEGORY_FILTER_VALUES,
  REPORT_IMAGE_MAX_BYTES,
  REPORT_IMAGE_MIME_TYPES,
  REPORT_STATUS_VALUES,
} from '@/lib/constants/reports'

const optionalCoordinate = (min: number, max: number) =>
  z.number().min(min).max(max).optional()

const reportPhotoSchema = z
  .instanceof(File)
  .refine((file) => file.size <= REPORT_IMAGE_MAX_BYTES, {
    message: 'Photo must be 5 MB or smaller',
  })
  .refine(
    (file) =>
      (REPORT_IMAGE_MIME_TYPES as ReadonlyArray<string>).includes(file.type),
    { message: 'Photo must be JPEG, PNG, or WebP' },
  )

export const reportFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(3, 'Description must be at least 3 characters')
    .max(2000, 'Description must be 2000 characters or fewer'),
  latitude: optionalCoordinate(-90, 90),
  longitude: optionalCoordinate(-180, 180),
})

export const createReportFormSchema = reportFormSchema.extend({
  photo: reportPhotoSchema,
})

export const editReportFormSchema = reportFormSchema.extend({
  photo: reportPhotoSchema.optional(),
})

export type ReportFormValues = z.infer<typeof reportFormSchema>
export type CreateReportFormValues = z.infer<typeof createReportFormSchema>
export type EditReportFormValues = z.infer<typeof editReportFormSchema>

export const reportSearchSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.enum(REPORT_STATUS_VALUES).optional(),
  category: z.enum(CATEGORY_FILTER_VALUES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  reporterId: z.coerce.number().int().positive().optional(),
  sort: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
})

export type ReportSearchParams = z.infer<typeof reportSearchSchema>
