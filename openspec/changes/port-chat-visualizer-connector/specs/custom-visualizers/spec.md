## MODIFIED Requirements

### Requirement: postMessage protocol constants

The protocol constants SHALL live in the workspace package `@epam/ai-dial-visualizer-connector` (`libs/visualizer-connector`). That package exports four string enums with PascalCase members:

- `VisualizerConnectorRequests`: `SendVisualizeData`, `SendGroupedVisualizeData`, `SetVisualizerOptions`;
- `VisualizerConnectorEvents`: `InitReady`, `Ready`, `ReadyToInteract`, `SendMessage`, `CreatedConversationSuccess`, `UpdatedConversationSuccess`, `UpdatedApplicationSuccess`;
- `AppsEditorEvents`: `ReadyToInteract`, `ReadyToSave`, `LoggedOut`, `UpdatedApplicationSuccess` — the events an application-editor iframe posts to the application editor, with the camelCase wire values `readyToInteract`, `readyToSave`, `loggedOut`, `updatedApplicationSuccess` that `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts` matches on;
- `AppsEditorMessages`: `TriggerSave`, `SaveSuccess`, `SaveError`, `ValidityState`, `DirtyState`, `RequestToolsetLogin`, `ToolsetLoginResult`, `RequestToolsetLogout`, `ToolsetLogoutResult`, `RequestApplicationCredentials` — the application editor's unprefixed save and auth messages, with the wire values `TRIGGER_SAVE`, `SAVE_SUCCESS`, `SAVE_ERROR`, `VALIDITY_STATE`, `DIRTY_STATE`, `REQUEST_TOOLSET_LOGIN`, `TOOLSET_LOGIN_RESULT`, `REQUEST_TOOLSET_LOGOUT`, `TOOLSET_LOGOUT_RESULT`, `REQUEST_APPLICATION_CREDENTIALS`.

The wire string values SHALL be the ones visualizers already built on `@epam/ai-dial-chat-visualizer-connector` expect, unchanged: `SEND_VISUALIZE_DATA`, `SEND_GROUPED_VISUALIZE_DATA`, `SET_VISUALIZER_OPTIONS`, `INIT_READY`, `READY`, `READY_TO_INTERACT`, `SEND_MESSAGE`, `CREATED_CONVERSATION_SUCCESS`, `UPDATED_CONVERSATION_SUCCESS`, `UPDATED_APPLICATION_SUCCESS`.

The **runtime** host path (`VisualizerCanvasRenderer`) SHALL import both enums from `@epam/ai-dial-visualizer-connector`, and the workspace SHALL NOT depend on `@epam/ai-dial-shared`. This monorepo SHALL NOT duplicate those protocol enums in `libs/chat-shared`. Host config and canvas payload types stay in `libs/chat-shared/src/models/custom-visualizer.ts`, separate from the connector's wire surface.

#### Scenario: runtime send uses the workspace enum

- **WHEN** `VisualizerCanvasRenderer` delivers visualize data
- **THEN** it calls `connector.send(VisualizerConnectorRequests.SendVisualizeData, …)` where `VisualizerConnectorRequests` is imported from `@epam/ai-dial-visualizer-connector`
- **AND** the posted message type is still `${visualizerName}/SEND_VISUALIZE_DATA`

#### Scenario: wire values are unchanged

- **WHEN** each member of `VisualizerConnectorRequests` and `VisualizerConnectorEvents` is read
- **THEN** its value equals the upper-snake-case wire string listed above

#### Scenario: application-editor wire values match the editor host

- **WHEN** each member of `AppsEditorEvents` is read
- **THEN** its value equals the camelCase wire string listed above
- **AND** it equals the value of the same-named member of `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts`

#### Scenario: unprefixed application-editor wire values match the editor host

- **WHEN** each member of `AppsEditorMessages` is read
- **THEN** its value equals the upper-snake-case wire string listed above
- **AND** it equals the value of the same-named member of `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts`

### Requirement: `VisualizerConnector` host-side manager class

The host SHALL use the workspace package `@epam/ai-dial-visualizer-connector`, built from `libs/visualizer-connector`. The package SHALL have no runtime `dependencies` and no `peerDependencies`. It SHALL NOT import `@epam/ai-dial-shared` or `@epam/ai-dial-chat-shared`, or any React or UI package. The root `package.json` SHALL NOT pin the npm release of this package.

`VisualizerCanvasRenderer` in `libs/attachment-canvas` is the sole in-repo consumer and lists the package as a workspace sibling in `dependencies`. The same package also carries the iframe-side `ChatVisualizerConnector` (see the `ChatVisualizerConnector` requirement).

The `VisualizerConnector` class SHALL stay wire-compatible with the npm `0.48.0` release and SHALL satisfy the following.

Constructor: `new VisualizerConnector(root: HTMLElement | string, options: VisualizerConnectorOptions)`

- `root`: the DOM container, or a CSS selector string, into which the iframe is mounted. A selector that matches nothing SHALL throw an `Error`.
- `options.domain`: the visualizer URL.
- `options.hostDomain?: string`: optional and `@deprecated`. The connector SHALL ignore it, and `VisualizerCanvasRenderer` SHALL NOT pass it.
- `options.visualizerName`: the type prefix used on outbound messages. The app supplies it from the registry entry's `title`, and the iframe-side app must be constructed with the identical string.
- `options.requestTimeout?: number`: an optional timeout in milliseconds applied to each `send()` request. It defaults to `10000` and is taken from the registry entry's `requestTimeout` when that is set. It MUST NOT be applied to `ready()`.
- `options.loaderStyles?`: a partial map of CSS declarations applied to the built-in loader overlay while the iframe is not yet ready.
- `options.loaderClass?: string`: CSS class(es) applied to the built-in loader overlay.
- `options.loaderInnerHTML?: string`: an HTML string set as the `innerHTML` of the built-in loader overlay.

Instance methods:

- `ready(): Promise<boolean>`: resolves with `true` after the iframe posts `READY_TO_INTERACT` and rejects on `destroy()`. It SHALL NOT time out. If the iframe never posts `READY_TO_INTERACT`, the promise stays pending indefinitely.
- `send(type: VisualizerConnectorRequests, payload?: unknown, waitForReady = true): Promise<unknown>`:
  - When `waitForReady` is set (the default), it first awaits the handshake.
  - It posts a message of type `${visualizerName}/${type}` with a unique `requestId`.
  - It resolves with the response payload when the iframe posts `${visualizerName}/${type}/RESPONSE` with the same `requestId`.
  - It rejects, with a string, when `requestTimeout` elapses first.
  - If `destroy()` happens while the call is still awaiting the handshake, it resolves with `undefined` instead of rejecting.
  - If the message was already posted, the request is left to time out (see `destroy()` below).
  - A reply that arrives in time SHALL clear that request's timeout timer.
- `subscribe(eventType: string, callback: (payload: unknown) => void): () => void`: registers a listener for unsolicited messages of one event type and returns an unsubscribe function.
- `setVisualizerConnectorOptions(options: VisualizerConnectorOptions): void`: replaces the stored options.
- `destroy(): void`:
  - removes the iframe and the loader;
  - fails the handshake `Task`, so calls awaiting `ready()` reject with the string `'Chat Visualizer destroyed'`;
  - detaches the `message` listener.

  It does **not** reach into pending `requests`: a request whose message was already posted is not cancelled and times out on its own deadline. `destroy()` SHALL be idempotent: a second call is a no-op and does not throw. `destroy()` SHALL NOT write to the console, and the connector's own handshake rejection SHALL NOT surface as an unhandled rejection.

Message reception:

- The class MUST attach a single `window` `message` listener, registered exactly once per instance and removed by `destroy`.
- Inbound messages MUST be discarded when `event.source !== iframeElement.contentWindow`.
- Inbound messages MUST be discarded when `event.data.type` is missing or does not start with `${visualizerName}/`.

**RTL impact:** none. The class renders no user-facing UI beyond the iframe container and a loader SVG with no text.

**Accessibility, i18n, feature flags, telemetry, memoisation:** none at this layer. The iframe's accessible `title` is set by `VisualizerCanvasRenderer`.

#### Scenario: destroy settles a send() that is still awaiting the handshake

- **WHEN** `send()` is called before `READY_TO_INTERACT` has arrived and `destroy()` is called while it is still awaiting `ready()`
- **THEN** the promise returned by `send()` resolves with `undefined`, because the handshake rejection is recognised and swallowed
- **AND** no message is dispatched to the iframe

#### Scenario: destroy rejects a pending ready()

- **WHEN** `ready()` is pending and `destroy()` is called
- **THEN** that promise rejects with the string `'Chat Visualizer destroyed'`
- **AND** the `message` listener is detached, so no further messages reach subscribers

#### Scenario: destroy is idempotent

- **WHEN** `destroy()` is called twice on the same instance
- **THEN** the second call does not throw
- **AND** the container no longer holds the iframe or the loader

#### Scenario: destroy is silent

- **WHEN** `destroy()` is called and nothing awaited `ready()`
- **THEN** nothing is written to `console.error`
- **AND** no unhandled promise rejection is raised

#### Scenario: hostDomain is optional

- **WHEN** the connector is constructed without `hostDomain`
- **THEN** the handshake, `send()` and `subscribe()` behave exactly as when `hostDomain` is passed

#### Scenario: message from wrong source window is ignored

- **WHEN** a `message` event fires with `event.source` different from the iframe's `contentWindow`
- **THEN** the connector does not resolve any pending request
- **AND** the connector does not invoke any subscribed handler

#### Scenario: message outside the visualizer namespace is ignored

- **WHEN** the iframe posts a message whose `type` does not start with `${visualizerName}/`
- **THEN** no pending request is resolved and no subscribed handler is invoked

#### Scenario: message from an unexpected origin is still accepted

- **WHEN** a `message` event fires with `event.source` equal to the iframe's `contentWindow` but an `event.origin` unrelated to the visualizer URL
- **THEN** the message is processed normally

The host connector filters on the source-window reference only and applies no `event.origin` check, which matches `development`. Trust comes from `event.source === iframe.contentWindow`, which an unrelated frame cannot forge. `event.origin` alone would not identify *which* frame sent the message (see `design.md`, Risks, "postMessage spoofing"). Origin filtering on the iframe side is a separate mechanism: `ChatVisualizerConnector` does check inbound origins against its configured `dialHosts`.

#### Scenario: ready resolves after handshake

- **WHEN** the iframe posts `${visualizerName}/READY_TO_INTERACT`
- **THEN** the promise returned by `ready()` resolves

#### Scenario: ready never times out

- **WHEN** the iframe never posts `${visualizerName}/READY_TO_INTERACT`
- **THEN** the promise returned by `ready()` remains pending; it neither resolves nor rejects
- **AND** it rejects only once `destroy()` is called

#### Scenario: per-entry requestTimeout bounds a send

- **WHEN** the connector is constructed with `requestTimeout: 15000` and `send()` is called after the handshake completes
- **THEN** the `send()` promise rejects with a timeout error once 15000 ms pass without a matching `/RESPONSE`

#### Scenario: default send timeout

- **WHEN** the connector is constructed without `requestTimeout` and a `send()` receives no `/RESPONSE`
- **THEN** the `send()` promise rejects after the `10000` ms default

### Requirement: `ChatVisualizerConnector` iframe-side receiver

The workspace package `@epam/ai-dial-visualizer-connector` SHALL export `ChatVisualizerConnector`, the iframe half of the protocol, ported from the npm `@epam/ai-dial-chat-visualizer-connector` `0.49.0` release with the same constructor, methods and wire messages. Visualizer applications and application editors (QuickApps, DIAL Loop) running inside the iframe use it; the host application MUST NOT import it. It SHALL have no runtime dependencies, read no environment, auth, routing or i18n state, and write nothing to the console. Third-party authors MAY keep using the published npm package, whose wire messages are the same.

`ChatVisualizerConnector` SHALL:

- Accept the visualizer's protocol name as a constructor argument (`appName`). This value MUST equal the `title` of the corresponding `CUSTOM_VISUALIZERS` entry on the host, or the editor's application name in the application editor. A mismatch produces a silent failure in which the iframe loads but never receives data.
- Post `${appName}/READY` when the consumer calls `sendReady()`. The constructor itself only attaches the `message` listener — it does NOT announce readiness, so a visualizer that never calls `sendReady()` never completes the handshake.
- Post `${appName}/READY_TO_INTERACT` when the consumer calls `sendReadyToInteract()`.
- Post `${appName}/readyToSave` when the consumer calls `sendReadyToSave()`, and `${appName}/loggedOut` when it calls `sendLoggedOut()`, using the `AppsEditorEvents` wire values.
- Post `${appName}/SEND_MESSAGE` with payload `{ message: content }` and no `requestId` from `sendMessage(content)`.
- Post an `AppsEditorMessages` message unchanged, with no `${appName}/` prefix, from `sendEditorMessage(message, dialHost?)`.
- Hand an inbound `AppsEditorMessages` message from an allowed origin to the `onEditorMessage(message, origin)` callback, whether or not it carries a `payload`. A prefixed copy (`${appName}/TRIGGER_SAVE`) is not an editor message.
- Post every outgoing message to each configured host, or, when `send()` is given a `dialHost`, to that host only.
- Listen for `${appName}/SEND_VISUALIZE_DATA` inbound messages, invoke the `onData` callback when the payload has `visualizerData` (`mimeType` is optional, because Chat 0.x's application editor sends `{ visualizerData: { layout } }` alone), and post `${appName}/SEND_VISUALIZE_DATA/RESPONSE` with the same `requestId` back to the sender's origin.
- Listen for `${appName}/SEND_GROUPED_VISUALIZE_DATA` inbound messages, invoke the `onGroupedData` callback when the payload has `attachments` and `layout`, and post the matching `/RESPONSE`.
- Accept one or more allowed host origins (`dialHost: string | string[]`) and discard any inbound `message` whose `event.origin` does not equal one of them exactly, a trailing `/` on a configured host ignored. Passing the wildcard `'*'` as the **first** entry disables the check entirely. The npm `0.49.0` prefix check (`allowedHost.startsWith(event.origin)`) SHALL NOT be kept.
- Post `${type}/RESPONSE` with the same `requestId` for any other inbound `${appName}/…` request that carries a `requestId`; never answer a message without one, a `/RESPONSE`, or another namespace.
- Ignore any message whose `event.source` is the connector's own window, which is where its own posts land when the iframe is not framed.
- Throw a descriptive error when constructed with an empty host list.
- Treat a missing `onData` as a no-op, without logging.
- Stop listening on `destroy()`; a second call does nothing.

The host handles `SEND_MESSAGE` only when the operator enables it, as specified by the `visualizer-send-message` capability; otherwise the envelope is silently ignored. The host sends `SEND_GROUPED_VISUALIZE_DATA` for application-scoped registry entries, as specified by the `application-visualizers` capability.

#### Scenario: handshake is announced explicitly, not on construction

- **WHEN** a `ChatVisualizerConnector` is constructed with `appName` `'my-viz'` and `sendReady()` is called
- **THEN** it posts a message of type `my-viz/READY`
- **AND** `my-viz/READY_TO_INTERACT` is posted only when `sendReadyToInteract()` is called

#### Scenario: application-editor readiness is posted on request

- **WHEN** `sendReadyToSave()` and then `sendLoggedOut()` are called on a connector with `appName` `'my-viz'`
- **THEN** it posts `my-viz/readyToSave` and then `my-viz/loggedOut` to each configured host

#### Scenario: an editor message is posted unprefixed

- **WHEN** `sendEditorMessage({ type: AppsEditorMessages.SaveSuccess, hasChanges: true })` is called
- **THEN** that object is posted as is to each configured host

#### Scenario: TRIGGER_SAVE reaches onEditorMessage

- **WHEN** an allowed host posts `{ type: 'TRIGGER_SAVE', general: { name: 'App' } }` with no `payload`
- **THEN** `onEditorMessage` is invoked with that message and the host's origin
- **AND** no `/RESPONSE` is posted

#### Scenario: visualize data is acknowledged with the same requestId

- **WHEN** the host posts `my-viz/SEND_VISUALIZE_DATA` with `requestId` `'r-1'`
- **THEN** the consumer-supplied data callback is invoked with the message payload
- **AND** the connector posts `my-viz/SEND_VISUALIZE_DATA/RESPONSE` carrying `requestId` `'r-1'`

#### Scenario: a layout-only SEND_VISUALIZE_DATA is delivered

- **WHEN** the host posts `my-viz/SEND_VISUALIZE_DATA` with payload `{ visualizerData: { layout: { themeId: 'light' } } }` and no `mimeType`
- **THEN** `onData` is invoked with that payload
- **AND** the request is acknowledged

#### Scenario: another request is acknowledged

- **WHEN** the host posts `my-viz/SET_VISUALIZER_OPTIONS` with `requestId` `'r-2'`
- **THEN** the connector posts `my-viz/SET_VISUALIZER_OPTIONS/RESPONSE` carrying `requestId` `'r-2'`

#### Scenario: the connector's own posts are ignored

- **WHEN** a message arrives whose `event.source` is the connector's own window
- **THEN** no callback is invoked and nothing is posted

#### Scenario: message from a host outside dialHosts is discarded

- **WHEN** an inbound `message` event arrives whose `event.origin` is not among the configured `dialHosts`
- **THEN** the payload is ignored and no callback is invoked
- **AND** no `/RESPONSE` is posted back

#### Scenario: an origin that only prefixes a configured host is discarded

- **WHEN** the configured host is `https://chat.example.com` and a message arrives from `https://chat.example.co`
- **THEN** the payload is ignored and no callback is invoked
