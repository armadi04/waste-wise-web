import type { MediaSortKey } from '@/lib/schemas/media'

export const SORT_LABELS: Record<MediaSortKey, string> = {
  originalName: 'Name',
  updatedAt: 'Last modified',
  createdAt: 'Upload date',
  size: 'Size',
  mimetype: 'Type',
}
