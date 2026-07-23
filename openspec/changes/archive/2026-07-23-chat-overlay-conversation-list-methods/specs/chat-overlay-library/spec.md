## MODIFIED Requirements

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

## ADDED Requirements

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
