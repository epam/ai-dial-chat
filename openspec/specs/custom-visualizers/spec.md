# custom-visualizers Specification

## Purpose

The registry, postMessage protocol, and connectors behind operator-configured custom attachment visualizers.

## Requirements

### Requirement: CustomVisualizer registry entry shape

The system SHALL define a `CustomVisualizer` type in `libs/chat-shared/src/models/custom-visualizer.ts` with the following fields:

- `contentType: string` — required, non-empty. A **comma-separated list of one or more MIME types** this entry matches (e.g. `"application/vnd.plotly.v1+json"` or `"application/vnd.plotly.v1+json, application/vnd.vega.v5+json"`). Preserved verbatim as the raw string on the type; splitting happens at lookup time (see "MIME → registry lookup").
- `url: string` — absolute HTTP(S) URL of the visualizer iframe (required, must have `http:` or `https:` scheme).
- `title: string` — **required, non-empty. This is the postMessage protocol namespace, not merely a display label.** Every message exchanged with the iframe is prefixed `${title}/…`, and the third-party visualizer app passes the same string as the `appName` argument to `ChatVisualizerConnector`. Host and iframe will not communicate at all if the two disagree. It is additionally used as the `visualizerName` on `VisualizerCanvasContent`.
- `requestTimeout?: number` — optional integer ≥ 1 (milliseconds). Bounds each `send()` request for this entry. Defaults to `10000` when unset. It does NOT bound the `READY_TO_INTERACT` handshake — see `design.md` D7.
- `width?: number` — optional integer ≥ 1. Suggested initial width of the canvas panel in pixels. Forwarded in `CustomVisualizerDataLayout`.
- `height?: number` — optional integer ≥ 1. Suggested initial height of the canvas panel in pixels. Forwarded in `CustomVisualizerDataLayout`.
- `mobileHeight?: number` — optional integer ≥ 1. Suggested canvas panel height on mobile-sized screens in pixels. Forwarded in `CustomVisualizerDataLayout`.

The following fields are present on the type for **operator-configuration parity** — they are accepted by the registry loader, preserved in the type, but not consumed by host logic: `description?: string`, `icon?: string`, `passAuthInfo?: boolean`, `passExplicitToken?: boolean`. Their presence MUST NOT cause the entry to be dropped, so that an existing configuration carrying these keys still yields a working visualizer.

The type SHALL be re-exported from the `libs/chat-shared` public entry (`@epam/ai-dial-chat-shared`).

The following fields belong to deferred features, SHALL be omitted from the type, and SHALL be ignored if present in the parsed JSON: `expanded`, `borderless`, `withoutTitle`, `providerId`, `logInHint`. Their presence MAY produce a warning log entry but MUST NOT cause an entry to be dropped.

**Feature flag:** Not gated. Registry is empty by default; feature is dark unless populated.

**RTL impact:** None (type only).

**i18n impact:** None. `title` is an operator-supplied protocol identifier, not a translatable string — it MUST NOT be localised, or the handshake breaks.

#### Scenario: Valid CustomVisualizer entry

- **WHEN** the registry loader parses `{ "contentType": "application/x-my-viz", "url": "https://viz.example.com", "title": "my-viz" }`
- **THEN** the entry is accepted and exposed on the client config
- **AND** `contentType`, `url`, `title` are preserved verbatim

#### Scenario: Entry without a title is rejected

- **WHEN** the registry loader parses an entry with no `title`, or with an empty-string `title`
- **THEN** the entry is dropped with an error log naming the missing protocol identifier
- **AND** other valid entries are still accepted

#### Scenario: Whitespace-only title is accepted

- **WHEN** the registry loader parses an entry whose `title` is `" "`
- **THEN** the entry is accepted and `title` is preserved verbatim, including its whitespace
- **AND** no error is logged

`title` is an opaque postMessage namespace, not a label, so it is never trimmed or normalised: some already-deployed visualizer applications pass a whitespace string as their `appName`, and trimming here would silently break their handshake. Only the absent and empty-string cases are rejected (by `@IsNotEmpty()` on the DTO).

#### Scenario: Entry with a comma-separated contentType matches every listed MIME

- **WHEN** the registry loader parses `{ "contentType": "application/x-a, application/x-b", "url": "https://viz.example.com", "title": "multi" }`
- **THEN** the entry is accepted with `contentType` stored verbatim
- **AND** an attachment whose MIME is `application/x-a` matches the entry
- **AND** an attachment whose MIME is `application/x-b` matches the same entry

#### Scenario: Unknown fields on entry are ignored

- **WHEN** the registry loader parses `{ "contentType": "application/x-my-viz", "url": "https://viz.example.com", "title": "my-viz", "description": "…", "icon": "…", "passAuthInfo": true, "expanded": true }`
- **THEN** the entry is accepted
- **AND** `description`, `icon`, `passAuthInfo` are retained on the resulting `CustomVisualizer` (known fields kept for schema parity, not consumed by host logic)
- **AND** `expanded` is dropped, with a warning naming it as an unrecognised field
- **AND** a warning log entry SHALL be emitted listing the ignored field names

---

### Requirement: `CUSTOM_VISUALIZERS` env variable

`apps/chat-api/src/config/environment.config.ts` SHALL declare an optional `CUSTOM_VISUALIZERS` field on `EnvironmentVariables`, typed `string`, decorated with `@IsOptional()` and `@IsString()`. Boot MUST NOT fail when the variable is missing or an empty string.

Parsing behaviour:

1. When absent or empty → resolved value is `[]`.
2. When present but not valid JSON → resolved value is `[]`; an error log entry is emitted and boot continues.
3. When JSON is valid but not an array → resolved value is `[]`; an error log entry is emitted.
4. When JSON is a valid array → each element is validated against the `CustomVisualizer` shape:
   - `contentType` is a non-empty string (may be a comma-separated MIME list; at least one non-empty MIME must remain after splitting and trimming).
   - `url` matches `@IsUrl({ require_protocol: true, protocols: ['http','https'] })`.
   - `title` is a **required** non-empty string (the protocol namespace — see "CustomVisualizer registry entry shape"). It is validated by `@IsNotEmpty()` only and is NOT trimmed: a whitespace-only `title` is accepted verbatim.
   - `requestTimeout`, `width`, `height`, `mobileHeight` are optional integers ≥ 1.
   Entries that fail validation are dropped with an error log; other entries continue to be accepted.

**Feature flag:** Not gated. The env var itself is the gate.

#### Scenario: env variable missing

- **WHEN** `CUSTOM_VISUALIZERS` is unset
- **THEN** the resolved registry is the empty array `[]`
- **AND** the API boots successfully

#### Scenario: env variable contains invalid JSON

- **WHEN** `CUSTOM_VISUALIZERS='not-json'`
- **THEN** the resolved registry is `[]`
- **AND** an error is logged
- **AND** the API boots successfully

#### Scenario: mixed valid / invalid entries

- **WHEN** `CUSTOM_VISUALIZERS='[{"contentType":"application/x-my-viz","url":"https://viz.example.com","title":"my-viz"},{"contentType":"","url":"not-a-url","title":"bad"}]'`
- **THEN** the resolved registry contains only the first entry
- **AND** the invalid entry is dropped with an error log

---

### Requirement: postMessage protocol constants

The protocol constants SHALL live in the workspace package `@epam/ai-dial-visualizer-connector` (`libs/visualizer-connector`). That package exports four string enums with PascalCase members:

- `VisualizerConnectorRequests`: `SendVisualizeData`, `SendGroupedVisualizeData`, `SetVisualizerOptions`;
- `VisualizerConnectorEvents`: `InitReady`, `Ready`, `ReadyToInteract`, `SendMessage`, `CreatedConversationSuccess`, `UpdatedConversationSuccess`, `UpdatedApplicationSuccess`;
- `AppsEditorEvents`: `ReadyToInteract`, `ReadyToSave`, `LoggedOut`, `UpdatedApplicationSuccess` — the events an application-editor iframe posts to the application editor, with the camelCase wire values `readyToInteract`, `readyToSave`, `loggedOut`, `updatedApplicationSuccess` that `AppsEditorEvent` in `apps/chat/src/types/apps-editor.ts` matches on;
- `AppsEditorMessages`: `TriggerSave`, `SaveSuccess`, `SaveError`, `ValidityState`, `DirtyState`, `RequestToolsetLogin`, `ToolsetLoginResult`, `RequestToolsetLogout`, `ToolsetLogoutResult`, `RequestApplicationCredentials`, `RequestExternalServiceLogin`, `ExternalServiceLoginResult` — the application editor's unprefixed save and auth messages, with the wire values `TRIGGER_SAVE`, `SAVE_SUCCESS`, `SAVE_ERROR`, `VALIDITY_STATE`, `DIRTY_STATE`, `REQUEST_TOOLSET_LOGIN`, `TOOLSET_LOGIN_RESULT`, `REQUEST_TOOLSET_LOGOUT`, `TOOLSET_LOGOUT_RESULT`, `REQUEST_APPLICATION_CREDENTIALS`, `REQUEST_EXTERNAL_SERVICE_LOGIN`, `EXTERNAL_SERVICE_LOGIN_RESULT`.

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

### Requirement: Typed application-editor host and client

The existing workspace package `@epam/ai-dial-visualizer-connector` SHALL export `AppsEditorHost`, `AppsEditorClient`, and direction-specific discriminated message types. These adapters SHALL preserve the deployed editor wire protocol: lifecycle events use `${applicationName}/${AppsEditorEvents}` and save, validity, dirty-state, and auth messages use the unprefixed `AppsEditorMessages` values. Uppercase `VisualizerConnectorEvents` remain a separate visualizer protocol and SHALL NOT grant editor readiness.

`AppsEditorHost<TGeneral = unknown, TCredentials = unknown>` SHALL receive a caller-supplied target window, target origin, application namespace, and message callback; its outgoing General metadata and credential payload types SHALL remain generic. `AppsEditorClient` SHALL receive a host origin and application namespace, an optional host window defaulting to `window.parent`, and an optional message callback. The client SHALL offer typed send helpers for lifecycle, save results, validity, dirtiness, toolset login/logout requests, application-credentials requests, and external-service login requests (`requestExternalServiceLogin(appId, serviceId, { offlineUsageConsent })`). Neither adapter SHALL create an iframe or perform authentication, routing, API requests, or state persistence.

Both adapters SHALL check the sender window and exact normalized origin before delivering a message. The shared parser SHALL reject malformed envelopes and messages belonging to the other direction. `REQUEST_EXTERNAL_SERVICE_LOGIN` SHALL carry nonempty `appId` and `serviceId` and a boolean `offlineUsageConsent`; `EXTERNAL_SERVICE_LOGIN_RESULT` SHALL carry nonempty `appId` and `serviceId`, a boolean `success` and an optional string `reason` whose vocabulary the host owns. Neither carries credential material or OAuth configuration. Lifecycle callback types SHALL be normalized to the unprefixed `AppsEditorEvents` discriminant. General metadata, updated application data, and credentials SHALL remain opaque on receipt for the consuming application to validate.

The receive boundary SHALL retain these legacy forms: `SAVE_ERROR` with a top-level `error` or nested `payload.error`; `DIRTY_STATE` with nested `payload.isDirty` or top-level `isDirty`; `SAVE_SUCCESS` with `hasChanges` omitted or not boolean, normalized to `false` unless exactly `true`. Preview's `TRIGGER_SAVE` SHALL be valid without `general`.

The host's optional `onActivity` callback SHALL report messages from the expected window and origin independently of recognized editor messages. Activity SHALL NOT imply UI readiness or save readiness. `destroy()` SHALL remove listeners and suppress subsequent sends, and repeated destruction SHALL be harmless. The existing visualizer classes SHALL keep their behavior; the loose editor API on `ChatVisualizerConnector` SHALL be deprecated in favor of `AppsEditorClient` without changing its wire messages.

`apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx` SHALL use the shared host adapter and retain ownership of React lifecycle state, schema/URL resolution, feature policy, authentication actions, credentials retrieval, domain payload validation, and translated UI. No new feature flag, cache, telemetry, translated string, or visual surface is introduced; RTL and keyboard behavior are unchanged.

#### Scenario: Typed editor messages retain the deployed wire format

- **WHEN** a client named `QuickApp` reports readiness and then a successful save with changes
- **THEN** it posts `QuickApp/readyToSave` and `{ type: 'SAVE_SUCCESS', hasChanges: true }`
- **AND** the host callback receives the readiness discriminant `AppsEditorEvents.ReadyToSave` and a typed save-success message

#### Scenario: Foreign windows and origins cannot drive editor state

- **WHEN** a message has the correct editor namespace but the wrong sender window or origin
- **THEN** neither the message callback nor the activity callback runs

#### Scenario: Direction and envelope validation precede callbacks

- **WHEN** the host receives a host-to-editor `TRIGGER_SAVE` or a `VALIDITY_STATE` without a boolean `payload.isValid`
- **THEN** the host does not deliver it to its message callback

#### Scenario: Legacy editor field placements normalize at the boundary

- **WHEN** an authorized editor posts a nested save error, a top-level dirty state, or a save success without `hasChanges`
- **THEN** the host receives the normalized error string, boolean dirty state, or `hasChanges: false`, respectively

#### Scenario: Visualizer readiness remains separate

- **WHEN** the editor posts `QuickApp/READY` or `QuickApp/READY_TO_INTERACT`
- **THEN** the host may report activity but does not deliver an editor readiness message
- **AND** Save and Preview remain gated until an explicit editor `readyToSave` arrives

#### Scenario: Destroyed adapters stop communication

- **WHEN** either adapter is destroyed and then receives or sends another message
- **THEN** no callback runs and no message is posted
- **AND** destroying it again has no effect

#### Scenario: External-service login request and result keep their shapes

- **WHEN** a client calls `requestExternalServiceLogin('applications/public/runner app', 'gitlab-oauth', { offlineUsageConsent: true })`
- **THEN** it posts `{ type: 'REQUEST_EXTERNAL_SERVICE_LOGIN', appId: 'applications/public/runner app', serviceId: 'gitlab-oauth', offlineUsageConsent: true }`
- **AND** the host parser rejects the same message without `offlineUsageConsent` or with an empty `serviceId`
- **AND** the client parser accepts `EXTERNAL_SERVICE_LOGIN_RESULT` with `success: false, reason: 'cancelled'` and rejects it without a boolean `success`

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

### Requirement: `SEND_VISUALIZE_DATA` payload shape

The `SEND_VISUALIZE_DATA` request payload SHALL match the `AttachmentData` type:

```ts
interface AttachmentData {
  mimeType: string;
  visualizerData: CustomVisualizerData;
}

interface CustomVisualizerData {
  layout: CustomVisualizerDataLayout;
  // opaque attachment payload consumed by the third-party visualizer
  [key: string]: unknown;
}

interface CustomVisualizerDataLayout {
  width?: number;
  height?: number;
  mobileHeight?: number;
  themeId: string;
}
```

`CustomVisualizerDataLayout` MUST NOT carry any authentication or identity fields — specifically `logInHint`, `providerId`, and `accessToken` MUST NOT be present in the type. The layout describes presentation only.

#### Scenario: layout carries theme id

- **WHEN** the host sends `SEND_VISUALIZE_DATA`
- **THEN** `payload.visualizerData.layout.themeId` equals the current theme id from the host's theme context

---

### Requirement: Deferred features

The following features SHALL NOT be implemented **on the host side**:

- Auth-token forwarding (`passAuthInfo`, `passExplicitToken`) or any inclusion of `accessToken`, `providerId`, or `logInHint` in outbound payloads or iframe URLs.
- Locale, language, or `dir` propagation into the iframe URL query string.

Grouped/application-level visualizers are no longer deferred: the host sends
`SEND_GROUPED_VISUALIZE_DATA` for an application-scoped registry entry, specified by the
`application-visualizers` capability. Auth-token forwarding remains deferred for that
registry too — its `passAuthInfo` / `passExplicitToken` fields are accepted for
configuration parity and are inert, because 1.0 auth is server-side and the browser
holds no access token.

`SEND_MESSAGE` iframe → host is no longer deferred: it is specified by the
`visualizer-send-message` capability and is off unless the operator sets
`ALLOW_VISUALIZER_SEND_MESSAGES`.

Any implementation that adds the remaining features SHALL be a separate OpenSpec change.

#### Scenario: SEND_MESSAGE is ignored while the operator flag is off

- **WHEN** `ALLOW_VISUALIZER_SEND_MESSAGES` is unset or `false` and a visualizer iframe posts `${visualizerName}/SEND_MESSAGE`
- **THEN** the host does not dispatch a chat message
- **AND** no error is thrown; the message is silently ignored

#### Scenario: iframe URL is unmodified

- **WHEN** the host mounts a visualizer iframe
- **THEN** the iframe `src` equals the configured `url` for that entry
- **AND** no `?currentLocale=`, `?dir=`, or `?token=` query parameter is appended

#### Scenario: Grouped delivery is available to application-scoped entries only

- **WHEN** an attachment is matched through the MIME-keyed `CUSTOM_VISUALIZERS` registry
- **THEN** the host sends `SEND_VISUALIZE_DATA` for that single attachment
- **AND** it does not send `SEND_GROUPED_VISUALIZE_DATA`

---

### Requirement: iframe sandbox attribute

The iframe SHALL be mounted with a `sandbox` attribute granting the capability set that interactive visualizers require, and MUST withhold `allow-top-navigation`.

Visualizers are operator-configured applications that render rich, interactive content — charts that export to file, documents that open a print or fullscreen view, panels that copy a value to the clipboard. The sandbox therefore grants the capabilities those interactions require, and trust is established by the operator explicitly listing the URL in `CUSTOM_VISUALIZERS`, not by restricting the frame.

The required `sandbox` tokens are:

- `allow-same-origin`
- `allow-scripts`
- `allow-modals`
- `allow-forms`
- `allow-downloads`
- `allow-popups`
- `allow-presentation`

The iframe SHALL additionally carry an `allow` attribute granting: `clipboard-write`, `fullscreen`, `accelerometer`, `gyroscope`, `autoplay`, `web-share`, `encrypted-media`.

`allow-top-navigation` MUST NOT be granted — a visualizer must never be able to navigate the host page away.

The `sandbox` token set is hardcoded in the `VisualizerConnector` implementation and is not overridable via options.

`allow-same-origin` and `allow-scripts` together remove the sandbox's isolation guarantee for a document that shares the host's origin (the framed document could then reach the host's storage/cookies/DOM via same-origin script access). This is accepted because `url` is expected to be a third-party origin distinct from the DIAL Chat host. Operators MUST NOT host a visualizer on the same origin as the DIAL Chat host.

#### Scenario: sandbox tokens

- **WHEN** the iframe is mounted
- **THEN** the `sandbox` attribute contains `allow-same-origin`, `allow-scripts`, `allow-modals`, `allow-forms`, `allow-downloads`, `allow-popups`, and `allow-presentation`
- **AND** it does NOT contain `allow-top-navigation`

#### Scenario: allow attribute is set

- **WHEN** the iframe is mounted
- **THEN** its `allow` attribute grants `clipboard-write`, `fullscreen`, `accelerometer`, `gyroscope`, `autoplay`, `web-share`, and `encrypted-media`

---

### Requirement: `useCustomVisualizers` client hook

`apps/chat/src/hooks/attachment/useCustomVisualizers.ts` (or the existing `useAppConfig` accessor) SHALL expose the parsed `CustomVisualizer[]` registry to app-level consumers. The hook SHALL:

- Return `[]` while the app-config request is loading.
- Return `[]` on config error.
- Return the resolved registry once the config is ready.
- Memoise the value so referential equality is stable across renders until the underlying config changes.

The registry SHALL be sourced only from `AppConfigContext`. Libs SHALL NOT read this hook directly.

#### Scenario: registry is empty while loading

- **WHEN** `AppConfigContext.status === 'loading'`
- **THEN** `useCustomVisualizers()` returns `[]`

#### Scenario: registry is stable across re-renders

- **WHEN** the parent component re-renders without a config change
- **THEN** the array reference returned by `useCustomVisualizers()` is identical to the previous render

---

### Requirement: MIME → registry lookup

A helper (e.g. `findVisualizerForMime(mime, registry)`) SHALL locate the first entry in the registry that matches the attachment MIME.

Matching rules:

- The entry's `contentType` SHALL be split on `,` and each part trimmed, yielding one or more candidate MIME types. An entry matches when ANY candidate equals the attachment MIME.
- Comparison is case-insensitive on both sides.
- Empty parts produced by splitting (e.g. a trailing comma) SHALL be skipped, never treated as a wildcard match.
- When several entries match the same MIME, the FIRST entry in registry order wins. Registry order is therefore significant and MUST be preserved end to end, from the parsed env value through to the client.
- When no entry matches, the helper returns `undefined`.

Escaping commas inside a MIME type is NOT supported, and no escape syntax SHALL be introduced: RFC 2045 does not permit an unquoted comma in a media type or subtype, so a comma in the field is always a separator.

#### Scenario: case-insensitive match

- **WHEN** the registry contains `contentType: 'application/x-my-viz'` and the attachment MIME is `Application/X-MY-VIZ`
- **THEN** the helper returns the registry entry

#### Scenario: comma-separated contentType matches any listed MIME

- **WHEN** the registry contains `contentType: 'application/x-a, application/x-b'` and the attachment MIME is `application/x-b`
- **THEN** the helper returns that entry

#### Scenario: first matching entry wins

- **WHEN** two entries both list `application/x-my-viz` in their `contentType`
- **THEN** the helper returns the entry appearing first in the registry array

#### Scenario: trailing comma does not create a wildcard

- **WHEN** the registry contains `contentType: 'application/x-a,'` and the attachment MIME is `application/pdf`
- **THEN** the helper returns `undefined`

#### Scenario: no match

- **WHEN** no entry's `contentType` matches
- **THEN** the helper returns `undefined`
