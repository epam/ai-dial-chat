# syntax=docker/dockerfile:1

# BFF-only image (published as ai-dial-chat-bff): the root Dockerfile minus the
# React SPA and overlay sandbox bundles, for deployments that host the frontend
# elsewhere. Build from the repository root: docker build -f apps/chat-api/Dockerfile .
# Keep the node-base/deps stages in sync with the root Dockerfile and
# apps/mcp-app-sandbox/Dockerfile when bumping the base image or npm.

# ─────────────────────────────────────────────
# Stage 0: install the package manager used during builds
# ─────────────────────────────────────────────
FROM node:24.21-alpine3.24 AS node-base

# Pin npm for builds; remove its bundled dependencies from the final image below.
RUN apk upgrade --no-cache libcrypto3 libssl3 \
    && npm install --global npm@12.1.0

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
# Stage 2: build the BFF only
# ─────────────────────────────────────────────
FROM deps AS builder

# Copy the full monorepo source on top of the installed node_modules
COPY . .

# Build NestJS, generate a pruned package.json/lockfile, and copy
# workspace packages → apps/chat-api/dist/{main.js,package.json,...,workspace_modules/}
RUN npm exec nx run chat-api:prune

# ─────────────────────────────────────────────
# Stage 3: lean production image
# ─────────────────────────────────────────────
FROM node-base AS runner

ENV NODE_ENV=production

WORKDIR /app

# NestJS compiled bundle + pruned manifests + workspace packages
COPY --from=builder /workspace/apps/chat-api/dist ./apps/chat-api/dist

# Install only production dependencies using the pruned lockfile
# (workspace_modules are referenced via file: entries in the pruned package.json)
WORKDIR /app/apps/chat-api/dist
# Runtime starts with node directly. Project overrides do not patch global npm's
# bundled dependencies, so remove npm/npx and its cache after the last install.
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app

# No frontend is bundled: non-API routes fall through to Nest's 404.
EXPOSE 5000

CMD ["node", "apps/chat-api/dist/main.js"]
