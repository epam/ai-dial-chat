# Spec: conversation-history-panel

## Purpose

The `conversation-panel` library: grouped, searchable, filterable conversation history with per-item actions, persistent on desktop and a drawer on mobile.
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

Each section renders a disclosure button (chevron icon) as its header that toggles open/closed. All sections start expanded. When a section is collapsed, all items in that section SHALL be hidden regardless of whether any item in that section is the currently active conversation. A section with zero items after active search + tab filter SHALL be hidden. Each item SHALL display the conversation `title` (truncated) and its deployment icon according to the following rules:

- When `item.isIconLoading` is `true`, an animated skeleton placeholder MUST be shown in the icon slot instead of the deployment icon or fallback.
- When `item.isIconLoading` is `false` or `undefined` and `item.iconUrl` is set, the resolved image MUST be shown.
- When `item.isIconLoading` is `false` or `undefined` and `item.iconUrl` is absent, the default fallback icon MUST be shown.

When `item.iconTooltip` is provided and `item.isIconLoading` is `false` or `undefined`, the deployment icon SHALL show a tooltip with that text on hover. The item SHALL call `onSelectConversation(id)` when activated. The active conversation (matching `activeConversationId`) SHALL receive `aria-current="page"`. Section headings via optional `groupLabels?: { pinned?, myChats?, shared?, organization? }` (English defaults: `"Pinned"`, `"My chats"`, `"Shared"`, `"Organization"`).

`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` computes each row's `iconTooltip` as the resolved deployment's `displayName` when `findDeploymentByIdOrReference` finds a match for the id extracted by `getModelIdFromConversationId`. When no match is found (the deployment is unavailable, or the extracted id was contaminated by real conversation-folder path segments — see the `getModelIdFromConversationId` requirement above), `iconTooltip` SHALL fall back to only the **last** `/`-separated segment of the extracted id, percent-decoded — NOT the full extracted id/path — to avoid showing a misleading or unreadable full path as the tooltip.

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

#### Scenario: Fallback tooltip shows only the last path segment when no deployment matches

- **GIVEN** `getModelIdFromConversationId` extracted `'YH folder01.1/YH folder01.2/YH folder01.3/dial-chathub-v2-gpt-5.5-2026-04-24'` for a row (contaminated by real conversation-folder segments) and no deployment in `deployments` has that `id` or `reference`
- **WHEN** `ConversationPanelView` computes that row's `iconTooltip`
- **THEN** `iconTooltip` is `'dial-chathub-v2-gpt-5.5-2026-04-24'` (the last segment, decoded), not the full extracted path

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

`ConversationPanel` SHALL accept an optional `isLoading?: boolean` prop. When `isLoading` is `true`, the panel body SHALL render a column of skeleton placeholder rows instead of the conversation list, empty state, or no-results state. Each skeleton row SHALL display a 24 × 24 px circular avatar placeholder and a title rectangle beside it. Row widths vary deterministically via `60 + (i * 23 % 35)` percent. The skeleton uses `Skeleton` from `@epam/ai-dial-ui-kit` with `color="var(--bg-layer-4)"` for contrast against the `bg-layer-raised` panel background. `ConversationPanelView` in `apps/chat` passes `isLoading` from `ConversationsContext`.

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

#### Scenario: Section collapses even when its active conversation is open

- **WHEN** the user opens a conversation from the My chats section (making it the active conversation)
- **AND** clicks the My chats section disclosure button to collapse the section
- **THEN** the My chats section items are no longer visible, including the active conversation row

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

`ConversationPanel` SHALL render a segmented tab control with four tabs corresponding to `FilterTab` enum values (`All`, `MyChats`, `Shared`, `Organization`). Active tab state is internal `useState<FilterTab>` (default: `FilterTab.All`). Items are filtered by `item.source === tab` (or all when `FilterTab.All`). Filtering combines with search. The active tab SHALL have `aria-selected="true"`; the tab list SHALL have `role="tablist"`. Labels via `filterLabels: FilterLabels`.

#### Scenario: Active tab is marked aria-selected

- **WHEN** "My chats" tab is selected
- **THEN** that tab has `aria-selected="true"` and others have `aria-selected="false"`

#### Scenario: Selecting a tab filters by source

- **WHEN** the user clicks the "Shared" tab
- **THEN** only conversations with `source === ConversationSource.Shared` are shown

---

### Requirement: `hiddenSources` fully excludes matching conversations, not just their tab

`ConversationPanel` SHALL accept an optional `hiddenSources?: FilterTab[]` prop. When non-empty, any conversation whose `source` is included in `hiddenSources` SHALL be dropped before tab filtering, search filtering, and grouping — so it never appears under any tab (including `All`), never contributes to a group heading (e.g. "Organization"), and is excluded from drag-and-drop's allowed-groups computation. The corresponding tab pill(s) in `FilterTabs` SHALL also be omitted from the row entirely. This differs from `isFilterTabsHidden`, which only hides the tab row while every source's conversations remain visible under `All`.

`FilterTabs` (the tab-row sub-component) accepts the same `hiddenSources?: FilterTab[]` prop and filters its rendered tabs by it; `ConversationPanel` forwards its own `hiddenSources` prop unchanged.

#### Scenario: A conversation with a hidden source is absent everywhere

- **GIVEN** `hiddenSources={[FilterTab.Organization]}` and a conversation with `source: FilterTab.Organization`
- **WHEN** the panel renders with the `All` tab active
- **THEN** that conversation is not shown, and no "Organization" group heading appears

#### Scenario: The hidden source's tab pill is omitted

- **GIVEN** `hiddenSources={[FilterTab.Organization]}`
- **WHEN** the filter tab row renders
- **THEN** the "Organization" pill is not rendered, while the other tabs render normally

#### Scenario: hiddenSources absent or empty changes nothing

- **WHEN** `hiddenSources` is omitted or `[]`
- **THEN** all four tabs render and every source's conversations are shown exactly as before this prop existed

---

### Requirement: Panel rows expose per-item actions (pin, rename, delete, share)

`ConversationPanel` SHALL accept `getActions?: (item: ConversationHistoryItem) => DropdownItem[]` and `actionsLabel?: string` (English default: `"More actions"`). When `getActions` returns a non-empty array for a row, an ellipsis trigger button is rendered on that row; activating it opens a dropdown built from the returned `DropdownItem[]`. When `getActions` is omitted or returns an empty array, no trigger is rendered.

Row-level actions (pin/unpin, rename, duplicate, delete, share) are wired in `ConversationPanelView` where `ConversationsContext` supplies the mutation methods.

For owned, non-readonly conversations (`isReadonly: false`, `sharedWithMe: false`, `publishedWithMe: false`), `getActions` SHALL include a `share` action (in addition to `pin`/`unpin`, `rename`, `duplicate`, `delete`) that opens `ShareConversationPopoverContainer` for the conversation. Readonly conversations (readonly, shared-with-me, or published-with-me) continue to receive only `pin`/`unpin` and `duplicate` — no `share` action is added for them.

#### Scenario: Row actions trigger renders when getActions returns items

- **WHEN** `getActions` returns a non-empty array for a row
- **THEN** an actions trigger button is visible on that row

#### Scenario: No trigger when getActions returns empty array

- **WHEN** `getActions` returns `[]` for a row
- **THEN** no actions trigger button is rendered for that row

#### Scenario: Owned conversation's action menu includes Share

- **GIVEN** a conversation row where `isReadonly`, `sharedWithMe`, and `publishedWithMe` are all `false`
- **WHEN** the row's actions trigger is activated
- **THEN** the dropdown includes a "Share" item alongside pin, rename, duplicate, and delete

#### Scenario: Readonly conversation's action menu excludes Share

- **GIVEN** a conversation row where `sharedWithMe` is `true`
- **WHEN** the row's actions trigger is activated
- **THEN** the dropdown includes only pin/unpin and duplicate; no "Share" item is present

#### Scenario: Selecting Share opens the share popover

- **GIVEN** an owned conversation row's action dropdown is open
- **WHEN** the "Share" item is clicked
- **THEN** `ShareConversationPopoverContainer` is rendered for that conversation

---

### Requirement: Panel is responsive — persistent on desktop, drawer on mobile

`ConversationPanel` SHALL render the same markup regardless of viewport. On desktop it is a persistent `w-[325px]` panel that pushes `<main>` via flex row. On mobile `ConversationPanelView` passes `className="inset-y-0 start-0 z-50"` plus `onToggle={onClose}` so `SidebarPanel` renders a close button inside the panel header; the parent manages `isOpen` state.

Mobile close is handled exclusively via the close button inside the panel header (via `onToggle` → `SidebarPanel.onClose`). There is no backdrop overlay.

#### Scenario: Desktop renders a persistent panel

- **WHEN** the app is rendered at a desktop viewport
- **THEN** the panel occupies a persistent `w-[325px]` column beside `<main>` and renders no close button

#### Scenario: Mobile renders a closable drawer

- **WHEN** the app is rendered at a mobile viewport and the panel is open
- **THEN** the panel is positioned with `inset-y-0 start-0 z-50` and its header carries a close button
- **AND** no backdrop overlay is rendered

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

DIAL Scheduler additionally writes scheduled-task conversations under the reserved `conversations/{bucket}/.scheduler/{scheduleId}/{filename}` path shape (matching `apps/chat-api/src/conversations/utils/parse-scheduled-task-conversation-path.ts`'s `SCHEDULER_SEGMENT = '.scheduler'`). When the segment immediately after the bucket is the literal string `.scheduler`, the function MUST treat that segment and the one immediately following it (the schedule id) as a reserved path prefix and skip both before extracting the deployment id from the remaining segments — they are never part of the deployment id.

The function MUST scan the remaining segments (after skipping bucket, and after skipping the `.scheduler`/scheduleId pair when present) **left-to-right** and stop at the **first** segment (after URL-decoding) that contains `__`. Segments before that one form the deployment ID path prefix. The part of the separator segment before `__` is the final piece of the deployment ID. Segments after the separator segment are part of the title and MUST be ignored.

The function MUST return `undefined` when:
- The input has fewer than 3 `/`-separated segments.
- No segment (after any `.scheduler` prefix skip) contains `__`.

Note: outside the specifically-reserved `.scheduler/{scheduleId}` prefix, this function cannot reliably distinguish a real, user-created conversation folder from a genuine multi-segment deployment id — both appear as plain `/`-separated path segments once encoded into the resource path, and no other reserved marker exists to disambiguate them. Consumers of this function's return value MUST NOT assume the result is always a valid deployment id (see the `ConversationPanelView` icon-tooltip fallback requirement below).

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

#### Scenario: Scheduled-task conversation strips the .scheduler/{scheduleId} prefix

- **WHEN** `getModelIdFromConversationId('conversations/bucket/.scheduler/64bd658b-4258-46bd-b19e-afd9e0f3f254/gemini-3.1-flash-lite__title__run-id')` is called
- **THEN** it returns `'gemini-3.1-flash-lite'`, not `'.scheduler/64bd658b-4258-46bd-b19e-afd9e0f3f254/gemini-3.1-flash-lite'`

#### Scenario: Scheduled-task conversation with a multi-segment deployment id strips the prefix

- **WHEN** `getModelIdFromConversationId('conversations/bucket/.scheduler/schedule-id/anthropic/claude-3__title__run-id')` is called
- **THEN** it returns `'anthropic/claude-3'`

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

### Requirement: A conversation the backend no longer has leaves the panel

A conversation can disappear upstream while the panel still lists it — most commonly because deleting its last message deleted the conversation itself (see `chat-hooks-conversation-handlers`), but also when another tab or session removed it. Such a row is unusable: opening it fails and deleting it fails, so it SHALL NOT be left in the list.

`ConversationsContext` SHALL therefore expose `removeConversationFromList(id)`,
which drops a conversation from the local list without issuing a delete
request, matching ids with the same encoding-safe comparison the panel uses.
The conversation view SHALL call it both from `useConversationHandlers`'
`onConversationDeleted` and when loading a conversation fails with a
not-found error.

`deleteConversation` SHALL treat a not-found response as success: the row
stays removed and no error is raised, mirroring the bulk deletion endpoint's
already-absent accounting. Any other failure SHALL still restore the row and
rethrow. Both removal paths SHALL match ids with `conversationIdsMatch`, so a
differently-encoded id clears the same row either way.

Reporting an already-absent deletion as success is deliberate: every consumer
of a resolved `deleteConversation` — the panel's and header menu's
`notifyOperationSuccess`, `useConversationListBridge`, the overlay bridge —
then reports the deletion as done. From the user's side that is accurate: the
conversation they asked to delete is gone. Distinguishing "was already gone"
would raise a failure or a caveat for an outcome the user asked for and got.

#### Scenario: Deleting the last message removes the row

- **WHEN** the user deletes the only message pair of the open conversation, which deletes the conversation itself
- **THEN** the conversation is removed from the panel list and the view navigates to `ROUTES.Root`

#### Scenario: Opening a conversation the backend no longer has removes the row

- **WHEN** loading a conversation fails with a not-found error
- **THEN** the conversation is removed from the panel list in addition to the existing error notification and navigation to `ROUTES.Root`

#### Scenario: Deleting an already-absent conversation succeeds

- **WHEN** the user confirms deletion of a row whose conversation the backend no longer has
- **THEN** the delete resolves successfully, the row stays removed, no inline delete error is shown, and the caller's usual deletion-success notification is raised

#### Scenario: A differently-encoded id clears the same row

- **WHEN** `deleteConversation` is called with an id whose encoding differs from the listed id (e.g. `folder%2Fchat%20one` for `folder/chat one`)
- **THEN** that row is the one removed from the list

#### Scenario: Any other delete failure still restores the row

- **WHEN** the delete request fails with anything other than a not-found response
- **THEN** the row is restored to the list and the error is rethrown for the inline error state

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

---

### Requirement: Unread scheduler-created conversations show an unread dot in the history panel

`ConversationItem` (exported from `@epam/ai-dial-conversation-panel`) SHALL include one optional presentational field: `isUnread?: boolean`. The lib carries no knowledge of scheduler ids, bucket storage, or API shapes — this is a plain display prop, following the same pattern as the existing `leadingIcon`/`iconTooltip` fields.

When `isUnread` is `true`, `ConversationRow` SHALL:

1. render a `7.11px` round dot centered in a 24×24 container at the **trailing edge** of the row, after the title, using the design system's accent/notification color (`--cp-unread-dot`, overridable via `ConversationColors.unreadDot`, default `--text-accent`);
2. render the title with the `dial-small-semi-text` typography class (600 weight, 14/24) instead of `itemTitleClassName`. The weight change SHALL NOT change the row height.

When `isUnread` is `false` or omitted, no dot renders, the title keeps its normal weight, and the leading slot no longer reserves any space for an indicator (the former 12×12 pre-avatar slot is removed). The dot is decorative status, not a control — it has no click handler and is not a link.

**Row layout.** When both the unread dot and the overflow-actions trigger are present, `ConversationRow` SHALL adjust end padding (mirroring the existing `getButtonPaddingEnd` pattern) so the title truncates with an ellipsis and neither the dot nor the trigger overlaps it. In the hover, focus-within, and open-menu states where the actions trigger appears, the dot SHALL be visually hidden so the trigger takes its trailing spot; the `sr-only` unread label SHALL stay in the accessibility tree in every state.

**Accessible name.** Since AAA requires status to not be conveyed by color or weight alone, the dot wrapper SHALL carry a visually-hidden (`sr-only`) label (i18n key `conversationPanel.unreadIndicatorLabel`, English default: `"Unread"`) so screen reader users hear the unread state; the visible dot element itself SHALL be `aria-hidden`. The dot color's contrast against the row background (default, hover, active) SHALL be at least 3:1 (non-text UI component).

**App wiring (`ConversationPanelView` in `apps/chat`).** The app maps `ConversationListItemDto.isUnread` to `ConversationItem.isUnread` for scheduled-task items through `resolveTaskPresentation`.

**Mark-as-viewed on open.** When the user opens (clicks, or middle-clicks to open in a new tab) a row whose item has `isScheduledTask: true` and `isUnread: true`, the app SHALL optimistically clear the row's unread state in local state and call the mark-viewed action (`ConversationsContext.markConversationViewed(id)`, which calls `PATCH /api/v1/conversations/viewed?path=<path>`). If the call fails, the app SHALL roll back the local state to `isUnread: true` (same optimistic-update-with-rollback pattern already used for pinning). Opening a conversation directly via URL navigation or from a task's History (not via a history panel row click) SHALL also trigger the same mark-viewed call once the conversation is confirmed loaded — this relies on the context's full, uncollapsed list (see `scheduled-task-conversation-grouping`).

**RTL.** The dot SHALL be positioned with logical properties (`ms-*`/`me-*`, `end-*`) so it stays at the trailing edge in both LTR and RTL — the visual left side in RTL.

**i18n.** `conversationPanel.unreadIndicatorLabel` (value `"Unread"`) remains in `apps/chat/src/i18n/locales/en.json` and the `ConversationPanelI18nKeys` type.

#### Scenario: Unread row shows a trailing dot and a heavier title

- **GIVEN** a `ConversationItem` with `isUnread: true`
- **WHEN** `ConversationRow` renders that item
- **THEN** a dot renders after the title at the row's trailing edge, the title uses the heavier weight, and an accessible "Unread" label is present

#### Scenario: Read or non-scheduler row shows no dot and normal weight

- **GIVEN** a `ConversationItem` with `isUnread` omitted or `false`
- **WHEN** `ConversationRow` renders that item
- **THEN** no dot renders, the title uses the normal weight, and no space is reserved before the leading icon

#### Scenario: Opening an unread task conversation clears the unread state optimistically

- **GIVEN** a history panel row with `isUnread: true` for a scheduler-created conversation
- **WHEN** the user clicks the row to open it
- **THEN** the dot and heavier weight disappear immediately (before the network call resolves) and `PATCH /api/v1/conversations/viewed?path=<path>` is called for that conversation

#### Scenario: Failed mark-viewed call restores the unread state

- **GIVEN** the user opens an unread task conversation and the optimistic clear has been applied
- **WHEN** the `PATCH /api/v1/conversations/viewed` call fails
- **THEN** the row's dot and heavier title weight are restored (rolled back to `isUnread: true`)

#### Scenario: Dot is decorative and has no click handler

- **GIVEN** a row with the unread dot rendered
- **WHEN** the user clicks directly on the dot
- **THEN** the row's normal `onSelectConversation` behavior for the row click still applies

#### Scenario: Dot and actions trigger do not overlap the title

- **GIVEN** a row with `isUnread: true` and a non-empty `getActions` result, and a long title
- **WHEN** the row renders and is hovered
- **THEN** the title truncates with an ellipsis and neither the dot nor the trigger overlaps it

#### Scenario: Dot stays at the trailing edge in RTL

- **GIVEN** `dir="rtl"` is set on an ancestor element
- **WHEN** a row with `isUnread: true` renders
- **THEN** the dot appears at the visual end of the row (left side in RTL)

### Requirement: A conversation row can carry a host-supplied leading icon

`ConversationItem` (exported from `@epam/ai-dial-conversation-panel`) SHALL include an optional presentational field `leadingIcon?: ReactNode`. When it is set, `ConversationRow` SHALL render it in the leading slot **instead of** the deployment avatar (`iconUrl`/`isIconLoading`/`iconTooltip` are then ignored for that row). When it is omitted, the row renders the deployment avatar exactly as today. The lib carries no knowledge of what the icon means — it has no schedule, task, or feature-flag concept; the host decides which items get an icon and which icon.

The leading slot SHALL keep the avatar's footprint (same box size and alignment) so titles of icon rows and avatar rows stay aligned.

**App wiring (`ConversationPanelView` in `apps/chat`).** For every item with `isScheduledTask === true`, the app SHALL supply its existing `ScheduledTasksIcon` (the same glyph as the Scheduled tasks navigation entry) at 16px with `stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden`, colored `var(--text-visual-blue, #1189C8)`, inside a 24×24 box with 4px padding, 8px corner radius, and `var(--bg-visual-blue, #D6EDF9)` background. The icon is supplied through `useConversationPanelItems`'s `resolveTaskPresentation` resolver (see `chat-hooks-conversation-panel-controller`). Like the former TASK badge, it is shown regardless of the `scheduledTasksEnabled` flag.

**a11y.** The icon is decorative: the row's accessible name remains the conversation title. The lib SHALL NOT add a tooltip or accessible name for a `leadingIcon`.

**RTL.** The leading slot uses the existing logical layout of the row; the icon itself SHALL NOT be mirrored (a clock/task glyph has no inherent direction).

**i18n.** None — the icon has no text.

#### Scenario: Row with a leading icon replaces the avatar

- **GIVEN** a `ConversationItem` with `leadingIcon` set and `iconUrl` set
- **WHEN** `ConversationRow` renders it
- **THEN** the leading icon is rendered and the deployment avatar is not

#### Scenario: Row without a leading icon is unchanged

- **GIVEN** a `ConversationItem` with `leadingIcon` omitted
- **WHEN** `ConversationRow` renders it
- **THEN** the deployment avatar (or its loading skeleton) renders exactly as before

#### Scenario: Task conversation shows the task icon

- **GIVEN** a list item with `isScheduledTask: true`
- **WHEN** the history panel renders it
- **THEN** its row shows the task icon with `aria-hidden="true"` and no TASK pill

#### Scenario: Title alignment holds between icon and avatar rows

- **WHEN** a task row and an ordinary row render one above the other
- **THEN** both titles start at the same inline offset

