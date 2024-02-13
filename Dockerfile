# ---- Base Node ----
FROM node:20-alpine AS base
RUN apk update && apk upgrade --no-cache libcrypto3 libssl3 ip
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
FROM build AS run_ependencies
WORKDIR /app/dist/apps/chat
COPY /tools /app/dist/apps/chat/tools
RUN npm i
RUN node tools/patch-nextjs.js

# ---- Production ----
FROM node:20-alpine AS production
RUN apk update && apk upgrade --no-cache libcrypto3 libssl3 ip
WORKDIR /app
COPY --from=run_ependencies /app/dist/apps/chat ./
COPY --from=run_ependencies /app/startup.sh ./startup.sh

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

# Expose the port the app will run on
EXPOSE 3000 9464

# Start the application
CMD ["/app/startup.sh"]
