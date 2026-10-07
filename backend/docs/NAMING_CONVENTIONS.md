# Naming conventions

Application code, files, folders, services, DTOs, and custom API contracts use English. Customer-facing Indonesian belongs in UI copy, seed catalog content, email templates, and notifications.

- Files and folders use kebab-case; entity files keep the required `.entity.ts` suffix.
- Variables, functions, properties, DTO JSON, and REST response fields use camelCase.
- Classes, interfaces, DTOs, and types use PascalCase.
- Constants use UPPER_SNAKE_CASE.
- REST paths use English kebab-case.
- Physical database table and column names are unchanged; migrations are immutable.
- OAuth2/OIDC protocol fields such as `grant_type`, `client_id`, `access_token`, `expires_in`, `email_verified`, and `logout_token` retain their standard spelling.
- REST errors expose stable English `code` values (`UNAUTHORIZED`, `NOT_FOUND`, and so on); the frontend maps these codes to Indonesian customer-facing messages.


Controllers/services/modules/entities keep their Nest suffixes (`*.controller.ts`, etc.).
Unit specs use `test/unit/<feature>/*.spec.ts`; E2E uses `test/*.e2e.spec.ts`.
Use `@/` for src imports. Match ESLint/Prettier formatting: two spaces, single quotes,
semicolons and trailing commas. New physical table/column names follow the existing plural
snake_case table and explicit camelCase column conventions; never rename existing schema
identifiers without a migration.
