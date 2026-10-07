import type { PortalRecord } from '@/types/portal'

export const records = (value: unknown): Array<PortalRecord> =>
  Array.isArray(value) ? value : []
