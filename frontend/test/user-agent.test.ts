import { describe, expect, it } from 'vitest'
import {
  describeUserAgent,
  isMobileUserAgent,
  sessionAudienceLabel,
} from '@/lib/utils/user-agent'

describe('describeUserAgent', () => {
  it('names the native app and its device', () => {
    const ua = 'WasteWise-Mobile/1.0.0 (Android 14; Xiaomi 23078RKD5C)'
    expect(describeUserAgent(ua)).toBe('WasteWise app on Xiaomi 23078RKD5C')
    expect(isMobileUserAgent(ua)).toBe(true)
  })

  it('recognises older app builds', () => {
    expect(describeUserAgent('WasteWise-Mobile')).toBe('WasteWise app')
    expect(describeUserAgent('okhttp/4.12.0')).toBe('WasteWise app')
    expect(describeUserAgent('WasteWise/1.0.0')).toBe('WasteWise app')
    expect(
      describeUserAgent('Dalvik/2.1.0 (Linux; U; Android 14; 23078RKD5C)'),
    ).toBe('WasteWise app on Android')
  })

  it('keeps browser labels', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
      ),
    ).toBe('Chrome on Linux')
    expect(describeUserAgent(null)).toBe('Unknown device')
  })
})

describe('sessionAudienceLabel', () => {
  it('labels browser and mobile sessions', () => {
    expect(sessionAudienceLabel('admin')).toBe('Browser')
    expect(sessionAudienceLabel('mobile')).toBe('Mobile')
  })
})
