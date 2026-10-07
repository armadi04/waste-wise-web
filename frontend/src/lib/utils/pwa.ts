/**
 * Last force-refresh signal this browser has already acted on.
 *
 * The server's signal is a timestamp, so remembering the applied one keeps a
 * reload idempotent: the same signal replayed on every socket reconnect must
 * not put the tab into a reload loop.
 */
const APPLIED_KEY = 'kuponmalam.refresh-applied-at'

export function getAppliedRefreshAt(): string | null {
  try {
    return localStorage.getItem(APPLIED_KEY)
  } catch {
    return null
  }
}

export function setAppliedRefreshAt(issuedAt: string): void {
  try {
    localStorage.setItem(APPLIED_KEY, issuedAt)
  } catch {
    // Storage unavailable (private mode / quota). Worst case the client
    // refreshes once more on the next reconnect.
  }
}

/**
 * Drop every service worker and cache, then hard-reload.
 *
 * `registerType: 'autoUpdate'` swaps the worker on the next reload, but a stale
 * precache can keep serving an old bundle until then — this is the escape
 * hatch, used both by the manual button in Settings and by the server-issued
 * force-refresh signal.
 */
export async function clearCachesAndReload(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
  }
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
  window.location.reload()
}
