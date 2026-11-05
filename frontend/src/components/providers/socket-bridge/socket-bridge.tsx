import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { io } from 'socket.io-client'
import type { Notification as NotificationEntity } from '@/types/api'
import { normalizeApiOrigin } from '@/lib/config/api-url'
import { addToast } from '@/components/shared/controls/toast'
import {
  clearCachesAndReload,
  getAppliedRefreshAt,
  setAppliedRefreshAt,
} from '@/lib/utils/pwa'
import { useSocketStore } from '@/lib/stores/socket.store'
import { useAuthStore } from '@/lib/stores/auth.store'

/**
 * Runs the notifications socket lifecycle and writes connection state into
 * {@link useSocketStore}. Renders nothing — mount once under the router (it
 * needs `useNavigate`). Connects only while authenticated.
 */
export function SocketBridge() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Ask for browser notification permission once.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        void Notification.requestPermission()
      }
    }
  }, [])

  useEffect(() => {
    const { setSocket, setConnected } = useSocketStore.getState()

    if (!isAuthenticated) {
      const existing = useSocketStore.getState().socket
      if (existing) {
        existing.disconnect()
        setSocket(null)
        setConnected(false)
      }
      return
    }

    // The access token is httpOnly; authenticate the handshake via the cookie
    // (withCredentials) — the gateway reads access_token from the handshake
    // cookie. No token is available to JS to pass explicitly.
    const newSocket = io(
      `${normalizeApiOrigin(import.meta.env.VITE_API_URL) || 'http://localhost:3000'}/notifications`,
      { withCredentials: true },
    )

    newSocket.on('connect', () => setConnected(true))
    newSocket.on('disconnect', () => setConnected(false))

    // An operator pushed every client onto the new build. The gateway replays
    // the standing signal on each connect, so compare against the last one this
    // browser applied — otherwise a reconnect would reload the tab forever.
    newSocket.on('app_refresh', ({ issuedAt }: { issuedAt: string }) => {
      if (getAppliedRefreshAt() === issuedAt) return
      setAppliedRefreshAt(issuedAt)
      addToast({
        title: 'Updating to the latest version',
        description: 'The app is reloading.',
        color: 'warning',
      })
      void clearCachesAndReload()
    })

    newSocket.on('new_notification', (notification: NotificationEntity) => {
      const colorMap: Record<
        string,
        'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
      > = {
        info: 'primary',
        success: 'success',
        warning: 'warning',
        error: 'danger',
      }

      addToast({
        title: notification.title,
        description: notification.message,
        color: colorMap[notification.type] || 'primary',
      })

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        const n = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon_io/favicon.ico',
        })
        n.onclick = () => {
          window.focus()
          if (notification.link) void navigate({ to: notification.link })
          n.close()
        }
      }

      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [isAuthenticated, queryClient, navigate])

  return null
}
