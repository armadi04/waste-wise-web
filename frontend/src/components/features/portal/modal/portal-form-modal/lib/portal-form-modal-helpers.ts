import type { PortalField } from '@/components/features/portal/lib/config'
import type { PortalValue } from '@/types/portal'
import { toBusinessDateInput } from '@/lib/utils/business-time'
import { formatDateTime } from '@/lib/utils/format'

export const inputType = (field: PortalField) => {
  if (field.type === 'number') return 'number'
  if (field.type === 'datetime') return 'datetime-local'
  if (field.type === 'email') return 'email'
  return 'text'
}

export const inputValue = (
  field: PortalField,
  value: PortalValue | undefined,
  timeZone: string,
) => {
  if (value === null || value === undefined) return ''
  if (field.type === 'datetime') {
    return toBusinessDateInput(String(value), timeZone)
  }
  return typeof value === 'boolean' ? value : String(value)
}

export const displayValue = (
  field: PortalField,
  value: PortalValue | undefined,
  timeZone?: string,
) => {
  if (value === null || value === undefined || value === '') return '—'
  if (field.type === 'boolean') return value ? 'Yes' : 'No'
  if (field.type === 'datetime') return formatDateTime(String(value), timeZone)
  return typeof value === 'object'
    ? JSON.stringify(value, null, 2)
    : String(value)
}
