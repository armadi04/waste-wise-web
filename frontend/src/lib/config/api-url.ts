export const REST_API_BASE_PATH = '/api/v1'

/** Empty selects the existing same-origin proxy; configured values must be origins. */
export function normalizeApiOrigin(value: string | undefined): string {
  if (!value) return ''
  const message =
    'VITE_API_URL must be an HTTP(S) origin without credentials, path, query, or fragment (example: https://api.example.com)'
  if (
    !/^https?:\/\/[^/?#]+\/?$/i.test(value) ||
    value.includes('\\') ||
    value.trim() !== value
  ) {
    throw new Error(message)
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(message)
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(message)
  }
  return url.origin
}

/** Resource paths omit the API prefix. Both Axios and browser navigation use this builder. */
export function buildApiUrl(origin: string | undefined, resource = ''): string {
  if (
    resource &&
    (!resource.startsWith('/') ||
      resource.startsWith('//') ||
      /^\/api(?:[/?#]|$)/.test(resource))
  ) {
    throw new Error(
      'REST resource paths must start with / and omit the /api prefix',
    )
  }
  return `${normalizeApiOrigin(origin)}${REST_API_BASE_PATH}${resource}`
}
