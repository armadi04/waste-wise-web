# Shared agent working rules

These instructions apply to both independent Bun packages. Read the relevant
[backend](backend/docs/AI_AGENT_GUIDE.md) or [admin](frontend/docs/AI_AGENT_GUIDE.md) guide
before changing that package. Project guides own technical rules; this file owns shared
workflow and release policy. User instructions take precedence.

## Working agreement

- Run commands from the package being changed. Use Bun; no root workspace commands.
- Follow the project architecture and existing dependencies/components before adding another.
- Keep documentation accurate in the same change. Use the canonical guides listed in each
  project README; do not create redundant narrow docs or duplicate rules here.
- Never commit real secrets. Templates are placeholders; production credentials belong to
  runtime secret management. Avoid exposing secrets through logs or generated artifacts.
- Confirm before destructive/hard-to-reverse operations, including database resets, force-push
  and irreversible deletion outside the authorized scope. Routine authorized work can proceed.
- All tests belong in each project's test/. Backend integration uses a separate disposable
  nestplate_test database; do not point the harness at development/production data.
- Run the changed project's required checks before reporting completion. If unavailable or
  failing, report the exact limitation. Docs-only work requires link/headings and diff checks.
- E2E coverage and execution are optional. Run E2E only when explicitly requested by the user,
  never automatically for route, session, UI or API changes. Skipping unrequested E2E does not
  block completion or make required verification incomplete.
- Commit/push only when explicitly requested. If working on master, create a branch first.
  Git author is armadi04. Preserve unrelated user changes.

## Releases and review

Use type(scope):description. Semantic-release cuts versions from master; do not tag manually
or create CHANGELOG.md. Commit descriptions for feat/fix appear to users, so describe the
resulting behavior and choose established frontend changelog scopes when applicable.
PRs explain the behavior, validation and affected routes/search states; include screenshots
or recordings for UI changes. Follow [Releasing](RELEASING.md) for release configuration.

## Cross-project changes

Backend owns auth/RBAC/schema; admin uses services, shared Query options/loaders, UI stores
and validated URL table state. This starter has no sibling application dependency.

Permission changes must synchronize backend PermissionType/seeder and applicable admin
MENU_PERMISSIONS/sidebarData. Follow [permission sync](backend/docs/AUTH.md#permission-sync).
Route/DTO changes regenerate OpenAPI; entity changes require reviewed new migrations; SDL
changes regenerate GraphQL typings. Technical steps/checks remain in the project guides.
