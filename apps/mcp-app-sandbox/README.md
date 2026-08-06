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

## Deployment

Deploy this app on its own host/port, distinct from `apps/chat`'s. Configure:

- `PORT` — defaults to `3100`.
- `MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS` — comma-separated list of origins
  allowed to embed this page (e.g. `https://chat.example.com`). **Required**
  for the app to serve anything — every request is rejected with `403` until
  this is set, there is no insecure "allow all" default.

Then point `apps/chat-api`'s `MCP_APP_SANDBOX_URL` env var at this
deployment's base URL, so `apps/chat` can resolve it via the existing
client-config pipeline.

## Local development

```bash
MCP_APP_SANDBOX_ALLOWED_HOST_ORIGINS=http://localhost:4207 npm exec nx serve mcp-app-sandbox
```
