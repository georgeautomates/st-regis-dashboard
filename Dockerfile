# ── st-regis-dashboard (Next.js, standalone) ──────────────────────────────────
# Multi-stage: build with full deps, ship only the standalone server.
# Requires `output: "standalone"` in next.config.ts.

# ---- Build stage ----
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies against the lockfile (reproducible builds).
# package.json + lockfile first → this layer caches unless deps change.
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build. NEXT_TELEMETRY_DISABLED keeps build output clean.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runtime stage ----
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as a non-root user (standard hardening; the node image ships one)
USER node

# Copy only what the standalone server needs:
#   - .next/standalone : the minimal server + traced node_modules
#   - .next/static     : compiled JS/CSS assets
#   - public           : static files (images etc.)
COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static
COPY --chown=node:node --from=builder /app/public ./public

EXPOSE 3000

# Standalone build emits server.js at the root of .next/standalone (copied to /app)
CMD ["node", "server.js"]
