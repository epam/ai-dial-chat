## MODIFIED Requirements

### Requirement: `libs/conversation-history` library exposes `ConversationHistoryPanel`

A new library `@epam/ai-dial-conversation-history` SHALL exist at `libs/conversation-history/`. It SHALL export `ConversationHistoryPanel`, `ConversationHistoryPanelProps`, and `ConversationHistoryColors`. The library SHALL declare `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, `@tabler/icons-react`, and `@epam/ai-dial-sidebar` as peer dependencies. It SHALL have `"license": "Apache-2.0"` in `package.json`.

#### Scenario: ConversationHistoryPanel is importable in apps/chat
- **WHEN** `apps/chat` imports `ConversationHistoryPanel` from `@epam/ai-dial-conversation-history`
- **THEN** TypeScript resolves the import without error

---

### Requirement: Panel header contains a toggle icon button

`ConversationHistoryPanel` SHALL render a header bar (48px height, matching the app header) containing:
- A panel title (e.g. "Conversations") rendered as a string prop `title`.
- A toggle icon button (`IconLayoutSidebarLeftCollapse` when open, `IconLayoutSidebarLeftExpand` when closed) that calls `onToggle` when activated.
- The icon button SHALL have an accessible `aria-label` provided via the `toggleAriaLabel` prop.
- The icon button SHALL be keyboard-accessible (Enter / Space triggers `onToggle`).

#### Scenario: Toggle button is present in header
- **WHEN** `ConversationHistoryPanel` renders with `isOpen={true}`
- **THEN** a button with the collapse icon is visible in the header

#### Scenario: Toggle button calls onToggle
- **WHEN** the user clicks the toggle button
- **THEN** `onToggle` is called once

#### Scenario: Toggle button is keyboard accessible
- **WHEN** the toggle button has focus and the user presses Enter
- **THEN** `onToggle` is called once

---

### Requirement: Panel body renders conversations grouped into Pinned and My chats sections

When `isOpen` is `true`, `ConversationHistoryPanel` SHALL render conversation items split into two collapsible sections:

- **Pinned** — items where `isPinned === true`, shown first.
- **My chats** — remaining items.

Each section SHALL render a disclosure button (chevron icon) as its header that toggles the section open/closed. Both sections start expanded by default. A section with zero items after active search and tab filter is applied SHALL be hidden entirely.

Each item (`role="listitem"`) SHALL display:
- A model/conversation icon passed via `item.iconUrl` or a default icon.
- The conversation `title` (truncated with ellipsis if too long).
- The item SHALL be a button or link that calls `onSelectConversation(id)` when activated.
- The currently active conversation (matching `activeConversationId`) SHALL receive `aria-current="page"`.

i18n keys: `conversationHistory.pinnedSection`, `conversationHistory.myChatsSection`.

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
- **THEN** the empty-state message (`emptyLabel` prop) is rendered instead of sections

#### Scenario: Collapsing a section hides its items
- **WHEN** the user clicks the Pinned section disclosure button
- **THEN** the Pinned section items are no longer visible

---

### Requirement: Panel is hidden when isOpen is false

When `isOpen` is `false`, the panel body and title SHALL be visually hidden (width collapses to 0 via CSS transition). The toggle button SHALL remain accessible for re-opening. The panel root element SHALL have `aria-expanded={isOpen}`.

#### Scenario: Panel collapses on isOpen false
- **WHEN** `isOpen` changes to `false`
- **THEN** the panel has `aria-expanded="false"` and the conversation list is not visible

---

### Requirement: Panel is themed via CSS custom properties

When `colors` is provided, `ConversationHistoryPanel` SHALL apply values as CSS custom properties. Supported: `--ch-bg`, `--ch-border`, `--ch-header-border`, `--ch-item-hover`, `--ch-item-active`, `--ch-text`, `--ch-text-secondary`.

---

### Requirement: Panel is responsive — persistent on desktop, drawer on mobile

`ConversationHistoryPanel` itself renders the same markup regardless of viewport. The consuming app (`apps/chat`) is responsible for mobile vs desktop layout:
- **Desktop**: panel is in the flex row next to `<main>`, width transitions from 280px to 0.
- **Mobile**: panel renders as a fixed full-height overlay (left-anchored drawer). The app passes a `className` to position it appropriately. A backdrop overlay click SHALL call `onToggle`.

The panel SHALL accept `onBackdropClick?: () => void`; when provided and `isOpen` is `true`, a backdrop overlay is rendered behind the panel.

#### Scenario: Backdrop click closes the panel on mobile
- **WHEN** `onBackdropClick` is provided and the backdrop is clicked
- **THEN** `onBackdropClick` is called once

---

### Requirement: `ConversationHistoryPanel` has unit tests

Tests SHALL be in `libs/conversation-history/src/components/ConversationHistoryPanel/tests/ConversationHistoryPanel.spec.tsx`. They MUST cover: rendering items, toggle button interaction, active item marking, empty state, aria-expanded, backdrop click, new-chat button callback, search filtering, filter tab switching, and section collapse/expand.

---

## ADDED Requirements

### Requirement: Panel renders a New chat button

`ConversationHistoryPanel` SHALL render a full-width "New chat" button (with a `+` / `IconPlus` icon) directly below the header. Clicking it SHALL call the `onNewChat: () => void` required prop. The button SHALL be keyboard-accessible (Enter / Space triggers `onNewChat`). Its accessible label is provided via the `newChatLabel` prop.

i18n key: `conversationHistory.newChat`.

#### Scenario: New chat button is visible when panel is open
- **WHEN** `ConversationHistoryPanel` renders with `isOpen={true}`
- **THEN** a button labelled by `newChatLabel` is visible

#### Scenario: Clicking New chat calls onNewChat
- **WHEN** the user clicks the New chat button
- **THEN** `onNewChat` is called once

#### Scenario: New chat button is keyboard accessible
- **WHEN** the New chat button has focus and the user presses Enter
- **THEN** `onNewChat` is called once

---

### Requirement: Panel renders a search input to filter conversations

`ConversationHistoryPanel` SHALL render a text input below the New chat button with a search icon and placeholder provided via `searchPlaceholder` prop. The search value is internal `useState<string>` — no external prop. Typing in the input SHALL filter conversation items by case-insensitive title substring match. Sections with zero matching items SHALL be hidden. Clearing the input SHALL restore the full list.

i18n key: `conversationHistory.searchPlaceholder`.

#### Scenario: Search filters conversation list
- **WHEN** the user types "foo" in the search input
- **THEN** only conversations whose title contains "foo" (case-insensitive) are shown

#### Scenario: Clearing search restores full list
- **WHEN** the user clears the search input
- **THEN** all conversations matching the active tab filter are shown

#### Scenario: No match shows empty state
- **WHEN** the user types a string that matches no conversation title
- **THEN** the empty-state message is rendered

---

### Requirement: Panel renders filter tabs — All / My chats / Shared / Organization

`ConversationHistoryPanel` SHALL render a segmented tab control below the search input with four tabs: **All**, **My chats**, **Shared**, **Organization**. Tab state is internal `useState<FilterTab>` (default: `'all'`). Selecting a tab filters visible items:

- `'all'` — shows all items.
- `'my-chats'` — shows items where `source === 'my-chats'`.
- `'shared'` — shows items where `source === 'shared'`.
- `'organization'` — shows items where `source === 'organization'`.

Filtering combines with the active search query (both conditions must match). Tab labels are provided via the `filterLabels` prop (`{ all, myChats, shared, organization }: Record<string, string>`).

i18n keys: `conversationHistory.filterAll`, `conversationHistory.filterMyChats`, `conversationHistory.filterShared`, `conversationHistory.filterOrganization`.

The active tab button SHALL have `aria-selected="true"` and `role="tab"`. The tab list SHALL have `role="tablist"`.

#### Scenario: Active tab is marked aria-selected
- **WHEN** "My chats" tab is selected
- **THEN** the My chats tab button has `aria-selected="true"` and the others have `aria-selected="false"`

#### Scenario: Selecting a tab filters by source
- **WHEN** the user clicks the "Shared" tab
- **THEN** only conversations with `source === 'shared'` are shown

#### Scenario: Tab filter combines with search
- **WHEN** "My chats" tab is active and the user types "foo" in the search input
- **THEN** only conversations with `source === 'my-chats'` AND title containing "foo" are shown
