# Admin operations

## Deployment

Admin stays a static SPA. Dockerfile builds `dist/` with Bun and serves it through Caddy
on port3000. Vite public environment must be available during the build, not only as runtime
environment on the Caddy runner. Never ship frontend secrets in the build context/bundle.

Build from the admin package directory with public values supplied by the deployment environment:

```bash
docker build -t kuponmalam-admin:local \
  --build-arg VITE_API_URL="${ADMIN_API_URL}" \
  --build-arg VITE_GOOGLE_CLIENT_ID="${ADMIN_GOOGLE_CLIENT_ID}" \
  --build-arg VITE_TURNSTILE_SITE_KEY="${ADMIN_TURNSTILE_SITE_KEY}" \
  --build-arg VITE_SSO_SILENT="${ADMIN_SSO_SILENT:-false}" .

docker run --rm -p 3001:3000 \
  -e BACKEND_URL="${ADMIN_BACKEND_URL}" \
  -e BACKEND_HOST="${ADMIN_BACKEND_HOST}" \
  kuponmalam-admin:local
```

Public build arguments default to empty, except silent SSO which defaults to `false`.
Local `.env` and `.env.*` files are excluded from the build context, except `.env.example`.
Set `ADMIN_API_URL` to the browser-reachable backend origin, or leave it empty when the
existing deployment edge routes API requests to the backend. Verify the socket origin
separately as described below. Runtime `ADMIN_BACKEND_URL` must be reachable from the
container and `ADMIN_BACKEND_HOST` must match the upstream host used by the sitemap proxy.
These runtime values do not change the API origin embedded in browser assets.

Production builds reject official Turnstile test site keys. Use real public site keys for
Turnstile-enabled images and rebuild when public configuration changes. Configure the matching
`TURNSTILE_SECRET` and `TURNSTILE_ALLOWED_HOSTNAMES` on the backend at runtime; never pass
secrets as frontend build arguments. Deploy compatible portal/admin/backend versions together
because password login and portal OTP use distinct required actions. See
[backend Auth](../../backend/docs/AUTH.md) for activation and explicit opt-out policy.

The current Caddyfile serves static assets, SPA fallback and a backend-proxied sitemap.
It does **not** implement `/api` or `/socket.io` proxy routes. Configure the deployment edge
explicitly to route those paths to the backend before the SPA fallback, or use a configured
absolute API/socket origin with valid CORS/cookies. Document and verify the actual edge setup;
do not assume the static container provides the Vite development proxy in production.

Fingerprint assets use immutable caching; index HTML is no-cache. The production PWA excludes
API/socket navigation fallback. Check old service worker behavior when diagnosing stale routes.
SPA deep links must return index HTML, while API/file/SSO paths must reach backend endpoints.

## Acceptance and rollback

Verify login/Google/OIDC, two-factor challenges, verified-email gate, role switches,
impersonation, protected deep links, URL table state, refresh/CSRF, upload/download,
notifications/socket reconnect and logout. Confirm Query cache does not cross identities.
Run lint/unit/build/browser CI before staging; mocked browser tests do not validate providers.

Monitor backend errors/401/403, refresh loops, failed asset requests and websocket connectivity.
Rollback the static image and its public configuration together. Coordinate backend rollback
only when contracts or migrations require it; frontend deployment alone does not change schema.

## Troubleshooting

| Symptom | Check |
|---|---|
| API returns HTML | Deployment edge let `/api` fall into SPA fallback; configure backend routing |
| Logged out after reload | Backend cookies, exact CORS origin, credentials, session validity |
| Login/refresh loop | Refresh CSRF and cookies, route guard/session response, SSO one-attempt flag |
| 403 or invisible menu | Backend permission/verification, active role, profile permissions and seeded menu keys |
| Stale data after account switch | Auth-transition Query cache reset; do not persist auth/server data |
| Missing Google/Turnstile UI | Correct public build configuration and matching provider/backend configuration |
| Socket fails | SocketBridge origin, cookie credentials, `/socket.io` edge route and upgrade support |
| Old UI after release | index cache headers, PWA update lifecycle and deployed asset availability |

Backend integrations and health diagnostics: [backend operations](../../backend/docs/OPERATIONS.md).
