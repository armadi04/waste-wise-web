import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/auth/use-auth'
import {
  timeZoneConfigOptions,
  timeZonePreferenceOptions,
  updateTimeZonePreference,
} from '@/lib/services/time-zone.service'
import { useTimeZone } from '@/lib/stores/time-zone'
import {
  detectBrowserTimeZone,
  resolveTimeZone,
} from '@/lib/utils/business-time'

export function useTimeZoneSynchronization() {
  const auth = useAuth()
  const identity = auth.isAuthenticated ? auth.user?.sub : undefined
  const client = useQueryClient()
  const config = useQuery({
    ...timeZoneConfigOptions(),
    enabled: typeof window !== 'undefined',
  })
  const [detected, setDetected] = useState<string | null>(null)
  const reported = useRef('')
  const query = useQuery({
    ...timeZonePreferenceOptions(identity),
    enabled: Boolean(identity),
  })
  const timeZone = useTimeZone((s) => s.timeZone)
  useEffect(() => {
    const detect = () => setDetected(detectBrowserTimeZone())
    detect()
    window.addEventListener('focus', detect)
    return () => window.removeEventListener('focus', detect)
  }, [])
  useEffect(() => {
    useTimeZone
      .getState()
      .setTimeZone(
        resolveTimeZone(
          identity ? query.data?.timeZone : null,
          detected ?? config.data?.defaultTimeZone,
        ),
      )
  }, [identity, query.data?.timeZone, detected, config.data?.defaultTimeZone])
  useEffect(() => {
    if (
      !identity ||
      !detected ||
      !query.data ||
      query.data.lastDetectedTimeZone === detected
    )
      return
    const key = `${identity}:${detected}`
    if (reported.current === key) return
    reported.current = key
    void updateTimeZonePreference({ lastDetectedTimeZone: detected })
      .then(() =>
        client.invalidateQueries({
          queryKey: timeZonePreferenceOptions(identity).queryKey,
        }),
      )
      .catch(() => {
        reported.current = ''
      })
  }, [identity, detected, query.data, client])
  return timeZone
}
