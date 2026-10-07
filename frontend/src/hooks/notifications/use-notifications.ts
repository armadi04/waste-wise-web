import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { useAppMutation } from '@/hooks/global/use-mutations'
import {
  notificationsQueryOptions,
  unreadCountQueryOptions,
} from '@/lib/query/options'
import {
  markAllAsRead as markAllAsReadApi,
  markAsRead as markAsReadApi,
} from '@/lib/services/notification.service'

const notificationRoute = getRouteApi('/(content)/notifications')

export const useNotifications = () => {
  const [page, setPage] = useState(1)
  return { ...useQuery(notificationsQueryOptions(page, 10)), page, setPage }
}
export const useRouteNotifications = () => {
  const { page, limit } = notificationRoute.useSearch()
  const navigate = notificationRoute.useNavigate()
  const setPage = (next: number) => {
    void navigate({ search: (previous) => ({ ...previous, page: next }) })
  }
  return { ...useQuery(notificationsQueryOptions(page, limit)), page, setPage }
}

export const useUnreadCount = () => {
  return useQuery(unreadCountQueryOptions())
}

export const useMarkAsRead = () => {
  const queryClient = useQueryClient()
  return useAppMutation({
    mutationFn: markAsReadApi,
    onSuccess: () => {
      // Invalidate both the notification list and the unread count
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient()
  return useAppMutation({
    mutationFn: markAllAsReadApi,
    successMessage: 'All notifications marked as read',
    onSuccess: () => {
      // Invalidate both the notification list and the unread count
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
