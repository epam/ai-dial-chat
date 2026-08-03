## ADDED Requirements

### Requirement: Publishable package metadata

`libs/chat-overlay/package.json` SHALL declare `"name": "@epam/ai-dial-chat-overlay"`, `"license": "Apache-2.0"`, and a one-sentence `"description"` (no trailing period, not equal to the package name), placed directly after `"name"`/`"version"` per this repo's lib conventions. The `project.json` SHALL tag the project `"publishable"` and define a `publish` target that runs `node tools/publish-lib.mjs chat-overlay --version={args.ver} --dry={args.dry} --tag={args.tag} --development={args.development}`, matching `libs/conversation-input/project.json`.

#### Scenario: Package name is not the retired name

- **WHEN** `libs/chat-overlay/package.json` is inspected
- **THEN** `"name"` is `"@epam/ai-dial-chat-overlay"`
- **AND** it is NOT `"@epam/ai-dial-overlay"`

#### Scenario: Publish target mirrors the reference publishable lib

- **WHEN** `npm exec nx run chat-overlay:publish -- --dry=true` is executed after a build
- **THEN** it invokes `tools/publish-lib.mjs` the same way `libs/conversation-input`'s `publish` target does, writing a publish-ready `package.json` into `dist/libs/chat-overlay`

### Requirement: Vite library-mode build with chat-shared externalized

`libs/chat-overlay/vite.config.mts` SHALL build in Vite library mode (`build.lib`, `formats: ['es']`) with `vite-plugin-dts` for declaration output, matching `libs/conversation-input/vite.config.mts`'s structure. `@epam/ai-dial-chat-shared` SHALL be listed in `build.rollupOptions.external` and as a `peerDependencies` entry in `package.json` — it MUST NOT be bundled into the published output. The lib SHALL NOT depend on React, `react-dom`, or any UI-kit package.

#### Scenario: chat-shared is externalized, not bundled

- **WHEN** `npm exec nx build chat-overlay` runs and the output in `dist/libs/chat-overlay/index.js` is inspected
- **THEN** it contains an unresolved `import`/`require` reference to `@epam/ai-dial-chat-shared`
- **AND** it does NOT contain the inlined source of any `@epam/ai-dial-chat-shared` module

#### Scenario: No React dependency

- **WHEN** `libs/chat-overlay/package.json` dependencies and peerDependencies are inspected
- **THEN** neither `react` nor `react-dom` appears

### Requirement: Public API surface

`libs/chat-overlay/src/index.ts` SHALL preserve its existing public API and additionally export the `OverlayAuthUiMode` and `OverlayRequestErrorCode` enums (re-exported from `@epam/ai-dial-chat-shared`), the `ChatOverlayRequestError` class, and the pure protocol types from `@epam/ai-dial-chat-shared` needed by consumers (`ChatOverlayOptions`, `OverlayRequestError`, the request/event type unions, response payload types for every v1 method). It SHALL NOT export the internal `Task`/`DeferredRequest`-equivalent helper classes.

#### Scenario: Internal transport helpers are not exported

- **WHEN** `libs/chat-overlay/src/index.ts` is inspected
- **THEN** no symbol named `Task` or `DeferredRequest` (or their chosen internal equivalents) appears in the export list

#### Scenario: Consumer can import everything needed from one entry point

- **WHEN** a consumer writes `import { ChatOverlay, ChatOverlayManager, ChatOverlayOptions, OverlayAuthUiMode } from '@epam/ai-dial-chat-overlay'`
- **THEN** the import resolves without needing a separate import from `@epam/ai-dial-chat-shared`

#### Scenario: OverlayAuthUiMode is available from the library entry point

- **WHEN** a consumer imports `OverlayAuthUiMode` from `'@epam/ai-dial-chat-overlay'`
- **THEN** it has members `External` and `SameWindow` without requiring a separate `@epam/ai-dial-chat-shared` import

#### Scenario: Request errors are available from the library entry point

- **WHEN** a consumer imports `ChatOverlayRequestError` and `OverlayRequestErrorCode` from `@epam/ai-dial-chat-overlay`
- **THEN** both imports resolve without importing the shared or internal transport packages directly

### Requirement: ChatOverlay creates and manages a single iframe

`ChatOverlay`'s constructor SHALL accept `(root: HTMLElement | string, options: ChatOverlayOptions)`, resolve `root` to an element (throwing a descriptive error if a string selector matches nothing), create one `<iframe>` whose `src` is `options.domain`, and append a loader element and the iframe into `root`. The iframe SHALL set `name="overlay"`, a non-empty `aria-label`, `sandbox` tokens `allow-same-origin allow-scripts allow-modals allow-forms allow-popups allow-downloads allow-popups-to-escape-sandbox`, and an `allow` permissions-policy string that includes `clipboard-write` and additionally `microphone` only when `options.enabledFeatures` includes the voice-input feature.

#### Scenario: Constructing with a missing selector throws

- **WHEN** `new ChatOverlay('#does-not-exist', options)` is called
- **THEN** it throws an `Error` naming the selector and the library

#### Scenario: iframe has an accessible name

- **WHEN** a `ChatOverlay` is constructed
- **THEN** the created `<iframe>` element has a non-empty `aria-label` attribute

#### Scenario: Microphone permission is opt-in

- **WHEN** a `ChatOverlay` is constructed without the voice-input feature enabled
- **THEN** the iframe's `allow` attribute does NOT include `microphone`

### Requirement: Loader visibility follows configured hide event

`ChatOverlay` SHALL render a loader (default animated SVG, or `options.loaderInnerHTML` if provided, styled via `options.loaderStyles`/`options.loaderClass`) that stays visible until the event named by `options.loaderHideEvent` occurs; if `loaderHideEvent` is unset, the loader hides on the app's `READY` event.

#### Scenario: Default loader hides on READY

- **WHEN** no `loaderHideEvent` option is provided and the app sends its `READY` event
- **THEN** the loader element becomes hidden

#### Scenario: Custom loaderHideEvent postpones hiding

- **WHEN** `loaderHideEvent` is set to `READY_TO_INTERACT` and only `READY` has been received so far
- **THEN** the loader remains visible until `READY_TO_INTERACT` is received

### Requirement: v1 method surface

`ChatOverlay` SHALL implement, each returning a `Promise` resolved from the matching protocol response: `ready()`, `destroy()`, `allowFullscreen()`, `openFullscreen()`, `subscribe(eventType, callback): () => void`, `setOverlayOptions(options)`, `getMessages()`, `sendMessage(content: string)`, `setInputContent(content: string)`, `setSystemPrompt(systemPrompt: string)`, `setTemperature(temperature: number)`, `getConversations()`, `getSelectedConversations()`, `selectConversation(id: string)`, `createConversation(options?: { deploymentId?: string; firstMessage?: string })`, `createLocalConversation()`, `deleteConversation(id: string)`, `renameConversation(id: string, newName: string)`. It SHALL NOT implement `createPlaybackConversation`, `stopSelectedPlaybackConversation`, `exportConversation`, or `importConversation` in this change.

`createConversation`'s option object replaces the old positional `(parentPath?, local?)` signature: `parentPath` has no replacement (this app has no folder concept for conversations), and `local` is replaced by omitting `firstMessage` — `createConversation()` with no `firstMessage` behaves identically to `createLocalConversation()`.

#### Scenario: sendMessage resolves with the response payload

- **WHEN** `overlay.sendMessage('Hello')` is called and the app responds with a `SEND_MESSAGE/RESPONSE` message carrying `{ messages: [...] }`
- **THEN** the returned promise resolves with `{ messages: [...] }`

#### Scenario: Still-deferred methods are absent from the public type

- **WHEN** the `ChatOverlay` public TypeScript type is inspected
- **THEN** it has no `createPlaybackConversation`, `stopSelectedPlaybackConversation`, `exportConversation`, or `importConversation` members

#### Scenario: Conversation-list methods are present on the public type

- **WHEN** the `ChatOverlay` public TypeScript type is inspected
- **THEN** it has `getConversations`, `getSelectedConversations`, `selectConversation`, `createConversation`, `createLocalConversation`, `deleteConversation`, and `renameConversation` members with the signatures described above

#### Scenario: createConversation with no firstMessage matches createLocalConversation

- **WHEN** `overlay.createConversation()` is called with no arguments
- **AND** `overlay.createLocalConversation()` is called separately
- **THEN** both requests are dispatched with a payload where `firstMessage` is absent, and both resolve however the app answers an omitted-`firstMessage` `CREATE_CONVERSATION`/`CREATE_LOCAL_CONVERSATION` request (`{ conversation: null }` per `chat-overlay-app-mode`)

#### Scenario: Requests wait for ready before sending

- **WHEN** `overlay.sendMessage('Hello')` is called before the handshake completes
- **THEN** no `postMessage` call is made until `ready()` resolves

#### Scenario: Requests do not timeout before ready

- **WHEN** `overlay.sendMessage('Hello')` is called before the handshake completes with `requestTimeout: 50`
- **AND** `ready()` has not resolved after 50ms
- **THEN** the promise has not rejected yet
- **AND** the request is posted only after `ready()` resolves

### Requirement: Structured app failures reject with ChatOverlayRequestError

When a matching response contains a top-level protocol `error`, `ChatOverlay` SHALL remove the request from its pending set and reject its promise immediately with `ChatOverlayRequestError`. The error SHALL have `name: 'ChatOverlayRequestError'`, expose the stable protocol `code`, expose the original `requestType`, and include the app-provided message in its human-readable `message`. `ChatOverlayManager` SHALL preserve this rejection unchanged when forwarding methods. This path is distinct from the existing unanswered-request timeout error.

#### Scenario: Active conversation is unavailable

- **WHEN** `overlay.getMessages()` receives a matching response with `error.code: 'ACTIVE_CONVERSATION_UNAVAILABLE'`
- **THEN** it rejects before `requestTimeout` with `ChatOverlayRequestError`
- **AND** the error's `code` is `OverlayRequestErrorCode.ActiveConversationUnavailable`
- **AND** its `requestType` is `OverlayRequestType.GetMessages`

#### Scenario: Manager preserves a structured rejection

- **WHEN** `manager.setTemperature(overlayId, 0.2)` is rejected by the underlying overlay with `ChatOverlayRequestError`
- **THEN** the manager promise rejects with that error rather than replacing it with a generic timeout or manager error

#### Scenario: Unanswered request still uses timeout error

- **WHEN** a posted request receives neither a success response nor an error response before `requestTimeout`
- **THEN** its promise rejects with the existing timeout error naming the request type and timeout

### Requirement: destroy() releases all resources

`ChatOverlay.destroy()` SHALL remove the `window` `message` listener, remove the iframe and loader from `root`, and reject the internal readiness gate (so any request awaiting readiness rejects rather than hanging forever). Calling `destroy()` twice SHALL NOT throw.

#### Scenario: Listener is removed on destroy

- **WHEN** `destroy()` is called and a `message` event is subsequently dispatched matching a pending request
- **THEN** the destroyed instance's internal state is not mutated by that event

#### Scenario: Pending request rejects after destroy

- **WHEN** `overlay.getMessages()` is called and `destroy()` is invoked before any response arrives
- **THEN** the `getMessages()` promise rejects

#### Scenario: Double destroy is safe

- **WHEN** `destroy()` is called twice in a row
- **THEN** no error is thrown

### Requirement: ChatOverlayManager provides multi-overlay placement and chrome

`ChatOverlayManager` SHALL create, per `createOverlay(options: ChatOverlayManagerOptions)` call, one fixed-position container with a toggle button, a close button, and — when `options.allowFullscreen` is true — a fullscreen button, positioned per `options.position` (`left-bottom | left-top | right-bottom | right-top`, default `right-bottom`) and sized per `options.width`/`options.height`/`options.zIndex` with documented defaults. It SHALL forward every implemented `ChatOverlay` method (`ready`, `getMessages`, `sendMessage`, `setInputContent`, `setSystemPrompt`, `setTemperature`, `setOverlayOptions`, `subscribe`, `getConversations`, `getSelectedConversations`, `selectConversation`, `createConversation`, `createLocalConversation`, `deleteConversation`, `renameConversation`) keyed by `overlayId`, and expose `showOverlay`/`hideOverlay`/`removeOverlay`/`openFullscreen`/`destroy`. It SHALL recompute position/size on `resize` and `orientationchange` (removing its listeners via `AbortController` in `destroy()`), and SHALL switch to a full-viewport mobile layout under the same breakpoint logic as the reference implementation.

#### Scenario: Unknown overlayId throws

- **WHEN** `manager.sendMessage('missing-id', 'hi')` is called for an id that was never created
- **THEN** it throws an `Error` naming the missing id

#### Scenario: Unknown overlayId throws for conversation-list methods too

- **WHEN** `manager.deleteConversation('missing-id', 'conv-1')` is called for an overlay id that was never created
- **THEN** it throws an `Error` naming the missing id, identically to the pre-existing v1 methods

#### Scenario: removeOverlay cleans up its DOM and forwarding

- **WHEN** `manager.removeOverlay('test')` is called
- **THEN** the container and toggle button for `'test'` are removed from `document.body`
- **AND** subsequent calls referencing `'test'` throw the unknown-id error

#### Scenario: destroy removes all overlays and global listeners

- **WHEN** `manager.destroy()` is called with two active overlays
- **THEN** both overlays' `destroy()` is invoked and both containers are removed from `document.body`
- **AND** the manager's `resize`/`orientationchange` listeners no longer fire on subsequent window resize events

### Requirement: Toggle/close/fullscreen buttons are keyboard-accessible

Every button `ChatOverlayManager` creates (toggle, close, fullscreen) SHALL be a real `<button>` element with a non-empty, English-default `aria-label` describing its action (e.g. "Open chat", "Collapse", "Open full screen"), reachable and activatable via keyboard (native button semantics — no `tabIndex="-1"` or click-only handlers), with a visible `:focus-visible` treatment at least as prominent as its `:hover` treatment.

#### Scenario: Toggle button has an accessible name

- **WHEN** `ChatOverlayManager.createOverlay(...)` runs
- **THEN** the created toggle `<button>` has a non-empty `aria-label`

#### Scenario: Buttons are focusable via keyboard

- **WHEN** a user tabs through the page containing a `ChatOverlayManager` overlay
- **THEN** the toggle, close, and (if enabled) fullscreen buttons each receive focus in DOM order without any `tabindex` override

### Requirement: Conversation-list methods forward requestId'd promises like existing v1 methods

`getConversations()`, `getSelectedConversations()`, `selectConversation(id)`, `createConversation(options?)`, `createLocalConversation()`, `deleteConversation(id)`, and `renameConversation(id, newName)` SHALL each dispatch a single request through the same `send()`/readiness-gate/timeout machinery every other `ChatOverlay` method already uses (`chat-overlay-protocol`'s request/response matching requirement) — no separate transport path is introduced for these seven methods.

#### Scenario: getConversations waits for ready

- **WHEN** `overlay.getConversations()` is called before the handshake completes
- **THEN** no `postMessage` call is made until `ready()` resolves, identically to `getMessages()`

#### Scenario: createConversation times out like any other request

- **WHEN** `overlay.createConversation({ firstMessage: 'Hi' })` is called with `requestTimeout: 50` and no response arrives within 50ms
- **THEN** the returned promise rejects with an error mentioning `CREATE_CONVERSATION` and `50`, matching the existing timeout error shape

### Requirement: README documents the seven new methods and the createConversation compatibility break

`libs/chat-overlay/README.md` SHALL document `getConversations`, `getSelectedConversations`, `selectConversation`, `createConversation`, `createLocalConversation`, `deleteConversation`, and `renameConversation` with usage examples, and SHALL call out explicitly that `createConversation`'s option-object signature replaces the historical positional `(parentPath?, local?)` shape used by pre-`@epam/ai-dial-chat-overlay` overlay integrations, including what happened to `parentPath` (dropped, no equivalent) and `local` (replaced by omitting `firstMessage`).

#### Scenario: README documents the signature change

- **WHEN** `libs/chat-overlay/README.md` is inspected
- **THEN** it contains a note that `createConversation`'s signature changed from a positional `(parentPath?, local?)` shape to `(options?: { deploymentId?; firstMessage? })`, explaining the removal of `parentPath` and the `local` → omitted-`firstMessage` mapping

### Requirement: setOverlayOptions and initial handshake send enabledFeatures

`ChatOverlay.setOverlayOptions` SHALL accept `Partial<Pick<ChatOverlayOptions, 'theme' | 'modelId' | 'overlayConversationId' | 'enabledFeatures'>>`. When `enabledFeatures` is supplied, it SHALL replace (not merge with) the instance's stored `options.enabledFeatures`. `sendCurrentOverlayOptions` (the private method also used for the initial `READY`-triggered handshake send) SHALL include `enabledFeatures` in the outgoing `SetOverlayOptionsPayload` whenever `this.options.enabledFeatures` is defined, mirroring how `theme`/`modelId`/`overlayConversationId` are already conditionally included. `ChatOverlayManager.setOverlayOptions(overlayId, options)` SHALL forward the same expanded parameter shape to the underlying `ChatOverlay` instance, unchanged in every other respect.

Enabling `enabledFeatures` after construction does not retroactively change the iframe's `allow` permissions attribute (already set at iframe creation, per the existing "Microphone permission is opt-in" requirement) — a host that wants to add `voice-input` after the fact must still request microphone access through the pre-existing construction-time mechanism; this change does not add iframe permission-attribute mutation after mount.

#### Scenario: setOverlayOptions with enabledFeatures updates and resends

- **WHEN** `overlay.setOverlayOptions({ enabledFeatures: [OverlayFeature.Header, OverlayFeature.Likes] })` is called
- **THEN** the instance's stored `enabledFeatures` becomes exactly `[Header, Likes]`, and a `SET_OVERLAY_OPTIONS` message is sent with `payload.enabledFeatures: ['header', 'likes']`

#### Scenario: Omitting enabledFeatures in a later call preserves the previous value

- **WHEN** `overlay.setOverlayOptions({ enabledFeatures: ['header'] })` is called, followed later by `overlay.setOverlayOptions({ theme: 'dark' })`
- **THEN** the second call's outgoing payload still includes `enabledFeatures: ['header']` (unchanged), alongside the updated `theme`

#### Scenario: Initial handshake send includes enabledFeatures from constructor options

- **WHEN** a `ChatOverlay` is constructed with `enabledFeatures: [OverlayFeature.VoiceInput, OverlayFeature.Header]` and the app emits `READY`
- **THEN** the library's `SET_OVERLAY_OPTIONS` response includes `payload.enabledFeatures: ['voice-input', 'header']`

#### Scenario: ChatOverlayManager forwards enabledFeatures unchanged

- **WHEN** `manager.setOverlayOptions('test', { enabledFeatures: ['header'] })` is called
- **THEN** the underlying `ChatOverlay` instance for `'test'` receives the same call arguments, identically to how `theme`/`modelId`/`overlayConversationId` are already forwarded

#### Scenario: enabledFeatures does not retroactively change iframe permissions

- **WHEN** a `ChatOverlay` is constructed without `voice-input` and later `setOverlayOptions({ enabledFeatures: ['voice-input'] })` is called
- **THEN** the iframe's `allow` attribute is unchanged (still excludes `microphone`) — only the wire payload and the app's own effective UI-feature state are affected

### Requirement: README documents enabledFeatures usage on setOverlayOptions

`libs/chat-overlay/README.md` SHALL document `setOverlayOptions`'s expanded parameter shape, including an example showing `enabledFeatures` used to change which UI sections the embedded app shows without reconstructing the iframe, and SHALL note that this array replaces (not merges with) any previously-sent `enabledFeatures`.

#### Scenario: README shows a setOverlayOptions enabledFeatures example

- **WHEN** `libs/chat-overlay/README.md` is inspected
- **THEN** it contains a code example calling `setOverlayOptions({ enabledFeatures: [...] })` and a note that the array replaces the previous value rather than merging with it

### Requirement: ChatOverlay stores and transmits provider-mode option

`ChatOverlay`'s constructor SHALL accept the new optional `auth` field on `ChatOverlayOptions` and store it alongside the other options. When `sendCurrentOverlayOptions()` serializes the `SET_OVERLAY_OPTIONS` payload, it SHALL include `authProviderUiModes` in the payload if and only if `options.auth?.providerUiModes` is set and non-empty; if the map is absent or empty, the field SHALL be omitted from the payload (matching the pattern used for `theme`, `modelId`, and `overlayConversationId`).

`setOverlayOptions()` SHALL accept an updated `auth` option via the `Partial<Pick<...>>` shape: when `auth` is included in the update, the stored `options.auth` SHALL be replaced. When `auth` is absent from the update, the existing stored `auth` SHALL be preserved. The updated options are re-sent to the iframe via `sendCurrentOverlayOptions()` as before. An in-progress external login attempt (managed by the app side) is NOT affected by this update; the new map takes effect on the next login initiation.

`libs/chat-overlay` MUST NOT fetch providers, construct `/api` URL paths, read auth/session state, inspect cookies, or encode any knowledge of specific IdP brands.

#### Scenario: Constructor without auth option compiles and behaves as before

- **WHEN** `new ChatOverlay('#root', { domain: 'https://chat.example.com' })` is called
- **THEN** the instance is created without error
- **AND** the `SET_OVERLAY_OPTIONS` payload does NOT include `authProviderUiModes`

#### Scenario: Constructor with auth.providerUiModes transmits authProviderUiModes

- **WHEN** `ChatOverlay` is constructed with `auth: { providerUiModes: { 'my-id': OverlayAuthUiMode.SameWindow } }`
- **AND** `sendCurrentOverlayOptions()` is called
- **THEN** the `SET_OVERLAY_OPTIONS` payload includes `authProviderUiModes: { 'my-id': 'sameWindow' }`

#### Scenario: Empty providerUiModes omits authProviderUiModes from payload

- **WHEN** `ChatOverlay` is constructed with `auth: { providerUiModes: {} }`
- **AND** `sendCurrentOverlayOptions()` is called
- **THEN** the `SET_OVERLAY_OPTIONS` payload does NOT include `authProviderUiModes`

#### Scenario: setOverlayOptions replaces stored auth when provided

- **WHEN** `setOverlayOptions({ auth: { providerUiModes: { 'new-id': OverlayAuthUiMode.External } } })` is called
- **THEN** the stored `auth` is updated to the new value
- **AND** the next `SET_OVERLAY_OPTIONS` payload contains `authProviderUiModes: { 'new-id': 'external' }`

#### Scenario: setOverlayOptions preserves stored auth when absent from update

- **WHEN** the instance has `auth: { providerUiModes: { 'my-id': OverlayAuthUiMode.SameWindow } }` stored
- **AND** `setOverlayOptions({ theme: 'dark' })` is called (no `auth` key)
- **THEN** the stored `auth` is unchanged
- **AND** subsequent `SET_OVERLAY_OPTIONS` still includes `authProviderUiModes: { 'my-id': 'sameWindow' }`

---

### Requirement: README usage example for provider-mode option

`libs/chat-overlay/README.md` SHALL include a usage example demonstrating the `auth.providerUiModes` option. The example MUST show at least two providers with different modes and MUST include a comment stating that `SameWindow` requires the host to verify that the provider supports iframe login for their specific configuration.

#### Scenario: README example type-checks

- **WHEN** the README example TypeScript snippet is type-checked in isolation
- **THEN** it produces no TypeScript errors

#### Scenario: README example includes SameWindow disclaimer comment

- **WHEN** the README is inspected
- **THEN** the `auth.providerUiModes` example contains a comment about host responsibility for verifying iframe compatibility
