# Chat Overlay Sandbox

Static sandbox for exercising `@epam/ai-dial-chat-overlay` against a deployed
`apps/chat` instance running in overlay mode.

## Deployment

Build the image from the workspace root:

```bash
docker build -f apps/chat-overlay-sandbox/Dockerfile -t chat-overlay-sandbox .
```

The deployed container reads the embedded chat URL from runtime environment:

```bash
CHAT_OVERLAY_HOST=https://development-overlay-ng.example.com
```

The image generates `/env.js` from that value when the container starts, so
changing `CHAT_OVERLAY_HOST` in Helm values does not require rebuilding the
image.

The embedded chat environment must allow this sandbox origin:

```bash
OVERLAY_ENABLED=true
ALLOWED_IFRAME_ORIGINS=https://development-overlay-sandbox-ng.example.com
```

## Local Development

Local Vite runs can keep using the build-time fallback:

```bash
VITE_CHAT_OVERLAY_HOST=http://localhost:4207
npm exec nx serve chat-overlay-sandbox
```
