import { formatDistanceToNow, isValid } from 'date-fns'
import {
  parseBusinessDate,
  parseCalendarDate,
  timeZoneLabel,
} from './business-time'
import { displayTimeZone } from '@/lib/stores/time-zone'

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null
  const date = parseBusinessDate(value)
  return isValid(date) ? date : null
}

export const formatBytes = (bytes: number | null | undefined, decimals = 2) => {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k)),
  )
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Human phrasing for a timestamp glanced at rather than read precisely:
 * "2 days ago". Always pair it with `formatDateTime()` in a `title` so the
 * exact moment stays one hover away.
 */
export const formatRelativeTime = (
  value: string | Date | null | undefined,
): string => {
  const date = toDate(value)
  if (!date) return '—'
  return formatDistanceToNow(date, { addSuffix: true })
}

/** Exact, for tooltips and detail views: `3 August 2026, 14.05`. */
export const formatDateTime = (
  value: string | Date | null | undefined,
  timeZone = displayTimeZone(),
): string => {
  const date = toDate(value)
  if (!date) return '—'
  return (
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date) +
    ' ' +
    timeZoneLabel(timeZone)
  )
}

/** Absolute formatting uses zoned parts, so DST in the device zone cannot shift WIB. */
export function formatBusinessDate(
  value: string | number | Date,
  pattern: string,
  timeZone = displayTimeZone(),
): string {
  const calendar =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (calendar) timeZone = 'UTC'
  const instant =
    typeof value === 'number'
      ? new Date(value)
      : calendar
        ? parseCalendarDate(String(value))
        : parseBusinessDate(value)
  if (!isValid(instant)) return '—'
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const part = (key: string) =>
    parts.find((item) => item.type === key)?.value ?? ''
  const month = (width: 'short' | 'long') =>
    new Intl.DateTimeFormat('en-GB', { timeZone, month: width }).format(instant)
  const tokens: Record<string, string> = {
    yyyy: part('year'),
    MM: part('month'),
    MMM: month('short'),
    MMMM: month('long'),
    dd: part('day'),
    d: String(Number(part('day'))),
    HH: part('hour'),
    mm: part('minute'),
    ss: part('second'),
  }
  return pattern.replace(
    /yyyy|MMMM|MMM|MM|dd|d|HH|mm|ss/g,
    (token) => tokens[token],
  )
}
