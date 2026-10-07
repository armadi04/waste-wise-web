import { useNavigate } from '@tanstack/react-router'
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useRouteNotifications,
} from '@/hooks/notifications/use-notifications'

export function useNotificationPage() {
  const navigate = useNavigate()
  const { data, isLoading, page, setPage } = useRouteNotifications()
  const markAsReadMutation = useMarkAsRead()
  const markAllAsReadMutation = useMarkAllAsRead()

  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id)
    }
    if (notification.link) {
      navigate({ to: notification.link })
    }
  }

  const unreadCount = data?.data.filter((n) => !n.isRead).length || 0

  return {
    data,
    isLoading,
    page,
    setPage,
    unreadCount,
    handleNotificationClick,
    markAsReadMutation,
    markAllAsReadMutation,
  }
}
