## MODIFIED Requirements

### Requirement: Panel body renders conversations grouped into four collapsible sections

When `isOpen` is `true`, `ConversationPanel` SHALL render conversation items split into four collapsible sections:

- **Pinned** — items where `isPinned === true`, shown first.
- **My chats** — items where `source` is not `ConversationSource.Shared` or `ConversationSource.Organization` and `isPinned` is falsy.
- **Shared** — items where `source === ConversationSource.Shared` and `isPinned` is falsy.
- **Organization** — items where `source === ConversationSource.Organization` and `isPinned` is falsy.

Each section renders a disclosure button (chevron icon) as its header that toggles open/closed. All sections start expanded. A section with zero items after active search + tab filter SHALL be hidden. Each item SHALL display the conversation `title` (truncated) and optionally an icon from `item.iconUrl`. The item SHALL call `onSelectConversation(id)` when activated. The active conversation (matching `activeConversationId`) SHALL receive `aria-current="page"`. Section headings via optional `groupLabels?: { pinned?, myChats?, shared?, organization? }` (English defaults: `"Pinned"`, `"My chats"`, `"Shared"`, `"Organization"`).

When `conversations` is empty, `PanelEmptyState` SHALL be rendered with `IconMessageCircle` and `emptyLabel`. When `conversations` is non-empty but all items are filtered to zero, `PanelEmptyState` SHALL be rendered with `IconSearchOff` and `noResultsLabel`.

#### Scenario: Renders pinned conversations in Pinned section

- **WHEN** `conversations` contains 2 items with `isPinned: true` and 3 without
- **THEN** the Pinned section shows 2 items and the My chats section shows 3 items

#### Scenario: Active conversation is marked

- **WHEN** `activeConversationId` matches one item's `id`
- **THEN** that item has `aria-current="page"`

#### Scenario: Clicking an item calls onSelectConversation

- **WHEN** the user clicks a conversation item
- **THEN** `onSelectConversation` is called with that item's `id`

#### Scenario: No-conversations empty state is shown when conversations array is empty

- **WHEN** `conversations` is an empty array
- **THEN** `PanelEmptyState` with `IconMessageCircle` and the `emptyLabel` text is rendered instead of sections

#### Scenario: No-results empty state is shown when filtering yields no matches

- **WHEN** `conversations` is non-empty but the active search query or tab filter reduces `filteredItems` to zero
- **THEN** `PanelEmptyState` with `IconSearchOff` and the `noResultsLabel` text is rendered instead of sections

#### Scenario: Collapsing a section hides its items

- **WHEN** the user clicks the My chats section disclosure button
- **THEN** the My chats section items are no longer visible
