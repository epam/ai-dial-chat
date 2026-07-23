# syntax=docker/dockerfile:1

FROM node:24.17-alpine AS node-base

RUN npm install --global npm@12.0.1

FROM node-base AS deps

WORKDIR /workspace

COPY --parents package.json package-lock.json apps/*/package.json libs/*/package.json ./

RUN npm ci --ignore-scripts

FROM deps AS builder

WORKDIR /workspace

COPY . .

RUN npm exec -- nx build chat-overlay-sandbox

FROM nginx:1.29-alpine AS runner

ENV CHAT_OVERLAY_HOST=""

COPY apps/chat-overlay-sandbox/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/chat-overlay-sandbox/dist /usr/share/nginx/html

EXPOSE 80

CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js && exec nginx -g 'daemon off;'"]
