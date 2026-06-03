## MODIFIED Requirements

### Requirement: `libs/conversation-panel` library exposes `ConversationPanel`

A new library `@epam/ai-dial-conversation-panel` SHALL exist at `libs/conversation-panel/`. It SHALL export `ConversationPanel` and the types: `ConversationPanelProps`, `ConversationPanelStyles`, `ConversationHistoryColors`, `ConversationHistoryTypography`, `ConversationHistoryItem`, `ConversationSource` (string enum), `FilterTab` (string enum), `FilterLabels`, `ConversationGroupProps`. The library SHALL declare `react`, `@epam/ai-dial-ui-kit`, `@tabler/icons-react` as peer dependencies. It SHALL have `"license": "Apache-2.0"` in `package.json`.

#### Scenario: ConversationPanel is importable in apps/chat

- **WHEN** `apps/chat` imports `ConversationPanel` from `@epam/ai-dial-conversation-panel`
- **THEN** TypeScript resolves the import without error

---

### Requirement: Panel header contains the title prop; toggle button is in the app Header

`ConversationPanel` SHALL render a header bar containing the panel title from the `title: string` prop. The header SHALL NOT contain a toggle icon button — `apps/chat/src/components/Header/Header.tsx` owns the toggle (via `isHistoryPanelOpen` and `onHistoryPanelToggle` props, desktop-only). `ConversationPanel` SHALL accept `isOpen: boolean`; when `false`, the panel collapses to zero width via a CSS transition.

#### Scenario: Panel is visible when isOpen is true

- **WHEN** `ConversationPanel` renders with `isOpen={true}`
- **THEN** the panel is visible and the title is rendered

#### Scenario: Panel collapses when isOpen is false

- **WHEN** `isOpen` changes to `false`
- **THEN** the panel has `aria-expanded="false"` and its width collapses to 0

---

### Requirement: Panel body renders conversations grouped into Pinned and My chats sections

When `isOpen` is `true`, `ConversationPanel` SHALL render conversation items split into two collapsible sections:

- **Pinned** — items where `isPinned === true`, shown first.
- **My chats** — remaining items.

Each section renders a disclosure button (chevron icon) as its header that toggles open/closed. Both sections start expanded. A section with zero items after active search + tab filter SHALL be hidden. Each item SHALL display the conversation `title` (truncated) and optionally an icon from `item.iconUrl`. The item SHALL call `onSelectConversation(id)` when activated. The active conversation (matching `activeConversationId`) SHALL receive `aria-current="page"`. Section headings via optional `groupLabels?: { pinned?, myChats? }` (English defaults: `"Pinned"`, `"My chats"`).

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

---

### Requirement: Panel renders a New chat button

`ConversationPanel` SHALL render a full-width "New chat" button (with `IconPlus` icon) below the header. Clicking it SHALL call `onNewChat: () => void`. The button is keyboard-accessible. Its label comes from `newChatLabel` prop.

#### Scenario: Clicking New chat calls onNewChat

- **WHEN** the user clicks the New chat button
- **THEN** `onNewChat` is called once

---

### Requirement: Panel renders a search input to filter conversations

`ConversationPanel` SHALL render a text input below the New chat button with a search icon. Placeholder comes from `searchPlaceholder` prop. Search state is internal `useState<string>`. Typing filters items by case-insensitive title substring match. Sections with zero matching items are hidden. Clearing restores the full list.

#### Scenario: Search filters conversation list

- **WHEN** the user types "foo" in the search input
- **THEN** only conversations whose title contains "foo" (case-insensitive) are shown

#### Scenario: Clearing search restores full list

- **WHEN** the user clears the search input
- **THEN** all conversations matching the active tab filter are shown

---

### Requirement: Panel renders filter tabs — All / My chats / Shared / Organization

`ConversationPanel` SHALL render a segmented tab control with four tabs corresponding to `FilterTab` enum values (`All`, `MyChats`, `Shared`, `Organization`). Active tab state is internal `useState<FilterTab>` (default: `FilterTab.All`). Items are filtered by `item.source === tab` (or all when `FilterTab.All`). Filtering combines with search. The active tab SHALL have `aria-selected="true"` and `role="tab"`; the tab list SHALL have `role="tablist"`. Labels via `filterLabels: FilterLabels`.

#### Scenario: Active tab is marked aria-selected

- **WHEN** "My chats" tab is selected
- **THEN** that tab has `aria-selected="true"` and others have `aria-selected="false"`

#### Scenario: Selecting a tab filters by source

- **WHEN** the user clicks the "Shared" tab
- **THEN** only conversations with `source === ConversationSource.Shared` are shown

---

### Requirement: Panel is responsive — persistent on desktop, drawer on mobile

`ConversationPanel` renders the same markup regardless of viewport. `ConversationPanelView` in `apps/chat` passes `className="fixed inset-y-0 left-0 z-50 w-[320px]"` on mobile for drawer positioning. `onBackdropClick?: () => void` — when provided and `isOpen` is `true`, a semi-transparent backdrop overlay is rendered; clicking it calls the callback.

#### Scenario: Backdrop click closes the panel on mobile

- **WHEN** `onBackdropClick` is provided and the backdrop is clicked
- **THEN** `onBackdropClick` is called once

---

### Requirement: `ConversationPanel` has unit tests

Tests SHALL be in `libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx` covering: rendering items, active item marking, empty state, aria-expanded, backdrop click, new-chat callback, search filtering, filter tab switching, section collapse/expand.

#### Scenario: Tests cover core interactions

- **WHEN** the `ConversationPanel` test suite runs
- **THEN** all scenarios above have corresponding test cases and pass

---

## RENAMED Requirements

FROM: `libs/conversation-history` library exposes `ConversationHistoryPanel`
TO: `libs/conversation-panel` library exposes `ConversationPanel`
