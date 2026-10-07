import type { PortalRecord } from '@/types/portal'
import { formatDateTime } from '@/lib/utils/format'

export const cell = (record: PortalRecord, key: string, type: string) => {
  const value = record[key]
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'datetime') return formatDateTime(String(value))
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
