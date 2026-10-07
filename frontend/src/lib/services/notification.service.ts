import type { Notification, PaginatedData } from '@/types/api'
import { apiGet, apiPatch, apiPost } from '@/lib/api'

export const getNotifications = (params?: {
  page?: number
  limit?: number
}) => {
  return apiGet<PaginatedData<Notification>>('/notifications', { params })
}

export const getUnreadCount = () => {
  return apiGet<number>('/notifications/unread-count')
}

export const markAsRead = (id: number) => {
  return apiPatch<void>(`/notifications/${id}/read`)
}

export const markAllAsRead = () => {
  return apiPost<void>('/notifications/read-all')
}
