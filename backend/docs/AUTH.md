# Authentication & Authorization

How identity and permissions work: the token model, the auth endpoints, the strategies, the
guard chain, the RBAC model, the email-verification gate, and CSRF. For how guards are wired
onto a route, see [Architecture](ARCHITECTURE.md#bootstrap-and-request-lifecycle).

## Token flow

Browser sessions use HttpOnly `accessToken` and `refreshToken` cookies. The readable
`authenticated` flag is a UI hint, never proof of authorization. The readable `csrfToken`
is echoed as `X-CSRF-Token` on protected mutations. Cookies are Secure in production;
access/refresh/flag use SameSite strict and CSRF uses lax. Existing login responses may
include accessToken for non-browser clients; the browser application does not
store or decode that token.

Session lifetimes follow OWASP idle + absolute timeouts, per session `audience`
(`src/sessions/session-policy.ts`):

| Audience | Opened by | Access JWT | Idle (max gap between refreshes) | Absolute (since login) |
|---|---|---|---|---|
| `admin` | dashboard password/Google/2FA, impersonation | 15 min | 2 h (`SESSION_ADMIN_IDLE_MINUTES`) | 8 h (`SESSION_ADMIN_ABSOLUTE_HOURS`) |
| `mobile` | native app `/auth/mobile/*` sign-in | 15 min | same as `admin` | same as `admin` |

The admin UI labels `admin` sessions as "Browser" and `mobile` sessions as "Mobile". The
mobile app sends `User-Agent: WasteWise-Mobile/<version> (Android <release>; <brand> <model>)`.
Sessions opened before the `mobile` audience existed stay `admin` until they expire.

The `user_sessions` row is authoritative: `expiresAt` is the idle deadline, slid by each
refresh but never past `absoluteExpiresAt`; refresh and every request are refused once either
passes. Refresh JWTs expire after the idle window and session cookies after the absolute
deadline. Clients refresh on 401, so the short access TTL is transparent; after the absolute
limit users sign in again. The starter
baseline includes session deadlines; no legacy audience backfill is needed.

Access tokens carry `tokenType: 'user'` and refresh tokens `tokenType: 'refresh'`. The JWT
strategy and the notification socket reject refresh and two-factor challenge tokens;
`/auth/refresh` accepts only refresh tokens (untyped tokens minted before typing stay
accepted until they expire, at most seven days after deploy). Refresh also renews the CSRF
cookie with its current value so writes keep working for the whole session.

User tokens carry identity, `roles`/`activeRole` and session ids but no permission list: the
JWT strategy reloads permissions from the database on every request. Keep claims small —
browsers silently drop cookies over ~4 KB, and a superadmin token that listed every permission
did exactly that, bouncing every login back to the sign-in page.

Login/Google/2FA issue backend cookies after their provider/credential checks. Refresh
rotates tokens/cookies: the used refresh token is blacklisted with reason `rotated`. It stays
spendable for 30 seconds (`REFRESH_REUSE_GRACE_MS`) so tabs refreshing together don't sign
each other out; a rotated token presented after that window is treated as stolen — its device
session is revoked and `auth.refresh_reuse` is audited. Tokens revoked at logout carry reason
`logout`. Logout revokes the device session, blacklists the token and clears
session cookies.

The reusable login-code mail helper queues messages with `redactAfterSend` and a 10-minute `expiresAt`: the outbox
clears their body once delivery succeeds or gives up, drops a code that expired while queued,
and logs row ids instead of recipient addresses. Starter login uses passwords/Google,
TOTP; the helper is not a public email-OTP login endpoint.

Request logs carry method, path (no query string) and status — never
headers or cookies. Set `TRUST_PROXY` to verified proxy addresses/subnets when the API sits
behind Caddy or another proxy so throttling and sessions see client IPs. Browser identity
is read through `/api/v1/auth/me`. Mobile clients may use explicit Bearer authorization.

## Endpoints

All under `/api/v1/auth`. Tighter throttles protect the credential routes.

| Method & path | Guard | Throttle | Purpose |
|---------------|-------|----------|---------|
| `POST /login` | — | 10/min | Email+password (+ Turnstile); sets cookies, returns `accessToken` — or a two-factor challenge |
| `POST /google` | — | 10/min | Google sign-in (id-token or `ya29.` access-token) |
| `POST /2fa/verify` | — | 5/min | Spend a challenge token + code; finishes the login |
| `POST /mobile/google` | — | 10/min | Native app Google sign-in; opens a `mobile` session and returns `accessToken`, `refreshToken`, `sessionExpiresAt` in the body (no cookies) — or a two-factor challenge |
| `POST /mobile/2fa/verify` | — | 5/min | Spend a mobile challenge token + code; returns the mobile session tokens |
| `POST /mobile/refresh` | — (refresh token in body) | 20/min | Rotate the refresh token; returns new `accessToken`, `refreshToken`, `sessionExpiresAt` |
| `POST /mobile/logout` | — (refresh token in body; optional Bearer access token is blacklisted) | 20/min | Revoke the mobile device session |
| `GET /2fa` | `AuthGuard('jwt')` | default | Whether it's on, and recovery codes left |
| `POST /2fa/setup` | `AuthGuard('jwt')` | 5/min | Start enrollment: secret, otpauth URL, QR data URL |
| `POST /2fa/enable` | `AuthGuard('jwt')` | 5/min | Confirm with a code; returns the recovery codes |
| `POST /2fa/disable` | `AuthGuard('jwt')` | 5/min | Turn it off (needs a valid code) |
| `POST /2fa/recovery-codes` | `AuthGuard('jwt')` | 5/min | Replace the recovery codes (needs a valid code) |
| `POST /impersonate/:id` | `users.impersonate` | default | Open a session as another user |
| `POST /stop-impersonating` | `AuthGuard('jwt')` | default | Return to your own account |
| `POST /refresh` | CSRF middleware | default | New access token from the refresh cookie |
| `POST /logout` | `AuthGuard('jwt')` + CSRF | default | Blacklist token, revoke the device session, clear cookies |
| `POST /forgot-password` | — | 5/min | Email a reset link |
| `POST /reset-password` | — | 5/min | Set a new password from a reset token |
| `POST /resend-verification` | — | 3/min | Re-send the verification email |
| `GET /verify-email?token=` | — | default | Mark the email verified |
| `GET /me` | `AuthGuard('jwt')` | default | Flattened current session identity |
| `POST /switch-role` | `AuthGuard('jwt')` + CSRF | default | Scope the session to a held role |
| `GET /profile` | `AuthGuard('jwt')` | default | Current user (serialized, password excluded) |

## Strategies & providers

- **`JwtStrategy`** (`src/auth/jwt.strategy.ts`) accepts Bearer, then accessToken cookie,
  then a legacy query token extractor. Browser clients use cookies; do not introduce new
  token-in-URL flows. It rejects blacklisted tokens, two-factor challenges
  and inactive device sessions, then reloads identity/permissions from the database.
  Returned identity includes userId/email/roles/permissions/emailVerified and optional
  activeRole, sessionId and impersonatorId. `/auth/me` exposes the controller projection.

- **Google** — `AuthController.googleLogin` branches on the token: a `ya29.`-prefixed value
  is validated as a Google *access token*, anything else as an *id token*
  (`google-auth-library`). Requires `GOOGLE_CLIENT_ID`.
- **Turnstile** — `TurnstileService.verify` checks the Cloudflare CAPTCHA before login.
  Uses `TURNSTILE_SECRET` (`TURNSTILE_SECRET_KEY` is a legacy fallback).
  Required by default in staging/production; local development activates when a secret is set.
  `TURNSTILE_ENABLED=false` is an explicit opt-out. Startup rejects deployed test secrets and
  requires `TURNSTILE_ALLOWED_HOSTNAMES` when enabled in staging/production.
   Password login requires action `admin-login`.
  Real tokens must match the expected action and configured hostname allowlist. Official dummy
  secrets are allowed locally and skip dummy origin/action metadata checks only.
  Invalid/expired/replayed challenges answer 400; provider/network/secret errors answer 503.
  Structured `turnstile.verification` logs include outcome, action and safe failure category,
  never tokens, secret keys or raw provider responses. Group these events for verified/rejected/
  unavailable counts; alert on unavailable spikes and track `expired-or-duplicate` failures.
   Google login and TOTP code verification do not require Turnstile. Deploy the updated frontend
  builds with the backend: earlier widgets do not send the required action.
- **JWT config** — `AuthModule` registers `JwtModule` with `JWT_SECRET` and
  `signOptions: { expiresIn: '60m' }`.

## The guard chain

Four guards, composed per route. `JwtAuthGuard` authenticates; the others authorize.

```ts
@UseGuards(JwtAuthGuard, PermissionsGuard)   // authenticate, then check a permission
@Permissions('roles.create')
```

| Guard | Reads | Allows when | Use for |
|-------|-------|-------------|---------|
| `JwtAuthGuard` | — | Valid JWT **and** verified email (unless `@AllowUnverified()`) | Every protected route |
| `PermissionsGuard` | `@Permissions(...)` | User holds **any** listed permission | Admin/resource actions |
| `RolesGuard` | `@Roles(...)` | User holds **any** listed role | Role-gated routes |
| `OwnerOrPermissionGuard` | `@Permissions(...)` + `:id` param | User owns the record (`:id === userId`) **OR** is `superadmin` **OR** holds a permission | Self-service + admin (e.g. update own profile) |

`PermissionsGuard` and `RolesGuard` return `true` when no metadata is set, so they're inert
on undecorated routes. If no guard reads `@Permissions`, the decorator has no effect — always
pair it with `PermissionsGuard` or `OwnerOrPermissionGuard`.

## RBAC model

- A **User** has a `@ManyToMany` to **Roles** and a separate `@ManyToMany` to **Permissions**
  (direct grants). A **Role** has a `@ManyToMany` to **Permissions**.
- **Effective permissions** are direct grants plus permissions of the valid active role,
  computed from the database on every request. A single-role user is scoped to that role.
  A multi-role user without a selected role gets no role-derived permissions or role claims.
  Use `/api/v1/auth/switch-role` to select a held role and issue a new session view.
- `superadmin` is special-cased in `OwnerOrPermissionGuard` and seeded with the full
  permission set.

### Grant ceiling

Routes that hand out access check the caller in services, so REST and GraphQL apply the
same rules (`GrantPolicyService`, `src/roles/grant-policy.service.ts`):

- **Only grant what you hold.** Roles added to a user or invitation, and permissions added to
  a user or role, must consist of permissions the caller holds. Only additions are checked,
  so a user or role may keep access the editor lacks.
- **Superadmin is superadmin-only.** Only a superadmin can grant the `superadmin` role,
  change, re-role or delete a superadmin account, or edit, rename or delete the role.
- **Access fields need manage_* permissions.** `roleIds` / `permissionIds` in `PATCH /users/:id`
  need `users.manage_roles` / `users.manage_permissions`. `permissions` in role create/update
  needs `roles.manage_permissions`.
- **Owners edit basic info only** (`UsersService.updateAs`). A non-superadmin editing their own
  account can't change their access fields, which are dropped, or their email (403). Login
  matches accounts by email, so a self-service change would let someone claim an address
  they don't own. An email changed by an administrator is marked unverified. An avatar id
  must be an upload by the caller or the target user.

> Every permission string is a member of the `PermissionType` union in
> `src/auth/permissions.type.ts`. **Add the string there first** — `@Permissions(...)` is
> typed against it, so an unknown key won't compile. Then add it to the seeder's
> `SEEDED_PERMISSIONS` so it exists in the DB.

Seeded catalogue (see `src/database/seeder/seeder.service.ts`): menu visibility
(`menu.dashboard`, `menu.users`, …), `users.*` (`invite/read/update/delete/manage_roles/manage_permissions`),
`roles.*`, `permissions.*`, and `media.*` (including `read_all` / `delete_all`).

## Email-verification gate

`JwtAuthGuard` rejects an authenticated-but-unverified user with a `403 Forbidden`
("Please verify your email address to continue."). A few routes must stay reachable before
verification — decorate them with `@AllowUnverified()`:

```ts
// src/auth/allow-unverified.decorator.ts
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
```

Use it sparingly — e.g. the profile fetch needed to render the "verify your email" screen,
or logout. Verification tokens live in `email_verification_tokens` (24h); registration emits
the email over SMTP (see [Operations](OPERATIONS.md#integration-diagnostics)).

## Supporting token entities

| Entity | Table | Lifetime | Purpose |
|--------|-------|----------|---------|
| `BlacklistedToken` | `blacklisted_tokens` | until access-token expiry | Invalidate a JWT on logout |
| `PasswordResetToken` | `password_reset_tokens` | ~30 min | One-time password reset |
| `EmailVerificationToken` | `email_verification_tokens` | 24 h | Email verification |
| `UserSession` | `user_sessions` | 2 h idle / 8 h absolute by default | Device sessions — see below |
| `TwoFactorRecoveryCode` | `two_factor_recovery_codes` | until used | Single-use 2FA backup codes |

## Audit trail

Security-relevant actions are recorded in `audit_logs` (`AuditModule`). Callers **emit**
`audit.record` rather than calling the service, so the write sits outside their transaction
and a failure in the trail can never break the action being recorded.

Recorded today: `auth.login`, `auth.login_failed`, `auth.logout`, `auth.locked`,
`auth.password_reset`, `2fa.enabled`, `2fa.disabled`, `user.impersonated`,
`user.impersonation_ended`, `session.revoked`, `user.roles_synced`,
`user.permissions_synced`, `user.access_updated` (roles/permissions set through
`PATCH /users/:id`), `user.deleted`.

Rows keep `actorEmail` alongside `actorId`: the account may later be renamed or deleted, and
the trail should still say who did it at the time. There is no update or delete path anywhere
in the module — an audit trail you can edit isn't one. Reading it needs `audit.read`
(`GET /api/v1/audit-logs`, plus `/actions` for the filter).

## Sign-in lockout

The global throttler caps requests per IP, which does nothing about an attacker rotating
addresses through one account's password space. So failures are also counted **per account**:
`users.failedLoginAttempts` rises on every wrong password *and* every wrong second-factor
code (both are guesses at the same account), and at 5 the account is locked for 15 minutes via
`users.lockedUntil`. Any successful sign-in clears both.

An unknown email address is never locked — that would turn the lockout into an oracle for
which addresses have accounts.

## Two-factor authentication (TOTP)

Off by default and opt-in per user. `TwoFactorService` (otplib) owns it.

**Enrollment.** `POST /2fa/setup` mints a secret and returns it three ways — raw,
as an `otpauth://` URI, and as a PNG data URL — so the SPA needs no QR library. The secret is
stored **encrypted** (AES-256-GCM, key derived from `JWT_SECRET` via scrypt) on
`users.twoFactorSecret`, but the factor isn't live until `POST /2fa/enable` proves the user
can produce a code. `users.twoFactorEnabledAt` is what login checks; null means off.

**Login.** With the factor on, a correct password no longer opens a session: `POST /login`
(and `POST /google`) return `{ twoFactorRequired: true, challengeToken }`. The challenge
is a 5-minute JWT with `tokenType: '2fa'` — the JWT strategy rejects it outright, so it
authenticates nothing and is spendable only at `POST /2fa/verify`, which then completes the
login exactly like a password one (device session + cookies).

**Replay protection.** Verification records the matched TOTP time step in
`users.twoFactorLastStep` and passes it back as otplib's `afterTimeStep`, so a code can't be
replayed inside the tolerance window it stays valid for.

**Recovery codes.** Ten single-use codes are issued at enrollment and stored bcrypt-hashed in
`two_factor_recovery_codes`. They're accepted anywhere a TOTP code is (login, disable,
re-issue) and are consumed on use — without them, a lost phone would mean a lost account.

## Signing in as another user

`POST /auth/impersonate/:id` (permission `users.impersonate`, which the superadmin role gets
with everything else) mints a session for the target user and stamps the administrator's own
id on the token as `impersonatorId`. `/auth/me` surfaces it, so the SPA can show a banner and
call `POST /auth/stop-impersonating` to swap back. Both routes end the caller's previous
device session and open a fresh one.

Three refusals keep it from being an escalation path: you can't impersonate yourself, you
can't nest impersonations, and you can't impersonate a user whose permissions you don't
already hold. The device session row records `impersonatedById`, so an impersonated session
is never mistaken for the user's own device.

## Device sessions

Every user login opens a row in `user_sessions` (`SessionsModule`) and puts its id in the JWT
as the `sessionId` claim — access **and** refresh tokens. The JWT strategy rejects a token
whose session is revoked or expired and bumps `lastActiveAt` (at most once a minute), and
`AuthService.refresh` slides the expiry forward, so a session is only as alive as its use.

That makes "sign out this device" real: revoking the row kills the access token immediately
instead of waiting out its TTL. Tokens minted before this existed carry no `sessionId` and
keep working until they expire.

Login records the request IP and User-Agent on the row so a user can recognise their devices.
| Method & path | Guard | Purpose |
|---------------|-------|---------|
| `GET /api/v1/sessions/me` | `AuthGuard('jwt')` | The caller's live sessions, with `isCurrent` |
| `DELETE /api/v1/sessions/me/:id` | `AuthGuard('jwt')` | Revoke one of the caller's own sessions |
| `POST /api/v1/sessions/me/revoke-others` | `AuthGuard('jwt')` | Sign out every other device |
| `GET /api/v1/sessions` | `sessions.read` | Paginated admin listing (searches user, IP, device) |
| `DELETE /api/v1/sessions/:id` | `sessions.delete` | Revoke anyone's session |

The self-service routes scope every lookup by `req.user.userId`, so they can never touch
another user's session — the admin routes are the only cross-user path, and they're gated by
`sessions.*` permissions.

## CSRF

The `refresh`, `logout` and `switch-role` routes are mutating and rely on cookies, so they are protected
by the global `SessionCsrfGuard` before throttling and the route's Passport guard. It requires the `csrfToken` cookie to
match the `X-CSRF-Token` request header (a double-submit check); a mismatch is a `403`. The
cookie is set non-httpOnly at login precisely so the SPA can echo it back in the header.
The check also applies to Bearer requests on these three routes. Cookies are parsed by
`@fastify/cookie`; no cookie signing secret was used by Express, so existing unsigned
cookies remain compatible and signing is not newly enabled. JWT signatures are unchanged.
Cookie lifetimes stay in milliseconds in session policy and convert to seconds only
when writing Fastify cookies. Names, paths, expiry deadlines and security flags are retained.

## Realtime & mail

- The **WebSocket gateway** authenticates the same JWT during the Socket.IO handshake — see
  [Architecture](ARCHITECTURE.md#events-and-integrations).
- **Verification / reset / invitation emails** are sent by `MailService` — see
  [Operations](OPERATIONS.md#integration-diagnostics).

## Permission sync

When adding a permission, synchronize all applicable definitions:

1. `backend/src/auth/permissions.type.ts`: closed PermissionType union.
2. `backend/src/database/seeder/seeder.service.ts`: permission data and role grants.
3. `frontend/src/lib/constants/sidebar.tsx`: MENU_PERMISSIONS for menu permissions.
4. The same sidebar file: sidebarData entries for visible navigation.

Re-seed only the intended non-production database when verifying new grants. Production
permission/data provisioning needs a controlled deployment process. A frontend permission
check does not override backend guards, ownership or active-role scoping.

## Account registration method

Users record their original creation method as `registerMethod`: `EMAIL_OTP`, `GOOGLE`,
`INVITATION`, `SEEDER`, or `UNKNOWN`. Google provisioning, invitation acceptance,
and new seeded identities supply this value internally. `EMAIL_OTP` remains
an enum value for extensions; starter has no email-OTP login route.
Later login, verification, or profile/password changes do not overwrite it.

`GET /api/v1/users` accepts `createdIn=today|7d|1m|3m` and `registerMethod` for both paginated
and unpaginated lists, combined with email/name search. Invalid values return 400.
Creation windows use server time and WIB (Asia/Jakarta): today begins at midnight;
7d begins six days ago; 1m/3m begin 30/90 days ago, ending at now.

The starter baseline includes the registration-method column. Login history is not
registration evidence; set the value only at account creation.


## Email identity and concurrent revocation

Live account email lookup is case-insensitive and newly saved email addresses are trimmed and
lowercase. The starter baseline enforces live uniqueness on `LOWER(email)` for active rows.

Refresh updates only activity and idle expiry with a `revokedAt IS NULL` condition. If a revoke
wins between the read and update, refresh returns no session and cannot revive it. Sign out
other devices updates only `revokedAt`, preserving concurrent activity fields.
Role/permission mutations invalidate backend users/roles caches and the corresponding admin
Query lists. Account creation and invitation acceptance invalidate the users cache through
`user.created`; role assignment also emits `user.roles_updated`.

Every newly issued refresh token carries a unique UUID `jti`, including rotations within the same second. Existing tokens without `jti` remain valid under the existing session and reuse policies.
