## MODIFIED Requirements

### Requirement: postMessage protocol constants

The protocol constants SHALL live in the workspace package `@epam/ai-dial-visualizer-connector` (`libs/visualizer-connector`). That package exports two string enums with PascalCase members:

- `VisualizerConnectorRequests`: `SendVisualizeData`, `SendGroupedVisualizeData`, `SetVisualizerOptions`;
- `VisualizerConnectorEvents`: `InitReady`, `Ready`, `ReadyToInteract`, `SendMessage`, `CreatedConversationSuccess`, `UpdatedConversationSuccess`, `UpdatedApplicationSuccess`.

The wire string values SHALL be the ones visualizers already built on `@epam/ai-dial-chat-visualizer-connector` expect, unchanged: `SEND_VISUALIZE_DATA`, `SEND_GROUPED_VISUALIZE_DATA`, `SET_VISUALIZER_OPTIONS`, `INIT_READY`, `READY`, `READY_TO_INTERACT`, `SEND_MESSAGE`, `CREATED_CONVERSATION_SUCCESS`, `UPDATED_CONVERSATION_SUCCESS`, `UPDATED_APPLICATION_SUCCESS`.

The **runtime** host path (`VisualizerCanvasRenderer`) SHALL import both enums from `@epam/ai-dial-visualizer-connector`, and the workspace SHALL NOT depend on `@epam/ai-dial-shared`. This monorepo SHALL NOT duplicate those protocol enums in `libs/chat-shared`. Host config and canvas payload types stay in `libs/chat-shared/src/models/custom-visualizer.ts`, separate from the connector's wire surface.

#### Scenario: runtime send uses the workspace enum

- **WHEN** `VisualizerCanvasRenderer` delivers visualize data
- **THEN** it calls `connector.send(VisualizerConnectorRequests.SendVisualizeData, …)` where `VisualizerConnectorRequests` is imported from `@epam/ai-dial-visualizer-connector`
- **AND** the posted message type is still `${visualizerName}/SEND_VISUALIZE_DATA`

#### Scenario: wire values are unchanged

- **WHEN** each member of `VisualizerConnectorRequests` and `VisualizerConnectorEvents` is read
- **THEN** its value equals the upper-snake-case wire string listed above

---

### Requirement: `VisualizerConnector` host-side manager class

The host SHALL use the workspace package `@epam/ai-dial-visualizer-connector`, built from `libs/visualizer-connector`. The package SHALL have no runtime `dependencies` and no `peerDependencies`. It SHALL NOT import `@epam/ai-dial-shared` or `@epam/ai-dial-chat-shared`, or any React or UI package. The root `package.json` SHALL NOT pin the npm release of this package.

`VisualizerCanvasRenderer` in `libs/attachment-canvas` is the sole in-repo consumer and lists the package as a workspace sibling in `dependencies`. The iframe-side `@epam/ai-dial-chat-visualizer-connector` stays out of scope (see the `ChatVisualizerConnector` requirement).

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
