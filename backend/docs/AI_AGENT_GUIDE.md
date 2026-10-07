# Backend AI agent guide

Read repo-wide [working rules](../../CLAUDE.md), [Architecture](ARCHITECTURE.md) and
[Naming conventions](NAMING_CONVENTIONS.md). [Auth](AUTH.md) owns the guard/permission contract;
[GraphQL](GRAPHQL.md) owns the optional GraphQL interface.

## Rules

- Keep controllers HTTP-only. Business queries/writes live in services; generic CRUD extends
  BaseService. Do not hard-delete business resources or bypass their soft-delete semantics.
- Place feature services, DTOs, entities and helpers in the owning feature folder.
  Register providers once and pass the transaction manager through transactional helpers.
- Use DTO validation, guarded routes, typed permission strings and the existing cache
  invalidation pattern. A permission decorator without the matching guard is inert.
- Keep `.entity.ts` names, explicit nullable column types, database naming and immutable
  migrations. Production schema changes require reviewed migrations, never synchronize.
- Emit domain/notification/audit events from services. Do not inject NotificationsGateway
  into feature business logic or add inline SMTP paths. Existing auth/invitation MailService
  integration remains valid; do not rewrite it merely to fit an overly broad guideline.
- Return payloads directly; errors are shaped by AllExceptionsFilter. Do not edit generated
  swagger.json or GraphQL typings manually. Generate from routes/DTOs or SDL.
- Build through `bun run build` (Nest plus tsc-alias); never bypass alias rewriting.
- All unit specs live in `test/unit/`; E2E specs/helper infrastructure live in `test/`.
  Never put new specs under src or connect integration tests to the application database.
- Env changes require `src/config/env.ts`, `.env.example` and Development documentation.
  No real credentials in source, examples, generated docs or logs.

## Change recipe

1. Copy the closest existing feature (roles for generic CRUD) and verify the actual contract.
2. Add permission strings to PermissionType and seeder; synchronize admin menu/action permission
   definitions as described in [Auth](AUTH.md#permission-sync).
3. Define entity, indexes and relations with timestamps/soft-delete. Generate and review a
   new migration whenever schema changes; never alter an applied migration.
4. Add base/create/update DTOs, numeric transforms, optional validation and IsUnique if needed.
5. Extend BaseService with search fields. Override only for relation/domain behavior and emit
   events with existing payload conventions. Keep business writes transactional where required.
6. Add guarded controller methods, permission metadata, Swagger response types, pagination
   branch, upload interceptor if needed and post-write cache invalidation.
7. Register repository/service/controller in the feature module and root imports; export
   providers only when another module needs them. Add an event listener for new side effects.
8. Add behavior unit specs with mocked repositories/events. E2E coverage for auth, permission,
   ownership, validation, conflicts and soft-delete is optional and added when requested by the
   user. Reuse test/utils fakes and setup-app for requested E2E work.
9. Regenerate OpenAPI for route/DTO changes; GraphQL SDL/types/resolvers only if that surface
   changes. Update canonical guides instead of adding another narrow documentation file.

## Verification

Run `bun run lint`, `bun run test` and `bun run build`. Default test commands run unit tests
only. Run `bun run test:e2e` or individual integration specs only when explicitly requested by
the user, using the dedicated integration database. If requested E2E cannot run, report that
limitation; skipping unrequested E2E does not make required verification incomplete.
Lint rewrites formatting. Run schema:check for entity/migration work, spec:generate for
route/DTO changes and graphql:types for SDL changes; review generated diffs.

For documentation-only work, validate links/headings and git diff --check; do not regenerate
schemas or run DB mutations. [Development](DEVELOPMENT.md) explains test isolation and commands.
Follow shared commit/release policy and never claim an unrun/failing check passed.
