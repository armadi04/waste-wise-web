export type PassKind = 'voucher' | 'ticket'

const PREFIX = 'KM1.'

/**
 * Reads the pass kind (`k` claim) from a customer QR token so a scan reaches the
 * right endpoint. Routing only: the backend verifies the signature and rejects a
 * forged or wrong-kind token, so an unreadable payload falls back to `fallback`.
 */
export function passTokenKind(token: string, fallback: PassKind): PassKind {
  const trimmed = token.trim()
  if (!trimmed.startsWith(PREFIX)) return fallback
  const payload = trimmed.slice(PREFIX.length).split('.')[1]
  if (!payload) return fallback
  try {
    const json = atob(
      payload
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(payload.length / 4) * 4, '='),
    )
    const claim = (JSON.parse(json) as { k?: unknown }).k
    return claim === 't' ? 'ticket' : claim === 'v' ? 'voucher' : fallback
  } catch {
    return fallback
  }
}
