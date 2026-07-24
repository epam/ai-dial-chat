# Chat Overlay Sandbox

Static sandbox for exercising `@epam/ai-dial-chat-overlay` against a deployed
`apps/chat` instance running in overlay mode.

## Deployment

The root workspace `Dockerfile` builds this app into the same image as
`apps/chat` and `apps/chat-api`. When enabled, `chat-api` serves the sandbox at:

```bash
https://<chat-host>/overlay-sandbox/
```

Enable the sandbox route and overlay runtime mode in the embedded chat
environment:

```bash
OVERLAY_ENABLED=true
OVERLAY_SANDBOX_ENABLED=true
ALLOWED_IFRAME_ORIGINS=https://<chat-host>
```

The deployed sandbox embeds `window.location.origin`, so no separate sandbox
image or runtime host variable is required.

## Local Development

Local Vite runs can override the embedded chat host:

```bash
VITE_CHAT_OVERLAY_HOST=http://localhost:4207
npm exec nx serve chat-overlay-sandbox
```
