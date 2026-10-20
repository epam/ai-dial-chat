## MODIFIED Requirements

### Requirement: `libs/conversation-panel` library exposes `ConversationPanel`

A library `@epam/ai-dial-conversation-panel` SHALL exist at `libs/conversation-panel/`. Its `src/index.ts` SHALL export:

- **Components:** `ConversationPanel`, `ConversationList`, `ConversationListHeader`, `RenameConversationPopup`.
- **Values:** `CONVERSATION_PANEL_CLASS` and the enum `ConversationRowVariant`.
- **Types:** `ConversationMove`, `ConversationPanelProps`, `ConversationPanelStyles`, `ConversationColors`, `NewChatButtonColors`, `ConversationPanelTypography`, `ConversationPanelLabels`, `ConversationItem`, `FilterLabels`, `ConversationListProps`, `ConversationListLabels`, `ConversationListStyles`, `ConversationListColors`, `ConversationListHeaderProps`, `ConversationListHeaderLabels`, `ConversationListHeaderStyles`, `ConversationListHeaderColors`, `ConversationListHeaderTypography`, `ConversationListTypography`, `RenameConversationPopupProps`, `RenameConversationPopupLabels`, and `RenameConversationPopupStyles`.

It SHALL NOT export `FilterTab`, which is owned by `@epam/ai-dial-chat-shared` — `ConversationItem.source` and `ConversationMove.targetGroupKey` are typed as `FilterTab`, and consumers import that enum from its own package alongside this one. The library SHALL declare `react`, `@epam/ai-dial-chat-shared`, and `@epam/ai-dial-ui-kit` as peer dependencies, and `@tabler/icons-react`, `react-window`, and `@epam/ai-dial-sidebar` as regular dependencies. It SHALL have `"license": "Apache-2.0"` in `package.json`.

The library imports `SidebarPanel`, `SidebarOrientation`, `PanelEmpty`, and `PanelNoResults` from `@epam/ai-dial-sidebar` for the panel shell and empty states, and the 2.0 `Search`, `Skeleton`, `Dropdown`, and `GhostIconButton` components from `@epam/ai-dial-ui-kit`.

#### Scenario: ConversationPanel is importable in apps/chat

- **WHEN** `apps/chat` imports `ConversationPanel` from `@epam/ai-dial-conversation-panel`
- **THEN** TypeScript resolves the import without error

#### Scenario: `FilterTab` resolves from its owning package

- **WHEN** `apps/chat` or any module inside `libs/conversation-panel` needs `FilterTab`
- **THEN** it imports the enum from `@epam/ai-dial-chat-shared`, and importing it from
  `@epam/ai-dial-conversation-panel` does not resolve

#### Scenario: The list and its header are importable without the panel

- **WHEN** a host imports `ConversationList`, `ConversationListHeader` and `ConversationRowVariant` from `@epam/ai-dial-conversation-panel`
- **THEN** TypeScript resolves them, and rendering them does not render `SidebarPanel`, the New chat button or the filter chips

### Requirement: Panel is responsive — persistent on desktop, drawer on mobile

`ConversationPanel` SHALL render the same markup regardless of viewport, and the host decides how it is placed:
- **Persistent:** a host that mounts it in a desktop layout gets a `w-[324px]` panel that pushes `<main>` via flex row.
- **Drawer:** a host that passes `className="fixed inset-y-0 start-0 z-50"`, `isOverlay` and `onToggle` gets a panel that slides over the content instead of collapsing its width beside it, with a close button inside the panel header and the host managing `isOpen`.

`apps/chat` mounts no `ConversationPanel` at any width (see `navigation-sidebar`): `ConversationPanelView` renders `ConversationListSection` inside the sidebar, which is a column on desktop and a drawer on mobile.

Mobile close is handled exclusively via the close button inside the panel header (via `onToggle` → `SidebarPanel.onClose`). There is no backdrop overlay.

#### Scenario: Desktop renders a persistent panel

- **WHEN** a host mounts `ConversationPanel` in a desktop layout
- **THEN** the panel occupies a persistent `w-[324px]` column beside `<main>` and renders no close button

#### Scenario: Mobile renders a closable drawer

- **WHEN** a host renders `ConversationPanel` as a drawer and the panel is open
- **THEN** the panel is positioned with `fixed inset-y-0 start-0 z-50` as an overlay drawer and its header carries a close button
- **AND** no backdrop overlay is rendered

#### Scenario: The app renders no desktop panel

- **WHEN** `apps/chat` is rendered at any width
- **THEN** no `ConversationPanel` renders, and the conversation list renders inside the sidebar

## ADDED Requirements

### Requirement: `ConversationList` renders the grouped list without the panel chrome

`ConversationList` SHALL render the virtualized, grouped, collapsible conversation list. It SHALL keep:
- the Pinned / My chats / Shared / Organization grouping;
- `hiddenSources` exclusion;
- drag-and-drop moves reported through `onMoveConversation`;
- per-row actions;
- the active-row `aria-current="page"` and scroll-into-view;
- search highlighting;
- the loading skeleton, empty and no-results states;
- the polite live region announcing them.

It SHALL NOT render a header, a New chat button, a search field or filter chips. Search text and the active filter SHALL arrive as controlled `searchQuery` and `activeFilter` props.

`ConversationPanel` SHALL render through `ConversationList`, with no change to its props, its rendered output, its `dial-cp-*` classes, or the behaviour asserted by its existing tests.

The root element SHALL carry the public class `dial-cp-list` and merge the host's `className`.

#### Scenario: Controlled filtering

- **WHEN** `ConversationList` renders with `activeFilter={FilterTab.Shared}` and `searchQuery="plot"`
- **THEN** only shared conversations whose title matches "plot" are listed, with the match highlighted

#### Scenario: ConversationPanel output is unchanged

- **WHEN** the existing `ConversationPanel` test suite runs after the extraction
- **THEN** every test passes without modification

### Requirement: `ConversationListHeader` renders the "Chats and tasks" header row

`ConversationListHeader` SHALL render a title button with `aria-expanded`, reporting its toggle through `onToggleExpanded`. It SHALL also render these optional controls, each present only when the host passes its props:
- **Search toggle.** It swaps the row for the kit `Search`, with a separate Close search button. Escape also closes it. Closing calls `onSearchOpenChange(false)` and `onSearchChange('')` and returns focus to the toggle.
- **Filter trigger.** It opens a `Dropdown` of the four `FilterTab` options, excluding `hiddenSources`, single-select with a check on the active option.
- **`actions` slot.**

Every label SHALL be a prop. The root SHALL carry the public class `dial-cp-list-header`.

**RTL:** the controls use logical alignment, and no icon in the row is mirrored.

#### Scenario: Search toggle moves focus into the field

- **WHEN** the user activates the search toggle
- **THEN** the search field renders with focus, and the title and controls are replaced by it

#### Scenario: Filter trigger omitted

- **WHEN** the host passes no filter props
- **THEN** no filter trigger renders

### Requirement: Rows offer an indicator variant

`ConversationRowVariant` SHALL have the members `Avatar = 'avatar'` (the default, today's rows) and `Indicator = 'indicator'`. `ConversationList` SHALL accept `rowVariant`. `ConversationPanel` SHALL always render `Avatar` rows.

An `Indicator` row SHALL render:
- a leading dot, hollow when read; when unread, a filled dot in the `unreadDot` color and the title in `dial-small-semi-text`;
- no deployment avatar and no `leadingIcon`;
- no trailing unread dot.

It SHALL still announce the visually hidden `unreadIndicatorLabel` when unread. Row and group-header heights SHALL follow the variant.

#### Scenario: Unread indicator row

- **WHEN** an `isUnread` conversation with an `iconUrl` and a `leadingIcon` renders as an `Indicator` row
- **THEN** it shows a filled leading dot and a semi-bold title, renders neither the avatar nor the leading icon, and announces the unread label

#### Scenario: Default rows are unchanged

- **WHEN** `ConversationList` renders without `rowVariant`
- **THEN** rows render with the deployment avatar or `leadingIcon`, exactly as `ConversationPanel` rows do

### Requirement: ConversationListSection joins the header and the list

`@epam/ai-dial-conversation-panel` SHALL export `ConversationListSection`, which renders `ConversationListHeader` and an indicator-row `ConversationList` inside a `section` named by `labels.title`, and owns the search text, the search-open flag, the list-expanded flag and the active filter. It SHALL adopt `requestedFilter` whenever it changes, report the user's choice through `onFilterChange`, drop the filter trigger under `isFilterHidden`, remove `hiddenSources` from the list, render `headerActions` at the end of the header, merge `listClassName` onto the list root and carry the public class `dial-cp-list-section`. It SHALL NOT read feature keys, routes, i18n or session state.

#### Scenario: The section wires the header to the list

- **WHEN** the user types in the section's search field or chooses a filter
- **THEN** the list shows the matching rows, and `onFilterChange` receives the chosen tab

#### Scenario: A requested filter is adopted

- **WHEN** a host changes `requestedFilter`
- **THEN** the section switches to that filter and the user can still choose another

#### Scenario: The list collapses through the header title

- **WHEN** the user activates the header title
- **THEN** the list is removed, and the title reports `aria-expanded="false"`
