# chat-overlay-protocol Specification

## Purpose

The pure postMessage protocol types in `chat-shared`: message envelopes, handshake sequencing, request/response matching, events, and origin validation.

## Requirements

### Requirement: Protocol types are pure and live in libs/chat-shared

`libs/chat-shared/src/types/overlay/` SHALL export: the namespace constant (`@DIAL_OVERLAY`), an `OverlayRequestType` enum covering exactly the v1 requests (`GET_MESSAGES`, `SEND_MESSAGE`, `SET_INPUT_CONTENT`, `SET_SYSTEM_PROMPT`, `SET_TEMPERATURE`, `SET_OVERLAY_OPTIONS`) plus the conversation-list requests (`GET_CONVERSATIONS`, `GET_SELECTED_CONVERSATIONS`, `SELECT_CONVERSATION`, `CREATE_CONVERSATION`, `CREATE_LOCAL_CONVERSATION`, `DELETE_CONVERSATION`, `RENAME_CONVERSATION`), an `OverlayEventType` enum covering exactly the v1 events (`INIT_READY`, `READY`, `READY_TO_INTERACT`, `SELECTED_CONVERSATION_LOADED`, `GPT_START_GENERATING`, `GPT_END_GENERATING`, `STOP_GENERATING`, `CONVERSATIONS_UPDATED`) — no new event types are introduced by this change — the `ChatOverlayOptions` interface (including the new optional `auth` field), a new `OverlayAuthUiMode` enum, `OverlayRequestErrorCode`, `OverlayRequestError`, and one response payload interface per implemented request. The `SetOverlayOptionsPayload` interface SHALL include the new optional `authProviderUiModes?: Record<string, string>` field. This module SHALL import nothing from `apps/*`, `libs/chat-overlay`, `libs/chat-api-client`, or any other lib/app — it contains only enums and interfaces, no functions with logic beyond type guards.

#### Scenario: Overlay types module has no runtime logic imports

- **WHEN** `libs/chat-shared/src/types/overlay/overlay-protocol.ts` (or equivalent file) is inspected
- **THEN** its only imports, if any, are other pure-type files within `libs/chat-shared/src/types/`

#### Scenario: Still-deferred request names are absent from the enum

- **WHEN** `OverlayRequestType` is inspected
- **THEN** it has no member for `CREATE_PLAYBACK_CONVERSATION`, `STOP_SELECTED_PLAYBACK_CONVERSATION`, `EXPORT_CONVERSATION`, or `IMPORT_CONVERSATION`

#### Scenario: Conversation-list request names are present in the enum

- **WHEN** `OverlayRequestType` is inspected
- **THEN** it has members `GetConversations = '@DIAL_OVERLAY/GET_CONVERSATIONS'`, `GetSelectedConversations = '@DIAL_OVERLAY/GET_SELECTED_CONVERSATIONS'`, `SelectConversation = '@DIAL_OVERLAY/SELECT_CONVERSATION'`, `CreateConversation = '@DIAL_OVERLAY/CREATE_CONVERSATION'`, `CreateLocalConversation = '@DIAL_OVERLAY/CREATE_LOCAL_CONVERSATION'`, `DeleteConversation = '@DIAL_OVERLAY/DELETE_CONVERSATION'`, `RenameConversation = '@DIAL_OVERLAY/RENAME_CONVERSATION'`

#### Scenario: OverlayAuthUiMode enum is exported from chat-shared

- **WHEN** `@epam/ai-dial-chat-shared` is imported
- **THEN** `OverlayAuthUiMode` is available with members `External = 'external'` and `SameWindow = 'sameWindow'`

#### Scenario: SetOverlayOptionsPayload includes authProviderUiModes

- **WHEN** `SetOverlayOptionsPayload` is inspected
- **THEN** it has an optional `authProviderUiModes?: Record<string, string>` field

#### Scenario: ChatOverlayOptions includes auth field

- **WHEN** `ChatOverlayOptions` is inspected
- **THEN** it has an optional `auth?: { providerUiModes?: Record<string, OverlayAuthUiMode> }` field

### Requirement: Message envelope shapes

A request from host to iframe SHALL be `{ type: '@DIAL_OVERLAY/<REQUEST>', requestId: string, expiresAt?: number, payload?: unknown }`, where `expiresAt` is epoch milliseconds after which the app must stop waiting for prerequisites and drop the request. A response from iframe to host SHALL be `{ type: '@DIAL_OVERLAY/<REQUEST>/RESPONSE', requestId: string, payload?: unknown, error?: OverlayRequestError }`, using the same `requestId` as the request it answers. `payload` carries a successful or domain-level response; the top-level `error` carries a request-execution failure. An event from iframe to host SHALL be `{ type: '@DIAL_OVERLAY/<EVENT>', payload?: unknown }` with no `requestId` field.

#### Scenario: Request/response requestId round-trips

- **WHEN** the library sends `{ type: '@DIAL_OVERLAY/SEND_MESSAGE', requestId: 'abc', payload: {...} }`
- **THEN** the app's response is `{ type: '@DIAL_OVERLAY/SEND_MESSAGE/RESPONSE', requestId: 'abc', payload: {...} }`

#### Scenario: Events never carry a requestId

- **WHEN** the app emits `GPT_START_GENERATING`
- **THEN** the posted message has no `requestId` property (not even `undefined` — the key is absent)

#### Scenario: Request failure preserves requestId

- **WHEN** the app cannot execute `GET_MESSAGES` because no conversation is open
- **THEN** it responds with `{ type: '@DIAL_OVERLAY/GET_MESSAGES/RESPONSE', requestId: 'abc', error: { code: 'ACTIVE_CONVERSATION_UNAVAILABLE', message: '...' } }`
- **AND** the `requestId` is the same one received in the request

### Requirement: Handshake sequencing

On overlay-mode initialization the app SHALL emit `INIT_READY` first (once), then `READY` once models/auth-required-state is resolved (once). The library, on receiving `READY`, SHALL send `SET_OVERLAY_OPTIONS` with its current options, omitting unset optional fields (`theme`, `modelId`, `overlayConversationId`) from the payload; when `auth.providerUiModes` is set on the `ChatOverlay` instance, `authProviderUiModes` SHALL be included in the payload (mapping string keys to their string values), otherwise it SHALL be omitted. The app, on receiving `SET_OVERLAY_OPTIONS`, SHALL treat absent, `null`, or `undefined` optional option fields as unset rather than malformed, apply the options, and respond with `SET_OVERLAY_OPTIONS/RESPONSE` using the request's `requestId`. Once the app has selected/loaded its active conversation for the first time after options are applied, it SHALL emit `READY_TO_INTERACT` (once). The library's `ready()` SHALL resolve only after `READY_TO_INTERACT` is observed (not merely after `READY`).

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

#### Scenario: authProviderUiModes is included when configured

- **WHEN** the `ChatOverlay` was constructed with `auth.providerUiModes` containing entries
- **AND** the app has sent `READY`
- **THEN** the library's `SET_OVERLAY_OPTIONS` payload includes `authProviderUiModes` with the configured entries

#### Scenario: authProviderUiModes is omitted when not configured

- **WHEN** the `ChatOverlay` was constructed without an `auth` option
- **AND** the app has sent `READY`
- **THEN** the library's `SET_OVERLAY_OPTIONS` payload does NOT include an `authProviderUiModes` key

#### Scenario: Older iframe ignores unknown authProviderUiModes field

- **WHEN** a newer host library sends `SET_OVERLAY_OPTIONS` with `authProviderUiModes` to an older app that does not know this field
- **THEN** the older app accepts the payload and responds with `SET_OVERLAY_OPTIONS/RESPONSE`
- **AND** the handshake completes normally with external-only login behavior

### Requirement: Request/response matching with timeout

Every library-issued request SHALL generate a unique `requestId`, include an `expiresAt` deadline derived from its dispatch time, and race its response against `options.requestTimeout` (default `10000` ms if unset). Requests that are called before `ready()` resolves SHALL NOT start their timeout until the request is actually posted to the iframe. On timeout, the request's promise SHALL reject with an error naming the request type and the configured timeout. A matching response with a top-level `error` SHALL reject immediately with `ChatOverlayRequestError` rather than waiting for the timeout. A response whose `requestId` matches no pending request SHALL be ignored without throwing.

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

#### Scenario: Structured error rejects immediately

- **WHEN** a pending `GET_MESSAGES` request receives a matching response with `error.code: 'ACTIVE_CONVERSATION_UNAVAILABLE'`
- **THEN** its promise rejects immediately with `ChatOverlayRequestError`
- **AND** the error exposes `code: 'ACTIVE_CONVERSATION_UNAVAILABLE'`, `requestType: '@DIAL_OVERLAY/GET_MESSAGES'`, and the app-provided message

### Requirement: Structured request-execution errors

`OverlayRequestErrorCode` SHALL define `ACTIVE_CONVERSATION_UNAVAILABLE`, `CONVERSATION_LIST_UNAVAILABLE`, `INVALID_PAYLOAD`, and `REQUEST_EXECUTION_FAILED`. `OverlayRequestError` SHALL be `{ code: OverlayRequestErrorCode; message: string }`. After `READY_TO_INTERACT`, the app SHALL answer a trusted, unexpired request it cannot execute with a matching response carrying this error at the response-envelope level. It SHALL use `ACTIVE_CONVERSATION_UNAVAILABLE` when an active-conversation method requires a mounted conversation but the composer is open, `CONVERSATION_LIST_UNAVAILABLE` when a conversation-list bridge is unavailable, `INVALID_PAYLOAD` when the payload does not match the request contract, and `REQUEST_EXECUTION_FAILED` when the registered bridge throws or rejects. The app SHALL log the request type, code, and message to its console when emitting such an error.

#### Scenario: Empty composer fails without a timeout

- **WHEN** `READY_TO_INTERACT` has been emitted for the empty composer and the trusted host sends `GET_MESSAGES`, `SEND_MESSAGE`, `SET_INPUT_CONTENT`, `SET_SYSTEM_PROMPT`, or `SET_TEMPERATURE`
- **THEN** the app responds immediately with top-level `error.code: 'ACTIVE_CONVERSATION_UNAVAILABLE'`
- **AND** the message tells the host to open or create a conversation
- **AND** the request is not left pending until `requestTimeout`

#### Scenario: Bridge rejection is observable

- **WHEN** a registered bridge rejects while executing a valid request
- **THEN** the app responds with top-level `error.code: 'REQUEST_EXECUTION_FAILED'` and the failure message
- **AND** the app logs a warning containing the request type and error code

#### Scenario: Malformed payload is rejected explicitly

- **WHEN** a trusted host sends a request whose payload does not match that request's contract
- **THEN** the app responds with top-level `error.code: 'INVALID_PAYLOAD'` instead of silently leaving the host to time out

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

### Requirement: Conversation-list payload and response types

`libs/chat-shared/src/types/overlay/overlay-protocol.ts` SHALL export a host-agnostic `OverlayConversation` interface (`id: string`, `title: string`, `updatedAt: number`, `isPinned: boolean`, `isReadonly: boolean`, `sharedWithMe: boolean`, `publishedWithMe: boolean`) with no dependency on `@epam/chat-api-client` or any other generated/app-owned type, plus one request-payload interface per new request (`SelectConversationPayload { id }`, `DeleteConversationPayload { id }`, `RenameConversationPayload { id, newName }`, `CreateConversationPayload { deploymentId?, firstMessage? }`) and one response interface per new request: `GetConversationsResponse { conversations: OverlayConversation[] }`, `GetSelectedConversationsResponse { conversations: OverlayConversation[] }`, `SelectConversationResponse { conversation?: OverlayConversation; error?: OverlayConversationError }`, `CreateConversationResponse { conversation: OverlayConversation | null; error?: OverlayConversationError }`, `CreateLocalConversationResponse { conversation: null }`, `DeleteConversationResponse { error?: OverlayConversationError }`, `RenameConversationResponse { conversation?: OverlayConversation; error?: OverlayConversationError }`.

#### Scenario: OverlayConversation carries no generated-client dependency

- **WHEN** `libs/chat-shared/src/types/overlay/overlay-protocol.ts` is inspected for its `OverlayConversation` declaration
- **THEN** it is a self-contained interface with no import from `@epam/chat-api-client` or any app-owned type

#### Scenario: CreateConversationResponse allows a null conversation

- **WHEN** the `CreateConversationResponse` type is inspected
- **THEN** `conversation` is typed `OverlayConversation | null`, reflecting that the local/no-`firstMessage` creation path resolves with `null`

### Requirement: Explicit error signal for conversation-list methods

`OverlayConversationError` SHALL be exported as `{ code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_ARGUMENT'; message: string }`. Every response payload type for `SELECT_CONVERSATION`, `CREATE_CONVERSATION`, `DELETE_CONVERSATION`, and `RENAME_CONVERSATION` SHALL carry an optional domain-level `error` field of this type; when that payload error is present, any success field (`conversation`) on the same payload SHALL be absent. `GET_CONVERSATIONS` and `GET_SELECTED_CONVERSATIONS` SHALL NOT carry a domain-level `error` field. This payload error remains distinct from the response envelope's `OverlayRequestError`, which is available for every request when the app cannot execute it. The five pre-existing active-conversation response payloads and `SET_OVERLAY_OPTIONS` keep their existing payload shapes unchanged.

#### Scenario: Invalid id produces an explicit error response, not a timeout

- **WHEN** the library sends `DELETE_CONVERSATION` for an id that does not exist or is not accessible to the current user
- **THEN** the app posts a `DELETE_CONVERSATION/RESPONSE` message whose payload is `{ error: { code: 'NOT_FOUND', message: '...' } }` within the request's normal timeout window, rather than never responding

#### Scenario: Success and error are mutually exclusive on the same response

- **WHEN** a `RENAME_CONVERSATION/RESPONSE` payload is inspected
- **THEN** it has either a `conversation` field (success) or an `error` field (failure), never both

#### Scenario: v1 payloads are unaffected by the request-error envelope

- **WHEN** `SendMessageResponse`/`SetSystemPromptResponse`/`SetTemperatureResponse`/`GetMessagesResponse` are inspected
- **THEN** none of their payload interfaces gains a domain-level `error` field
- **AND** failures are represented by the optional top-level `OverlayMessageResponse.error`

### Requirement: Conversation-list requests follow the same origin and timeout rules as active-conversation requests

`GET_CONVERSATIONS`, `GET_SELECTED_CONVERSATIONS`, `SELECT_CONVERSATION`, `CREATE_CONVERSATION`, `CREATE_LOCAL_CONVERSATION`, `DELETE_CONVERSATION`, and `RENAME_CONVERSATION` SHALL be accepted by the app only after a valid `SET_OVERLAY_OPTIONS` has established the trusted host origin (same rule as active-conversation requests), and SHALL use the same default `requestTimeout` (`10000` ms when unset) and `expiresAt` semantics already defined for all requests.

#### Scenario: Conversation-list request before host validation is ignored

- **WHEN** `GET_CONVERSATIONS` is received before any valid `SET_OVERLAY_OPTIONS`
- **THEN** the app does not execute the request and sends no response for its `requestId`

#### Scenario: Conversation-list request from an untrusted origin is ignored

- **WHEN** the app has accepted `SET_OVERLAY_OPTIONS` from `https://partner.example.com`
- **AND** it receives `RENAME_CONVERSATION` from `https://other.example.com`
- **THEN** the app does not execute the request and sends no response for its `requestId`

### Requirement: OverlayFeature enum covers the 37 transferable UI-section toggle keys

`libs/chat-overlay/src/protocol/overlay-protocol.ts`'s `OverlayFeature` enum SHALL have exactly 37 members, covering the groups: applications (`code-apps`, `custom-applications`, `hide-custom-app-creation`, `custom-apps`), chat input (`disabled-send`, `skip-focus-chat-input-onload`), conversation functions (`dislike-comment`, `input-files`, `likes`, `live-chat-interaction`), conversation header (`disallow-change-agent`, `hide-change-agent`, `hide-new-conversation`), empty chat (`empty-chat-settings`, `hide-empty-chat-change-agent`), layout (`attachments-manager`, `conversations-panel-toggle`, `conversations-section`, `header`, `showConversationsSectionByDefault`), catalog (`catalog`, `catalog-hide-my-apps`, `catalog-table-view`), file manager (`file-manager`), message editing (`hide-delete-user-message`, `hide-edit-user-message`, `hide-regenerate-assistant-message`), publishing (`conversations-publishing`), sharing (`applications-sharing`, `conversations-sharing`, `toolsets-sharing`), toolsets (`toolsets`), prompts (`prompts`), skills (`skills`), user settings (`hide-user-menu`, `hide-user-settings`), and voice input (`voice-input`). This module SHALL remain import-free (no imports from `apps/*` or app-owned code), consistent with its existing "pure types only" requirement.

`apps/chat-api`'s `KNOWN_UI_FEATURES` SHALL mirror this membership one-to-one. It is duplicated rather than imported so the Node-only service stays independent of the browser-facing overlay package, and it SHALL be updated in the same change as any addition, removal, or rename here — a key present in only one of the two is silently unusable through `ENABLED_UI_FEATURES`.

**Feature flag:** N/A — this is the enum definition itself, not a gated feature. This repo has no `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` mechanism to gate it behind.

#### Scenario: OverlayFeature has exactly 37 members

- **WHEN** `Object.values(OverlayFeature)` is inspected
- **THEN** it has exactly 37 unique string values, including `'voice-input'`, `'header'`, `'likes'`, `'hide-new-conversation'`, `'live-chat-interaction'`, `'prompts'`, `'skills'`, `'file-manager'`, and `'hide-change-agent'`

#### Scenario: The renamed marketplace keys are not in the enum

- **WHEN** `OverlayFeature` is inspected
- **THEN** it has no member for `marketplace`, `marketplace-hide-my-apps`, or `marketplace-table-view` — those were renamed to `catalog`, `catalog-hide-my-apps`, and `catalog-table-view`

#### Scenario: Keys whose behavior became unconditional are not in the enum

- **WHEN** `OverlayFeature` is inspected
- **THEN** it has no member for `custom-logo`, `show-layout-dividers`, `top-settings`, `top-chat-model-settings`, `chat-header-border`, or `chat-input-border` — the behavior each guarded is unconditional in the new chat

#### Scenario: The 21 absent keys are not in the enum

- **WHEN** `OverlayFeature` is inspected
- **THEN** it has no member for `code-interpreter`, `compare-mode-disabled`, `input-links`, `message-templates`, `hide-top-context-menu`, `top-chat-info`, `top-clear-conversation`, `chat-full-width-by-default`, `footer`, `prompts-panel-toggle`, `prompts-section`, `showPromptsSectionByDefault`, `edit-all-assistant-message`, `edit-last-assistant-message`, `disabled-playback-controls`, `prompts-publishing`, `prompts-sharing`, `report-an-issue`, or `request-api-key` (19 keys with no transferable UI surface in this repo), nor for `md-sidebar-overlay-breakpoint` or `user-message-align-end` (2 keys removed because they require new UI behaviour to wire — see design.md known-gaps table)

### Requirement: SetOverlayOptionsPayload carries an optional enabledFeatures array

`SetOverlayOptionsPayload` (`overlay-protocol.ts`) SHALL gain an optional field `enabledFeatures?: string[]`. It is typed `string[]` (not `OverlayFeature[]`) at the wire-payload level because the app must accept and filter out-of-date or unrecognized values from a host without a compile-time guarantee the host is running the same version of the enum; `ChatOverlayOptions.enabledFeatures` (the library-facing, pre-existing field) remains typed `OverlayFeature[]` for library callers who do get compile-time checking. Absent, `null`, or `undefined` SHALL be treated as unset (no override change), matching the existing "unset optional fields are not malformed" rule already governing `theme`/`modelId`/`overlayConversationId`. This field carries no comma-separated-string form — array only.

#### Scenario: enabledFeatures is optional and array-typed

- **WHEN** `SetOverlayOptionsPayload` is inspected
- **THEN** it has an optional `enabledFeatures?: string[]` field alongside the pre-existing `hostDomain`, `theme?`, `modelId?`, `overlayConversationId?` fields

#### Scenario: Absent enabledFeatures does not break the existing malformed-payload guard

- **WHEN** a `SET_OVERLAY_OPTIONS` payload omits `enabledFeatures` entirely
- **THEN** `hasSetOverlayOptionsPayload` (or its updated equivalent) still accepts the payload as well-formed, identically to today

#### Scenario: enabledFeatures present as a non-array is rejected as malformed

- **WHEN** a `SET_OVERLAY_OPTIONS` payload includes `enabledFeatures: "header,likes"` (a string, not an array)
- **THEN** the payload is rejected as malformed by the same validator that already rejects non-string `theme`/`modelId`/`overlayConversationId`, and no response is sent for that request
