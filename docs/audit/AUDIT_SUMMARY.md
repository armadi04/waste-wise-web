# WasteWise Audit Summary

Audit-only. No source was modified. Date: 2026-11-05. Scope: `waste-wise-web` (backend + admin frontend), sibling repos `waste-wise-apk` (Expo mobile), `waste-wise-ml` (FastAPI). CI/CD skipped at the user's request.

Companion documents: [SECURITY_AUDIT](SECURITY_AUDIT.md), [CODE_QUALITY_AUDIT](CODE_QUALITY_AUDIT.md), [INTEGRATION_AUDIT](INTEGRATION_AUDIT.md), [DEPENDENCY_AUDIT](DEPENDENCY_AUDIT.md), [TESTING_REPORT](TESTING_REPORT.md), [REMEDIATION_PLAN](REMEDIATION_PLAN.md).

## Overall assessment

Core report flow is sound. Ownership checks, server-side ML classification, status state machine, CSRF and cookie settings are good. Not ready for submission until the P0/P1 items below are fixed. Overall risk: **Medium-High**.

## Findings by severity (verified unless marked)

| ID | Sev | Area | Finding |
|---|---|---|---|
| SEC-001 | High | Backend auth | `ya29.` Google access-token login path never checks token audience (`auth.service.ts:225-266`, `auth.controller.ts:296,330`). |
| SEC-002 | Medium | Backend auth | `GOOGLE_CLIENT_ID` optional. When unset, google-auth-library skips the `aud` check (confirmed in `node_modules/.../oauth2client.js:775`). |
| SEC-003 | Medium | Backend media | Uploads default `isPrivate=false`; `/media/:id/view` is unauthenticated with sequential ids. Every report photo is publicly enumerable. |
| SEC-004 | Medium | ML | `/api/v1/predict` has no auth; binds 0.0.0.0. No network isolation artifact in any repo. Deployment exposure not verified. |
| SEC-005 | Medium | ML | No pixel cap. A 78 KB 9000x9000 PNG decoded to about 1 GB peak RSS (includes TF baseline). 200 MP image raises `DecompressionBombError`, which is uncaught, so a 500 instead of 400. Reachable by any signed-in user via report upload. |
| SEC-006 | Medium | Backend WS | Socket gateway checks JWT signature only. No blacklist, session-revoked or `isActive` check. `cors: '*'` hardcoded. |
| SEC-007 | Low | Backend | JWT accepted from `?token=` on all routes (`jwt.strategy.ts:34`). |
| SEC-008 | Low | Backend | Fallback `JWT_SECRET \|\| 'secretKey'` (`jwt.strategy.ts`). Unreachable today because env requires min 16 chars. |
| SEC-009 | Low | Backend | Default upload MIME list includes pdf, zip, mp4 and audio, which are publicly viewable via SEC-003. |
| SEC-010 | Low | Mobile | `preview` profile sets `usesCleartextTraffic: true`. `build:apk` uses preview. HTTPS is not enforced on the API URL. |
| SEC-011 | Low | Infra | Containers run as root; base images are not pinned by digest; no HEALTHCHECK. Throttler is in-memory. Cookie `secure` only when `NODE_ENV=production`. |
| INT-001 | Medium | Report flow | Classification runs inside `POST /reports`: up to 15 s image fetch plus 15 s predict. Mobile axios timeout is 30 s. No idempotency key, so a retry can create duplicate reports. |
| INT-002 | Low | Report flow | FAILED classifications are never retried. No re-classify action. |
| INT-003 | Low | Report flow | Backend accepts lat without lng (the CHECK passes on NULL) and no coordinates at all. Mobile requires both. |
| INT-004 | Low | Report flow | No status history table, audit events only. |
| INT-005 | Low | Report flow | Status update is read-then-write with no conditional update, so concurrent transitions can race (potential). |
| CQ-001 | Medium | Backend | `strict:false`, `noImplicitAny:false`. `tsc -p tsconfig.json` fails with 46 errors, all in `test/`. Build config is clean. |
| CQ-002 | Low | Backend/FE | `lint` and `check` scripts use `--fix`, so they mutate source and are unsuitable as gates. |
| CQ-003 | Low | All | Unused deps: backend `sharp` (carries high advisories), `passport-local`; frontend `@faker-js/faker`; mobile `@lottiefiles/dotlottie-react`. |
| CQ-004 | Low | Frontend | Several admin routes use `requireAuth` only, with no permission check. Backend still enforces; component-level gating not verified. |
| CQ-005 | Low | Mobile | 3 UI tests time out under parallel jest workers; pass serially. |
| DEP-001 | High | ML | Pillow 11.3.0 locked, with 93 OSV advisories (5 critical). `pyproject` caps `pillow<12`; fix needs 13.0.0, so the cap must be lifted. |
| DEP-002 | High | ML | Starlette 0.49.3, 10 advisories. Fixes are in 1.x; `fastapi<0.121` blocks it. |
| DEP-003 | High | Frontend | `xlsx` 0.18.5: prototype pollution and ReDoS, no fix on npm. Used only for export. |
| DEP-004 | High | Backend | `bun audit`: 52 advisories (1 critical `proxy-addr`, 27 high). Direct ones: `zod <4.6.6`, `sharp <0.35.4` (unused), `graphql-scalars`, `path-to-regexp`. |
| DEP-005 | Medium | Frontend | `bun audit`: 51 advisories (2 critical in `shell-quote` and `seroval`, mostly dev-tool chains). `zod` high. |
| DEP-006 | Low | Mobile | `bun audit`: 3 (2 moderate, 1 low), transitive dev/test. |

Total: 27 findings: 0 Critical, 5 High, 8 Medium, 14 Low (plus informational notes in the detail documents). Dependency items are rated by exposure, not raw advisory count.

## Top 10

1. SEC-001 Google access-token audience not validated
2. DEP-001 Pillow advisories, pinned by cap
3. SEC-005 ML memory exhaustion via crafted image
4. SEC-003 Public enumerable report photos
5. SEC-004 Unauthenticated ML service
6. SEC-002 Fail-open audience check when `GOOGLE_CLIENT_ID` is unset
7. INT-001 Timeout mismatch and duplicate reports
8. DEP-003 / DEP-004 Vulnerable `xlsx` / backend deps
9. SEC-006 WebSocket skips revocation checks
10. CQ-001 Non-strict TS with failing test typecheck

## Submission readiness

Not ready. Fix SEC-001, SEC-002, SEC-005, DEP-001 first, then SEC-003/SEC-004/INT-001.

## Positive controls observed

- Report ownership enforced server-side (`reports.service.ts` assertCanRead/Update/Delete).
- ML category and confidence set only by the backend; clients cannot forge them.
- Strict status transition map.
- SameSite=Strict cookies plus double-submit CSRF.
- Magic-byte MIME detection on uploads.
- Swagger off in production.
- Throttling on auth routes.
- Mobile tokens in SecureStore; refresh is de-duplicated.
- Mobile re-encodes images as JPEG (strips EXIF).
- No tracked `.env` files and no secret-pattern hits in tracked files.
