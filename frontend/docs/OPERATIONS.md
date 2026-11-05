# Frontend operations

## Deployment

The Dockerfile builds the SPA with Bun and serves `dist/` through Caddy on container port 3000.
Public Vite values must be supplied at build time; backend secrets never enter browser assets.

```bash
docker build -t nestplate-frontend \
  --build-arg VITE_API_URL="" \
  --build-arg VITE_GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
  --build-arg VITE_TURNSTILE_SITE_KEY="${TURNSTILE_SITE_KEY}" .

docker run --rm -p 3001:3000 \
  -e BACKEND_URL=http://backend:3000 \
  --network your-app-network nestplate-frontend
```

`BACKEND_URL` must resolve from the frontend container. Default is `http://backend:3000`.
Keep browser API URL empty for same-origin deployment. Use HTTPS at the deployment edge.
Absolute backend origins require matching CORS/cookie configuration.

Caddy routes `/api`, `/api/*`, `/socket.io`, `/socket.io/*`, and `/graphql` to the backend.
The `/api/*` matcher includes Swagger `/api/docs`, its assets, and OpenAPI documents
before SPA fallback. Socket upgrades are handled by reverse_proxy. It preserves request paths.
Fingerprint assets are immutable; index HTML is no-cache. Deep links return index HTML.
The production service worker excludes API/Swagger/socket/GraphQL navigation fallback; dev workers
are disabled. Update public values by rebuilding, runtime target by updating BACKEND_URL.

## Acceptance and rollback

Run lint/unit/build, then validate deployment login, verified-email gate, role switching,
protected deep links, refresh/CSRF, media and notification sockets. Browser E2E is opt-in.
Real providers need deployment acceptance independent of mocked browser fixtures.
Rollback static image and its build configuration together; coordinate backend contracts.

## Troubleshooting

| Symptom                         | Check                                                             |
| ------------------------------- | ----------------------------------------------------------------- |
| API returns HTML                | Caddy backend matcher, path and service-worker version            |
| Backend returns 502             | BACKEND_URL, container network and backend health                 |
| Logged out after reload         | Session cookies, exact origin, HTTPS and backend validity         |
| Refresh loop                    | CSRF/cookie match, auth guard response                            |
| Invisible menu or 403           | Active role, verified email, API and menu permissions             |
| Stale data after account switch | Query cache reset; do not persist auth/server lists               |
| Missing Google/CAPTCHA          | Public build values and matching backend provider config          |
| Socket fails                    | Same-origin proxy, credentials and websocket-capable edge routing |
| Old UI after release            | index cache headers, PWA update and available fingerprint assets  |

Integration diagnostics: [backend operations](../../backend/docs/OPERATIONS.md).

REST consumers use `/api/v1/*`, including health. Existing `/api/*` proxy
matching covers these paths without rewriting. `VITE_API_URL` is an origin only;
never append `/api/v1` there because the shared URL builder adds it. Rebuild the
frontend alongside the backend migration. External probe and IdP changes are listed
in [backend operations](../../backend/docs/OPERATIONS.md#deploying-rest-uri-version-1).

`VITE_API_URL` is validated during Vite startup/build and client initialization.
Only empty (same-origin) or an HTTP(S) origin is accepted. A root trailing slash is
normalized; credentials, other paths, query strings and fragments are rejected.
REST services pass resource paths such as `/users`; the shared builder supplies
`/api/v1` once. Socket navigation uses the normalized origin without the REST prefix.
For deployment integration evidence, follow the backend
[staging acceptance procedure](../../backend/docs/OPERATIONS.md#staging-acceptance-procedure).
