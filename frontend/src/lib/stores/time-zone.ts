import { create } from 'zustand'
import { BUSINESS_TIME_ZONE } from '@/lib/utils/business-time'

export const useTimeZone = create<{
  timeZone: string
  setTimeZone: (timeZone: string) => void
}>((set) => ({
  timeZone: BUSINESS_TIME_ZONE,
  setTimeZone: (timeZone) => set({ timeZone }),
}))
export const displayTimeZone = () =>
  typeof window === 'undefined'
    ? BUSINESS_TIME_ZONE
    : useTimeZone.getState().timeZone
