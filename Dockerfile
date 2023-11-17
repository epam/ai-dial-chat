# ---- Base Node ----
FROM node:20-alpine AS base
RUN apk update && apk upgrade --no-cache libcrypto3 libssl3

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app
COPY /tools ./tools
COPY package*.json ./
RUN npm ci
RUN find node_modules -type f -exec md5sum {} \; | md5sum

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# fix dynamic wasm dependency
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm ./node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm

USER nextjs

EXPOSE 3000 9464

CMD ["node", "server.js"]
