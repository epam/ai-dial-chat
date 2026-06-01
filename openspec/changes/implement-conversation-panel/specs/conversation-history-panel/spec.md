## Requirements

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

### Requirement: Panel body renders a list of conversation items

When `isOpen` is `true`, `ConversationHistoryPanel` SHALL render a scrollable list (`role="list"`) of conversation items. Each item (`role="listitem"`) SHALL display:
- The conversation `title` (truncated with ellipsis if too long).
- A formatted date string (`updatedAt`), formatted by the caller via the `formatDate` prop callback.
- The item SHALL be a button or link that calls `onSelectConversation(id)` when activated.
- The currently active conversation (matching `activeConversationId`) SHALL receive `aria-current="page"`.

#### Scenario: Renders all provided conversations
- **WHEN** `ConversationHistoryPanel` receives 5 conversation items and `isOpen={true}`
- **THEN** 5 list items are visible

#### Scenario: Active conversation is marked
- **WHEN** `activeConversationId` matches one item's `id`
- **THEN** that item has `aria-current="page"`

#### Scenario: Clicking an item calls onSelectConversation
- **WHEN** the user clicks a conversation item
- **THEN** `onSelectConversation` is called with that item's `id`

#### Scenario: Empty state is shown when no conversations
- **WHEN** `conversations` is an empty array
- **THEN** the empty-state message (`emptyLabel` prop) is rendered instead of a list

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

Tests SHALL be in `libs/conversation-history/src/components/ConversationHistoryPanel/tests/ConversationHistoryPanel.spec.tsx`. They MUST cover: rendering items, toggle button interaction, active item marking, empty state, aria-expanded, and backdrop click.
