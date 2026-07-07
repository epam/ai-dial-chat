# Spec: conversation-history-panel

## Requirements

### Requirement: `libs/conversation-panel` library exposes `ConversationPanel`

A new library `@epam/ai-dial-conversation-panel` SHALL exist at `libs/conversation-panel/`. It SHALL export `ConversationPanel` and the types: `ConversationPanelProps`, `ConversationPanelStyles`, `ConversationHistoryColors`, `ConversationHistoryTypography`, `ConversationHistoryItem`, `ConversationSource` (string enum), `FilterTab` (string enum), `FilterLabels`, `ConversationGroupProps`. The library SHALL declare `react`, `@epam/ai-dial-ui-kit`, `@tabler/icons-react` as peer dependencies. It SHALL have `"license": "Apache-2.0"` in `package.json`.

The library imports `SidebarPanel`, `SearchInput`, and `SidebarOrientation` from `@epam/ai-dial-sidebar` to use as the panel shell.

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

#### Scenario: Middle mouse button click opens conversation in a new tab

- **WHEN** the user middle-clicks (scroll wheel click) a conversation row
- **THEN** the conversation URL (`item.href`) is opened in a new browser tab
- **AND** the browser autoscroll indicator does NOT appear

`ConversationHistoryItem` SHALL include an optional `href?: string` field — a browser-navigable URL for the conversation. When `href` is set, the row intercepts `mousedown` (button 1) to suppress the browser autoscroll cursor and intercepts `auxclick` (button 1) to call `window.open(href, '_blank', 'noreferrer')`. Both handlers are attached to the interactive `<button>` element (not the surrounding `<li>`). `ConversationPanelView` in `apps/chat` SHALL populate `href` using `getConversationRoute(id)` for each item.

#### Scenario: Empty state is shown when no conversations

- **WHEN** `conversations` is an empty array
- **THEN** the `emptyLabel` prop text is rendered instead of sections

---

### Requirement: Panel shows a skeleton loader while conversations are loading

`ConversationPanel` SHALL accept an optional `isLoading?: boolean` prop. When `isLoading` is `true`, the panel body SHALL render a column of skeleton placeholder rows instead of the conversation list, empty state, or no-results state. Each skeleton row SHALL display a 24 × 24 px circular avatar placeholder and a title rectangle beside it. Row widths vary deterministically via `60 + (i * 23 % 35)` percent. The skeleton uses `DialSkeleton` from `@epam/ai-dial-ui-kit` with `color="var(--bg-layer-4)"` for contrast against the `bg-layer-3` panel background. `ConversationPanelView` in `apps/chat` passes `isLoading` from `ConversationsContext`.

#### Scenario: Skeleton is shown while loading

- **WHEN** `ConversationPanel` receives `isLoading={true}`
- **THEN** skeleton rows are rendered and the conversation list, empty state, and no-results state are not rendered

#### Scenario: Normal content is shown after loading

- **WHEN** `isLoading` is `false` or omitted
- **THEN** the panel renders conversations (or empty/no-results state) as normal

---

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

---

### Requirement: `getModelIdFromConversationId` correctly extracts the deployment ID from multi-segment and slash-containing conversation IDs

`apps/chat/src/utils/get-model-id-from-conversation-id.ts` SHALL export `getModelIdFromConversationId(id: string): string | undefined`.

The backend encodes each `/`-separated segment of the conversation path individually with `encodeURIComponent` (`encodeDialResourcePath`). This means **both** the deployment ID and the conversation title can introduce extra URL path segments:

- Deployment `anthropic/claude-3`, title `My chat`
  → `conversations/bucket/anthropic/claude-3__My%20chat`
- Deployment `uuid`, title `report 6/2/2026` (title contains slashes)
  → `conversations/bucket/uuid__report%206/2/2026`

The function MUST scan the post-`conversations/{bucket}/` segments **left-to-right** and stop at the **first** segment (after URL-decoding) that contains `__`. Segments before that one form the deployment ID path prefix. The part of the separator segment before `__` is the final piece of the deployment ID. Segments after the separator segment are part of the title and MUST be ignored.

The function MUST return `undefined` when:
- The input has fewer than 3 `/`-separated segments.
- No segment contains `__`.

#### Scenario: Simple single-segment deployment

- **WHEN** `getModelIdFromConversationId('conversations/bucket/gpt-4__My%20chat')` is called
- **THEN** it returns `'gpt-4'`

#### Scenario: Multi-segment deployment ID

- **WHEN** `getModelIdFromConversationId('conversations/bucket/anthropic/claude-3__My%20chat')` is called
- **THEN** it returns `'anthropic/claude-3'`

#### Scenario: Title containing slashes

- **WHEN** `getModelIdFromConversationId('conversations/bucket/gpt-4__report%206/2/2026')` is called
- **THEN** it returns `'gpt-4'`

#### Scenario: Multi-segment deployment AND title with slashes

- **WHEN** `getModelIdFromConversationId('conversations/bucket/anthropic/claude-3__report%206/2/2026')` is called
- **THEN** it returns `'anthropic/claude-3'`

#### Scenario: No `__` separator → returns undefined

- **WHEN** `getModelIdFromConversationId('conversations/bucket/gpt-4-no-title')` is called
- **THEN** it returns `undefined`

#### Scenario: Fewer than 3 segments → returns undefined

- **WHEN** `getModelIdFromConversationId('bucket/gpt-4__title')` is called
- **THEN** it returns `undefined`

---

### Requirement: `ConversationPage` uses `model.id` as fallback when `assistantModelId` is absent

`apps/chat/src/pages/Conversation/Conversation.tsx` SHALL pass `initialModelId` to `ConversationView` as:

```ts
initialModelId={conversation.assistantModelId || conversation.model.id}
```

The `Conversation` type declares `assistantModelId: string`, but conversations created externally or by older versions of the application may omit the field at runtime. Without a fallback, messages that have no own `deploymentId` would have no effective deployment ID and therefore no icon in the message bubbles, while the dropdown and sidebar correctly display an icon. The `model.id` fallback MUST mirror the same fallback already used when calling `restoreSelectedItemId` from `loadConversation`.

#### Scenario: Icons shown in message bubbles when assistantModelId is absent

- **WHEN** a conversation's JSON has `model.id = 'gpt-4'` but no `assistantModelId` field
- **AND** the conversation messages have no individual `deploymentId` set
- **THEN** message bubbles resolve icons using `'gpt-4'` as the effective deployment ID
- **AND** the icon is consistent with the dropdown and conversation panel

#### Scenario: assistantModelId takes precedence when present

- **WHEN** a conversation has both `model.id = 'gpt-4'` and `assistantModelId = 'anthropic/claude-3'`
- **THEN** `initialModelId` is `'anthropic/claude-3'` (the `assistantModelId` wins)

---

### Requirement: Conversations can be reordered and pinned/unpinned via drag-and-drop

`ConversationPanel` SHALL support native HTML5 drag-and-drop on conversation rows. Dragging is enabled only within the virtualised list (rows rendered by react-window); drag state is held in `ConversationPanel` so it survives virtual row recycling.

`ConversationPanelProps` SHALL accept an optional `onMoveConversation?: (move: ConversationMove) => void` callback. `ConversationMove` is exported from `@epam/ai-dial-conversation-panel` and contains:

```ts
interface ConversationMove {
  draggedId: string;
  targetGroupKey: ConversationGroupKey;  // which group the item was dropped into
  afterId: string | null;               // item to insert after; null = top of group
}
```

`ConversationGroupKey` is also exported from the lib (`Pinned | MyChats | Shared | Organization`).

**Drop rules enforced by the lib:**

| Drag source → Drop target | Allowed? |
|---|---|
| Any group → same group | ✅ (reorder) |
| MyChats / Shared / Organization → Pinned | ✅ (pin) |
| Pinned → source group (item.source matches) | ✅ (unpin) |
| Pinned → non-matching group | ❌ |
| MyChats ↔ Organization / Shared | ❌ |

The lib enforces rules via `computeAllowedDropGroups` (computed at drag start); invalid targets receive `cursor-not-allowed` and no ring.

**Visual feedback:**

- Dragged row: `opacity-50 cursor-grabbing`
- Valid drop target (item row or Pinned header): `ring-1 ring-inset ring-accent-secondary`
- Invalid drop target (drag is active, drop not allowed): `cursor-not-allowed`

**Pinned group header as drop zone:** The Pinned section header is also a valid drop target. Dropping onto it is equivalent to inserting at the top of the Pinned list (`afterId: null`).

**App wiring (`ConversationPanelView`):** `onMoveConversation` is wired to:
- `targetGroupKey === Pinned` → call `pinConversation(contextId, true)`
- Item is currently pinned and `targetGroupKey !== Pinned` → call `pinConversation(contextId, false)`
- Same-group reorder → no-op (no reorder persistence API in this iteration)

#### Scenario: Dragging a My Chats conversation to the Pinned section pins it

- **WHEN** the user drags a My Chats conversation and drops it onto the Pinned section header
- **THEN** `onMoveConversation` is called with `targetGroupKey: ConversationGroupKey.Pinned` and `afterId: null`
- **AND** the app calls `pinConversation(contextId, true)`

#### Scenario: Dragging a pinned conversation to My Chats unpins it

- **WHEN** the user drags a pinned conversation (with `source: MyChats`) and drops it onto a My Chats row
- **THEN** `onMoveConversation` is called with `targetGroupKey: ConversationGroupKey.MyChats`
- **AND** the app calls `pinConversation(contextId, false)`

#### Scenario: Cross-category drop is blocked

- **WHEN** the user drags a My Chats conversation over an Organization row
- **THEN** the Organization row shows `cursor-not-allowed` and no highlight ring
- **AND** releasing the mouse produces no `onMoveConversation` call

#### Scenario: Dragged row is visually dimmed

- **WHEN** the user starts dragging a conversation row
- **THEN** that row renders with `opacity-50`

#### Scenario: Valid drop target is highlighted

- **WHEN** the user drags a conversation over a row in the same group
- **THEN** that row shows a highlight ring (`ring-1 ring-inset ring-accent-secondary`)

---

### Requirement: A success notification is shown after a conversation row is deleted

After `deleteConversation` resolves successfully, `ConversationPanelView` SHALL show a success notification with a localized title and message confirming the deletion. No success notification is shown when the deletion fails — only the inline error state is set.

#### Scenario: Success notification shown after successful deletion

- **WHEN** the user confirms deletion and the API call succeeds
- **THEN** a success notification appears with the localized title and delete-success message

#### Scenario: No success notification on deletion failure

- **WHEN** the API call throws
- **THEN** no success notification is shown and the inline delete error state is set instead

---

### Requirement: Deleting the active conversation from the panel row navigates to root

When the user confirms single-row deletion of the conversation currently open in the conversation view, `ConversationPanelView` SHALL navigate to `ROUTES.Root` after the deletion succeeds.

The comparison between the deleted conversation ID and `activeConversationId` MUST be encoding-safe: apply `decodeURIComponent` to the normalized deleted ID before comparing, with a try/catch fallback to the raw normalized form (matching the decoding applied to `activeConversationId` in `apps/chat/src/app/app.tsx`).

Navigation MUST occur regardless of whether the conversation is owned, shared, or published — the deletion request was explicit and the view is no longer valid.

#### Scenario: navigates to root after deleting the active conversation

- **WHEN** the user deletes the conversation whose ID matches `activeConversationId`
- **THEN** `navigate(ROUTES.Root)` is called after the deletion API call succeeds

#### Scenario: no navigation when deleting a non-active conversation

- **WHEN** the user deletes a conversation whose ID does NOT match `activeConversationId`
- **THEN** `navigate` is NOT called

#### Scenario: encoding-safe comparison navigates correctly for percent-encoded IDs

- **WHEN** the API returns an ID such as `conversations/bucket/gpt-4__My%20Chat.json` (percent-encoded)
- **AND** `activeConversationId` holds the decoded form `bucket/gpt-4__My Chat.json`
- **WHEN** the user deletes that conversation
- **THEN** `navigate(ROUTES.Root)` is called (the percent-encoded and decoded forms are recognized as equal)
