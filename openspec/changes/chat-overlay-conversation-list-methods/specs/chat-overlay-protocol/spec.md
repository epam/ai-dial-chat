## MODIFIED Requirements

### Requirement: Protocol types are pure and live in libs/chat-shared

`libs/chat-shared/src/types/overlay/` SHALL export: the namespace constant (`@DIAL_OVERLAY`), an `OverlayRequestType` enum covering exactly the v1 requests (`GET_MESSAGES`, `SEND_MESSAGE`, `SET_INPUT_CONTENT`, `SET_SYSTEM_PROMPT`, `SET_TEMPERATURE`, `SET_OVERLAY_OPTIONS`) plus the conversation-list requests added by this change (`GET_CONVERSATIONS`, `GET_SELECTED_CONVERSATIONS`, `SELECT_CONVERSATION`, `CREATE_CONVERSATION`, `CREATE_LOCAL_CONVERSATION`, `DELETE_CONVERSATION`, `RENAME_CONVERSATION`), an `OverlayEventType` enum covering exactly the v1 events (`INIT_READY`, `READY`, `READY_TO_INTERACT`, `SELECTED_CONVERSATION_LOADED`, `GPT_START_GENERATING`, `GPT_END_GENERATING`, `STOP_GENERATING`, `CONVERSATIONS_UPDATED`) — unchanged by this change, no new event types are introduced — the `ChatOverlayOptions` interface, and one response payload interface per implemented request. This module SHALL import nothing from `apps/*`, `libs/chat-overlay`, `libs/chat-api-client`, or any other lib/app — it contains only enums and interfaces, no functions with logic beyond type guards.

#### Scenario: Overlay types module has no runtime logic imports

- **WHEN** `libs/chat-shared/src/types/overlay/overlay-protocol.ts` (or equivalent file) is inspected
- **THEN** its only imports, if any, are other pure-type files within `libs/chat-shared/src/types/`

#### Scenario: Still-deferred request names are absent from the enum

- **WHEN** `OverlayRequestType` is inspected
- **THEN** it has no member for `CREATE_PLAYBACK_CONVERSATION`, `STOP_SELECTED_PLAYBACK_CONVERSATION`, `EXPORT_CONVERSATION`, or `IMPORT_CONVERSATION`

#### Scenario: Conversation-list request names are present in the enum

- **WHEN** `OverlayRequestType` is inspected
- **THEN** it has members `GetConversations = '@DIAL_OVERLAY/GET_CONVERSATIONS'`, `GetSelectedConversations = '@DIAL_OVERLAY/GET_SELECTED_CONVERSATIONS'`, `SelectConversation = '@DIAL_OVERLAY/SELECT_CONVERSATION'`, `CreateConversation = '@DIAL_OVERLAY/CREATE_CONVERSATION'`, `CreateLocalConversation = '@DIAL_OVERLAY/CREATE_LOCAL_CONVERSATION'`, `DeleteConversation = '@DIAL_OVERLAY/DELETE_CONVERSATION'`, `RenameConversation = '@DIAL_OVERLAY/RENAME_CONVERSATION'`

## ADDED Requirements

### Requirement: Conversation-list payload and response types

`libs/chat-shared/src/types/overlay/overlay-protocol.ts` SHALL export a host-agnostic `OverlayConversation` interface (`id: string`, `title: string`, `updatedAt: number`, `isPinned: boolean`, `isReadonly: boolean`, `sharedWithMe: boolean`, `publishedWithMe: boolean`) with no dependency on `@epam/chat-api-client` or any other generated/app-owned type, plus one request-payload interface per new request (`SelectConversationPayload { id }`, `DeleteConversationPayload { id }`, `RenameConversationPayload { id, newName }`, `CreateConversationPayload { deploymentId?, firstMessage? }`) and one response interface per new request: `GetConversationsResponse { conversations: OverlayConversation[] }`, `GetSelectedConversationsResponse { conversations: OverlayConversation[] }`, `SelectConversationResponse { conversation?: OverlayConversation; error?: OverlayConversationError }`, `CreateConversationResponse { conversation: OverlayConversation | null; error?: OverlayConversationError }`, `CreateLocalConversationResponse { conversation: null }`, `DeleteConversationResponse { error?: OverlayConversationError }`, `RenameConversationResponse { conversation?: OverlayConversation; error?: OverlayConversationError }`.

#### Scenario: OverlayConversation carries no generated-client dependency

- **WHEN** `libs/chat-shared/src/types/overlay/overlay-protocol.ts` is inspected for its `OverlayConversation` declaration
- **THEN** it is a self-contained interface with no import from `@epam/chat-api-client` or any app-owned type

#### Scenario: CreateConversationResponse allows a null conversation

- **WHEN** the `CreateConversationResponse` type is inspected
- **THEN** `conversation` is typed `OverlayConversation | null`, reflecting that the local/no-`firstMessage` creation path resolves with `null`

### Requirement: Explicit error signal for conversation-list methods

`OverlayConversationError` SHALL be exported as `{ code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_ARGUMENT'; message: string }`. Every response type for `SELECT_CONVERSATION`, `CREATE_CONVERSATION`, `DELETE_CONVERSATION`, and `RENAME_CONVERSATION` SHALL carry an optional `error` field of this type; when `error` is present, any success field (`conversation`) on that same response SHALL be absent. `GET_CONVERSATIONS` and `GET_SELECTED_CONVERSATIONS` SHALL NOT carry an `error` field — they are snapshot reads with no failure mode beyond the pre-existing request timeout. This error signal is additive and applies only to the seven conversation-list requests; the five pre-existing v1 requests (`GET_MESSAGES`, `SEND_MESSAGE`, `SET_INPUT_CONTENT`, `SET_SYSTEM_PROMPT`, `SET_TEMPERATURE`) and `SET_OVERLAY_OPTIONS` keep their existing response shapes unchanged — this change does not retrofit an error field onto them.

#### Scenario: Invalid id produces an explicit error response, not a timeout

- **WHEN** the library sends `DELETE_CONVERSATION` for an id that does not exist or is not accessible to the current user
- **THEN** the app posts a `DELETE_CONVERSATION/RESPONSE` message whose payload is `{ error: { code: 'NOT_FOUND', message: '...' } }` within the request's normal timeout window, rather than never responding

#### Scenario: Success and error are mutually exclusive on the same response

- **WHEN** a `RENAME_CONVERSATION/RESPONSE` payload is inspected
- **THEN** it has either a `conversation` field (success) or an `error` field (failure), never both

#### Scenario: v1 methods are unaffected by the new error shape

- **WHEN** `SendMessageResponse`/`SetSystemPromptResponse`/`SetTemperatureResponse`/`GetMessagesResponse` are inspected
- **THEN** none of them gains an `error` field as part of this change

### Requirement: Conversation-list requests follow the same origin and timeout rules as active-conversation requests

`GET_CONVERSATIONS`, `GET_SELECTED_CONVERSATIONS`, `SELECT_CONVERSATION`, `CREATE_CONVERSATION`, `CREATE_LOCAL_CONVERSATION`, `DELETE_CONVERSATION`, and `RENAME_CONVERSATION` SHALL be accepted by the app only after a valid `SET_OVERLAY_OPTIONS` has established the trusted host origin (same rule as active-conversation requests), and SHALL use the same default `requestTimeout` (`10000` ms when unset) and `expiresAt` semantics already defined for all requests.

#### Scenario: Conversation-list request before host validation is ignored

- **WHEN** `GET_CONVERSATIONS` is received before any valid `SET_OVERLAY_OPTIONS`
- **THEN** the app does not execute the request and sends no response for its `requestId`

#### Scenario: Conversation-list request from an untrusted origin is ignored

- **WHEN** the app has accepted `SET_OVERLAY_OPTIONS` from `https://partner.example.com`
- **AND** it receives `RENAME_CONVERSATION` from `https://other.example.com`
- **THEN** the app does not execute the request and sends no response for its `requestId`
