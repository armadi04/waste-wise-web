# Testing Report

Every row was actually run; output was saved to the session scratchpad. No source modified. Backend `lint` was run via eslint **without** `--fix`.

| Package | Command | Exit | Result |
|---|---|---|---|
| backend | `tsc --noEmit -p tsconfig.json` | 2 | 46 errors, all under `test/` (e.g. `test/utils/fakes.ts:44` TS2707, `test/unit/users/users.service.spec.ts:307` TS2352, top-level await in `seeded-permissions.spec.ts`) |
| backend | `tsc --noEmit -p tsconfig.build.json` | 0 | clean |
| backend | `eslint "{src,apps,libs,test}/**/*.ts"` | 0 | no issues |
| backend | `bun run test:unit` | 0 | 347 pass, 0 fail, 48 files |
| backend | `bun run test:http` | 0 | 20 pass |
| backend | `bun run test:cov` | 0 | all files 70.73% lines, 90.21% funcs; `reports.service` 100%, `classification.service` 100%, `auth.service` 89% |
| backend | `bun run build` | 0 | ok |
| backend | `bun audit` | 1 | 52 vulns (1 critical, 27 high, 20 moderate, 4 low) |
| frontend | `tsc --noEmit` | 0 | clean |
| frontend | `eslint` | 0 | clean |
| frontend | `bun run test` (vitest) | 0 | 159 pass, 21 files |
| frontend | `bun run build` | 0 | ok, PWA precache 78 entries |
| frontend | `bun audit` | 1 | 51 vulns (2 critical, 22 high, 21 moderate, 6 low) |
| mobile | `tsc --noEmit` | 0 | clean |
| mobile | `eslint .` | 0 | 1 warning in `.claude/skills/.../generate-tokens.cjs` |
| mobile | `bun test __tests__/unit` | 0 | 63 pass |
| mobile | `jest` (UI), full run | 1 | 3 fail (5 s timeouts: edit-report, edit-profile, create-report), 55 pass |
| mobile | `jest --runInBand` on the 3 failing files | 0 | 11 pass, so flaky under parallel load |
| mobile | `bun audit` | 1 | 3 vulns (2 moderate, 1 low) |
| ml | `ruff check src tests` | 0 | pass |
| ml | `pytest -q` | 0 | 31 pass |
| ml | decompression test (local script, 9000x9000 and 20000x10000 PNG) | n/a | 200 MP: uncaught `DecompressionBombError`; 81 MP: decoded, peak RSS 1051 MB |
| ml | OSV API query on `uv.lock` | n/a | pillow 93 advisories, starlette 10, pytest 2 |

## Not run or not verified

- Backend E2E / DB integration (needs a disposable `nestplate_test` database; CLAUDE.md says E2E only on request).
- Playwright (web) and Maestro (mobile) E2E.
- `pip-audit`, `trivy`, `osv-scanner`, `gitleaks` (not installed). OSV was queried via API instead; a regex secret scan was run on tracked files.
- Docker image builds and runtime network exposure of the ML service.
- Real Google sign-in, real S3, and a real ML round trip.
- Android device behavior (GPS accuracy, camera permission flows), accessibility, and the EAS build.
- Frontend component-level permission gating.
- CI/CD (skipped per instruction).
- No ML evaluation/accuracy re-run (the model was not retrained; artifact `waste_classifier.keras` is tracked, no checksum).
