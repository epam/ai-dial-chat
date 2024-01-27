# ---- Base Node ----
FROM node:20-alpine AS base
RUN apk update && apk upgrade --no-cache libcrypto3 libssl3
WORKDIR /app
COPY /tools ./tools
COPY package*.json ./

# ---- Dependencies ----
FROM base AS dependencies
RUN npm ci

# ---- Build ----
FROM dependencies AS build
COPY . .
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS production
RUN apk update && apk upgrade --no-cache libcrypto3 libssl3
WORKDIR /app
COPY --from=build /app ./dist/apps/chat
COPY --from=build /app/startup.sh ./startup.sh
COPY --from=dependencies /app/node_modules ./node_modules

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

# Expose the port the app will run on
EXPOSE 3000 9464

# Start the application
CMD ["/app/startup.sh"]
