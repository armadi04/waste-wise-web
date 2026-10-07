# KuponMalam API

Two independent Bun packages: NestJS backend and React admin SPA. The sibling KuponMalam
portal uses TanStack Start; both frontends share this API and its session/RBAC/business rules.
There is no root package-manager workspace. Run commands from the relevant package.

## Projects and documentation

- [Backend](backend/README.md): API, data, integrations and eight canonical guides.
- [Admin](frontend/README.md): SPA, shared loaders/Query and six canonical guides.
- [Portal](../kuponmalam/README.md): selective SSR, server functions and integrated HTTP proxy.
- [Agent entry point](AGENTS.md) and [shared working rules](CLAUDE.md).
- [Releasing](RELEASING.md): semantic-release and user-facing commit conventions.
- [Design](DESIGN.md): existing product/design reference.

## Local topology

Backend localhost:3000, admin localhost:3001, portal localhost:3002. Admin Vite proxies /api;
portal runs one Start server with its integrated proxy. Production edge routing must match
these boundaries, not assume Vite proxy configuration is deployed.

Read the project Development guide before setup and tests; API env validation requires
PostgreSQL and configured credential values. Redis is optional. Integration tests use a
separate disposable database with deterministic external-service fakes.
