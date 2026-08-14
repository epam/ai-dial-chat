# Chat Overlay Sandbox

Static sandbox for exercising `@epam/ai-dial-chat-overlay` against a deployed
`apps/chat` instance running in overlay mode.

## Cases

One page per integration scenario, under `src/cases/`:

| Case                    | Exercises                                                                       |
| ----------------------- | ------------------------------------------------------------------------------- |
| `DirectOverlayCase`     | `new ChatOverlay(...)` mounted into a host-owned layout                          |
| `ManagerOverlayCase`    | `ChatOverlayManager` — floating widget chrome, toggle/close/fullscreen           |
| `ConversationListCase`  | `getConversations`, `createConversation`, `selectConversation`, rename, delete   |
| `EnabledFeaturesCase`   | Live `enabledFeatures` and `setOverlayOptions()` experimentation                 |
| `AuthUiModeCase`        | Per-provider `auth.providerUiModes` login UI modes                               |

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

The **Provider auth UI mode case** accepts two deployment-specific provider
IDs and lets you apply `OverlayAuthUiMode.External` or
`OverlayAuthUiMode.SameWindow` through `auth.providerUiModes`. Sign out of the
embedded chat before testing the login picker. Same-window mode should only be
used after verifying iframe compatibility for the provider's exact tenant and
configuration.

## Local Development

Local Vite runs can override the embedded chat host:

```bash
VITE_CHAT_OVERLAY_HOST=http://localhost:4207
npm exec nx serve chat-overlay-sandbox
```

The sandbox itself is served on port **4300**. The chat instance it points at
still needs `OVERLAY_ENABLED=true` and the sandbox's own origin in
`ALLOWED_IFRAME_ORIGINS` — otherwise the embedded app's CSP `frame-ancestors`
denies the embed and the iframe stays blank.

```bash
npm exec nx test chat-overlay-sandbox
npm exec nx build chat-overlay-sandbox
```

See [`libs/chat-overlay/README.md`](../../libs/chat-overlay/README.md) for the
full `ChatOverlay` / `ChatOverlayManager` API and
[`docs/chat-overlay-migration-guide.md`](../../docs/chat-overlay-migration-guide.md)
for migrating a host page off the legacy overlay package.
