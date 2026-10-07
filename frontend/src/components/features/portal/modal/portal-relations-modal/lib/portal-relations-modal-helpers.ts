import type { PortalField } from '@/components/features/portal/lib/config'
import type { RelationKind } from '@/components/features/portal/modal/portal-relations-modal/types'
import type { PortalValue } from '@/types/portal'
import {
  businessDateInputToISO,
  parseBusinessDate,
} from '@/lib/utils/business-time'

export const labels: Record<RelationKind, { title: string; owner: string }> = {
  'event-tickets': { title: 'Event ticket options', owner: 'event' },
  'order-items': { title: 'Order items', owner: 'order' },
}

export const normalizeRelationData = (
  data: Record<string, PortalValue>,
  fields: Array<PortalField>,
) => {
  const result: Record<string, PortalValue> = {}
  for (const field of fields) {
    if (field.readOnly) continue
    if (
      data.localTimes &&
      typeof data.localTimes === 'object' &&
      !Array.isArray(data.localTimes) &&
      data.localTimes[field.key] !== undefined
    )
      continue
    const value = data[field.key]
    if (value === '' || value === undefined) {
      if (field.required) result[field.key] = value ?? ''
      continue
    }
    result[field.key] =
      field.type === 'number'
        ? Number(value)
        : field.type === 'datetime'
          ? Number.isFinite(parseBusinessDate(String(value)).getTime())
            ? String(value)
            : businessDateInputToISO(String(value))
          : value
  }
  for (const key of [
    'localTimes',
    'timeZoneChangeMode',
    'timeZoneChangeReason',
  ])
    if (data[key] !== undefined) result[key] = data[key]
  return result
}
