# Spec delta: chat-overlay-protocol

## MODIFIED Requirements

### Requirement: Protocol types are pure and live in libs/chat-shared

`libs/chat-shared/src/types/overlay/` SHALL export: the namespace constant (`@DIAL_OVERLAY`), an `OverlayRequestType` enum covering exactly the v1 requests (`GET_MESSAGES`, `SEND_MESSAGE`, `SET_INPUT_CONTENT`, `SET_SYSTEM_PROMPT`, `SET_TEMPERATURE`, `SET_OVERLAY_OPTIONS`) plus the conversation-list requests (`GET_CONVERSATIONS`, `GET_SELECTED_CONVERSATIONS`, `SELECT_CONVERSATION`, `CREATE_CONVERSATION`, `CREATE_LOCAL_CONVERSATION`, `DELETE_CONVERSATION`, `RENAME_CONVERSATION`), an `OverlayEventType` enum covering exactly the v1 events (`INIT_READY`, `READY`, `READY_TO_INTERACT`, `SELECTED_CONVERSATION_LOADED`, `GPT_START_GENERATING`, `GPT_END_GENERATING`, `STOP_GENERATING`, `CONVERSATIONS_UPDATED`) — no new event types are introduced by this change — the `ChatOverlayOptions` interface (including the new optional `auth` field), a new `OverlayAuthUiMode` enum, and one response payload interface per implemented request. The `SetOverlayOptionsPayload` interface SHALL include the new optional `authProviderUiModes?: Record<string, string>` field. This module SHALL import nothing from `apps/*`, `libs/chat-overlay`, `libs/chat-api-client`, or any other lib/app — it contains only enums and interfaces, no functions with logic beyond type guards.

#### Scenario: Overlay types module has no runtime logic imports

- **WHEN** `libs/chat-shared/src/types/overlay/overlay-protocol.ts` is inspected
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

---

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
