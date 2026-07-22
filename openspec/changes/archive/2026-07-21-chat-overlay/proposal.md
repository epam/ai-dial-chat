## Why

The chat app has no supported way to run inside a third-party host page. There is no publishable client library, no `postMessage` protocol, and no runtime mode in which the app treats itself as an embedded surface rather than a full standalone site. Partner teams that want to embed DIAL Chat inside their own product (a support widget, an internal portal panel, a docs site assistant) currently have no integration path other than a raw same-origin `<iframe src="...">`, which cannot exchange state (selected conversation, theme, generation lifecycle) with the host page and is blocked outright by the app's current CSP/frame defaults on any cross-origin host.

## What Changes

- Add a new publishable library `libs/chat-overlay` (package `@epam/ai-dial-chat-overlay`) exposing a vanilla-DOM `ChatOverlay` class (single iframe) and a `ChatOverlayManager` class (multi-overlay factory with positioning/fullscreen/toggle chrome), built with the repo's existing Vite-lib-mode convention (see `libs/conversation-input`).
- Add a `postMessage` request/response/event protocol under the `@DIAL_OVERLAY` namespace, with a defined handshake (`INIT_READY` → `READY` → host `SET_OVERLAY_OPTIONS` → app `SET_OVERLAY_OPTIONS/RESPONSE` → `READY_TO_INTERACT`), request timeouts, and origin validation on both sides.
- Add pure, dependency-free protocol types/enums (request names, event names, `ChatOverlayOptions`, `Feature`-equivalent constants) to `libs/chat-shared`, imported by both `libs/chat-overlay` and `apps/chat` — no new `@epam/ai-dial-shared`-style package.
- Add an overlay runtime mode to `apps/chat`: a new state owner (`apps/chat/src/context/overlay/`) that bridges `ConversationsContext`, `DeploymentsContext`, `GenerationContext`, and an active-conversation adapter to the postMessage handshake, gated by runtime config (extends the `client-config-endpoint`/`app-config-context` pattern) plus a host-origin allowlist — not a Vite build-time flag.
- Add v1 chat-only method parity: `ready`, `destroy`, `subscribe`, `setOverlayOptions`, `getMessages`, `sendMessage`, `setInputContent`, `setSystemPrompt`, `setTemperature`, plus the generation lifecycle events (`GPT_START_GENERATING`, `GPT_END_GENERATING`, `STOP_GENERATING`) and `READY`/`READY_TO_INTERACT`/`SELECTED_CONVERSATION_LOADED`/`CONVERSATIONS_UPDATED` events.
- Extend backend CSP config (`apps/chat-api/src/config/csp.ts`, `environment.config.ts`) with `frame-ancestors` support and explicit `X-Frame-Options` handling for allowed embedding origins — **BREAKING** for any deployment currently relying on Helmet's default same-origin framing behavior once overlay mode is enabled for that deployment (embedding is opt-in per allowlisted origin; default-deny is preserved when the allowlist is empty).
- Add a new Nx app `apps/chat-overlay-sandbox` (React + Vite, matching this repo's frontend stack) exercising both `ChatOverlay` and `ChatOverlayManager` against the real workspace package.
- Document deployment prerequisites, env/config names, and public API in `libs/chat-overlay/README.md`.

**Deferred (not in this change):**
- Conversation-list mutation methods (`createConversation`, `createLocalConversation`, `deleteConversation`, `renameConversation`, `selectConversation`, `getConversations`, `getSelectedConversations`), playback conversations, import/export, custom message buttons, and fine-grained UI-section feature toggles (a client-settable `enabledFeatures` concept has no equivalent in this app's feature-flag system today and is out of scope here).
- Sign-in-in-iframe / sign-in-in-new-window automation. This app's auth is a session-cookie/BFF/OIDC flow (see `docs/` auth design), architecturally different from a client-side auto-sign-in handshake. This change documents the security shape (Impact section) but ships v1 assuming the host page already has an authenticated session or accepts the normal login-redirect UX inside the iframe.

## Capabilities

### New Capabilities

- `chat-overlay-library`: the publishable `libs/chat-overlay` package — `ChatOverlay`/`ChatOverlayManager` classes, public option/method surface, build (Vite lib mode)/publish (`tools/publish-lib.mjs`) wiring, README.
- `chat-overlay-protocol`: the `@DIAL_OVERLAY` postMessage request/response/event contract — message shapes, handshake sequencing, request timeout/matching (`DeferredRequest`-equivalent), duplicate-event handling, origin validation rules, and cleanup semantics on `destroy`/unmount. Includes the pure protocol types added to `libs/chat-shared`.
- `chat-overlay-app-mode`: the chat app's overlay runtime mode — how the app detects it should run embedded, the new overlay state/bridge context, how `SET_OVERLAY_OPTIONS` (theme/model/conversation id) is applied to existing contexts, and how chat/generation events are emitted from existing hooks.
- `chat-overlay-security-config`: backend CSP (`frame-ancestors`, `X-Frame-Options` coordination) and env/runtime-config additions (host-origin allowlist, overlay-enabled flag) that gate embedding.
- `chat-overlay-sandbox`: the `apps/chat-overlay-sandbox` Nx app and its automated coverage of direct-`ChatOverlay` and `ChatOverlayManager` usage against the real package.

### Modified Capabilities

- `client-config-endpoint`: `GET /api/v1/client-config` response gains an overlay-related config key (allowed host origins / overlay-enabled flag) so the frontend can determine overlay eligibility at runtime instead of from a Vite build-time env var.
- `app-config-context`: `AppConfigContext`'s `config` shape gains the corresponding overlay fields, consumed by the new overlay bridge context to decide whether to initialize overlay mode.

## Impact

- **Affected code**: new `libs/chat-overlay/**`, new `apps/chat-overlay-sandbox/**`, additions to `libs/chat-shared/src/types/overlay/**`, `apps/chat/src/context/overlay/**`, `apps/chat/src/main.tsx` (mode-gated provider wiring), `apps/chat-api/src/config/csp.ts`, `apps/chat-api/src/config/environment.config.ts`, `apps/chat-api/.env.template`, `apps/chat-api/src/app-config/**` (client-config DTO), `tsconfig.base.json` (new path alias), `eslint.config.mjs` (if a new lib tag is needed).
- **Dependencies**: no new third-party runtime dependencies for `libs/chat-overlay` (vanilla DOM + `postMessage`, no React). Sandbox app depends on the workspace package the same way an external consumer would.
- **Security**: origin validation is tightened relative to a naive iframe embed — the library only accepts messages whose `event.source` matches the created iframe's `contentWindow`, and only posts to `new URL(options.domain).origin` (never `"*"`) once the domain is known; the app validates incoming message origin against the configured host-origin allowlist and only ever responds to the `hostDomain` supplied in the handshake, never a wildcard, once options are received.
- **Scope-creep flags**: this change touches `libs/chat-shared` (new pure types only, no logic), backend CSP/security headers, and the `client-config-endpoint`/`app-config-context` capabilities. It does **not** touch auth/session/cookie handling, `libs/chat-api-client` generated code, or global provider ordering beyond adding one new overlay-mode-gated provider.
- **i18n/RTL/a11y**: overlay-mode UI reuses the existing app's i18n/RTL/a11y behavior unchanged (the embedded app still inherits `<html dir>` and existing translations). The library's own DOM (loader, `ChatOverlayManager` toggle/close/fullscreen buttons) is host-page chrome, not part of the translated app, and needs its own accessible labevisible focus/keyboard/aria treatment (see design.md) with plain-string label options (no i18n dependency in the lib, per library isolation).
- **Observability**: no new metrics/logging endpoints in this change; existing `MetricsInterceptor` continues to cover the client-config extension.
- **Docs**: `libs/chat-overlay/README.md` (new), updates to `apps/chat-api/.env.template`, and a docs/ note if an authoritative doc already describes CSP/embedding (checked via the `dial-docs` skill during design/apply).
