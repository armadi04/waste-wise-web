import { useCallback, useState } from 'react'

export type BrowserNotificationPermission =
  'granted' | 'denied' | 'default' | 'unsupported'

const getPermission = (): BrowserNotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window))
    return 'unsupported'
  return Notification.permission
}

/** Reads the current browser notification permission and exposes a permission request function. */
export const useBrowserNotification = () => {
  const [permission, setPermission] =
    useState<BrowserNotificationPermission>(getPermission)

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
  }, [])

  return { permission, requestPermission }
}
