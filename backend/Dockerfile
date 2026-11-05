# ---------------------------------------
# Stage 1: Builder
# ---------------------------------------
FROM oven/bun:1.3.14-alpine AS builder

WORKDIR /usr/src/app

# Copy manifests first to cache dependencies
COPY package.json bun.lock ./

# Install ALL dependencies (including devDeps).
RUN bun install --frozen-lockfile

# Copy source and build
COPY . .
RUN bun run build

# Remove devDependencies to save space
RUN bun install --production --frozen-lockfile

# ---------------------------------------
# Stage 2: Runner
# ---------------------------------------

FROM oven/bun:1.3.14-alpine AS runner

WORKDIR /usr/src/app

# Set to production environment
ENV NODE_ENV=production
ENV TZ=UTC
RUN apk add --no-cache tzdata

# Copy only the necessary files from the builder stage
COPY --from=builder --chown=bun:bun /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /usr/src/app/dist ./dist
COPY --from=builder --chown=bun:bun /usr/src/app/package.json ./
COPY --from=builder --chown=bun:bun /usr/src/app/docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Do not run as root (the base image ships an unprivileged `bun` user).
USER bun
EXPOSE 3000

# Liveness only; the endpoint does not require auth. PORT defaults to 3000.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/api/v1/health" || exit 1

# Apply pending migrations, then run the app
ENTRYPOINT ["./docker-entrypoint.sh"]