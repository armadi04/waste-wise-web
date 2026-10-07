import { apiPost } from '@/lib/api'

/**
 * Tell every connected client to drop its cache and reload onto the current
 * build. The backend stores the signal and the notifications gateway both
 * broadcasts it and replays it to clients as they reconnect.
 */
export const forceClientRefresh = () =>
  apiPost<{ issuedAt: string }>('/api/app/force-refresh')
