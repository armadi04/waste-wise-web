# Dependency Audit

Tools run: `bun audit` (backend, frontend, mobile); OSV API query against `waste-wise-ml/uv.lock`. Not available: pip-audit, trivy, osv-scanner. Nothing upgraded. Lockfiles present in all four projects (`bun.lock` x3, `uv.lock`); Dockerfiles use `--frozen-lockfile` / `uv sync --frozen`.

## Summary

| Project | Advisories | Notes |
|---|---|---|
| backend | 52 (1 critical, 27 high, 20 mod, 4 low) | many transitive via NestJS/Apollo/Fastify |
| frontend | 51 (2 critical, 22 high, 21 mod, 6 low) | criticals in dev-tool chains |
| mobile | 3 (2 mod, 1 low) | transitive dev/test only |
| ml (OSV) | pillow 93, starlette 10, pytest 2 | none in other locked packages |

## [DEP-001] High: Pillow 11.3.0 (ML)
93 advisories, 5 critical (e.g. GHSA-8g5g-8vmr-9782 JPEG decode heap overflow, GHSA-5x8w-8jj5-q52h FPX). Service decodes untrusted uploads. Fixes need 13.0.0 but `pyproject.toml` caps `pillow>=10.4,<12`. Fix: lift cap, upgrade, rerun the 31 tests. Risk: preprocessing output differences; re-check predictions on sample set. Effort S.

## [DEP-002] High: Starlette 0.49.3 via fastapi 0.120.4 (ML)
10 advisories (e.g. form limits ignored GHSA-82w8-qh3p-5jfq, host header poisoning). Fixed in 1.x; `fastapi<0.121` blocks it. Fix: raise fastapi bound, upgrade. Risk: API changes between 0.12x and 1.x. Effort M.

## [DEP-003] High: xlsx 0.18.5 (frontend)
Prototype pollution (GHSA-4r6h-8v6p-xvw6) and ReDoS (GHSA-5pgg-2g8v-p4x9); no fix on npm. Used only to write exports (`use-export-excel.ts`), so exposure is low (no parsing of untrusted files). Fix: install SheetJS from its CDN tarball, or switch to `exceljs`/CSV. Effort S.

## [DEP-004] High: backend advisories
Direct: `zod <4.6.6` (memory exhaustion on oversized collections), `graphql-scalars` (PhoneNumber ReDoS), `sharp <0.35.4` (libheif/librsvg; **unused**, remove), `fastify` pinned 5.12.5 (low). Transitive: `path-to-regexp` high (NestJS core), `proxy-addr` critical (IP spoof via IPv4-mapped IPv6 subnet; relevant only if `TRUST_PROXY` uses subnets). Fix: `bun update` for zod and fastify; remove `sharp`, `passport-local`. Check breaking changes in NestJS patch bumps. Effort S–M.

## [DEP-005] Medium: frontend advisories
Criticals `shell-quote`, `seroval` come from devtools/router chains (dev time). `zod` high shared with backend; `vite 8.2.0–8.2.3` high via launch-editor (Windows dev server). Fix: `bun update`, move `@tanstack/*devtools`, `@faker-js/faker` (unused) out of production dependencies. Effort S.

## [DEP-006] Low: mobile
minimatch, glob, deepmerge via jest/expo tooling. Update when Expo SDK patch lands.

## Other observations
- Unused: backend `sharp`, `passport-local`; frontend `@faker-js/faker`; mobile `@lottiefiles/dotlottie-react` (web-only). Other heuristic hits (`@as-integrations/fastify`, `@fastify/static`, `@nestjs/platform-socket.io`, expo router peers) are implicit peers and are not removal candidates.
- Version spread: `zod` 4.5/4.6 across projects, `axios` ^1.20/^1.21, `typescript` 6.0.x everywhere (consistent).
- ML: loose lower bounds only (`numpy>=1.26`, `pyarrow>=17`); lockfile mitigates. Training libs (pandas, scikit-learn, matplotlib) ship in the runtime image only if installed without the `--no-dev` group split; they are runtime deps, so the image is larger than needed.
- Model artifact `artifacts/waste_classifier.keras` (9.2 MB) is tracked in git with no checksum or signature; Keras `load_model` runs with default safe mode. Add a SHA-256 check at startup.
- Licences: not scanned (no tool). Lifecycle scripts: mobile `trustedDependencies: @parcel/watcher` only.
