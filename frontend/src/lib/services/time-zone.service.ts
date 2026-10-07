import { z } from 'zod'
import { isTimeZone } from '@/lib/utils/business-time'
import { apiGet, apiPatch, apiPost } from '@/lib/api'

export const preferenceSchema = z.object({
  timeZone: z.string().refine(isTimeZone).nullable(),
  lastDetectedTimeZone: z.string().refine(isTimeZone).nullable(),
})
export type TimeZonePreference = z.infer<typeof preferenceSchema>
export const timeZonePreferenceOptions = (identity?: number) => ({
  queryKey: ['time-zone-preference', identity] as const,
  enabled: Boolean(identity),
  queryFn: () =>
    apiGet<TimeZonePreference>('/api/time-zone/preferences').then((data) =>
      preferenceSchema.parse(data),
    ),
  staleTime: 30_000,
})
export const updateTimeZonePreference = (data: Partial<TimeZonePreference>) =>
  apiPatch<TimeZonePreference>('/api/time-zone/preferences', data).then(
    (value) => preferenceSchema.parse(value),
  )

export const previewLocalTime = (localDateTime: string, timeZone: string) =>
  apiPost<{ instant: string; localDateTime: string; timeZone: string }>(
    '/api/time-zone/preview',
    { localDateTime, timeZone },
  )

export const timeZoneConfigOptions = () => ({
  queryKey: ['time-zone-config'] as const,
  queryFn: () =>
    apiGet<{ defaultTimeZone: string; businessTimeZones: Array<string> }>(
      '/api/time-zone/config',
    ),
  staleTime: 300_000,
})
