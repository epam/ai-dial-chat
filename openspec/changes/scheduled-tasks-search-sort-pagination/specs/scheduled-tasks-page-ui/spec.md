## REMOVED Requirements

### Requirement: Client-side search and sort over the fetched list

**Reason**: Search and sort now operate against the full server-side dataset via `GET /api/v1/scheduled-tasks`'s `search`/`sort` query parameters, not just the single page already fetched into the browser. Filtering/sorting the in-memory array can no longer answer "does any schedule match this search" once the list spans more than one page.
**Migration**: Callers relying on `filterScheduledTaskItems`/`sortScheduledTaskItems` from `libs/scheduled-tasks/src/utils/filter-sort.ts` must instead pass `searchQuery`/`sortKey` into `useScheduledTasks`, which resets and refetches page 0 from the server on change (see the new "Server-driven search and sort trigger refetch" requirement below). `ScheduledTasks` now renders `items` as received, with no further client-side filtering/sorting applied.

## MODIFIED Requirements

### Requirement: ScheduledTasks lib component renders header, toolbar, and data-driven content states

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTasks` root component accepting `texts`, `onCreateClick`, `searchQuery`/`onSearchQueryChange`, `sortKey`/`onSortChange`, `items: ScheduledTaskItem[]`, `isLoading` (default `false`), `hasMore: boolean` (default `false`), `isLoadingMore?: boolean` (default `false`), `skeletonCount?: number` (default `6`), `onLoadMore?: () => void`, and optional `error`/`onRetry`. It SHALL render, in order: a header (title, subtitle, primary "create" action button), a toolbar (search input, sort control with options), and a content region whose rendering depends on state:

- `isLoading` is `true` (initial load) → the content region renders a `DialSpinner` and no other content-region markup.
- `error` is set → the content region renders an error message with a retry action that invokes `onRetry`.
- `isLoading` is `false`, `error` is unset, and `items` is empty because the source list itself is empty (no `searchQuery` in effect) → the content region renders the shared `PanelEmptyState` component (from `@epam/ai-dial-chat-shared`) with `texts.emptyStateLabel`.
- `isLoading` is `false`, `error` is unset, `items` is empty, and a non-empty `searchQuery` is in effect → the content region renders a distinct "no results" state (not `PanelEmptyState`, not the card grid) using `texts.noResultsLabel`. Because search is now server-driven, this state reflects the server returning zero matches, not a client-side filter reducing a non-empty array to zero.
- `isLoading` is `false`, `error` is unset, and `items` is non-empty → the content region renders the card grid: items are grouped by `sectionKey`, each group rendered as a `ScheduledTaskSection` containing a `ScheduledTaskCardGrid` of `ScheduledTaskCard`s, in the order received (server-driven `sortKey` already determines order; the lib performs no re-sorting). The `'shared'` group renders with a title + count badge (`texts.sharedSectionTitle`); the `'myTasks'` group renders with no title/count row, just its card grid. When `isLoadingMore` is `true`, exactly `skeletonCount` `ScheduledTaskCardSkeleton` elements render in a single trailing row below all sections (not distributed into `'shared'`/`'myTasks'` individually).
- A scroll sentinel is rendered at the end of the content region's scrollable area; when it becomes visible and `hasMore && !isLoadingMore && !isLoading`, `onLoadMore` is invoked (if provided).

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, auth, env, or analytics — all such knowledge is passed in via props. Fetching, pagination-state management, search/sort request triggering, and DTO mapping happen in the app; the lib renders exactly the `items` it is given.

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

#### Scenario: Non-empty items render grouped card grid in received order

- **WHEN** `items` contains entries with `sectionKey: 'shared'` and `sectionKey: 'myTasks'`
- **THEN** the content region renders one `ScheduledTaskSection` per distinct `sectionKey` present, each containing that section's `ScheduledTaskCardGrid` with items in the order they appear in `items`; the `'shared'` section shows a title and a count badge equal to the number of items in that section, while the `'myTasks'` section shows neither a title nor a count badge

#### Scenario: Loading-more state renders trailing skeletons below all sections

- **WHEN** `ScheduledTasks` renders with non-empty `items`, `hasMore={true}`, and `isLoadingMore={true}`
- **THEN** exactly `skeletonCount` (default 6) `ScheduledTaskCardSkeleton` elements render in a single trailing row after all `ScheduledTaskSection`s, each marked `aria-hidden="true"`

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

`ScheduledTasksPage` SHALL fetch the list via a `useScheduledTasks` hook (`apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts`) that owns pagination, search, and sort state, and exposes `{ items, searchQuery, setSearchQuery, sortKey, setSortKey, isLoading, isLoadingMore, error, hasMore, loadMore, refetch }`. On mount, and whenever `searchQuery` (debounced ~300ms) or `sortKey` (immediately) changes, the hook SHALL reset accumulated `items` and call `listScheduledTasks({ limit, offset: 0, search: searchQuery, sort: sortKey, signal })` from `apps/chat/src/server-api/scheduled-tasks.api.ts`, using `AbortController` to cancel any prior in-flight request for that same trigger and a cancelled flag to guard against post-unmount/post-superseded state updates. Calling `loadMore()` SHALL, only when `hasMore && !isLoadingMore && !isLoading`, fetch the next page at `offset = items.length` with the current `search`/`sort` and append the mapped, deduplicated-by-`id` results to `items`. The page SHALL map each `ScheduledTaskDto` to `ScheduledTaskItem` (locale-aware label formatting happens here, not in the lib) and pass `items`, `hasMore` (derived from the response's `next !== null`), `isLoadingMore`, and `loadMore` into `ScheduledTasks`. When the user navigates back to `/scheduled-tasks` from the create flow, the page SHALL call `refetch()`, which resets to page 0 with the current `search`/`sort`, so a newly created task appears without a full page reload.

#### Scenario: List fetches page 0 on mount

- **WHEN** `ScheduledTasksPage` mounts with the feature flag enabled
- **THEN** `listScheduledTasks({ offset: 0, ... })` is called exactly once, and the resolved items are passed to `ScheduledTasks` as `items`

#### Scenario: Unmount before fetch resolves does not update state

- **WHEN** `ScheduledTasksPage` unmounts while a `listScheduledTasks()` call is still in flight
- **THEN** the in-flight request is aborted and no state update is attempted after unmount

#### Scenario: Returning from create refetches page 0 with the current search/sort

- **WHEN** the user creates a task via the create flow and is navigated back to `/scheduled-tasks` with an active `searchQuery`/`sortKey`
- **THEN** `useScheduledTasks.refetch()` is invoked, resetting to `offset = 0` with the current `search`/`sort`, and the newly created task is visible once the refetch resolves (if it matches the current search/sort), without a full page reload

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

### Requirement: Server-driven search and sort trigger refetch from page 0

Changing `searchQuery` (debounced ~300ms to avoid a request per keystroke) or `sortKey` (immediately, no debounce) in `ScheduledTasksPage` SHALL reset `useScheduledTasks`'s accumulated `items` and issue a new `listScheduledTasks` request at `offset = 0` with the new `search`/`sort` value, aborting any still-in-flight request from a superseded search/sort value so a stale response cannot overwrite a newer one.

#### Scenario: Debounced search resets and refetches

- **WHEN** the user types into the search input
- **THEN** no request is sent until ~300ms after the last keystroke, at which point `items` resets and a new page-0 request is sent with `search` set to the current input value

#### Scenario: Sort change refetches immediately without debounce

- **WHEN** the user selects a different sort option
- **THEN** `items` resets and a new page-0 request is sent immediately with the new `sort` value, with no debounce delay

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

While a subsequent page is being fetched (`isLoadingMore === true`), the list SHALL render exactly 6 `ScheduledTaskCardSkeleton` elements in a trailing row below the already-loaded cards, distinct from the initial-load `DialSpinner` state (which remains reserved for `isLoading === true && items.length === 0`). Each skeleton card SHALL be built on `DialSkeleton` from `@epam/ai-dial-ui-kit`, sized to match `ScheduledTaskCard`'s footprint (title block, optional description lines, schedule pill area), and marked `aria-hidden="true"` so screen readers do not announce placeholder content as real cards.

#### Scenario: Six skeletons render during load-more

- **WHEN** `isLoadingMore` becomes `true` after the user triggers a load-more via scroll
- **THEN** exactly 6 `ScheduledTaskCardSkeleton` elements render below the existing cards, each with `aria-hidden="true"`

#### Scenario: Skeletons disappear once the next page resolves

- **WHEN** the load-more request resolves and `isLoadingMore` returns to `false`
- **THEN** the 6 skeleton cards are removed and replaced by the newly appended real cards

#### Scenario: Initial load never shows load-more skeletons

- **WHEN** the list is in its initial load (`isLoading === true`, no items yet loaded)
- **THEN** the content region shows the existing `DialSpinner` state, not skeleton cards
