## MODIFIED Requirements

### Requirement: Panel body renders conversations grouped into four collapsible sections

When `isOpen` is `true`, `ConversationPanel` SHALL render conversation items split into four collapsible sections:

- **Pinned** — items where `isPinned === true`, shown first.
- **My chats** — items where `source` is not `ConversationSource.Shared` or `ConversationSource.Organization` and `isPinned` is falsy.
- **Shared** — items where `source === ConversationSource.Shared` and `isPinned` is falsy.
- **Organization** — items where `source === ConversationSource.Organization` and `isPinned` is falsy.

Each section renders a disclosure button (chevron icon) as its header that toggles open/closed. All sections start expanded. A section with zero items after active search + tab filter SHALL be hidden. Each item SHALL display the conversation `title` (truncated) and optionally an icon from `item.iconUrl`. When `item.iconTooltip` is provided, the deployment icon SHALL show a tooltip with that text on hover. The item SHALL call `onSelectConversation(id)` when activated. The active conversation (matching `activeConversationId`) SHALL receive `aria-current="page"`. Section headings via optional `groupLabels?: { pinned?, myChats?, shared?, organization? }` (English defaults: `"Pinned"`, `"My chats"`, `"Shared"`, `"Organization"`).

#### Scenario: Renders pinned conversations in Pinned section

- **WHEN** `conversations` contains 2 items with `isPinned: true` and 3 without
- **THEN** the Pinned section shows 2 items and the My chats section shows 3 items

#### Scenario: Active conversation is marked

- **WHEN** `activeConversationId` matches one item's `id`
- **THEN** that item has `aria-current="page"`

#### Scenario: Clicking an item calls onSelectConversation

- **WHEN** the user clicks a conversation item
- **THEN** `onSelectConversation` is called with that item's `id`

#### Scenario: Empty state is shown when no conversations

- **WHEN** `conversations` is an empty array
- **THEN** the `emptyLabel` prop text is rendered instead of sections

#### Scenario: Collapsing a section hides its items

- **WHEN** the user clicks the My chats section disclosure button
- **THEN** the My chats section items are no longer visible

#### Scenario: Deployment icon tooltip shown when iconTooltip is provided

- **WHEN** a `ConversationHistoryItem` has `iconTooltip: "Claude 3.5 Sonnet"`
- **THEN** hovering the deployment icon in that row shows a tooltip with "Claude 3.5 Sonnet"

#### Scenario: No deployment icon tooltip when iconTooltip is absent

- **WHEN** a `ConversationHistoryItem` has no `iconTooltip` field
- **THEN** no tooltip appears on the deployment icon

## ADDED Requirements

### Requirement: `ConversationHistoryItem` exposes `iconTooltip` for the deployment icon tooltip

`ConversationHistoryItem` SHALL include an optional `iconTooltip?: string` field. When present, `ConversationRow` SHALL forward it as the `tooltip` prop of `DeploymentIcon`. When absent, no tooltip is rendered on the icon.

#### Scenario: iconTooltip field is accepted without TypeScript error

- **WHEN** a `ConversationHistoryItem` object is constructed with `iconTooltip: "My Agent"`
- **THEN** TypeScript resolves the type without error
