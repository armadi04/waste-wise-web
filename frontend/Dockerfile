# Build stage
FROM oven/bun:alpine AS builder

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

# Public Vite values are embedded in browser assets at build time.
ARG VITE_API_URL=""
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_TURNSTILE_SITE_KEY=""
ARG VITE_SSO_SILENT="false"
ENV VITE_API_URL="${VITE_API_URL}" \
    VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID}" \
    VITE_TURNSTILE_SITE_KEY="${VITE_TURNSTILE_SITE_KEY}" \
    VITE_SSO_SILENT="${VITE_SSO_SILENT}"
RUN bun run build

# Production stage
FROM caddy:2-alpine AS runner

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist /srv/dist

EXPOSE 3000
