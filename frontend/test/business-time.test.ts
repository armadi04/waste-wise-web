import { describe, expect, it } from 'vitest'
import { businessDateInputToISO, parseBusinessDate, toBusinessDateInput } from '@/lib/utils/business-time'
import { formatBusinessDate } from '@/lib/utils/format'

describe('business timezone', () => {
  it('roundtrips a WIB edit with seconds and milliseconds', () => {
    const utc = '2026-10-18T16:59:42.123Z'
    expect(toBusinessDateInput(utc)).toBe('2026-10-18T23:59:42.123')
    expect(businessDateInputToISO(toBusinessDateInput(utc))).toBe(utc)
    expect(businessDateInputToISO('2026-10-19T00:01')).toBe('2026-10-18T17:01:00.000Z')
    expect(parseBusinessDate('2026-10-18T23:59:42.123+07:00').toISOString()).toBe(utc)
  })
  it('rejects invalid calendar dates and handles day rollover', () => {
    expect(() => businessDateInputToISO('2026-02-30T10:00')).toThrow()
    expect(toBusinessDateInput('invalid')).toBe('')
    expect(formatBusinessDate('2026-10-18T18:00:00Z', 'yyyy-MM-dd HH:mm:ss')).toBe('2026-10-19 01:00:00')
    expect(formatBusinessDate('2026-03-08T19:30:00Z', 'yyyy-MM-dd HH:mm')).toBe('2026-03-09 02:30')
    expect(formatBusinessDate('2026-10-19', 'd MMM yyyy')).toBe('19 Oct 2026')
  })
})
