import { z } from 'zod'

/** Sortable columns the backend accepts for `/api/media`. */
export const MEDIA_SORT_KEYS = [
  'originalName',
  'createdAt',
  'updatedAt',
  'size',
  'mimetype',
] as const

export type MediaSortKey = (typeof MEDIA_SORT_KEYS)[number]

export const mediaSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  sort: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
  /** Card grid or list rows. Cards are the default, like Drive. */
  view: z.enum(['grid', 'list']).optional(),
})

export type MediaSearchParams = z.infer<typeof mediaSearchSchema>
