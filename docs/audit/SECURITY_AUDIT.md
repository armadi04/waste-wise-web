# Security Audit

Method: static code review plus local execution of read-only checks. No exploit was run against a live system. "Verified" = traced in code or reproduced locally.

## [SEC-001] Google access-token login does not validate token audience

- Severity: High
- Category: Authentication / token substitution
- Affected component: NestJS API
- Location: `backend/src/auth/auth.service.ts:225-266`, `backend/src/auth/auth.controller.ts:296,330` (`POST /auth/google`, `POST /auth/mobile/google`)
- Evidence: any token starting with `ya29.` is sent to Google `userinfo`. A 200 response yields email and name, then `findOrCreateGoogleUser` matches by email. Nothing checks that the token was issued to this app's client ID (`aud`/`azp`). The web frontend uses `useGoogleLogin` (access-token flow), so the path is live.
- Attack scenario: a third-party app or site gets a Google access token with email scope from a victim, replays it to `/auth/mobile/google`, and receives a WasteWise session as the victim. This includes admin accounts matched by email. TOTP 2FA, if enabled, still blocks the session.
- Impact: Confidentiality, Integrity (account takeover).
- Recommendation: call `oauth2.googleapis.com/tokeninfo` (or `googleClient.getTokenInfo`) and require `aud`/`azp` in an allow-list of own client IDs, or switch web to the ID-token flow (`GoogleLogin` credential) and delete the access-token branch. Mobile already sends ID tokens.
- Effort: S
- Verification: unit test that a valid Google access token with a foreign `aud` is rejected; existing ID-token tests still pass.
- Confidence: High

## [SEC-002] Audience check silently disabled when GOOGLE_CLIENT_ID is unset

- Severity: Medium (High if unset in production)
- Category: Fail-open configuration
- Location: `backend/src/config/env.ts:98`, `backend/src/auth/auth.service.ts:80,174`
- Evidence: env schema marks `GOOGLE_CLIENT_ID` optional. `google-auth-library` skips the audience comparison when `audience` is undefined (`node_modules/google-auth-library/build/src/auth/oauth2client.js:775`).
- Attack scenario: production deployed without the variable; any Google-signed ID token for any app is accepted.
- Impact: Confidentiality, Integrity.
- Recommendation: if Google login is enabled, require the variable (superRefine); throw at startup, or reject login when it is empty.
- Effort: XS
- Verification: env test fails when Google login routes are enabled and the ID is empty; auth test rejects with no configured audience.
- Confidence: High

## [SEC-003] Report photos are public and enumerable

- Severity: Medium
- Category: Broken access control / privacy
- Location: `backend/src/media/entities/media.entity.ts:138` (`isPrivate` default false), `backend/src/media/media.controller.ts:143-165`, `media.service.ts` (URL = `/media/{id}/view`)
- Evidence: the upload API exposes no way to set `isPrivate`, so every upload is public. `GET /media/:id/view` is unauthenticated, redirects to a signed URL, and ids are sequential integers. The mobile app uses `mediaViewUrl` without an auth header.
- Attack scenario: unauthenticated loop over ids 1..N downloads every citizen's report photos.
- Impact: Confidentiality.
- Recommendation: default `isPrivate=true` for report media; serve through `/stream` with auth (mobile and web then need an authorized image fetch, or short-lived signed URLs returned inside the report payload). Migrate existing rows.
- Effort: M
- Verification: unauthenticated GET on a report photo returns 403/401; owner and admin can still load it in mobile and web.
- Confidence: High
- Blocker: mobile and web image loading changes.

## [SEC-004] ML service has no authentication or in-repo network isolation

- Severity: Medium (exposure unverified)
- Category: Trust boundary
- Location: `waste-wise-ml/src/waste_ml/api/routes.py`, `Dockerfile` (`EXPOSE 8000`, `--host 0.0.0.0`), `backend/src/reports/classification.service.ts:55`
- Evidence: `/api/v1/predict`, `/model/info`, `/docs` are open. The backend sends no credential. No compose, network policy or reverse-proxy config exists in any repo. Backend README says "internal", but nothing enforces it.
- Impact: Availability (CPU/memory abuse), free inference.
- Recommendation: private network only, and a shared-secret header checked by FastAPI (`X-Internal-Token`); disable `/docs` in production.
- Effort: S
- Verification: request without token returns 401; confirm port is not published on the public host.
- Confidence: Medium (deployment not seen)

## [SEC-005] ML image decoding has no pixel cap; decompression-bomb error returns 500

- Severity: Medium
- Category: Resource exhaustion
- Location: `waste-wise-ml/src/waste_ml/preprocessing.py:25-40`, `api/routes.py`
- Evidence (reproduced locally): a 78 KB 9000x9000 grayscale PNG decoded successfully with peak RSS 1051 MB (process includes TensorFlow import, so baseline is part of that). A 20000x10000 PNG (194 KB) raises `PIL.Image.DecompressionBombError`, which `load_image` does not catch (it catches `UnidentifiedImageError, OSError, ValueError`), so the response is 500 and the backend maps it to `ML_UNAVAILABLE`. Decoding is not serialized (only `model.predict` is locked), and the threadpool allows parallel decodes.
- Attack scenario: any signed-in user (Google auto-registration) uploads such a PNG as a report photo (backend checks only bytes and mime, 5 MB), backend forwards it to ML. Repeated requests exhaust memory and the container is OOM-killed.
- Impact: Availability of classification.
- Recommendation: set `Image.MAX_IMAGE_PIXELS` to about 25 MP, catch `DecompressionBombError`/`DecompressionBombWarning` as 400, use `Image.draft`/`thumbnail` before `load`, add a decode semaphore, set container memory limit. Also reject oversized dimensions in the backend upload pipe for report images.
- Effort: S
- Verification: tests that 200 MP and 81 MP inputs return 400 quickly without large RSS.
- Confidence: High

## [SEC-006] WebSocket gateway skips revocation and active-user checks

- Severity: Medium
- Location: `backend/src/notifications/notifications.gateway.ts:30-90`
- Evidence: gateway only runs `jwtService.verifyAsync`. `JwtStrategy.validate` additionally checks blacklist, session active, user active. CORS is hardcoded `origin: '*'` instead of `ALLOWED_ORIGINS`. Session cookies are SameSite=Strict, which limits cross-site hijacking.
- Impact: a logged-out, revoked or deactivated user keeps receiving live notifications until disconnect or token expiry.
- Recommendation: reuse the strategy checks in `handleConnection`; use the configured origin list.
- Effort: S
- Verification: test that a blacklisted token or revoked session is disconnected.
- Confidence: High

## Low findings

- **[SEC-007]** JWT accepted from `?token=` on every route (`jwt.strategy.ts:34-38`). Tokens leak into proxy logs and Referer. Restrict to the specific routes that need it, or remove.
- **[SEC-008]** `secretOrKey: JWT_SECRET || 'secretKey'` (`jwt.strategy.ts:41`). Unreachable now (env min 16) but fail-open; remove the fallback.
- **[SEC-009]** Default `MEDIA_ALLOWED_MIME_TYPES` includes pdf, zip, mp4, audio. For a photo-report app, any account can host files under a public URL. Restrict the report upload path to jpeg/png/webp; no malware scan exists (documented).
- **[SEC-010]** `app.config.ts` sets `usesCleartextTraffic` true for non-production profiles; `build:apk` uses `preview`. `EXPO_PUBLIC_API_URL` is not checked for https. Enforce https in preview/production builds.
- **[SEC-011]** Containers run as root (backend, ML, Caddy), images unpinned by digest, no HEALTHCHECK; throttler uses in-memory storage (per-instance); cookie `secure` only when `NODE_ENV=production` (staging gets insecure cookies).
- Also: no media garbage collection for uploads never attached to a report (`media-cleanup.service.ts` handles pending/deleted only). Potential storage-abuse vector, low (30 uploads/min/IP).

## Controls verified as good

Report ownership checks (`reports.service.ts:421-445`), server-only ML values, status state machine, SameSite=Strict + double-submit CSRF, bcrypt, login lockout, Turnstile, Swagger disabled in production, magic-byte upload validation, credentialed CORS only with explicit origin list, query string redacted in request logs, no tracked `.env`, no secret-pattern hits.
