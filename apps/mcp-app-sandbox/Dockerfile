# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────
# Stage 0: install the patched package manager used by all stages
# ─────────────────────────────────────────────
FROM node:24.17-alpine AS node-base

RUN npm install --global npm@12.0.1

# ─────────────────────────────────────────────
# Stage 1: install all workspace dependencies
# ─────────────────────────────────────────────
FROM node-base AS deps

WORKDIR /workspace

# Copy every workspace package.json (--parents preserves directory structure)
# so npm workspaces can create the correct symlinks before any source arrives.
COPY --parents package.json package-lock.json apps/*/package.json libs/*/package.json ./

RUN npm ci --ignore-scripts

# ─────────────────────────────────────────────
# Stage 2: build the sandbox-proxy app
# ─────────────────────────────────────────────
FROM deps AS builder

# Copy the full monorepo source on top of the installed node_modules
COPY . .

# Build NestJS, generate a pruned package.json/lockfile, and copy
# workspace packages → apps/mcp-app-sandbox/dist/{main.js,package.json,...,workspace_modules/}
RUN npm exec nx run mcp-app-sandbox:prune

# ─────────────────────────────────────────────
# Stage 3: lean production image
# ─────────────────────────────────────────────
FROM node-base AS runner

ENV NODE_ENV=production

WORKDIR /app

# NestJS compiled bundle + pruned manifests + workspace packages
COPY --from=builder /workspace/apps/mcp-app-sandbox/dist ./apps/mcp-app-sandbox/dist

# Install only production dependencies using the pruned lockfile
# (workspace_modules are referenced via file: entries in the pruned package.json)
WORKDIR /app/apps/mcp-app-sandbox/dist
RUN npm ci --omit=dev

WORKDIR /app

# Deployed at its own origin (different host and/or port from apps/chat) —
# genuine cross-origin isolation from the host app, not another static route
# under chat-api. See openspec/changes/mcp-apps-support/specs/mcp-app-sandbox-proxy/spec.md.
EXPOSE 3100

CMD ["node", "apps/mcp-app-sandbox/dist/main.js"]
