## ADDED Requirements

### Requirement: Protocol types are pure and live in libs/chat-shared

`libs/chat-shared/src/types/overlay/` SHALL export: the namespace constant (`@DIAL_OVERLAY`), an `OverlayRequestType` enum covering exactly the v1 requests (`GET_MESSAGES`, `SEND_MESSAGE`, `SET_INPUT_CONTENT`, `SET_SYSTEM_PROMPT`, `SET_TEMPERATURE`, `SET_OVERLAY_OPTIONS`), an `OverlayEventType` enum covering exactly the v1 events (`INIT_READY`, `READY`, `READY_TO_INTERACT`, `SELECTED_CONVERSATION_LOADED`, `GPT_START_GENERATING`, `GPT_END_GENERATING`, `STOP_GENERATING`, `CONVERSATIONS_UPDATED`), the `ChatOverlayOptions` interface, and one response payload interface per v1 request. This module SHALL import nothing from `apps/*`, `libs/chat-overlay`, `libs/chat-api-client`, or any other lib/app — it contains only enums and interfaces, no functions with logic beyond type guards.

#### Scenario: Overlay types module has no runtime logic imports

- **WHEN** `libs/chat-shared/src/types/overlay/overlay-protocol.ts` (or equivalent file) is inspected
- **THEN** its only imports, if any, are other pure-type files within `libs/chat-shared/src/types/`

#### Scenario: Deferred request/event names are absent from v1 enums

- **WHEN** `OverlayRequestType` is inspected
- **THEN** it has no member for `GET_CONVERSATIONS`, `GET_SELECTED_CONVERSATIONS`, `SELECT_CONVERSATION`, `CREATE_CONVERSATION`, `CREATE_LOCAL_CONVERSATION`, `DELETE_CONVERSATION`, `RENAME_CONVERSATION`, `CREATE_PLAYBACK_CONVERSATION`, `STOP_SELECTED_PLAYBACK_CONVERSATION`, `EXPORT_CONVERSATION`, or `IMPORT_CONVERSATION`

### Requirement: Message envelope shapes

A request from host to iframe SHALL be `{ type: '@DIAL_OVERLAY/<REQUEST>', requestId: string, expiresAt?: number, payload?: unknown }`, where `expiresAt` is epoch milliseconds after which the app must stop waiting for prerequisites and drop the request. A response from iframe to host SHALL be `{ type: '@DIAL_OVERLAY/<REQUEST>/RESPONSE', requestId: string, payload?: unknown }`, using the same `requestId` as the request it answers. An event from iframe to host SHALL be `{ type: '@DIAL_OVERLAY/<EVENT>', payload?: unknown }` with no `requestId` field.

#### Scenario: Request/response requestId round-trips

- **WHEN** the library sends `{ type: '@DIAL_OVERLAY/SEND_MESSAGE', requestId: 'abc', payload: {...} }`
- **THEN** the app's response is `{ type: '@DIAL_OVERLAY/SEND_MESSAGE/RESPONSE', requestId: 'abc', payload: {...} }`

#### Scenario: Events never carry a requestId

- **WHEN** the app emits `GPT_START_GENERATING`
- **THEN** the posted message has no `requestId` property (not even `undefined` — the key is absent)

### Requirement: Handshake sequencing

On overlay-mode initialization the app SHALL emit `INIT_READY` first (once), then `READY` once models/auth-required-state is resolved (once). The library, on receiving `READY`, SHALL send `SET_OVERLAY_OPTIONS` with its current options, omitting unset optional fields (`theme`, `modelId`, `overlayConversationId`) from the payload. The app, on receiving `SET_OVERLAY_OPTIONS`, SHALL treat absent, `null`, or `undefined` optional option fields as unset rather than malformed, apply the options, and respond with `SET_OVERLAY_OPTIONS/RESPONSE` using the request's `requestId`. Once the app has selected/loaded its active conversation for the first time after options are applied, it SHALL emit `READY_TO_INTERACT` (once). The library's `ready()` SHALL resolve only after `READY_TO_INTERACT` is observed (not merely after `READY`).

#### Scenario: ready() does not resolve on READY alone

- **WHEN** the app has sent `INIT_READY` and `READY` but not yet `READY_TO_INTERACT`
- **THEN** `overlay.ready()` has not resolved

#### Scenario: ready() resolves after the full handshake

- **WHEN** the app sends `INIT_READY`, then `READY`, the library replies with `SET_OVERLAY_OPTIONS`, the app responds `SET_OVERLAY_OPTIONS/RESPONSE` and then emits `READY_TO_INTERACT`
- **THEN** `overlay.ready()` resolves to `true`

#### Scenario: Unset optional options do not break the handshake

- **WHEN** the library sends `SET_OVERLAY_OPTIONS` with `hostDomain` and no unset optional option keys
- **THEN** the app accepts the request and sends `SET_OVERLAY_OPTIONS/RESPONSE`
- **AND** the handshake can continue to `READY_TO_INTERACT`

#### Scenario: Explicitly unset optional options are treated as absent

- **WHEN** the app receives `SET_OVERLAY_OPTIONS` with `theme`, `modelId`, or `overlayConversationId` present as `undefined` or `null`
- **THEN** those fields are ignored as unset
- **AND** the app does not reject the payload as malformed

#### Scenario: INIT_READY and READY are each sent at most once

- **WHEN** overlay-mode initialization runs to completion
- **THEN** exactly one `INIT_READY` message and exactly one `READY` message are observed on the host side, even if the app's own initialization effects re-run (e.g. React Strict Mode double-invoke)

### Requirement: Request/response matching with timeout

Every library-issued request SHALL generate a unique `requestId`, include an `expiresAt` deadline derived from its dispatch time, and race its response against `options.requestTimeout` (default `10000` ms if unset). Requests that are called before `ready()` resolves SHALL NOT start their timeout until the request is actually posted to the iframe. On timeout, the request's promise SHALL reject with an error naming the request type and the configured timeout. A response whose `requestId` matches no pending request SHALL be ignored without throwing.

#### Scenario: Request times out when unanswered

- **WHEN** `overlay.getMessages()` is called with `requestTimeout: 50` and no response arrives within 50ms
- **THEN** the returned promise rejects with an error mentioning `GET_MESSAGES` and `50`

#### Scenario: Pre-ready request timeout starts only on dispatch

- **WHEN** `overlay.sendMessage('Hello')` is called before `ready()` resolves with `requestTimeout: 50`
- **AND** `ready()` has not resolved for 50ms
- **THEN** the request has not been posted and its promise has not rejected
- **AND** once `ready()` resolves, the posted request includes an `expiresAt` later than the dispatch time

#### Scenario: Unmatched response is ignored

- **WHEN** a `message` event arrives with `type: '@DIAL_OVERLAY/SEND_MESSAGE/RESPONSE'` and a `requestId` not corresponding to any pending request
- **THEN** no error is thrown and no pending request's promise settles because of it

#### Scenario: A resolved request is removed from the pending set

- **WHEN** a request's matching response is received and its promise resolves
- **THEN** a later message reusing the same (already-consumed) `requestId` does not resolve or reject anything

### Requirement: Event subscription and duplicate delivery

`subscribe(eventType, callback)` SHALL register `callback` to be invoked with the event's `payload` every time a matching event message arrives, and SHALL return an unsubscribe function that removes only that callback. Multiple `subscribe` calls for the same `eventType` SHALL all be invoked independently on each matching event (no deduplication of identical event types); a caller that wants "at most once" behavior is responsible for guarding inside its own callback or unsubscribing after first invocation.

#### Scenario: Unsubscribe removes only the targeted callback

- **WHEN** two callbacks are subscribed to `GPT_START_GENERATING` and the first is unsubscribed
- **THEN** a subsequent `GPT_START_GENERATING` event invokes only the second callback

#### Scenario: Repeated identical events invoke subscribers each time

- **WHEN** the app emits `CONVERSATIONS_UPDATED` twice in a row
- **THEN** a single subscriber registered for it is invoked twice

### Requirement: Origin validation on both sides

The library SHALL discard any `message` event whose `event.source` is not the iframe's own `contentWindow`, before reading `event.data`. The library SHALL send every request to `new URL(options.domain).origin`, never `'*'`. The app SHALL only accept an inbound message as authoritative for setting/updating its stored `hostDomain` when the message's `event.origin` matches the server-provided allowed-origin configuration (see `chat-overlay-security-config`) and any supplied `payload.hostDomain` matches that same origin. Once a `hostDomain` is stored, the app SHALL reject active-conversation requests from any other origin, even if that other origin is also allowlisted. The app SHALL send every response/event to the stored `hostDomain` exactly, and SHALL NOT broadcast to `'*'` except for the two payload-free bootstrap events (`INIT_READY`, `READY`) that necessarily precede any host identity being known.

#### Scenario: Messages from a different window are ignored

- **WHEN** a `message` event arrives whose `event.source` is not this `ChatOverlay` instance's iframe `contentWindow`
- **THEN** the event is discarded without inspecting `event.data`

#### Scenario: Requests target the configured domain's origin

- **WHEN** `options.domain` is `'https://chat.example.com/some/path'`
- **THEN** every `postMessage` call from the library uses target origin `'https://chat.example.com'`

#### Scenario: App rejects a SET_OVERLAY_OPTIONS from a disallowed origin

- **WHEN** the app receives a `SET_OVERLAY_OPTIONS` message whose `event.origin` is not in the configured allowed-origin list
- **THEN** the app does not update its stored `hostDomain` and sends no response

#### Scenario: App rejects active requests before a trusted host is known

- **WHEN** the app has not yet accepted a valid `SET_OVERLAY_OPTIONS`
- **AND** it receives `SEND_MESSAGE`
- **THEN** the app does not execute the request and sends no response for its `requestId`

#### Scenario: App rejects active requests from a different origin

- **WHEN** the app has accepted `SET_OVERLAY_OPTIONS` from `https://partner.example.com`
- **AND** it receives `SEND_MESSAGE` from `https://other.example.com`
- **THEN** the app does not execute the request and sends no response for its `requestId`

#### Scenario: Bootstrap events are the only ones sent without a known hostDomain

- **WHEN** the app has not yet received a valid `SET_OVERLAY_OPTIONS`
- **THEN** the only messages it sends to `window.parent` are `INIT_READY` and `READY`, both without a `payload` containing conversation or user data

### Requirement: Cleanup on destroy/unmount

The library SHALL remove its `window` `message` listener and reject/clear all pending requests when `destroy()` is called. The app's overlay-mode message listener and handshake state SHALL be torn down when the owning React component unmounts or overlay mode is exited, with no listener left registered after teardown.

#### Scenario: No listener leak after library destroy

- **WHEN** `destroy()` is called and then a matching `message` event is dispatched on `window`
- **THEN** no state on the destroyed instance changes as a result

#### Scenario: No listener leak after app-side unmount

- **WHEN** the app's overlay provider unmounts
- **THEN** a subsequent `message` event targeting the overlay namespace produces no response and no state change
