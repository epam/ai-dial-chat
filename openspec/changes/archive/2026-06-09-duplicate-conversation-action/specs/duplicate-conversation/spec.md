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
