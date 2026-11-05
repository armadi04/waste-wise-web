# Build stage
FROM oven/bun:1.3.14-alpine AS builder

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

# Public Vite values are embedded in browser assets at build time.
ARG VITE_API_URL=""
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_TURNSTILE_SITE_KEY=""
ENV VITE_API_URL="${VITE_API_URL}" \
    VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID}" \
    VITE_TURNSTILE_SITE_KEY="${VITE_TURNSTILE_SITE_KEY}"
RUN bun run build

# Production stage
FROM caddy:2.10-alpine AS runner

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist /srv/dist

# Unprivileged: port 3000 needs no capabilities, Caddy state goes to /tmp.
ENV XDG_DATA_HOME=/tmp XDG_CONFIG_HOME=/tmp
RUN adduser -S -u 10001 -H caddyuser
USER caddyuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
