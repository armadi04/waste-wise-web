import type { PortalRecord } from '@/types/portal'

export const valueLabel = (value: PortalRecord[string]) => {
  if (value === null || value === undefined || value === '') return '—'
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
}
