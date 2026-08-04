## MODIFIED Requirements

### Requirement: Client-side search and sort over the fetched list

Search is now server-driven and full-dataset; sort remains a client-side operation over whatever items are currently loaded in the browser, because the upstream DIAL Scheduler list endpoint has no sort/order capability (confirmed from its source — only pagination and a name filter are supported).

`ScheduledTasksPage` SHALL send `searchQuery` to `GET /api/v1/scheduled-tasks` as the `search` query parameter (see the modified `scheduled-tasks-api` "List scheduled tasks" requirement) instead of filtering the fetched array locally; `filterScheduledTaskItems` is removed from `libs/scheduled-tasks/src/utils/filter-sort.ts`. `ScheduledTasks`/`ScheduledTasksPage` SHALL continue to sort the currently-loaded `items` by `sortKey` using `sortScheduledTaskItems` (unchanged): `firstToRun`/`lastToRun` order by `sortValues.nextRunAt` ascending/descending (items missing `nextRunAt` sort last), `newest` orders by `sortValues.createdAt` descending (items missing `createdAt` sort last), and `nameAZ` orders by `displayName` ascending. Because pagination now loads the dataset incrementally (see the new "Infinite scroll loads and appends additional pages" requirement), sort only orders the pages fetched so far, not the full remote dataset — an accepted, documented limitation, not a regression versus today's single-page behavior.

#### Scenario: Search sends a server request instead of filtering locally

- **WHEN** `searchQuery = "competitor"` is set
- **THEN** `GET /api/v1/scheduled-tasks` is called with `search=competitor`, and the rendered `items` are exactly what the server returned — no additional client-side substring filtering is applied

#### Scenario: Sort by nameAZ orders alphabetically over loaded items

- **WHEN** `sortKey = "nameAZ"` and the currently loaded `items` contains `displayName` values `"Zeta"`, `"Alpha"`
- **THEN** the rendered card order is `"Alpha"`, `"Zeta"`

#### Scenario: Items missing sort field sort last

- **WHEN** `sortKey = "newest"` and one loaded item has no `sortValues.createdAt` while others do
- **THEN** the item without `createdAt` renders after all items that have it

#### Scenario: Sort does not trigger a new fetch

- **WHEN** the user changes `sortKey`
- **THEN** no new `GET /api/v1/scheduled-tasks` request is sent; only the already-loaded `items` are reordered for rendering

### Requirement: ScheduledTasks lib component renders header, toolbar, and data-driven content states

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTasks` root component accepting `texts`, `onCreateClick`, `searchQuery`/`onSearchQueryChange`, `sortKey`/`onSortChange`, `items: ScheduledTaskItem[]`, `isLoading` (default `false`), `hasMore: boolean` (default `false`), `isLoadingMore?: boolean` (default `false`), `skeletonCount?: number` (default `6`), `onLoadMore?: () => void`, and optional `error`/`onRetry`. It SHALL render, in order: a header (title, subtitle, primary "create" action button), a toolbar (search input, sort control with options), and a content region whose rendering depends on state:

- `isLoading` is `true` (initial load) → the content region renders a `DialSpinner` and no other content-region markup.
- `error` is set → the content region renders an error message with a retry action that invokes `onRetry`.
- `isLoading` is `false`, `error` is unset, and `items` is empty because the source list itself is empty (no `searchQuery` in effect) → the content region renders the shared `PanelEmptyState` component (from `@epam/ai-dial-chat-shared`) with `texts.emptyStateLabel`.
- `isLoading` is `false`, `error` is unset, `items` is empty, and a non-empty `searchQuery` is in effect → the content region renders a distinct "no results" state (not `PanelEmptyState`, not the card grid) using `texts.noResultsLabel`. Because search is now server-driven, this state reflects the server returning zero matches, not a client-side filter reducing a non-empty array to zero.
- `isLoading` is `false`, `error` is unset, and `items` is non-empty → the content region renders the card grid: `items` are first sorted by `sortKey` (client-side, over the currently loaded items — see the modified "Client-side search and sort over the fetched list" requirement), then grouped by `sectionKey`, each group rendered as a `ScheduledTaskSection` containing a `ScheduledTaskCardGrid` of `ScheduledTaskCard`s. The `'shared'` group renders with a title + count badge (`texts.sharedSectionTitle`); the `'myTasks'` group renders with no title/count row, just its card grid. When `isLoadingMore` is `true`, exactly `skeletonCount` `ScheduledTaskCardSkeleton` elements render as **trailing children inside the last rendered section's own `ScheduledTaskCardGrid`** (via that grid's `trailingSkeletonCount` prop) — not in a separate grid container below all sections — so they continue filling the current CSS grid row (via `grid-auto-flow`) instead of unconditionally starting a new row and leaving a gap in a partially-filled last row.
- A scroll sentinel is rendered at the end of the content region's scrollable area; when it becomes visible and `hasMore && !isLoadingMore && !isLoading`, `onLoadMore` is invoked (if provided).

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, auth, env, or analytics — all such knowledge is passed in via props. Fetching, pagination-state management, and DTO mapping happen in the app; sorting of the currently-loaded `items` remains a pure, deterministic operation the lib (or the page, calling the lib's exported sort utility) performs given `items`/`sortKey`, unchanged from today.

#### Scenario: Header and toolbar render from props

- **WHEN** `ScheduledTasks` renders with `texts.title = 'Scheduled tasks'` and `texts.createButtonLabel = 'New task'`
- **THEN** the page shows a heading with that title and a button with that accessible name

#### Scenario: Loading state shows a spinner

- **WHEN** `ScheduledTasks` renders with `isLoading={true}`
- **THEN** the content region renders `DialSpinner` and no empty-state, no-results, card-grid, or skeleton markup

#### Scenario: Error state shows retry

- **WHEN** `ScheduledTasks` renders with `error` set and the user activates the retry action
- **THEN** the content region renders an error message and `onRetry` is called exactly once per activation

#### Scenario: Empty source list with no active search shows PanelEmptyState

- **WHEN** `ScheduledTasks` renders with `isLoading={false}`, no `error`, `items = []`, and no `searchQuery`
- **THEN** the content region renders `PanelEmptyState` with `texts.emptyStateLabel`, and no card/grid/section markup is present

#### Scenario: Empty items with an active search shows no-results state, not empty state

- **WHEN** `ScheduledTasks` renders with `items = []` and a non-empty `searchQuery`
- **THEN** the content region renders the no-results state with `texts.noResultsLabel`, distinct from `PanelEmptyState`

#### Scenario: Non-empty items render grouped card grid ordered by sortKey

- **WHEN** `items` contains entries with `sectionKey: 'shared'` and `sectionKey: 'myTasks'`
- **THEN** the content region renders one `ScheduledTaskSection` per distinct `sectionKey` present, each containing that section's `ScheduledTaskCardGrid` with items ordered by `sortKey`; the `'shared'` section shows a title and a count badge equal to the number of items in that section, while the `'myTasks'` section shows neither a title nor a count badge

#### Scenario: Loading-more state appends trailing skeletons inside the last section's grid

- **WHEN** `ScheduledTasks` renders with non-empty `items`, `hasMore={true}`, and `isLoadingMore={true}`
- **THEN** exactly `skeletonCount` (default 6) `ScheduledTaskCardSkeleton` elements render as additional children of the last rendered `ScheduledTaskSection`'s own `ScheduledTaskCardGrid` — not inside a separate grid container — each marked `aria-hidden="true"`, so they continue filling the grid's current row instead of starting a new one

#### Scenario: Reaching the scroll sentinel triggers onLoadMore

- **WHEN** the scroll sentinel at the end of the content region becomes visible, `hasMore={true}`, `isLoadingMore={false}`, and `isLoading={false}`
- **THEN** `onLoadMore` is called

#### Scenario: Scroll sentinel does not trigger onLoadMore while a load is already in flight or no more pages exist

- **WHEN** the scroll sentinel becomes visible but `isLoadingMore={true}` or `hasMore={false}`
- **THEN** `onLoadMore` is not called

#### Scenario: Create button invokes the injected callback

- **WHEN** the user activates the create button
- **THEN** `onCreateClick` is called exactly once, with no navigation or network call performed by the lib itself

#### Scenario: Lib has no host or integration imports

- **WHEN** the `libs/scheduled-tasks` source is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, auth, env, or analytics modules

### Requirement: List page fetches scheduled tasks and refreshes after create

`ScheduledTasksPage` SHALL fetch the list via a `useScheduledTasks` hook (`apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts`) that owns pagination and search state, and exposes `{ items, searchQuery, setSearchQuery, sortKey, setSortKey, isLoading, isLoadingMore, error, hasMore, loadMore, refetch }`. On mount, and whenever `searchQuery` changes (debounced ~300ms), the hook SHALL reset accumulated `items` and call `listScheduledTasks({ limit, offset: 0, search: searchQuery, signal })` from `apps/chat/src/server-api/scheduled-tasks.api.ts`, using `AbortController` to cancel any prior in-flight request for that same trigger and a cancelled flag to guard against post-unmount/post-superseded state updates. Changing `sortKey` does NOT trigger a request — it only affects client-side ordering of the currently-loaded `items` (see the modified "Client-side search and sort over the fetched list" requirement). Calling `loadMore()` SHALL, only when `hasMore && !isLoadingMore && !isLoading`, fetch the next page at `offset = items.length` with the current `search` and append the mapped, deduplicated-by-`id` results to `items`. The page SHALL map each `ScheduledTaskDto` to `ScheduledTaskItem` (locale-aware label formatting happens here, not in the lib) and pass `items`, `hasMore` (derived from the response's `next !== null`), `isLoadingMore`, and `loadMore` into `ScheduledTasks`. When the user navigates back to `/scheduled-tasks` from the create flow, the page SHALL call `refetch()`, which resets to page 0 with the current `search`, so a newly created task appears without a full page reload.

#### Scenario: List fetches page 0 on mount

- **WHEN** `ScheduledTasksPage` mounts with the feature flag enabled
- **THEN** `listScheduledTasks({ offset: 0, ... })` is called exactly once, and the resolved items are passed to `ScheduledTasks` as `items`

#### Scenario: Unmount before fetch resolves does not update state

- **WHEN** `ScheduledTasksPage` unmounts while a `listScheduledTasks()` call is still in flight
- **THEN** the in-flight request is aborted and no state update is attempted after unmount

#### Scenario: Returning from create refetches page 0 with the current search

- **WHEN** the user creates a task via the create flow and is navigated back to `/scheduled-tasks` with an active `searchQuery`
- **THEN** `useScheduledTasks.refetch()` is invoked, resetting to `offset = 0` with the current `search`, and the newly created task is visible once the refetch resolves (if it matches the current search), without a full page reload

#### Scenario: Fetch failure surfaces an error with retry

- **WHEN** `listScheduledTasks()` rejects
- **THEN** `useScheduledTasks` exposes a non-null `error`, and `ScheduledTasksPage` passes an `onRetry` that calls `refetch()` into `ScheduledTasks`

#### Scenario: Load more appends the next page without resetting existing items

- **WHEN** `loadMore()` is called while `hasMore` is `true` and no fetch is already in flight
- **THEN** `isLoadingMore` becomes `true` during the request, the previously loaded items remain rendered, and the newly fetched page's items are appended (deduplicated by `id`) once the request resolves, after which `isLoadingMore` returns to `false`

#### Scenario: Load more is a no-op when there is no next page or a load is already in flight

- **WHEN** `loadMore()` is called while `hasMore` is `false`, or while `isLoadingMore`/`isLoading` is already `true`
- **THEN** no additional request is made

## ADDED Requirements

### Requirement: Server-driven search triggers refetch from page 0

Changing `searchQuery` (debounced ~300ms to avoid a request per keystroke) in `ScheduledTasksPage` SHALL reset `useScheduledTasks`'s accumulated `items` and issue a new `listScheduledTasks` request at `offset = 0` with the new `search` value, aborting any still-in-flight request from a superseded search value so a stale response cannot overwrite a newer one.

#### Scenario: Debounced search resets and refetches

- **WHEN** the user types into the search input
- **THEN** no request is sent until ~300ms after the last keystroke, at which point `items` resets and a new page-0 request is sent with `search` set to the current input value

#### Scenario: A stale in-flight request does not overwrite a newer one

- **WHEN** the user changes `searchQuery` again before a previous debounced search request has resolved
- **THEN** the previous request is aborted (or its resolution is ignored), and only the response for the latest `searchQuery` is applied to `items`

### Requirement: Infinite scroll loads and appends additional pages

The Scheduled Tasks list SHALL support loading beyond the first page by scrolling: when the user scrolls the card grid's scroll container to reach a sentinel positioned at the end of the currently loaded content, and more pages exist (`hasMore`), the next page SHALL be requested and its items appended to the currently displayed list, without resetting scroll position or already-rendered cards. Scroll-position detection SHALL reuse the scroll-parent detection pattern already used by `libs/catalog/src/components/ListView/ListView.tsx` (`findScrollParent` + scroll-listener), not a bare `IntersectionObserver` against a non-document root, for consistency with the codebase's one existing infinite-scroll implementation.

#### Scenario: Scrolling to the bottom loads the next page

- **WHEN** the user scrolls the list's scroll container so the trailing sentinel enters the visible area, and `hasMore` is `true`
- **THEN** the next page is requested and, once resolved, its items are appended below the currently rendered cards with no change to the user's current scroll position

#### Scenario: No further requests once all pages are loaded

- **WHEN** the sentinel enters the visible area but `hasMore` is `false` (the last page has already been loaded)
- **THEN** no additional request is made

### Requirement: Load-more state shows exactly six skeleton cards

While a subsequent page is being fetched (`isLoadingMore === true`), the list SHALL render exactly 6 `ScheduledTaskCardSkeleton` elements as trailing children inside the last section's own `ScheduledTaskCardGrid` (continuing that grid's row/column flow rather than starting a new row in a separate container), distinct from the initial-load `DialSpinner` state (which remains reserved for `isLoading === true && items.length === 0`). Each skeleton card SHALL be built on `DialSkeleton` from `@epam/ai-dial-ui-kit` with an explicit `color` override (the default `bg-layer-raised` token is not visibly distinct from the card background in this app), sized to match `ScheduledTaskCard`'s footprint (title block, description lines, schedule pill area), and marked `aria-hidden="true"` so screen readers do not announce placeholder content as real cards.

#### Scenario: Six skeletons render during load-more, continuing the grid's current row

- **WHEN** `isLoadingMore` becomes `true` after the user triggers a load-more via scroll
- **THEN** exactly 6 `ScheduledTaskCardSkeleton` elements render as additional children of the same grid the existing cards are in (not a new grid container), each with `aria-hidden="true"` — if the last real card left a partially-filled row, the first skeleton(s) fill that row's remaining cells before any wrap to a new row

#### Scenario: Skeletons disappear once the next page resolves

- **WHEN** the load-more request resolves and `isLoadingMore` returns to `false`
- **THEN** the 6 skeleton cards are removed and replaced by the newly appended real cards

#### Scenario: Initial load never shows load-more skeletons

- **WHEN** the list is in its initial load (`isLoading === true`, no items yet loaded)
- **THEN** the content region shows the existing `DialSpinner` state, not skeleton cards
