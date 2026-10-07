/**
 * Remembers the role a user last chose to act as, so a returning multi-role
 * user is put back into that role without re-picking. Scoped per user id — the
 * session (via `GET /auth/me`) remains the source of truth for the *current*
 * active role; this is only the "last choice" hint used by the selection gate.
 */

const keyFor = (userSub: number) => `kuponmalam.active-role.${userSub}`

export function rememberActiveRole(userSub: number, role: string): void {
  try {
    localStorage.setItem(keyFor(userSub), role)
  } catch {
    // Storage unavailable (private mode / quota) — remembering is best-effort.
  }
}

export function getRememberedActiveRole(userSub: number): string | null {
  try {
    return localStorage.getItem(keyFor(userSub))
  } catch {
    return null
  }
}
