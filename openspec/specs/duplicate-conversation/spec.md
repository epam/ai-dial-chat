# Spec: duplicate-conversation

## Purpose

Define the backend, generated-client, state-management, and UI behavior for duplicating a conversation into the authenticated user's bucket with a fresh stable identifier.

## Requirements

### Requirement: Backend duplicate endpoint
The system SHALL expose `POST /api/v1/conversations/duplicate?path=<sourcePath>` that copies the source conversation into the authenticated user's own bucket. The endpoint is protected by `SessionGuard`, accepts no request body, and returns HTTP 201 with:

```json
{
  "newPath": "conversations/user-bucket/gpt-4o__My%20chat__550e8400-e29b-41d4-a716-446655440000"
}
```

The returned `newPath` is the encoded full DIAL Core resource path and SHALL be treated as an opaque conversation identifier by callers.

The duplicated conversation SHALL keep the source conversation's stored display name, sanitised via `prepareEntityName`, without adding a numeric title suffix. Its destination storage path SHALL always end with a fresh `crypto.randomUUID()` segment:

```
{deploymentId}__{displayName}__{uuid}
```

The UUID is unconditional, including when the corresponding unsuffixed destination path is free. `duplicateConversation` SHALL NOT perform a destination path-existence check. A trailing UUID from the source path SHALL NOT be reused. Existing legacy source paths without a UUID remain valid inputs.

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })`.

Generated-client impact:
- OpenAPI operationId: `duplicateConversation`
- SDK method: `ConversationsApi.duplicateConversation({ path })`
- Query DTO: `ConversationPathDto`
- Response DTO: `DuplicateConversationResponseDto` (`{ newPath: string }`)
- Frontend callers use the normal generated method through `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — `path` is missing, empty, or invalid
- `401 Unauthorized` — the caller has no valid session
- `403 Forbidden` — the caller cannot read the source conversation
- `404 Not Found` — the source conversation does not exist
- `502 Bad Gateway` — DIAL Core rejects the read or save operation
- `503 Service Unavailable` — DIAL Core is unreachable

This behavior does not require a new API version: UUID-suffixed `newPath` values were already valid collision responses, so consumers already have to treat the returned path as opaque. Existing stored paths are not migrated.

#### Scenario: Successful duplication from shared conversation
- **WHEN** an authenticated user calls `POST /api/v1/conversations/duplicate?path=other-bucket/gpt-4o__My%20chat__<source-uuid>`
- **THEN** the system copies the conversation to the user's bucket and returns `{ newPath: "conversations/<user-bucket>/gpt-4o__My%20chat__<fresh-uuid>" }` with HTTP 201

#### Scenario: UUID is appended when the unsuffixed destination path is free
- **GIVEN** no resource exists at `gpt-4o__My chat` in the user's bucket
- **WHEN** the user duplicates a conversation named `"My chat"`
- **THEN** the duplicate is stored at `gpt-4o__My chat__<fresh-uuid>`
- **AND** no destination metadata lookup is performed

#### Scenario: Repeated duplicates retain the display name and receive different ids
- **WHEN** the same conversation named `"My chat"` is duplicated twice
- **THEN** both duplicated conversations keep `name: "My chat"` without a numeric suffix
- **AND** their `newPath` values end with different freshly generated UUIDs

#### Scenario: Missing path parameter
- **WHEN** the request omits the `path` query parameter
- **THEN** the system returns HTTP 400

#### Scenario: Unauthenticated request
- **WHEN** the request is made without a valid session
- **THEN** the system returns HTTP 401

### Requirement: Server-API duplicate function
The frontend server-api module SHALL expose `duplicateConversation(conversationPath: string)` that delegates to `ConversationsApi.duplicateConversation({ path: conversationPath })` and returns `{ newPath: string }`. It SHALL NOT construct the REST request through `server-api/base.ts`.

#### Scenario: Successful call
- **WHEN** `duplicateConversation("other-bucket/some/chat.json")` is called
- **THEN** it resolves with `{ newPath: string }` matching the backend response

### Requirement: Conversations context exposes duplicate
`ConversationsContext` SHALL expose `duplicateConversation(id: string): Promise<string>` that calls the server-api, refreshes the conversation list on success, and returns the new conversation ID.

#### Scenario: Success path
- **WHEN** `duplicateConversation(id)` is called with a valid conversation id
- **THEN** the new conversation appears in the list and the returned string is the new conversation's id

#### Scenario: Error propagation
- **WHEN** the backend returns an error
- **THEN** the error is re-thrown so callers can handle it

### Requirement: Duplicate action in conversation row dropdown
The conversation row three-dot dropdown SHALL include a Duplicate item (icon + translated label) for all conversations regardless of source.

#### Scenario: Duplicate action appears in menu
- **WHEN** the user opens the three-dot menu for any conversation row
- **THEN** a Duplicate menu item is present with the correct icon and translated label

#### Scenario: Duplicate action triggers duplication and navigation
- **WHEN** the user clicks Duplicate in the row dropdown
- **THEN** the app calls `duplicateConversation` and navigates to the newly created conversation

### Requirement: Filter tab behavior after duplicating a read-only conversation
After duplicating a read-only conversation the conversation panel filter tab MUST follow these rules:
- If the active filter is **Organization** or **Shared with me** — switch to **My chats**, because the duplicated conversation does not appear under those filters.
- If the active filter is **All** or **My chats** — leave the filter unchanged, because the duplicated conversation is already visible under those filters.

#### Scenario: Duplicating from the Organization or Shared filter switches to My chats
- **GIVEN** the conversation panel is showing the Organization or Shared with me filter tab
- **WHEN** the user duplicates a read-only conversation (from the panel dropdown or the in-conversation button)
- **THEN** the panel switches to the My chats filter after navigating to the new conversation

#### Scenario: Duplicating from the All filter keeps the filter unchanged
- **GIVEN** the conversation panel is showing the All filter tab
- **WHEN** the user duplicates a read-only conversation
- **THEN** the panel remains on the All filter

#### Scenario: Duplicating from the My chats filter keeps the filter unchanged
- **GIVEN** the conversation panel is showing the My chats filter tab
- **WHEN** the user duplicates a read-only conversation
- **THEN** the panel remains on the My chats filter

### Requirement: Duplicate appears at the top of the conversation list
After a successful duplication the duplicated conversation SHALL appear as the first (topmost) item in the My chats group in the sidebar, regardless of the original conversation's position or the timestamp DIAL Core assigns to the copied resource.

#### Scenario: Duplicate is at the top after duplication
- **WHEN** the user duplicates any conversation
- **THEN** the new conversation is immediately visible at the top of the My chats group in the sidebar

#### Scenario: Order of other conversations is preserved
- **WHEN** the user duplicates a conversation
- **THEN** all other conversations retain their existing relative order in the list

### Requirement: Duplicated conversation preserves chat settings from the source
When a conversation is duplicated the chat settings (temperature, response format, system prompt) SHALL be copied from the source conversation so that the duplicate opens with the same configuration as the original.

#### Scenario: Temperature is preserved after duplication
- **GIVEN** the source conversation has a specific `temperature` value
- **WHEN** the user duplicates the conversation
- **THEN** the duplicated conversation's chat settings show the same temperature

#### Scenario: Response format is preserved after duplication
- **GIVEN** the source conversation has a `responseFormat` value
- **WHEN** the user duplicates the conversation
- **THEN** the duplicated conversation's chat settings show the same response format

#### Scenario: System prompt is preserved after duplication
- **GIVEN** the source conversation has a `prompt` (system prompt) value
- **WHEN** the user duplicates the conversation
- **THEN** the duplicated conversation's chat settings show the same system prompt

### Requirement: Read-only conversation view shows centered duplicate action button
When a conversation is read-only (source bucket differs from user bucket), the `ConversationView` SHALL render a centered action button instead of the `Notification` info banner. The button SHALL display a duplicate icon and the translated text "Duplicate the conversation to be able to edit it".

#### Scenario: Centered button rendered for read-only conversation
- **WHEN** `isReadOnly` is `true` and `onDuplicateConversation` is provided
- **THEN** the centered duplicate button is shown and the `Notification` is not

#### Scenario: Button invokes onDuplicateConversation
- **WHEN** the user clicks the centered duplicate button
- **THEN** `onDuplicateConversation` is called

### Requirement: i18n keys for duplicate feature
The `conversationHistory` i18n namespace SHALL include:
- `duplicateLabel`: short action label used in the dropdown (e.g., "Duplicate")
- `duplicateReadOnlyDescription`: full sentence used in the centered button (e.g., "Duplicate the conversation to be able to edit it")

Both keys SHALL be present in all locale files and referenced through typed `ConversationHistoryI18nKeys` enum values.

#### Scenario: Keys present in English locale
- **WHEN** `en.json` is loaded
- **THEN** `conversationHistory.duplicateLabel` and `conversationHistory.duplicateReadOnlyDescription` are defined

#### Scenario: Typed enum values exist
- **WHEN** a component imports `ConversationHistoryI18nKeys`
- **THEN** `ConversationHistoryI18nKeys.DuplicateLabel` and `ConversationHistoryI18nKeys.DuplicateReadOnlyDescription` resolve to the correct key strings
