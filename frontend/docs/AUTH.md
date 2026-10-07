# Authentication & Authorization

## Source of truth

The backend owns HttpOnly accessToken/refreshToken cookies. The browser sends cookies
with withCredentials; it does not decode the JWT or set an Authorization header.
/auth/me supplies identity, roles and permissions. auth.store is a reactive UI view.
Route guards validate that identity through the session Query before loaders run;
an authenticated flag cookie alone cannot grant access. Query cache is cleared on
login/logout, role switches and impersonation to prevent data crossing identities.
Unsafe requests carry X-CSRF-Token from the csrfToken cookie.

Concurrent 401 responses share one refresh attempt, including queued requests. A refresh
rejected with 401 or 403 (including invalid/missing CSRF) clears the authenticated flag and
preserves the original request's 401. The session read returns null so its route guard redirects
to `/login`. Network/server refresh failures retain the flag and propagate for retry. A direct
403 from `/auth/me` or a resource remains an authorization error, not a signed-out session.
The root route error boundary handles otherwise uncaught failures with access-denied or
load-failure copy; Try again invalidates the router to rerun guards and loaders.

## The auth store — `src/lib/stores/auth.store.ts`

State: `isAuthenticated`, `user`, `isLoading`, `error`.
Actions: `login(data, turnstileToken?)`, `loginWithGoogle(token)`, `logout()`,
`syncAuth()`, `clearError()`.
Selectors: `hasRole`, `hasPermission`, `hasAnyPermission`, `hasAllPermissions`.

> **Login actions do NOT navigate.** A store can't use the router. `login()` returns
> `{ success, error }`; the caller navigates. `useLogin` (`use-login.ts`) calls
> `navigate({ to: '/' })` on success for both email and Google flows.

`logout()` calls the service (which clears cookies and redirects to `/login`) then
`syncAuth()`. For **SSO sessions** (the session identity carries a `sid`), the service instead
redirects to `/api/v1/auth/sso/logout` so the IdP session is ended too (RP-initiated logout).

## Accessing auth in components

`useAuth()` (`src/hooks/use-auth.ts`) is a thin shim returning the store, so existing
call sites keep working:

```ts
const { isAuthenticated, user, login, logout, hasPermission } = useAuth()
```

Also in `use-auth.ts`:
- **`useProfile()`** — react-query hook for the full profile (`['profile']`,
  `enabled: isAuthenticated()`, 5-min stale time). The *server* truth about the user
  (with populated roles/permissions), alongside the flattened session identity.
- **`useAuthGuard({ isAuthPage?, redirectPath? })`** — redirects: logged-in users away
  from auth pages, logged-out users to `/login`.

## Permission model

Two layers, both checked against the user:

- **Data permissions** (`users.read`, `roles.create`, `media.delete`, …) gate actions.
- **Menu permissions** (`menu.users`, `menu.database`, …) gate sidebar visibility.

Two ways to check, depending on what data you have:

| Hook | Source | Use when |
|---|---|---|
| `useAuth().hasPermission(p)` | server session identity (`auth.store`) | quick check, no network |
| `useUserPermission().hasPermission(p)` (`use-permissions.ts`) | `useProfile()` data, falling back to session identity | UI check (backend remains authoritative) |

`useUserPermission` is what columns and the sidebar use — it reads the profile's
`permissions` and each role's `permissions`, falling back to session identity before the
profile loads.

```ts
const { hasPermission } = useUserPermission()
const columns = getColumns({ /* …, */ hasPermission })   // hide row actions by permission
onCreate: hasPermission('users.invite') ? openInvite : undefined
```

The sidebar (`useSidebarLogic` in `use-sidebar.ts`) filters `sidebarData` by both
`menuPermission` and `permission` before rendering.

## Login flow

1. `useLogin` builds the form (react-hook-form + Zod), wires Turnstile (if
   `VITE_TURNSTILE_SITE_KEY` set) and Google (if `VITE_GOOGLE_CLIENT_ID` set).
2. On submit → `auth.store.login()` → `auth.service.login()` sets the cookie → `syncAuth()`.
3. On success the hook navigates to `/` and toasts; on failure it resets Turnstile and
   toasts. A persisted `auth_error` in `sessionStorage` is surfaced on next mount.

**SSO login** is a plain full-page link, not a store action: the "Sign in with Stekom SSO"
button on the login page points at `<a href="/api/v1/auth/sso/login">`. The backend runs the
OIDC flow, sets the same session cookies, and redirects back into the SPA — `auth.store`
hydrates from `/api/v1/auth/me` on load, so no client-side token handling is needed.
Enabled when the backend has `SSO_ISSUER` configured.

**Silent login** (`useSilentSso`, `src/hooks/use-silent-sso.ts`) — when `VITE_SSO_SILENT=true`,
the login page redirects an unauthenticated visitor once to `/api/v1/auth/sso/silent`
(`prompt=none`). An active IdP session logs them straight in; otherwise the backend bounces
back and a one-shot `sso_silent` cookie keeps the login form from looping.

## Email verification gate

`<EmailVerificationGate/>` wraps app (non-auth) pages in `__root.tsx`. It uses
`useEmailVerificationStatus()` (`use-email-verification.ts`) to block unverified users and
offers resend (`use-resend-verification.ts`). Standalone verify/resend flows live under
`routes/(auth)/`.

## Two-factor authentication

Off by default. `use-two-factor.ts` drives the whole lifecycle from the profile page's
Security card: `startSetup` fetches the QR, `<TwoFactorModal/>` walks through scan → code →
recovery codes, and the same dialog handles turning it off or re-issuing codes. Every
state-changing step asks for a current code.

At sign-in, `login()` can come back with `twoFactorRequired` + `challengeToken` instead of a
session. `useLogin` holds that token in memory only and swaps the login page for a code step;
`verifyTwoFactor()` finishes the login. Cancelling drops the token and starts over.

## Signing in as another user

An administrator with `users.impersonate` can open a session as someone else from the users
table (`POST /auth/impersonate/:id`). The backend session carries their own id as `impersonatorId`,
which `/auth/me` surfaces, so `<ImpersonationBanner/>` can sit above the app and
`stopImpersonating()` hands the session back. The device session records who opened it, and
the admin sessions table marks it.

The backend refuses to impersonate yourself, to nest impersonations, or to impersonate a user
holding permissions the actor doesn't — otherwise "sign in as" would be a way to borrow a
superadmin's access.

## Device sessions

The backend tracks one row per signed-in device. `use-sessions.ts` exposes both views:

- `useMySessionsCard()` — the signed-in user's own devices, rendered by
  `<ProfileSessionsCard/>` in the Sessions section of `/profile`. The current device is flagged and can't be revoked
  there (that's what Sign out does); "Sign out others" ends every other one.
- `useSessionPage()` — the admin table at `/sessions`, gated by `sessions.read` /
  `sessions.delete`.

Both go through `lib/services/session.service.ts`; `lib/utils/user-agent.ts` turns the raw
User-Agent into a readable device label shared by the card and the table.

## Realtime auth

`<SocketBridge/>` connects the notifications socket **only while authenticated**
(subscribed to `auth.store`), using the backend session cookie in the socket handshake. On logout the
socket disconnects. See [Architecture](ARCHITECTURE.md#state-ownership).

## Active role

The backend scopes permissions to a valid active role plus direct grants. A multi-role user
without a chosen role receives no role-derived permissions. Use the backend role-switch
flow; clear Query cache and reload identity instead of combining all roles client-side.
Profile-derived UI checks cannot grant authority beyond the backend session.

Admin password and Google login use camelCase `twoFactorRequired`/`challengeToken`. A failed `/api/v1/auth/2fa/verify` returns to the code form without refreshing or redirecting, preserving the pending challenge.

## Turnstile lifecycle

Password login renders a default-width widget with action `admin-login` and the current
application theme. The hook and widget share a lifecycle contract: invalidate
readiness on expiry, challenge error, unsupported browser, theme change and unmount; reset
after every password attempt, including transition to 2FA. Script errors or a 15-second widget
loading timeout show a reload action; challenge failures offer verification retry.
No token is persisted. Production builds reject official test site keys. Backend activation,
hostname allowlists and 400/503 verification responses are in [backend Auth](../../backend/docs/AUTH.md).
Deploy frontend and backend together when enabling action validation.
