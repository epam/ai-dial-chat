# @epam/ai-dial-chat-overlay

Embeddable `ChatOverlay`/`ChatOverlayManager` widget for hosting a DIAL Chat instance inside a third-party page.

## Overview

`@epam/ai-dial-chat-overlay` lets a host page embed a running DIAL Chat instance as an iframe and control it over a `postMessage` protocol (`@DIAL_OVERLAY`), without the host needing same-origin access. `ChatOverlay` manages a single embedded iframe: it performs the readiness handshake, exposes chat-only methods (`getMessages`, `sendMessage`, `setInputContent`, `setSystemPrompt`, `setTemperature`, `setOverlayOptions`), and lets the host subscribe to chat/generation lifecycle events. `ChatOverlayManager` builds on top of `ChatOverlay` to create one or more fixed-position, toggle/close/(optional) fullscreen widgets — the common "chat bubble in the corner of the page" pattern — forwarding every `ChatOverlay` method keyed by an `overlayId`. Use `ChatOverlay` directly when you already own the layout and just need to mount an iframe somewhere in it; use `ChatOverlayManager` when you want the ready-made floating-widget chrome.

The library is vanilla DOM/TypeScript with no React dependency, so it can be used from any frontend stack. It has no network dependency beyond `postMessage` to the embedded app's origin — it never sends messages to `'*'` once the app's origin is known.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-chat-overlay": "*"
  }
}
```

## Peer Dependencies

- `@epam/ai-dial-chat-shared` — supplies the `@DIAL_OVERLAY` protocol types (`ChatOverlayOptions`, request/event enums, response payload types), re-exported from this package's entry point so no separate import is needed.

## Classes

### ChatOverlay

Embeds one DIAL Chat iframe into `root` and controls it over `postMessage`.

```ts
import { ChatOverlay, OverlayEventType } from '@epam/ai-dial-chat-overlay';

const overlay = new ChatOverlay('#chat-root', {
  domain: 'https://chat.example.com',
  theme: 'dark',
  modelId: 'gpt-4o',
  overlayConversationId: 'conversation-id',
});

await overlay.ready(); // resolves after the full handshake (READY_TO_INTERACT)

await overlay.sendMessage('Hello!');
const { messages } = await overlay.getMessages();

const unsubscribe = overlay.subscribe(
  OverlayEventType.GptStartGenerating,
  () => {
    console.log('generation started');
  },
);

// Later:
unsubscribe();
overlay.destroy();
```

Provider-specific authentication behavior can be configured per overlay:

```ts
import { ChatOverlay, OverlayAuthUiMode } from '@epam/ai-dial-chat-overlay';

const overlay = new ChatOverlay('#chat-root', {
  domain: 'https://chat.example.com',
  auth: {
    providerUiModes: {
      entra: OverlayAuthUiMode.External,
      keycloak: OverlayAuthUiMode.SameWindow,
    },
  },
});

/* SameWindow is an explicit opt-in. The host must verify that each provider
 * supports iframe login for its specific configuration before enabling it.
 */
```

Notes:

- `setSystemPrompt`/`setTemperature` persist onto the active conversation the same way the app's own UI does — the new value takes effect on the _next_ message sent, not retroactively on an in-flight generation.
- `setOverlayOptions` bypasses the readiness gate: it is also how the initial handshake options exchange happens (the library sends it automatically right after receiving the app's `READY` event), so it can be called at any time, including before `ready()` resolves.
- Deferred for a future change: `createPlaybackConversation`, `stopSelectedPlaybackConversation`, `exportConversation`, `importConversation`.

```ts
// Change which UI sections the embedded app shows, without reconstructing the iframe.
// enabledFeatures REPLACES (does not merge with) any previously-sent enabledFeatures.
await overlay.setOverlayOptions({
  enabledFeatures: [OverlayFeature.Header, OverlayFeature.ConversationsSharing],
});
```

#### Conversation-list methods

```ts
const { conversations } = await overlay.getConversations();
const { conversations: selected } = await overlay.getSelectedConversations();

// Persists immediately and navigates to the new conversation.
const { conversation } = await overlay.createConversation({
  deploymentId: 'gpt-4o',
  firstMessage: 'Hello!',
});

// Opens the composer without persisting anything — identical to
// createConversation() called with no firstMessage.
await overlay.createLocalConversation();

const { conversation: selectedConversation } = await overlay.selectConversation(
  conversation!.id,
);
await overlay.renameConversation(conversation!.id, 'New title');
await overlay.deleteConversation(conversation!.id);
```

`selectConversation`, `createConversation`, `deleteConversation`, and `renameConversation` responses carry an optional `error: { code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_ARGUMENT'; message: string }` field for invalid ids/values/forbidden actions instead of the request silently timing out. `getConversations`/`getSelectedConversations` have no error field — they are snapshot reads with no failure mode beyond the request timeout. One documented asymmetry: `selectConversation`/a persisted `createConversation` for an inaccessible id has no way to distinguish "will never load" from "still loading", so it degrades to the request's ordinary timeout rather than an explicit error.

**Compatibility break:** `createConversation`'s signature replaces the historical positional `(parentPath?, local?)` shape used by pre-`@epam/ai-dial-chat-overlay` overlay integrations with `createConversation(options?: { deploymentId?: string; firstMessage?: string })`. `parentPath` has no replacement — this app has no folder concept for conversations. The old `local` boolean is replaced by omitting `firstMessage`: `createConversation()` called with no `firstMessage` behaves identically to `createLocalConversation()`.

### ChatOverlayManager

Creates one or more `ChatOverlay` instances behind fixed-position toggle/close/(optional) fullscreen chrome.

```ts
import {
  ChatOverlayManager,
  OverlayPosition,
} from '@epam/ai-dial-chat-overlay';

const manager = new ChatOverlayManager();

manager.createOverlay({
  overlayId: 'support-widget',
  domain: 'https://chat.example.com',
  position: OverlayPosition.RightBottom,
  width: 380,
  height: 600,
  allowFullscreen: true,
});

await manager.sendMessage('support-widget', 'Hello!');
const { conversations } = await manager.getConversations('support-widget');
manager.showOverlay('support-widget');
manager.hideOverlay('support-widget');
manager.removeOverlay('support-widget');

// Tears down every overlay and global resize/orientationchange listeners.
manager.destroy();
```

## Options (`ChatOverlayOptions`)

| Option                  | Type                                                       | Description                                                                            |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `domain`                | `string`                                                   | Full URL of the chat app instance to embed (origin + optional path).                   |
| `requestTimeout`        | `number?`                                                  | Milliseconds to wait for a request's response before rejecting. Defaults to `10000`.   |
| `loaderStyles`          | `Record<string, string>?`                                  | Inline CSS properties applied to the loader element while visible.                     |
| `loaderClass`           | `string?`                                                  | CSS class applied to the loader element.                                               |
| `loaderInnerHTML`       | `string?`                                                  | Custom HTML rendered inside the loader, replacing the default spinner.                 |
| `loaderHideEvent`       | `OverlayEventType?`                                        | Event whose receipt hides the loader. Defaults to `OverlayEventType.Ready`.            |
| `enabledFeatures`       | `OverlayFeature[]?`                                        | Embed-time features to enable, e.g. `OverlayFeature.VoiceInput` for microphone access. |
| `theme`                 | `string?`                                                  | Theme name applied to the embedded app.                                                |
| `modelId`               | `string?`                                                  | Deployment/model id to select in the embedded app.                                     |
| `overlayConversationId` | `string?`                                                  | Conversation id the embedded app should load and display.                              |
| `auth`                  | `{ providerUiModes?: Record<string, OverlayAuthUiMode> }?` | Per-provider login UI modes; unconfigured providers default to external login.         |

`ChatOverlayManagerOptions` extends `ChatOverlayOptions` with `overlayId` (required), `position` (`OverlayPosition`, default `RightBottom`), `width`/`height` (default `380`/`600`), `zIndex` (default `999999`), `allowFullscreen`, and `toggleButtonAriaLabel`/`closeButtonAriaLabel`/`fullscreenButtonAriaLabel`.

## Events (`OverlayEventType`)

| Event                        | Fires when                                                             |
| ---------------------------- | ---------------------------------------------------------------------- |
| `InitReady`                  | Immediately, before any host identity is known.                        |
| `Ready`                      | Once auth/model-load state resolves in the embedded app.               |
| `ReadyToInteract`            | Once, after the active conversation is first selected/loaded.          |
| `SelectedConversationLoaded` | Whenever a conversation finishes loading (initial load or navigation). |
| `GptStartGenerating`         | When a generation starts for the active conversation.                  |
| `GptEndGenerating`           | When a generation completes normally (not on user-initiated stop).     |
| `StopGenerating`             | When the user (or host) stops an in-flight generation.                 |
| `ConversationsUpdated`       | Whenever the app's conversation list changes.                          |

## Deployment prerequisites

The embedded app (`apps/chat`) must have overlay mode enabled and the host's origin allowlisted on the backend before a `ChatOverlay`/`ChatOverlayManager` pointed at it will work — see `apps/chat-api/.env.template`'s `OVERLAY_ENABLED` / `ALLOWED_IFRAME_ORIGINS` documentation. Without both, the app's CSP `frame-ancestors` denies the embed outright.

## Sandbox

`apps/chat-overlay-sandbox` (Nx app) exercises both classes against the real built package — run `npm exec nx serve chat-overlay-sandbox` after setting `VITE_CHAT_OVERLAY_HOST` in its `.env.development` to a running, overlay-enabled `apps/chat` instance.

## Building

```sh
npm exec nx build @epam/ai-dial-chat-overlay
```

## Testing

```sh
npm exec nx test @epam/ai-dial-chat-overlay
```
