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

`libs/chat-overlay/src/index.ts` SHALL export exactly: the `ChatOverlay` class, the `ChatOverlayManager` class, the `ChatOverlayManagerOptions` type, and re-exports of the pure protocol types from `@epam/ai-dial-chat-shared` needed by consumers (`ChatOverlayOptions`, the request/event type unions, response payload types for every v1 method). It SHALL NOT export the internal `Task`/`DeferredRequest`-equivalent helper classes.

#### Scenario: Internal transport helpers are not exported

- **WHEN** `libs/chat-overlay/src/index.ts` is inspected
- **THEN** no symbol named `Task` or `DeferredRequest` (or their chosen internal equivalents) appears in the export list

#### Scenario: Consumer can import everything needed from one entry point

- **WHEN** a consumer writes `import { ChatOverlay, ChatOverlayManager, ChatOverlayOptions } from '@epam/ai-dial-chat-overlay'`
- **THEN** the import resolves without needing a separate import from `@epam/ai-dial-chat-shared`

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
