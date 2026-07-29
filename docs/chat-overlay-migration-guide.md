# Migrating the Overlay from the Legacy DIAL Chat

This guide is intended for teams that embedded the legacy DIAL Chat through
the `@epam/ai-dial-overlay` package and are migrating to the new chat overlay,
`@epam/ai-dial-chat-overlay`.

The new overlay preserves the core integration model—an iframe communicating
through `postMessage`—but it is not a complete drop-in replacement. Before
upgrading, you must update the deployment configuration, npm package, parts of
the API, and the set of UI feature flags.

## Migration overview

1. Deploy the new chat with overlay mode enabled and the required host origins
   allowlisted.
2. Replace `@epam/ai-dial-overlay` with `@epam/ai-dial-chat-overlay`.
3. Remove obsolete authentication options and `hostDomain`.
4. Replace raw event and feature-flag strings with the exported enums.
5. Adapt changed methods and remove calls to methods that are not supported
   yet.
6. Verify authentication, the handshake, core operations, and resource
   cleanup.

## 1. Prepare the new chat deployment

In the legacy chat, overlay mode was enabled with:

```dotenv
IS_IFRAME=true
ALLOWED_IFRAME_ORIGINS=https://portal.example.com
```

In the new chat, use:

```dotenv
OVERLAY_ENABLED=true
ALLOWED_IFRAME_ORIGINS=https://portal.example.com
```

`ALLOWED_IFRAME_ORIGINS` is a comma-separated list containing the exact origins
of the host applications, for example:

```dotenv
ALLOWED_IFRAME_ORIGINS=https://portal.example.com,https://admin.example.com
```

An origin includes the scheme, hostname, and port if it is non-standard. Do
not include a path:

```text
Correct:   https://portal.example.com
Incorrect: https://portal.example.com/support
```

Both settings are required:

- If `OVERLAY_ENABLED=false`, the application runs in normal mode.
- If the allowlist is empty, CSP prevents the application from being embedded.
- Incoming overlay messages are validated against the same allowlist.
- After the handshake, the chat accepts active requests only from the origin
  that established the trusted overlay session.

Do not use `*` in production. The new overlay intentionally requires an exact
origin and does not send data with `postMessage(..., '*')`.

### Authentication in the embedded chat

The new chat does not open the identity provider page inside the iframe. When
there is no authenticated session, the user sees a **Log in** button. The
login flow opens in a new tab or window, after which the iframe detects the
new session without reloading.

For a cross-site iframe in an HTTPS deployment, use:

```dotenv
OVERLAY_ENABLED=true
ALLOWED_IFRAME_ORIGINS=https://portal.example.com
AUTH_COOKIE_SECURE=true
```

In this configuration, the authentication cookie uses
`SameSite=None; Secure`. For local HTTP development, use
`AUTH_COOKIE_SECURE=false`; the cookie remains `SameSite=Lax`, so the host and
chat must run in a compatible same-site localhost setup.

The following legacy client-side authentication options are no longer
supported:

- `signInInSameWindow`
- `signInOptions.autoSignIn`
- `signInOptions.signInProvider`
- `signInOptions.logInHint`
- `signInOptions.signInInNewWindow`
- `signInOptions.validationUserEmail`
- `signInOptions.explicitToken`

If the host application relied on automatic provider selection, a login hint,
or an explicit token, that flow cannot currently be migrated one-to-one. The
user now completes the new chat's standard login flow in an external tab or
window.

## 2. Replace the library and configuration

Legacy package:

```bash
npm install @epam/ai-dial-overlay
```

Replace it with:

```bash
npm remove @epam/ai-dial-overlay
npm install @epam/ai-dial-chat-overlay
```

A minimal migrated integration looks like this:

```ts
import {
  ChatOverlay,
  OverlayEventType,
  OverlayFeature,
} from '@epam/ai-dial-chat-overlay';

const overlay = new ChatOverlay('#chat-root', {
  domain: 'https://chat.example.com',
  theme: 'dark',
  modelId: 'gpt-4o',
  overlayConversationId: 'conversation-id',
  requestTimeout: 20_000,
  loaderHideEvent: OverlayEventType.ReadyToInteract,
  enabledFeatures: [
    OverlayFeature.Header,
    OverlayFeature.ConversationsSection,
    OverlayFeature.Likes,
  ],
});

await overlay.ready();

const unsubscribe = overlay.subscribe(OverlayEventType.GptStartGenerating, () =>
  console.log('Generation started'),
);

await overlay.sendMessage('Hello!');

// When the host component unmounts:
unsubscribe();
overlay.destroy();
```

### Changes to `ChatOverlayOptions`

| Legacy option                         | New option or required action                                       |
| ------------------------------------- | ------------------------------------------------------------------- |
| `domain`                              | Preserved. The library now derives the target origin from this URL. |
| `hostDomain`                          | Removed. The library automatically sends `window.location.origin`.  |
| `theme`                               | Preserved.                                                          |
| `modelId`                             | Preserved.                                                          |
| `overlayConversationId`               | Preserved.                                                          |
| `requestTimeout`                      | Preserved; defaults to `10000` ms.                                  |
| `loaderStyles`                        | Preserved as `Record<string, string>`.                              |
| `loaderClass`                         | Preserved.                                                          |
| `loaderInnerHTML`                     | Preserved. Pass trusted HTML only.                                  |
| `loaderHideEvent`                     | Preserved, but now use `OverlayEventType`.                          |
| `enabledFeatures`                     | Accepts only `OverlayFeature[]`.                                    |
| `newConversationsFolderId`            | Removed because the new chat does not have conversation folders.    |
| `enabledFeaturesData`                 | Not supported.                                                      |
| `messageButtons`                      | Not supported.                                                      |
| `signInOptions`, `signInInSameWindow` | Removed; see the authentication section.                            |

`setOverlayOptions()` now accepts only fields that can be changed dynamically:
`theme`, `modelId`, `overlayConversationId`, and `enabledFeatures`. Do not pass
`domain`, `hostDomain`, the request timeout, or loader settings to it.

## 3. Account for the new handshake and error handling

The initialization sequence is now:

```text
iframe -> host: INIT_READY
iframe -> host: READY
host   -> iframe: SET_OVERLAY_OPTIONS
iframe -> host: SET_OVERLAY_OPTIONS/RESPONSE
iframe -> host: READY_TO_INTERACT
```

`overlay.ready()` resolves only after `READY_TO_INTERACT`, when the first active
conversation has been selected or the composer is ready. In legacy
integrations, readiness could be reached as early as `READY`.

Practical implications:

- Call the chat API after `await overlay.ready()`.
- Calls made earlier are queued by the library.
- A queued call's timeout starts when the request is actually posted to the
  iframe, not when it enters the queue.
- Every request receives a `requestId` and `expiresAt`.
- `setOverlayOptions()` may be called before `ready()` because it participates
  in the handshake.
- `destroy()` rejects pending requests and removes the iframe, loader, and
  `message` listener.

To keep the loader visible until the overlay is fully ready, set:

```ts
loaderHideEvent: OverlayEventType.ReadyToInteract;
```

The default `loaderHideEvent` is `OverlayEventType.Ready`.

## 4. Migrate the public API

### Supported methods

The following methods are available on the new `ChatOverlay`:

| Method                                  | Important notes                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `ready()`                               | Waits for `READY_TO_INTERACT`.                                               |
| `getMessages()`                         | Returns messages from the active conversation.                               |
| `sendMessage(content)`                  | Sends a message to the active conversation.                                  |
| `setInputContent(content)`              | Changes the composer content.                                                |
| `setSystemPrompt(prompt)`               | Applies to the next message, not an in-progress generation.                  |
| `setTemperature(value)`                 | Applies to the next message.                                                 |
| `getConversations()`                    | Returns the current in-memory snapshot; it does not force a refresh.         |
| `getSelectedConversations()`            | Returns one active conversation or an empty array when the composer is open. |
| `selectConversation(id)`                | Waits for the selected conversation to load.                                 |
| `createConversation(options?)`          | Its signature has changed; see below.                                        |
| `createLocalConversation()`             | Opens the composer without immediately persisting a conversation.            |
| `deleteConversation(id)`                | Now returns a payload that may contain an error.                             |
| `renameConversation(id, newName)`       | Now returns a payload that may contain an error.                             |
| `setOverlayOptions(options)`            | Accepts only the mutable subset of options.                                  |
| `subscribe(eventType, callback)`        | Uses `OverlayEventType` and returns an unsubscribe function.                 |
| `allowFullscreen()`, `openFullscreen()` | Preserved.                                                                   |
| `destroy()`                             | Idempotently releases resources.                                             |

### New `createConversation` signature

Legacy API:

```ts
await overlay.createConversation(parentPath, local);
```

New API:

```ts
const result = await overlay.createConversation({
  deploymentId: 'gpt-4o',
  firstMessage: 'Hello!',
});
```

- `parentPath` has no replacement because the new chat does not support
  conversation folders.
- A non-empty `firstMessage` persists the conversation immediately.
- Without `firstMessage`, the method opens a local composer and returns
  `{ conversation: null }`.
- Calling `createConversation()` without arguments is equivalent to
  `createLocalConversation()`.

### Conversation-list operation errors

Check the `error` field returned by `selectConversation`,
`createConversation`, `deleteConversation`, and `renameConversation`:

```ts
const result = await overlay.renameConversation(id, 'New title');

if (result.error) {
  switch (result.error.code) {
    case 'NOT_FOUND':
    case 'FORBIDDEN':
    case 'INVALID_ARGUMENT':
      console.error(result.error.message);
      break;
  }
} else {
  console.log(result.conversation);
}
```

`getConversations()` and `getSelectedConversations()` do not return an `error`
field. A transport failure appears as a timeout or rejected promise.

There is one known asymmetry: the overlay cannot always distinguish an
inaccessible conversation from one that is still loading. In this case,
`selectConversation()` may time out instead of returning an explicit
`NOT_FOUND` error.

### Methods not supported yet

The following methods are absent from the new overlay:

- `deleteMessage(index)`
- `updateMessage(index, fields)`
- `createPlaybackConversation(id)`
- `stopSelectedPlaybackConversation()`
- `exportConversation(id)`
- `importConversation(data)`

The following legacy events are also absent:

- `MESSAGE_CUSTOM_BUTTON`
- `EDIT_MESSAGE`
- `REGENERATE_MESSAGE`
- `DELETE_MESSAGE`
- `PREV_PLAYBACK_MESSAGE`
- `NEXT_PLAYBACK_MESSAGE`

Before switching, locate these calls in the host application and either remove
the UI that depends on them or keep affected users on the legacy overlay until
the required capability becomes available.

## 5. Migrate events

Do not pass raw event strings manually. The new package exports:

```ts
enum OverlayEventType {
  InitReady,
  Ready,
  ReadyToInteract,
  SelectedConversationLoaded,
  GptStartGenerating,
  GptEndGenerating,
  StopGenerating,
  ConversationsUpdated,
}
```

For example:

```ts
const unsubscribe = overlay.subscribe(
  OverlayEventType.ConversationsUpdated,
  () => refreshHostState(),
);
```

The same event may arrive multiple times, and subscribers are called each
time. If an action must run only once, unsubscribe inside the callback or add
your own guard.

## 6. Migrate UI feature flags

In the new API, `enabledFeatures` is an `OverlayFeature` array, not a string:

```ts
enabledFeatures: [OverlayFeature.Header, OverlayFeature.ConversationsSection];
```

It uses **replace**, not merge, semantics:

- Omitting `enabledFeatures` preserves the server or default baseline.
- `enabledFeatures: []` explicitly replaces the set with an empty set.
- A later `setOverlayOptions({ enabledFeatures })` call completely replaces
  the previous set.
- Unknown strings are dropped with a warning, but the entire request is not
  rejected.
- If every supplied string is unknown, the resulting set is empty.
- `null` is not supported as a reset-to-baseline sentinel.

Do not send a partial diff. Always send the complete desired set.

### Renamed flags

| Legacy flag                | New flag                                                    |
| -------------------------- | ----------------------------------------------------------- |
| `marketplace`              | `catalog` (`OverlayFeature.Catalog`)                        |
| `marketplace-hide-my-apps` | `catalog-hide-my-apps` (`OverlayFeature.CatalogHideMyApps`) |
| `marketplace-table-view`   | `catalog-table-view` (`OverlayFeature.CatalogTableView`)    |

### Flags replaced by unconditional behavior

The following legacy strings are no longer recognized. Their corresponding
behavior is unconditional in the new chat, so you can normally remove them:

| Legacy flag               | New chat behavior                                                                |
| ------------------------- | -------------------------------------------------------------------------------- |
| `custom-logo`             | The logo always comes from theme configuration; use `theme` to select the theme. |
| `show-layout-dividers`    | Dividers are a permanent part of the UI.                                         |
| `top-settings`            | The top settings panel is always rendered.                                       |
| `top-chat-model-settings` | The model selector is rendered; use `disallow-change-agent` to restrict it.      |
| `chat-header-border`      | The header bottom border is always rendered.                                     |
| `chat-input-border`       | The input border is always rendered.                                             |

### UI flags not supported yet

The following legacy chat flags are not included in the new `OverlayFeature`:

| Flag                            | Status                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `code-interpreter`              | The corresponding toggle integration is absent.                               |
| `compare-mode-disabled`         | Compare mode has not been migrated as an overlay toggle.                      |
| `input-links`                   | Link attachments have not been migrated as an overlay toggle.                 |
| `message-templates`             | Message templates have not been migrated.                                     |
| `hide-top-context-menu`         | No equivalent toggle is available.                                            |
| `top-chat-info`                 | No equivalent toggle is available.                                            |
| `top-clear-conversation`        | No equivalent toggle is available.                                            |
| `chat-full-width-by-default`    | No equivalent toggle is available.                                            |
| `footer`                        | The new UI has no transferable footer section.                                |
| `prompts-panel-toggle`          | The legacy prompts UI has not been migrated.                                  |
| `prompts-section`               | The legacy prompts UI has not been migrated.                                  |
| `showPromptsSectionByDefault`   | The legacy prompts UI has not been migrated.                                  |
| `edit-all-assistant-message`    | Editing assistant messages has not been migrated as a toggle.                 |
| `edit-last-assistant-message`   | Editing assistant messages has not been migrated as a toggle.                 |
| `disabled-playback-controls`    | The playback API and UI are not supported yet.                                |
| `prompts-publishing`            | The legacy prompts UI has not been migrated.                                  |
| `prompts-sharing`               | The legacy prompts UI has not been migrated.                                  |
| `report-an-issue`               | No equivalent toggle is available.                                            |
| `request-api-key`               | No equivalent toggle is available.                                            |
| `md-sidebar-overlay-breakpoint` | Requires a sidebar overlay/backdrop mode that does not exist in the new chat. |
| `user-message-align-end`        | Inline-end alignment is already unconditional.                                |

Pass only values exported by `OverlayFeature`. This also protects TypeScript
integrations from typos and removed keys.

### Supported flags and defaults

The new chat supports 32 flags.

Enabled by default:

```text
header
conversations-section
conversations-panel-toggle
showConversationsSectionByDefault
attachments-manager
likes
dislike-comment
input-files
live-chat-interaction
empty-chat-settings
conversations-sharing
applications-sharing
toolsets-sharing
conversations-publishing
custom-applications
code-apps
catalog
toolsets
voice-input
```

Disabled by default and enabled explicitly:

```text
hide-custom-app-creation
disabled-send
skip-focus-chat-input-onload
disallow-change-agent
hide-new-conversation
hide-empty-chat-change-agent
catalog-hide-my-apps
catalog-table-view
hide-delete-user-message
hide-edit-user-message
hide-regenerate-assistant-message
hide-user-menu
hide-user-settings
```

`voice-input` additionally adds `microphone` to the iframe's `allow`
attribute. The flag itself does not provide an ASR model or replace the
backend configuration required for voice input.

### Server baseline

The new chat operator can define a baseline for all clients:

```dotenv
ENABLED_UI_FEATURES=header,conversations-section,likes,input-files
```

This is also a complete replacement set, not an addition to the defaults. If
the variable is absent or empty, the built-in baseline containing 19
default-on flags is used. An overlay host may replace the server baseline with
its own `enabledFeatures`; the server baseline is not a security ceiling.

Do not use UI flags as an authorization mechanism. The backend must restrict
access to data and operations regardless of whether a button is hidden.

## 7. Migrate `ChatOverlayManager`

Use an instance of the new manager when you need a ready-made floating widget:

```ts
import {
  ChatOverlayManager,
  OverlayPosition,
} from '@epam/ai-dial-chat-overlay';

const manager = new ChatOverlayManager();

manager.createOverlay({
  overlayId: 'support',
  domain: 'https://chat.example.com',
  position: OverlayPosition.RightBottom,
  width: 380,
  height: 600,
  allowFullscreen: true,
});

await manager.ready('support');
await manager.sendMessage('support', 'Hello!');

manager.hideOverlay('support');
manager.showOverlay('support');
manager.removeOverlay('support');
manager.destroy();
```

Key differences:

- Instantiate the manager with `new ChatOverlayManager()`.
- The identifier option is named `overlayId`, not `id`.
- Manager methods still accept `overlayId` as their first argument.
- `destroy()` releases every overlay and all global listeners.
- The unsupported methods listed above are also absent from the manager.
