import { useCallback, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Drives manual control over the PWA service worker.
 *
 * `registerType: 'autoUpdate'` swaps the worker on the next reload, but a stale
 * precache can keep serving an old bundle until then. This exposes:
 * - `checkForUpdate` — ping the SW to fetch a fresh worker (flips `updateAvailable`).
 * - `applyUpdate`     — activate the waiting worker and reload.
 */
export const usePwaUpdate = () => {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(
    undefined,
  )
  const [isChecking, setIsChecking] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const {
    needRefresh: [updateAvailable],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration
    },
  })

  const checkForUpdate = useCallback(async (): Promise<
    'found' | 'none' | 'unavailable'
  > => {
    const reg = registrationRef.current
    if (!reg) return 'unavailable' // no active service worker (e.g. dev mode)
    setIsChecking(true)
    try {
      await reg.update()
      // A pending worker (waiting/installing) means a new version is ready.
      return reg.waiting || reg.installing ? 'found' : 'none'
    } finally {
      setIsChecking(false)
    }
  }, [])

  /** Activate the waiting worker; `updateServiceWorker(true)` reloads the page. */
  const applyUpdate = useCallback(async () => {
    setIsUpdating(true)
    await updateServiceWorker(true)
  }, [updateServiceWorker])

  return {
    updateAvailable,
    isChecking,
    isUpdating,
    checkForUpdate,
    applyUpdate,
  }
}
