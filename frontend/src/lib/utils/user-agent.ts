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

export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'

  const browser = match(userAgent, BROWSERS)
  const platform = match(userAgent, PLATFORMS)

  if (browser && platform) return `${browser} on ${platform}`
  return browser || platform || 'Unknown device'
}

/** Phones and tablets get a different icon than desktops in the session list. */
export function isMobileUserAgent(userAgent: string | null): boolean {
  return !!userAgent && /Mobi|Android|iPhone|iPad|iPod/.test(userAgent)
}
