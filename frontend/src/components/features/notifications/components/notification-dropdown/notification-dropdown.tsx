import {
  Badge,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
  PopoverContent,
  PopoverTrigger,
  ScrollShadow,
  Spinner,
} from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { Bell, Check, ExternalLink, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Popover } from '@/components/shared/controls'
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
  useUnreadCount,
} from '@/hooks/notifications'
import { LottieAnimation } from '@/components/atoms/lottie-animation'

export const NotificationDropdown = () => {
  const navigate = useNavigate()
  const { data: notifications, isLoading } = useNotifications()
  const { data: unreadCount = 0 } = useUnreadCount()
  const markAsReadMutation = useMarkAsRead()
  const markAllAsReadMutation = useMarkAllAsRead()
  const [permission, setPermission] =
    useState<NotificationPermission>('default')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const result = await Notification.requestPermission()
      setPermission(result)
    }
  }

  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id)
    }
    setIsOpen(false)
    if (notification.link) {
      navigate({ to: notification.link })
    }
  }

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-end"
      offset={10}
      classNames={{
        base: 'rounded-large',
        content: 'p-0 rounded-large overflow-hidden border border-default-200',
      }}
    >
      <PopoverTrigger>
        <Button
          isIconOnly
          // `sm` to match the command-palette trigger beside it in the header —
          // the default `md` made the bell a visibly bigger button than the
          // magnifier.
          size="sm"
          variant="light"
          className="overflow-visible text-default-500 hover:bg-default-100 transition-colors"
        >
          <Badge
            color="danger"
            content={unreadCount > 99 ? '99+' : unreadCount}
            isInvisible={unreadCount === 0}
            shape="circle"
            size="sm"
            placement="top-right"
            classNames={{ badge: 'border-2 border-background' }}
          >
            <Bell size={18} />
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <Card className="w-80 rounded-large bg-content1 shadow-none">
          <CardHeader className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
            <span className="text-base font-semibold text-default-700">
              Notifications
            </span>
            <div className="flex items-center gap-1">
              {permission === 'default' && (
                <Button
                  size="sm"
                  variant="flat"
                  color="warning"
                  onPress={requestPermission}
                  className="h-7 min-w-0 px-2.5 text-xs"
                >
                  Enable
                </Button>
              )}
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={() => markAllAsReadMutation.mutate()}
                  isLoading={markAllAsReadMutation.isPending}
                  startContent={
                    !markAllAsReadMutation.isPending && <Check size={14} />
                  }
                  className="h-7 min-w-0 px-2.5 text-xs"
                >
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>

          <Divider className="bg-default-100" />

          <CardBody className="p-0 overflow-hidden">
            {isLoading ? (
              <div className="h-40 flex items-center justify-center">
                <Spinner size="sm" color="primary" />
              </div>
            ) : !notifications?.data.length ? (
              <div className="h-56 flex flex-col items-center justify-center text-center px-4">
                <LottieAnimation
                  name="empty"
                  className="w-32 h-32 opacity-50"
                />
                <span className="text-sm font-medium text-default-500">
                  All caught up!
                </span>
              </div>
            ) : (
              <ScrollShadow className="max-h-[400px]">
                <div className="flex flex-col">
                  {notifications.data.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`flex items-start gap-3 border-b border-default-100 p-3.5 text-left outline-none transition-colors hover:bg-default-50 focus-visible:bg-default-100 ${
                        !notification.isRead
                          ? 'bg-[var(--app-selected-background)]'
                          : ''
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-medium ${
                          notification.type === 'success'
                            ? 'app-status-success bg-[var(--app-success-background)] text-[var(--app-success-foreground)] text-[var(--app-success)]'
                            : notification.type === 'error'
                              ? 'app-status-danger bg-[var(--app-danger-background)] text-[var(--app-danger-foreground)] text-[var(--app-danger)]'
                              : notification.type === 'warning'
                                ? 'app-status-warning bg-[var(--app-warning-background)] text-[var(--app-warning-foreground)] text-[var(--app-warning)]'
                                : 'bg-[var(--app-selected-background)] text-[var(--app-link)]'
                        }`}
                      >
                        {notification.link ? (
                          <ExternalLink size={15} />
                        ) : (
                          <Info size={15} />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`truncate text-sm font-medium ${
                              !notification.isRead
                                ? 'text-default-800'
                                : 'text-default-600'
                            }`}
                          >
                            {notification.title}
                          </span>
                          {!notification.isRead && (
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-default-500">
                          {notification.message}
                        </p>
                        <span className="mt-0.5 text-[11px] text-default-400">
                          {formatDistanceToNow(
                            new Date(notification.createdAt),
                            {
                              addSuffix: true,
                            },
                          )}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollShadow>
            )}
          </CardBody>

          <Divider className="bg-default-100" />

          <CardFooter className="justify-center py-2.5">
            <button
              type="button"
              className="text-xs font-medium text-[var(--app-link)] transition-colors hover:text-[var(--app-link-hover)] hover:underline"
              onClick={() => {
                setIsOpen(false)
                navigate({ to: '/notifications' } as any)
              }}
            >
              View All Notifications
            </button>
          </CardFooter>
        </Card>
      </PopoverContent>
    </Popover>
  )
}
