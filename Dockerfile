# ---- Base Node ----
FROM node:20-alpine AS base
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

# ---- Only required dependencies ----
FROM build AS run_dependencies
WORKDIR /app/dist/apps/chat
COPY /tools /app/dist/apps/chat/tools
COPY /patches /app/dist/apps/chat/patches
RUN npm i
RUN node tools/patch-nextjs.js

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=run_dependencies /app/dist/apps/chat ./

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_OPTIONS="${NODE_OPTIONS} --max-http-header-size=32768"
ENV KEEP_ALIVE_TIMEOUT=61000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

# Expose the port the app will run on
EXPOSE 3000 9464

# Start the application
CMD ["npm", "start", "--", "--keepAliveTimeout", "$KEEP_ALIVE_TIMEOUT"]
