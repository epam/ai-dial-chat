# Spec: conversation-history-panel

## Requirements

### Requirement: `libs/conversation-panel` library exposes `ConversationPanel`

A new library `@epam/ai-dial-conversation-panel` SHALL exist at `libs/conversation-panel/`. It SHALL export `ConversationPanel` and the types: `ConversationPanelProps`, `ConversationPanelStyles`, `ConversationHistoryColors`, `ConversationHistoryTypography`, `ConversationHistoryItem`, `ConversationSource` (string enum), `FilterTab` (string enum), `FilterLabels`, `ConversationGroupProps`. The library SHALL declare `react`, `@epam/ai-dial-ui-kit`, `@tabler/icons-react` as peer dependencies. It SHALL have `"license": "Apache-2.0"` in `package.json`.

The library imports `SidebarPanel`, `SearchInput`, and `SidebarSide` from `@epam/ai-dial-sidebar` to use as the panel shell.

#### Scenario: ConversationPanel is importable in apps/chat

- **WHEN** `apps/chat` imports `ConversationPanel` from `@epam/ai-dial-conversation-panel`
- **THEN** TypeScript resolves the import without error

---

### Requirement: Panel header contains the title prop; toggle button is in the app Header

`ConversationPanel` SHALL render a header bar containing the panel title from the `title: string` prop. `ConversationPanel` SHALL accept `isOpen: boolean`; when `false`, the panel collapses to zero width via a CSS transition. On mobile an optional `onToggle?: () => void` prop triggers a close button (rendered by `SidebarPanel.onClose`) inside the panel header; when `isOpen` is `false` the `<aside>` has `aria-hidden="true"`.

The desktop toggle button lives in `apps/chat/src/components/Header/Header.tsx` via `isHistoryPanelOpen` and `onHistoryPanelToggle` props. The panel width when open is `w-[325px]`.

#### Scenario: Panel is visible when isOpen is true

- **WHEN** `ConversationPanel` renders with `isOpen={true}`
- **THEN** the panel is visible and the title is rendered

#### Scenario: Panel collapses when isOpen is false

- **WHEN** `isOpen` changes to `false`
- **THEN** the `<aside>` has `aria-hidden="true"` and its width collapses to 0

---

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

#### Scenario: Middle mouse button click opens conversation in a new tab

- **WHEN** the user middle-clicks (scroll wheel click) a conversation row
- **THEN** the conversation URL (`item.href`) is opened in a new browser tab
- **AND** the browser autoscroll indicator does NOT appear

`ConversationHistoryItem` SHALL include an optional `href?: string` field — a browser-navigable URL for the conversation. When `href` is set, the row intercepts `mousedown` (button 1) to suppress the browser autoscroll cursor and intercepts `auxclick` (button 1) to call `window.open(href, '_blank', 'noreferrer')`. Both handlers are attached to the interactive `<button>` element (not the surrounding `<li>`). `ConversationPanelView` in `apps/chat` SHALL populate `href` using `getConversationRoute(id)` for each item.

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

### Requirement: Panel rows expose per-item actions (pin, rename, delete)

`ConversationPanel` SHALL accept `getActions?: (item: ConversationHistoryItem) => DropdownItem[]` and `actionsLabel?: string` (English default: `"More actions"`). When `getActions` returns a non-empty array for a row, an ellipsis trigger button is rendered on that row; activating it opens a dropdown built from the returned `DropdownItem[]`. When `getActions` is omitted or returns an empty array, no trigger is rendered.

Row-level actions (pin/unpin, rename, delete) are wired in `ConversationPanelView` where `ConversationsContext` supplies the mutation methods.

#### Scenario: Row actions trigger renders when getActions returns items

- **WHEN** `getActions` returns a non-empty array for a row
- **THEN** an actions trigger button is visible on that row

#### Scenario: No trigger when getActions returns empty array

- **WHEN** `getActions` returns `[]` for a row
- **THEN** no actions trigger button is rendered for that row

---

### Requirement: Panel is responsive — persistent on desktop, drawer on mobile

`ConversationPanel` renders the same markup regardless of viewport. On desktop it is a persistent `w-[325px]` panel that pushes `<main>` via flex row. On mobile `ConversationPanelView` passes `className="inset-y-0 start-0 z-50"` plus `onToggle={onClose}` so `SidebarPanel` renders a close button inside the panel header; the parent manages `isOpen` state.

Mobile close is handled exclusively via the close button inside the panel header (via `onToggle` → `SidebarPanel.onClose`). There is no backdrop overlay.

---

### Requirement: `ConversationPanel` has unit tests

Tests SHALL be in `libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx` covering: rendering items, active item marking, empty state, aria-hidden, new-chat callback, search filtering, filter tab switching, section collapse/expand.

#### Scenario: Tests cover core interactions

- **WHEN** the `ConversationPanel` test suite runs
- **THEN** all scenarios above have corresponding test cases and pass

---

### Requirement: `ConversationHistoryItem` exposes `iconTooltip` for the deployment icon tooltip

`ConversationHistoryItem` SHALL include an optional `iconTooltip?: string` field. When present, `ConversationRow` SHALL forward it as the `tooltip` prop of `DeploymentIcon`. When absent, no tooltip is rendered on the icon.

#### Scenario: iconTooltip field is accepted without TypeScript error

- **WHEN** a `ConversationHistoryItem` object is constructed with `iconTooltip: "My Agent"`
- **THEN** TypeScript resolves the type without error
