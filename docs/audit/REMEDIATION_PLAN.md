# Remediation Plan

Audit only; nothing implemented. Effort: XS < 1h, S < 0.5d, M ~1–2d, L > 2d.

## P0 — Critical (fix immediately)
None found at Critical severity. Treat P1 auth and ML items as first.

## P1 — High (before submission)

| ID | Service | Evidence | Fix | Effort | Regression risk | Verification | Blockers |
|---|---|---|---|---|---|---|---|
| SEC-001 | backend, web | `auth.service.ts:225` | Validate access-token `aud`/`azp` via tokeninfo, or move web to ID-token flow and remove the `ya29.` branch | S | Web Google login breaks if flow is switched wrongly | foreign-aud token rejected; web and mobile login manual test | none |
| SEC-002 | backend | `env.ts:98` | Require `GOOGLE_CLIENT_ID` when Google login is on; fail startup | XS | Dev setups without Google need a flag | env test | none |
| SEC-005 | ML, backend | `preprocessing.py:25` | Pixel cap, catch bomb error as 400, decode semaphore, memory limit; backend dimension check | S | Rejects very large legit photos (mobile resizes to 1600 px) | oversized-image tests return 400, RSS bounded | none |
| DEP-001 | ML | `pyproject.toml` pillow cap | Lift cap, upgrade to ≥13.0.0 | S | Preprocessing drift | 31 tests plus sample prediction comparison | none |
| DEP-002 | ML | fastapi/starlette | Upgrade fastapi to a release using Starlette ≥1.3.1 | M | API changes | pytest + manual predict | DEP-001 |
| DEP-003 | frontend | `xlsx 0.18.5` | SheetJS CDN build or exceljs | S | Export format | export test | none |
| DEP-004 | backend | `bun audit` | `bun update` zod/fastify; remove `sharp`, `passport-local` | S–M | NestJS patch bumps | lint, 347 unit, 20 http, build, audit | none |

## P2 — Medium (should fix)

| ID | Fix | Effort | Notes |
|---|---|---|---|
| SEC-003 | Private-by-default report media; authenticated or signed access | M | needs mobile and web image-loading change |
| SEC-004 | Private network and `X-Internal-Token` on ML; disable `/docs` in prod | S | needs deploy config |
| SEC-006 | Reuse blacklist/session/isActive checks in socket gateway; honor `ALLOWED_ORIGINS` | S | |
| INT-001 | Idempotency key or dedupe on create; align timeouts | S–M | |
| CQ-001 | `noImplicitAny`, fix 46 test type errors, add typecheck script | M | |
| DEP-005 | `bun update` frontend; move devtools/faker out of runtime deps | S | |

## P3 — Low / debt

SEC-007 (remove `?token=` auth), SEC-008 (remove secret fallback), SEC-009 (restrict report upload MIME), SEC-010 (enforce https in preview/production builds), SEC-011 (non-root users, digests, HEALTHCHECK, Redis throttler storage, secure cookies in staging), INT-002 (re-classify action), INT-003 (lat/lng pairing), INT-004 (status history), INT-005 (conditional update), CQ-002 (lint without --fix), CQ-004 (admin route permissions), CQ-005 (flaky UI tests), CQ-008 (defaults), DEP-006, model artifact checksum, media orphan GC.

## Suggested order
1. SEC-002, SEC-001 (auth) → 2. DEP-001/SEC-005 (ML hardening, one PR) → 3. DEP-004/DEP-003/DEP-005 → 4. DEP-002 → 5. INT-001, SEC-003, SEC-004, SEC-006 → 6. P3.

After each change run the project's required checks (backend `lint`, `test`, `test:http`, `build`; frontend `lint`, `test`, `build`; mobile `verify`; ML `ruff`, `pytest`).

## Implementation status (2026-11-05, uncommitted working-tree changes)

Done and verified: SEC-001, SEC-002, SEC-005, SEC-006, SEC-003 (backend + mobile), SEC-004 (token on both sides), INT-001, DEP-001..005, CQ-001, CQ-002 (`lint:check`). Details and commands in the final session report.

Residual / follow-up: backend still has 39 transitive advisories (1 critical `proxy-addr`, via Nest/Fastify; `fastify` is pinned to `@nestjs/platform-fastify`'s 5.12.5); `pytest` has 2 dev-only advisories; set `INTERNAL_TOKEN` (ML) and `ML_SERVICE_TOKEN` (backend) and keep the ML port private; the SEC-003 migration `1793730000000-PrivateReportMedia` must be run on deploy; web photo rendering relies on same-origin cookies; Android redirect behaviour of `Authorization` to S3 is unverified on device. P3 items are untouched.
