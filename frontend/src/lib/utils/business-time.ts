export const BUSINESS_TIME_ZONE = 'Asia/Jakarta'
export const BUSINESS_TIME_ZONES = [
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
] as const
export const TIME_ZONE_LABELS: Record<string, string> = {
  'Asia/Jakarta': 'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Jayapura': 'WIT',
}
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 100) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}
export function detectBrowserTimeZone(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isTimeZone(zone) ? zone : null
  } catch {
    return null
  }
}
export function resolveTimeZone(
  explicit?: string | null,
  detected?: string | null,
): string {
  return isTimeZone(explicit)
    ? explicit
    : isTimeZone(detected)
      ? detected
      : BUSINESS_TIME_ZONE
}
export function timeZoneLabel(zone: string): string {
  return TIME_ZONE_LABELS[zone] ?? zone
}
export function isLocalDateTime(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value)
  )
    return false
  const date = new Date(`${value}Z`)
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().startsWith(value.replace(/\.\d+$/, ''))
  )
}
/** Absolute API timestamps require a zone. Calendar dates are a separate contract. */
export function parseBusinessDate(value: string | Date): Date {
  if (value instanceof Date) return new Date(value.getTime())
  if (typeof value !== 'string') return new Date(Number.NaN)
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:\d{2})$/i,
  )
  if (!match || !isLocalDateTime(match[1])) return new Date(Number.NaN)
  if (match[2].toUpperCase() !== 'Z') {
    const [hour, minute] = match[2].slice(1).split(':').map(Number)
    if (hour > 23 || minute > 59) return new Date(Number.NaN)
  }
  return new Date(value)
}
export function toBusinessDateInput(
  value: string | Date,
  timeZone = BUSINESS_TIME_ZONE,
): string {
  const date = parseBusinessDate(value)
  if (!Number.isFinite(date.getTime()) || !isTimeZone(timeZone)) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (key: string) => parts.find((p) => p.type === key)?.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}.${String(date.getUTCMilliseconds()).padStart(3, '0')}`
}
/** Client preview for Indonesian business zones; authoritative conversion is server-side. */
export function businessDateInputToISO(
  value: string,
  timeZone = BUSINESS_TIME_ZONE,
): string {
  if (timeZone === 'UTC' && isLocalDateTime(value))
    return new Date(`${value}Z`).toISOString()
  if (
    !isLocalDateTime(value) ||
    !(BUSINESS_TIME_ZONES as ReadonlyArray<string>).includes(timeZone)
  )
    throw new Error('Enter a valid local date and business timezone')
  const wall = new Date(`${value}Z`).getTime()
  const rendered = toBusinessDateInput(new Date(wall), timeZone)
  const offset = new Date(`${rendered}Z`).getTime() - wall
  return new Date(wall - offset).toISOString()
}

/** Internal rendering adapter only: a date-only value never inherits a display zone. */
export function parseCalendarDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    isLocalDateTime(`${value}T00:00:00`)
    ? new Date(`${value}T00:00:00Z`)
    : new Date(Number.NaN)
}
