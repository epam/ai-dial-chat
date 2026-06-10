# conversation-source-filtering Specification

## Purpose
Conversations originate from three sources: the user's own bucket, the organisation-wide `public` bucket, and conversations shared directly with the user via the DIAL Core sharing API. This spec covers how the backend tags each item with `sharedWithMe`/`publishedWithMe` flags, how the frontend maps those flags to a `ConversationSource` enum, how the panel groups and filters by source, and how the UI signals that shared and organisation conversations are read-only.
## Requirements
### Requirement: Backend preserves ownership flags from DIAL Core and forces publishedWithMe for public bucket items
The conversations listing service SHALL extract `sharedWithMe` and `publishedWithMe` boolean fields from the DIAL Core `getConversationMetadata` response and include them in each `ConversationListItemDto` item. Items fetched from the `'public'` DIAL Core bucket SHALL always have `publishedWithMe: true` regardless of the flag value returned by DIAL Core, because public-bucket content is organisation-published by definition.

#### Scenario: Own conversation has no flags set
- **WHEN** DIAL Core returns a user-bucket item with `sharedWithMe` absent or `false` and `publishedWithMe` absent or `false`
- **THEN** the API response item SHALL have `sharedWithMe: false` and `publishedWithMe: false`

#### Scenario: Shared conversation carries sharedWithMe flag
- **WHEN** DIAL Core returns a user-bucket item with `sharedWithMe: true`
- **THEN** the API response item SHALL have `sharedWithMe: true`

#### Scenario: Published conversation carries publishedWithMe flag
- **WHEN** DIAL Core returns a user-bucket item with `publishedWithMe: true`
- **THEN** the API response item SHALL have `publishedWithMe: true`

#### Scenario: Public bucket item always has publishedWithMe: true
- **WHEN** the listing service fetches an item from the `'public'` DIAL Core bucket, regardless of the `publishedWithMe` value in the DIAL Core response
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

---

### Requirement: Conversation panel groups items by source when the All tab is active

When the All tab is active, non-pinned conversations SHALL be rendered in three separate collapsible sections in order: **My chats** (own conversations), **Shared** (shared-with-me), **Organization** (published). Each section is hidden when it has no items. The `groupLabels` prop on `ConversationPanel` accepts optional `shared` and `organization` strings to localise the section headings; the defaults are `"Shared"` and `"Organization"`.

When a source-specific tab is active (My chats, Shared, or Organization), only matching items are shown — the panel renders them in whichever group section they belong to (only one section is visible because the filter already limits items to a single source).

#### Scenario: All tab renders three distinct groups

- **WHEN** the All tab is active and each source has at least one conversation
- **THEN** three collapsible sections are visible: My chats, Shared, and Organization

#### Scenario: Empty groups are hidden

- **WHEN** there are no conversations with `source === ConversationSource.Shared`
- **THEN** the Shared section heading does not appear in the panel

---

### Requirement: Shared and Organisation conversations are read-only

The conversation view SHALL disable the chat input and show a notice — "Only own conversations can be edited" — when the opened conversation does not belong to the authenticated user's bucket. Read-only is determined by comparing the bucket segment of the conversation URL path against the session bucket; a mismatch means the conversation is public or shared.

#### Scenario: Input is hidden for a public conversation

- **WHEN** a conversation from the `public` bucket is opened
- **THEN** the chat input is not rendered and the read-only notice is shown in its place

#### Scenario: Input is hidden for a shared conversation

- **WHEN** a conversation whose bucket differs from the session bucket is opened
- **THEN** the chat input is not rendered and the read-only notice is shown in its place

#### Scenario: Input is shown for an own conversation

- **WHEN** a conversation whose bucket matches the session bucket is opened
- **THEN** the normal chat input is rendered

