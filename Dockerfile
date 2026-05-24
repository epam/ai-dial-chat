# ─────────────────────────────────────────────
# Stage 1: install all workspace dependencies
# ─────────────────────────────────────────────
FROM node:24-alpine AS deps

WORKDIR /workspace

# Copy manifests first to maximise layer caching
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─────────────────────────────────────────────
# Stage 2: build both apps
# ─────────────────────────────────────────────
FROM deps AS builder

# Copy the full monorepo source on top of the installed node_modules
COPY . .

# Build the React SPA → apps/chat/dist/
RUN npm exec nx build chat

# Build NestJS, generate a pruned package.json/lockfile, and copy
# workspace packages → apps/chat-api/dist/{main.js,package.json,...,workspace_modules/}
RUN npm exec nx run chat-api:prune

# ─────────────────────────────────────────────
# Stage 3: lean production image
# ─────────────────────────────────────────────
FROM node:24-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# NestJS compiled bundle + pruned manifests + workspace packages
COPY --from=builder /workspace/apps/chat-api/dist ./apps/chat-api/dist

# Install only production dependencies using the pruned lockfile
# (workspace_modules are referenced via file: entries in the pruned package.json)
WORKDIR /app/apps/chat-api/dist
RUN npm ci --omit=dev

# React SPA static files
# static-assets.ts resolves __dirname(dist)/../../chat/dist → /app/apps/chat/dist
COPY --from=builder /workspace/apps/chat/dist /app/apps/chat/dist

WORKDIR /app

EXPOSE 3005

CMD ["node", "apps/chat-api/dist/main.js"]
