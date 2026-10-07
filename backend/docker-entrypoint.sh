#!/bin/sh
# Container entrypoint: apply pending TypeORM migrations against the compiled
# build, then hand off to the API. Prod runs with `synchronize: false`, so the
# schema is only ever advanced here. Migrations are idempotent (TypeORM skips
# those already recorded in the migrations table), so this is safe on restarts.
set -e

echo "[entrypoint] Running database migrations..."
bun run migration:run:prod

echo "[entrypoint] Starting API..."
exec bun dist/main.js
