# Delta: scheduled-tasks-page-ui

## MODIFIED Requirements

### Requirement: ScheduledTasks lib component renders header, toolbar, and data-driven content states

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTasks` root component accepting `labels`, `onCreateClick`, `searchQuery`/`onSearchQueryChange`, `sortKey`/`onSortChange`, `items: ScheduledTaskItem[]`, `isLoading` (default `false`), `hasMore: boolean` (default `false`), `isLoadingMore?: boolean` (default `false`), `skeletonCount?: number` (default `6`), `onLoadMore?: () => void`, optional `error`/`onRetry`, and optional `onDisconnectClick?: () => void` (a second header action, rendered only when provided, with its accessible name from `labels.disconnectButtonLabel`/`labels.disconnectAriaLabel`). It SHALL render, in order: a header (title, subtitle, and a right-side action group: the primary "create" button always, plus the optional disconnect button beside it), a toolbar (search input, sort control with options), and a content region whose rendering depends on state:

- `isLoading` is `true` (initial load) → the content region renders a `Spinner` and no other content-region markup.
- `error` is set → the content region renders an error message with a retry action that invokes `onRetry`.
- `isLoading` is `false`, `error` is unset, and `items` is empty because the source list itself is empty (no `searchQuery` in effect) → the content region renders the shared `PanelEmptyState` component (from `@epam/ai-dial-chat-shared`) with `labels.emptyStateLabel`.
- `isLoading` is `false`, `error` is unset, `items` is empty, and a non-empty `searchQuery` is in effect → the content region renders a distinct "no results" state (not `PanelEmptyState`, not the card grid) using `labels.noResultsLabel`. Because search is server-driven, this state reflects the server returning zero matches, not a client-side filter reducing a non-empty array to zero.
- `isLoading` is `false`, `error` is unset, and `items` is non-empty → the content region renders a single flat `ScheduledTaskCardGrid` of `ScheduledTaskCard`s, **in the order they were received** (no client-side reordering by `sortKey` — sort order is now applied server-side, see the "Server-driven search and sort over the full remote dataset" requirement). There is no grouping/sectioning of any kind — no section heading, no count badge — regardless of task ownership. When `isLoadingMore` is `true`, exactly `skeletonCount` `ScheduledTaskCardSkeleton` elements render as **trailing children inside that same `ScheduledTaskCardGrid`** (via its `trailingSkeletonCount` prop) — not in a separate grid container — so they continue filling the current CSS grid row (via `grid-auto-flow`) instead of unconditionally starting a new row and leaving a gap in a partially-filled last row.
- A scroll sentinel is rendered at the end of the content region's scrollable area; when it becomes visible and `hasMore && !isLoadingMore && !isLoading`, `onLoadMore` is invoked (if provided).

Both header action buttons SHALL collapse to icon-only 40px circles below 1280px (the `desktop:` breakpoint mirroring `MOBILE_MAX_WIDTH_PX`), via **one shared CSS class pair** (label-span hide + circle pill) applied to both buttons — not a duplicated media-query block per button.

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, auth, env, or analytics — all such knowledge is passed in via props. Fetching, pagination-state management, sort-state management, and DTO mapping happen in the app; the lib performs no sorting of `items` itself — `sortKey`/`onSortChange` are used only to drive the toolbar control's UI state (selected option, `aria-selected`), not to reorder rendered cards. The disconnect action carries no host semantics in the lib: the lib renders it purely from the callback + label props and performs no network, auth, or navigation work when it is activated.

#### Scenario: Header and toolbar render from props

- **WHEN** `ScheduledTasks` renders with `labels.title = 'Scheduled tasks'` and `labels.createButtonLabel = 'New task'`
- **THEN** the page shows a heading with that title and a button with that accessible name

#### Scenario: Loading state shows a spinner

- **WHEN** `ScheduledTasks` renders with `isLoading={true}`
- **THEN** the content region renders `Spinner` and no empty-state, no-results, card-grid, or skeleton markup

#### Scenario: Error state shows retry

- **WHEN** `ScheduledTasks` renders with `error` set and the user activates the retry action
- **THEN** the content region renders an error message and `onRetry` is called exactly once per activation

#### Scenario: Empty source list with no active search shows PanelEmptyState

- **WHEN** `ScheduledTasks` renders with `isLoading={false}`, no `error`, `items = []`, and no `searchQuery`
- **THEN** the content region renders `PanelEmptyState` with `labels.emptyStateLabel`, and no card/grid/section markup is present

#### Scenario: Empty items with an active search shows no-results state, not empty state

- **WHEN** `ScheduledTasks` renders with `items = []` and a non-empty `searchQuery`
- **THEN** the content region renders the no-results state with `labels.noResultsLabel`, distinct from `PanelEmptyState`

#### Scenario: Non-empty items render a flat card grid in received order

- **WHEN** `items` contains entries for tasks owned by the current user and entries for tasks created by other users, already ordered by the caller
- **THEN** the content region renders a single `ScheduledTaskCardGrid` with items in the same order they appear in `items` (no reordering by `sortKey` inside the lib), with no section heading or count badge of any kind

#### Scenario: Loading-more state appends trailing skeletons inside the same grid

- **WHEN** `ScheduledTasks` renders with non-empty `items`, `hasMore={true}`, and `isLoadingMore={true}`
- **THEN** exactly `skeletonCount` (default 6) `ScheduledTaskCardSkeleton` elements render as additional children of the same `ScheduledTaskCardGrid` — not inside a separate grid container — each marked `aria-hidden="true"`, so they continue filling the grid's current row instead of starting a new one

#### Scenario: Reaching the scroll sentinel triggers onLoadMore

- **WHEN** the scroll sentinel at the end of the content region becomes visible, `hasMore={true}`, `isLoadingMore={false}`, and `isLoading={false}`
- **THEN** `onLoadMore` is called

#### Scenario: Scroll sentinel does not trigger onLoadMore while a load is already in flight or no more pages exist

- **WHEN** the scroll sentinel becomes visible but `isLoadingMore={true}` or `hasMore={false}`
- **THEN** `onLoadMore` is not called

#### Scenario: Create button invokes the injected callback

- **WHEN** the user activates the create button
- **THEN** `onCreateClick` is called exactly once, with no navigation or network call performed by the lib itself

#### Scenario: Disconnect button renders only when the callback is provided

- **WHEN** `ScheduledTasks` renders with `onDisconnectClick` and `labels.disconnectButtonLabel = 'Disconnect'`
- **THEN** a second header action button with that accessible name renders beside the create button; when `onDisconnectClick` is not provided, no second button and no disconnect markup of any kind renders

#### Scenario: Disconnect button invokes the injected callback

- **WHEN** the user activates the disconnect button
- **THEN** `onDisconnectClick` is called exactly once, with no network, auth, or navigation call performed by the lib itself

#### Scenario: Both header buttons collapse on narrow viewports

- **WHEN** the viewport is narrower than 1280px
- **THEN** both the create and the disconnect button render as icon-only 40px circles via the same shared collapse class, and the header row does not overflow

#### Scenario: Lib has no host or integration imports

- **WHEN** the `libs/scheduled-tasks` source is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, auth, env, or analytics modules
