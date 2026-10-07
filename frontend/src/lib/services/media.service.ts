import type { Media, PaginatedData, components } from '@/types/api'
import { apiDelete, apiGet, apiPost } from '@/lib/api'

export const getMediaList = (params?: {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: string
  paginated?: boolean
}) => {
  return apiGet<PaginatedData<Media> | Array<Media>>('/api/media', {
    params,
  })
}

export const getMedia = (id: number) => {
  return apiGet<Media>(`/api/media/${id}`)
}

export const deleteMedia = (id: number) => {
  return apiDelete<MediaDeletionResult>(`/api/media/${id}`)
}

export type MediaDeletionResult =
  components['schemas']['MediaDeletionResultDto']
export type MediaBulkDeleteResult =
  components['schemas']['MediaBulkDeleteResultDto']

export const bulkDeleteMedia = (ids: Array<number>) => {
  return apiPost<MediaBulkDeleteResult>('/api/media/bulk-delete', { ids })
}

export const uploadMedia = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return apiPost<Media>('/api/media/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}
