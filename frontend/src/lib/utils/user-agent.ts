/**
 * Turn a raw User-Agent header into something a person can recognise in the
 * session list ("Chrome on Windows"). Deliberately coarse — it only needs to
 * help someone spot a device that isn't theirs, not to fingerprint it.
 */
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg[eA]?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Chrome\//, 'Chrome'],
  [/Firefox\//, 'Firefox'],
  [/Safari\//, 'Safari'],
]

const PLATFORMS: Array<[RegExp, string]> = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
]

const match = (ua: string, table: Array<[RegExp, string]>) =>
  table.find(([pattern]) => pattern.test(ua))?.[1]

/** `WasteWise-Mobile/1.0.0 (Android 14; Xiaomi 23078RKD5C)` from the native app. */
const MOBILE_APP = /^WasteWise-Mobile(?:\/[\w.-]+)?(?:\s*\(([^)]*)\))?/

function describeMobileApp(userAgent: string): string | null {
  const app = MOBILE_APP.exec(userAgent)
  if (app) {
    const parts = (app[1] ?? '').split(';').map((part) => part.trim())
    const device = parts.find((part) => part && !/^Android\b/.test(part))
    if (device) return `WasteWise app on ${device}`
    return parts.some((part) => /^Android\b/.test(part))
      ? 'WasteWise app on Android'
      : 'WasteWise app'
  }
  // Older app builds sent the HTTP library's default agent.
  if (/^(okhttp|Dalvik)\//.test(userAgent)) {
    return /Android/.test(userAgent)
      ? 'WasteWise app on Android'
      : 'WasteWise app'
  }
  return null
}

export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'
  const mobileApp = describeMobileApp(userAgent)
  if (mobileApp) return mobileApp

  const browser = match(userAgent, BROWSERS)
  const platform = match(userAgent, PLATFORMS)

  if (browser && platform) return `${browser} on ${platform}`
  return browser || platform || 'Unknown device'
}

/** Phones and tablets get a different icon than desktops in the session list. */
export function isMobileUserAgent(userAgent: string | null): boolean {
  return (
    !!userAgent &&
    (/Mobi|Android|iPhone|iPad|iPod/.test(userAgent) ||
      describeMobileApp(userAgent) !== null)
  )
}

export type SessionAudience = 'admin' | 'mobile'

/** Admin UI label for a session audience: browser dashboard vs native app. */
export function sessionAudienceLabel(audience: SessionAudience): string {
  return audience === 'mobile' ? 'Mobile' : 'Browser'
}
