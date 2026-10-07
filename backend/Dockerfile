# syntax=docker/dockerfile:1.7
# ---------------------------------------
# Stage 1: Builder
# ---------------------------------------
FROM oven/bun:alpine AS builder

WORKDIR /usr/src/app

# Copy manifests first to cache dependencies (.npmrc sets the @univstekom registry)
COPY package.json bun.lock .npmrc ./

# Install ALL dependencies (including devDeps).
# The GitHub Packages token is mounted as a BuildKit secret, written to a
# throwaway ~/.npmrc, and removed in the same layer so it never persists.
RUN --mount=type=secret,id=node_auth \
    echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/node_auth)" >> ~/.npmrc && \
    bun install --frozen-lockfile && \
    rm -f ~/.npmrc

# Copy source and build
COPY . .
RUN bun run build

# Remove devDependencies to save space
RUN --mount=type=secret,id=node_auth \
    echo "//npm.pkg.github.com/:_authToken=$(cat /run/secrets/node_auth)" >> ~/.npmrc && \
    bun install --production --frozen-lockfile && \
    rm -f ~/.npmrc

# ---------------------------------------
# Stage 2: Runner
# ---------------------------------------

FROM oven/bun:alpine AS runner

WORKDIR /usr/src/app

# Set to production environment
ENV NODE_ENV=production
ENV TZ=UTC
RUN apk add --no-cache tzdata

# Copy only the necessary files from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

# Apply pending migrations, then run the app
ENTRYPOINT ["./docker-entrypoint.sh"]