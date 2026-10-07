import { describe, expect, it } from 'vitest'
import { formatBytes } from '@/lib/utils/format'

describe('media metadata formatting', () => {
  it('distinguishes unknown size from zero bytes and handles safe bigint bounds', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(0)).toBe('0 Bytes')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(Number.MAX_SAFE_INTEGER)).toBe('8 PB')
  })
})
