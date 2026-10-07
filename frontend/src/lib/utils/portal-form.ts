import type { PortalResourceConfig } from '@/components/features/portal/lib/config'
import type { PortalValue } from '@/types/portal'
import {
  businessDateInputToISO,
  parseBusinessDate,
} from '@/lib/utils/business-time'

export const normalizeFormData = (
  data: Record<string, PortalValue | undefined>,
  fields: PortalResourceConfig['fields'],
  mode: 'create' | 'update' = 'update',
) => {
  const result: Record<string, PortalValue> = {}
  for (const field of fields) {
    if (mode === 'create' && field.createDefault !== undefined) {
      result[field.key] = field.createDefault
      continue
    }
    if (field.readOnly && !(mode === 'create' && field.createWritable)) continue
    if (
      data.localTimes &&
      typeof data.localTimes === 'object' &&
      !Array.isArray(data.localTimes) &&
      data.localTimes[field.key] !== undefined
    )
      continue
    const value = data[field.key]
    if (value === undefined && mode === 'update') continue
    if (value === null && field.nullable) {
      result[field.key] = null
      continue
    }
    if (value === '' || value === undefined) {
      if (field.nullable) result[field.key] = null
      else if (field.required) result[field.key] = value ?? ''
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
  for (const key of ['images', 'packages']) {
    if (Array.isArray(data[key])) result[key] = data[key]
  }
  if (data.rules !== undefined) result.rules = data.rules
  for (const key of [
    'localTimes',
    'timeZoneChangeMode',
    'timeZoneChangeReason',
    'idempotencyKey',
    'userIds',
  ])
    if (data[key] !== undefined) result[key] = data[key]
  return result
}

function equalValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right))
    return (
      left.length === right.length &&
      left.every((value, index) => equalValue(value, right[index]))
    )
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const a = left as Record<string, unknown>
    const b = right as Record<string, unknown>
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every(
        (key) => Object.hasOwn(b, key) && equalValue(a[key], b[key]),
      )
    )
  }
  return false
}

export function changedFormData(
  data: Record<string, PortalValue>,
  original: Record<string, PortalValue>,
  fields: PortalResourceConfig['fields'],
) {
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => {
      if (
        fields.find((field) => field.key === key)?.type === 'datetime' &&
        value != null &&
        original[key] != null
      ) {
        return (
          parseBusinessDate(String(value)).getTime() !==
          parseBusinessDate(String(original[key])).getTime()
        )
      }
      return !equalValue(value, original[key])
    }),
  )
}

export function preparePortalMutation(
  data: Record<string, PortalValue | undefined>,
  config: PortalResourceConfig,
  mode: 'create' | 'update',
  original: Record<string, PortalValue | undefined> = {},
) {
  const normalized = normalizeFormData(data, config.fields, mode)
  return mode === 'update' && config.partialUpdate
    ? changedFormData(
        normalized,
        normalizeFormData(original, config.fields),
        config.fields,
      )
    : normalized
}
