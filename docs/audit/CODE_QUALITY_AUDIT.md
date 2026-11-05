# Code Quality Audit

## Architecture
- Backend follows its documented layout: thin controllers, services extend `BaseService`, DTO validation (`whitelist`, `transform` globally), `AllExceptionsFilter`, permission guards, cache invalidation. Reports module is clean and fully unit-tested (100% lines).
- Frontend and mobile consume generated OpenAPI types; mobile has a separate API layer, SecureStore token cache, TanStack Query hooks. No cross-app imports; coupling is only via `swagger.json`.
- Three repos instead of one monorepo (web, apk, ml). Contract files are copied (`api.generated.ts` x2), so drift is possible; mobile's `api:generate` script points to a sibling path.

## Findings

### [CQ-001] Medium: TypeScript strictness off, test typecheck broken
`backend/tsconfig.json`: `strict:false`, `noImplicitAny:false`. `tsc -p tsconfig.json` reports 46 errors, all in `test/` (`fakes.ts:44` Mock generic, `users.service.spec.ts:307` unsafe cast, top-level `await` in a CommonJS file). `tsconfig.build.json` passes, so the build hides it. Fix: turn on `noImplicitAny` incrementally, fix test types, add a `typecheck` script covering tests. Effort M.

### [CQ-002] Low: lint scripts rewrite source
Backend `lint` and frontend `check` use `--fix`. They cannot gate a change, and they silently reformat. Add separate `lint:check`. Effort XS.

### [CQ-003] Low: unused dependencies
See DEPENDENCY_AUDIT (sharp, passport-local, @faker-js/faker, dotlottie-react).

### [CQ-004] Low: admin route guards
Roles, permissions, audit-logs, media, sessions routes use `requireAuth` only; reports and users use `requirePermission`. Backend enforces, so this is UX only; component-level gating not verified. Effort S.

### [CQ-005] Low: flaky mobile UI tests
Full jest run: 3 suites time out at 5 s; the same 3 pass with `--runInBand` (11/11). Raise per-test timeout or limit workers. Effort XS.

### [CQ-006] Low: ML request path inside the HTTP transaction
`createForActor` performs up to two external calls (S3 fetch, ML) inside the request before the DB insert, with no circuit breaker. See INT-001.

### [CQ-007] Info: coverage
Backend total 70.73% lines / 90.21% functions. Entities/DTOs/controllers drag the line figure down. Auth and reports services are 89–100%. Frontend: 159 tests; mobile: 63 unit + 58 UI; ML: 31 tests covering predictions, preprocessing and invalid inputs (no oversized-pixel test).

### [CQ-008] Low: hardcoded fallbacks and defaults
`JWT_SECRET || 'secretKey'`, `ALLOWED_ORIGINS` default `*`, `DB_SEED` default true (production guarded in code), mobile default API URL `http://10.0.2.2:3000/api/v1` (dev only, guarded by `__DEV__`).

## Other observations
- Error handling: consistent in backend; classification errors never throw, they persist an error code (good for availability).
- Logging: pino with query redaction; ML logs exceptions with stack traces server-side only; responses are generic.
- Mobile: no `any` hotspots found by eslint/tsc; refresh handling avoids stampede; hooks lint clean.
- Not reviewed in depth: frontend component sizes, re-render performance, accessibility.
