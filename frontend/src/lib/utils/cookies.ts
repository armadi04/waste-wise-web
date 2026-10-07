import Cookies from 'js-cookie'

/**
 * Auth state is driven by two backend-set cookies:
 * - `access_token` — httpOnly, unreadable by JS (so XSS can't steal it); sent
 *   automatically on API requests. The backend authenticates browser sessions
 *   from it, so the SPA never handles the token directly.
 * - `authenticated` — a non-sensitive, JS-readable flag ("1") the backend sets
 *   alongside the token, so the SPA can synchronously tell it is logged in
 *   (route guards, initial render) without reading the token.
 *
 * Identity (roles/permissions) is loaded from `GET /auth/me`, never decoded
 * from the token client-side.
 */
const AUTH_FLAG = 'authenticated'

/** True when the backend-set authenticated flag is present. */
export function isAuthenticated(): boolean {
  return Cookies.get(AUTH_FLAG) === '1'
}

/**
 * Clear the client-visible auth flag. The httpOnly cookies are cleared by the
 * backend on logout; this just drops the local signal so guards react
 * immediately (e.g. when a refresh fails before the server responds).
 */
export function clearAuthFlag(): void {
  Cookies.remove(AUTH_FLAG, { path: '/' })
}
