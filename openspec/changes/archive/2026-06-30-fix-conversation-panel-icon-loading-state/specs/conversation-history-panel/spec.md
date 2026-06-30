## MODIFIED Requirements

### Requirement: Panel body renders conversations grouped into four collapsible sections

When `isOpen` is `true`, `ConversationPanel` SHALL render conversation items split into four collapsible sections:

- **Pinned** — items where `isPinned === true`, shown first.
- **My chats** — items where `source` is not `ConversationSource.Shared` or `ConversationSource.Organization` and `isPinned` is falsy.
- **Shared** — items where `source === ConversationSource.Shared` and `isPinned` is falsy.
- **Organization** — items where `source === ConversationSource.Organization` and `isPinned` is falsy.

Each section renders a disclosure button (chevron icon) as its header that toggles open/closed. All sections start expanded. A section with zero items after active search + tab filter SHALL be hidden. Each item SHALL display the conversation `title` (truncated) and its deployment icon according to the following rules:

- When `item.isIconLoading` is `true`, an animated skeleton placeholder MUST be shown in the icon slot instead of the deployment icon or fallback.
- When `item.isIconLoading` is `false` or `undefined` and `item.iconUrl` is set, the resolved image MUST be shown.
- When `item.isIconLoading` is `false` or `undefined` and `item.iconUrl` is absent, the default fallback icon MUST be shown.

When `item.iconTooltip` is provided and `item.isIconLoading` is `false` or `undefined`, the deployment icon SHALL show a tooltip with that text on hover. The item SHALL call `onSelectConversation(id)` when activated. The active conversation (matching `activeConversationId`) SHALL receive `aria-current="page"`. Section headings via optional `groupLabels?: { pinned?, myChats?, shared?, organization? }` (English defaults: `"Pinned"`, `"My chats"`, `"Shared"`, `"Organization"`).

#### Scenario: Renders pinned conversations in Pinned section

- **WHEN** `conversations` contains 2 items with `isPinned: true` and 3 without
- **THEN** the Pinned section shows 2 items and the My chats section shows 3 items

#### Scenario: Active conversation is marked

- **WHEN** `activeConversationId` matches one item's `id`
- **THEN** that item has `aria-current="page"`

#### Scenario: Clicking an item calls onSelectConversation

- **WHEN** the user clicks a conversation item
- **THEN** `onSelectConversation` is called with that item's `id`

#### Scenario: Icon skeleton shown when `isIconLoading` is true

- **WHEN** an item has `isIconLoading: true`
- **THEN** the icon slot contains a skeleton placeholder and no `DeploymentIcon` is rendered for that item

#### Scenario: Real icon shown when `isIconLoading` is false and `iconUrl` is set

- **WHEN** an item has `isIconLoading: false` and a resolved `iconUrl`
- **THEN** the icon slot contains `DeploymentIcon` with the provided URL

#### Scenario: Fallback icon shown when `isIconLoading` is false and `iconUrl` is absent

- **WHEN** an item has `isIconLoading: false` and no `iconUrl`
- **THEN** `DeploymentIcon` renders its fallback SVG
