# ---- Base Node ----
FROM node:24-alpine AS base
WORKDIR /app
COPY /tools ./tools
COPY package*.json ./

# ---- Dependencies ----
FROM base AS build_dependencies
RUN npm ci

# ---- Build ----
FROM build_dependencies AS build
COPY . .
RUN npm run build
RUN rm -rf /app/dist/apps/ai-dial-chat/.next/cache

# ---- Only required dependencies ----
FROM build AS run_dependencies
WORKDIR /app/dist/apps/chat
COPY /tools /app/dist/apps/chat/tools
COPY /patches /app/dist/apps/chat/patches
RUN npm i
RUN node tools/patch-nextjs.js

# ---- Production ----
FROM node:24-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="${NODE_OPTIONS} --max-http-header-size=32768"
ENV KEEP_ALIVE_TIMEOUT=61000

RUN apk upgrade --no-cache libssl3 libcrypto3

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 -G nodejs nextjs

COPY --chown=nextjs:nodejs --from=run_dependencies /app/dist/apps/chat ./

USER nextjs

# Expose the port the app will run on
EXPOSE 3000 9464

# Start the application
CMD ["sh", "-c", "npm start -- --keepAliveTimeout $KEEP_ALIVE_TIMEOUT"]
