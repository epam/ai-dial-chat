## ADDED Requirements

### Requirement: Backend duplicate endpoint
The system SHALL expose `POST /api/conversations/duplicate?path=<sourcePath>` that copies the source conversation into the authenticated user's own bucket and returns `{ newPath: string }`. The destination name SHALL be unique (conflict-free) within the user's bucket. The endpoint SHALL return 401 when unauthenticated, 400 when `path` is missing or empty, and 502 when DIAL Core rejects the copy.

#### Scenario: Successful duplication from shared conversation
- **WHEN** an authenticated user calls `POST /api/conversations/duplicate?path=other-bucket/path/to/chat.json`
- **THEN** the system copies the conversation to the user's bucket and returns `{ newPath: "conversations/<user-bucket>/path/to/chat.json" }` with HTTP 200

#### Scenario: Unique name on collision
- **WHEN** a conversation with the same title already exists in the user's bucket
- **THEN** the system appends a numeric suffix (e.g., ` (1)`, ` (2)`) to produce a collision-free destination path and returns the resolved `newPath`

#### Scenario: Missing path parameter
- **WHEN** the request omits the `path` query parameter
- **THEN** the system returns HTTP 400

#### Scenario: Unauthenticated request
- **WHEN** the request is made without a valid session
- **THEN** the system returns HTTP 401

### Requirement: Server-API duplicate function
The frontend server-api module SHALL expose `duplicateConversation(conversationPath: string)` that calls `POST /api/conversations/duplicate?path=<conversationPath>` and returns `{ newPath: string }`.

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
When a conversation is read-only (source bucket differs from user bucket), the `ConversationView` SHALL render a centered action button instead of the `DialNotification` info banner. The button SHALL display a duplicate icon and the translated text "Duplicate the conversation to be able to edit it".

#### Scenario: Centered button rendered for read-only conversation
- **WHEN** `isReadOnly` is `true` and `onDuplicateConversation` is provided
- **THEN** the centered duplicate button is shown and the `DialNotification` is not

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
