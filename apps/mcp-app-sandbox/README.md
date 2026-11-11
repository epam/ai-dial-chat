# MCP Apps Sandbox Proxy

A minimal, standalone NestJS app implementing the MCP Apps double-iframe
sandbox-proxy page that `@mcp-ui/client` (used by `libs/attachment-canvas`'s
`McpAppCanvasRenderer`) requires to render a tool-supplied `ui://` resource
safely. Adapted from `modelcontextprotocol/ext-apps`'s reference
implementation (`examples/basic-host/{sandbox.html,src/sandbox.ts}`).

## Why this is a separate app

The MCP Apps double-iframe architecture requires the sandbox-proxy page to be
served from an origin genuinely distinct from the host chat application's
origin (different hostname and/or port) — this is what gives the untrusted
tool HTML real cross-origin isolation, not just an iframe `sandbox`
attribute. It must **not** be served from the same origin as `apps/chat`
(unlike `apps/chat-overlay-sandbox`, which is intentionally same-origin).

## Environment variables

| Variable                               | Default | Description                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                 | `3100`  | Port the app listens on.                                                                                                                                                                                                                                                                                                                          |
| `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` | —       | Comma-separated list of origins allowed to embed this page (e.g. `https://chat.example.com`). Entries are normalized to the bare origin, so a trailing slash, a path or a default port is dropped. **Required** for the app to serve anything — every request is rejected with `403` until this is set, there is no insecure "allow all" default. |

Then point `apps/chat-api`'s `MCP_APP_SANDBOX_URL` env var at this
deployment's base URL, so `apps/chat` can resolve it via the existing
client-config pipeline.

## Observability

OpenTelemetry is opt-in and **off by default**: with no `OTEL_*` variable the app starts no exporter and opens no extra port. When enabled it reports generic HTTP server metrics (`http_server_request_duration`) and, optionally, HTTP traces. Log export is wired but the app writes no application logs through OpenTelemetry, so `OTEL_LOGS_EXPORTER=otlp` would only export SDK-internal logs; keep it `none`, in particular on UAT. The app has no health endpoint and makes no outbound requests, so only the incoming HTTP instrumentation is installed; `/metrics` is excluded from tracing.

| Variable                        | Default           | Description                                                                                                       |
| ------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `OTEL_SDK_DISABLED`             | `true`            | Set to `false` to start the SDK.                                                                                  |
| `OTEL_METRICS_EXPORTER`         | `prometheus`      | Comma-separated `prometheus`, `otlp`; `none` disables metrics.                                                    |
| `OTEL_TRACES_EXPORTER`          | `otlp`            | `otlp` or `none`.                                                                                                 |
| `OTEL_LOGS_EXPORTER`            | `otlp`            | `otlp` or `none`.                                                                                                 |
| `OTEL_EXPORTER_PROMETHEUS_HOST` | `127.0.0.1`       | Bind address of the scrape listener. Unauthenticated: set `0.0.0.0` only when a scraper outside the pod needs it. |
| `OTEL_EXPORTER_PROMETHEUS_PORT` | `9464`            | Scrape listener port, path `/metrics`.                                                                            |
| `OTEL_EXPORTER_OTLP_ENDPOINT`   | —                 | OTLP collector base URL (HTTP/JSON, e.g. `http://otel-collector:4318`).                                           |
| `OTEL_SERVICE_NAME`             | `mcp-app-sandbox` | `service.name` resource attribute.                                                                                |

Environments with only Prometheus and Grafana (no OTLP collector) use scrape mode:

```dotenv
OTEL_SDK_DISABLED=false
OTEL_METRICS_EXPORTER=prometheus
OTEL_EXPORTER_PROMETHEUS_HOST=0.0.0.0
OTEL_TRACES_EXPORTER=none
OTEL_LOGS_EXPORTER=none
```

Scrape port `9464` through a Kubernetes Service and ServiceMonitor owned by the deployment chart. Use OTLP (`OTEL_*_EXPORTER=otlp` plus `OTEL_EXPORTER_OTLP_ENDPOINT`) only where a collector exists. The `dist` bundle must stay built with `optimization: false` so the telemetry import in `src/main.ts` keeps running first. Shutdown flushes exporters with a 5 s bound.

Locally: `OTEL_SDK_DISABLED=false OTEL_TRACES_EXPORTER=none OTEL_LOGS_EXPORTER=none` plus the variables from Local development, then `curl http://127.0.0.1:9464/metrics`. See also [backend observability](../../docs/observability.md).

## Deployment

Deploy this app on its own host/port, distinct from `apps/chat`'s.

The image uses `node:24.22.2-alpine3.24`, matching the main chat image. npm is
available during the build and dependency installation, then removed together
with npx, its bundled dependencies, and its cache. The runtime starts with `node`
and does not support npm commands.

Build the production Docker image from the repo root:

```bash
docker build -f apps/mcp-app-sandbox/Dockerfile -t mcp-app-sandbox .
```

Run the built image, mapping the port and setting the required allowed-origins
env var:

```bash
docker run -p 3100:3100 \
  -e MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS=https://chat.example.com \
  mcp-app-sandbox
```

## Local development

### directly

```bash
MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS=http://localhost:4207 npm exec nx serve mcp-app-sandbox
```

### docker image

```bash
    docker run -p 3100:3100 -e MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS=http://localhost:4207 mcp-app-sandbox
```
