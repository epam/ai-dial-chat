# conversation-source-filtering Specification

## Purpose
TBD - created by archiving change conversation-panel-source-filtering. Update Purpose after archive.
## Requirements
### Requirement: Backend preserves ownership flags from DIAL Core
The conversations listing service SHALL extract `sharedWithMe` and `publishedWithMe` boolean fields from the DIAL Core `getConversationMetadata` response and include them in each `ConversationListItemDto` item.

#### Scenario: Own conversation has no flags set
- **WHEN** DIAL Core returns an item with `sharedWithMe` absent or `false` and `publishedWithMe` absent or `false`
- **THEN** the API response item SHALL have `sharedWithMe: false` and `publishedWithMe: false`

#### Scenario: Shared conversation carries sharedWithMe flag
- **WHEN** DIAL Core returns an item with `sharedWithMe: true`
- **THEN** the API response item SHALL have `sharedWithMe: true`

#### Scenario: Published conversation carries publishedWithMe flag
- **WHEN** DIAL Core returns an item with `publishedWithMe: true`
- **THEN** the API response item SHALL have `publishedWithMe: true`

---

### Requirement: ConversationListItemDto exposes ownership fields
The `ConversationListItemDto` SHALL include `sharedWithMe: boolean` and `publishedWithMe: boolean` fields, both documented in the OpenAPI/Swagger spec.

#### Scenario: DTO fields appear in Swagger
- **WHEN** the Swagger docs endpoint is requested
- **THEN** the `ConversationListItemDto` schema SHALL list `sharedWithMe` and `publishedWithMe` as boolean fields

---

### Requirement: Frontend adapter maps ownership flags to ConversationSource
`ConversationPanelView` SHALL derive a `ConversationSource` value from each item's `sharedWithMe` and `publishedWithMe` fields and pass it as the `source` property on `ConversationHistoryItem`.

#### Scenario: Own item maps to MyChats
- **WHEN** an item has `sharedWithMe: false` and `publishedWithMe: false`
- **THEN** its `source` SHALL be `ConversationSource.MyChats`

#### Scenario: Shared item maps to Shared
- **WHEN** an item has `sharedWithMe: true`
- **THEN** its `source` SHALL be `ConversationSource.Shared`

#### Scenario: Published item maps to Organization
- **WHEN** an item has `publishedWithMe: true`
- **THEN** its `source` SHALL be `ConversationSource.Organization`

---

### Requirement: Conversation panel tabs filter by source
The conversation panel SHALL display only items whose `source` matches the active filter tab.

#### Scenario: All tab shows every conversation
- **WHEN** the active tab is "All"
- **THEN** all conversations SHALL be visible regardless of source

#### Scenario: My chats tab shows only own conversations
- **WHEN** the active tab is "My chats"
- **THEN** only items with `source === ConversationSource.MyChats` SHALL be visible

#### Scenario: Shared tab shows only shared conversations
- **WHEN** the active tab is "Shared"
- **THEN** only items with `source === ConversationSource.Shared` SHALL be visible

#### Scenario: Organization tab shows only published conversations
- **WHEN** the active tab is "Organization"
- **THEN** only items with `source === ConversationSource.Organization` SHALL be visible

