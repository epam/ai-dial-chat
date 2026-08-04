## MODIFIED Requirements

### Requirement: ScheduledTasks lib component renders header, toolbar, and data-driven content states

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTasks` root component accepting `texts`, `onCreateClick`, `searchQuery`/`onSearchQueryChange`, `sortKey`/`onSortChange`, `items: ScheduledTaskItem[]`, `isLoading` (default `false`), `hasMore: boolean` (default `false`), `isLoadingMore?: boolean` (default `false`), `skeletonCount?: number` (default `6`), `onLoadMore?: () => void`, and optional `error`/`onRetry`. It SHALL render, in order: a header (title, subtitle, primary "create" action button), a toolbar (search input, sort control with options), and a content region whose rendering depends on state:

- `isLoading` is `true` (initial load) → the content region renders a `DialSpinner` and no other content-region markup.
- `error` is set → the content region renders an error message with a retry action that invokes `onRetry`.
- `isLoading` is `false`, `error` is unset, and `items` is empty because the source list itself is empty (no `searchQuery` in effect) → the content region renders the shared `PanelEmptyState` component (from `@epam/ai-dial-chat-shared`) with `texts.emptyStateLabel`.
- `isLoading` is `false`, `error` is unset, `items` is empty, and a non-empty `searchQuery` is in effect → the content region renders a distinct "no results" state (not `PanelEmptyState`, not the card grid) using `texts.noResultsLabel`. Because search is server-driven, this state reflects the server returning zero matches, not a client-side filter reducing a non-empty array to zero.
- `isLoading` is `false`, `error` is unset, and `items` is non-empty → the content region renders the card grid: `items` are grouped by `sectionKey` **in the order they were received** (no client-side reordering by `sortKey` — sort order is now applied server-side, see the "Server-driven search and sort over the full remote dataset" requirement), each group rendered as a `ScheduledTaskSection` containing a `ScheduledTaskCardGrid` of `ScheduledTaskCard`s. The `'shared'` group renders with a title + count badge (`texts.sharedSectionTitle`); the `'myTasks'` group renders with no title/count row, just its card grid. When `isLoadingMore` is `true`, exactly `skeletonCount` `ScheduledTaskCardSkeleton` elements render as **trailing children inside the last rendered section's own `ScheduledTaskCardGrid`** (via that grid's `trailingSkeletonCount` prop) — not in a separate grid container below all sections — so they continue filling the current CSS grid row (via `grid-auto-flow`) instead of unconditionally starting a new row and leaving a gap in a partially-filled last row.
- A scroll sentinel is rendered at the end of the content region's scrollable area; when it becomes visible and `hasMore && !isLoadingMore && !isLoading`, `onLoadMore` is invoked (if provided).

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, auth, env, or analytics — all such knowledge is passed in via props. Fetching, pagination-state management, sort-state management, and DTO mapping happen in the app; the lib performs no sorting of `items` itself — `sortKey`/`onSortChange` are used only to drive the toolbar control's UI state (selected option, `aria-selected`), not to reorder rendered cards.

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

- **WHEN** `items` contains entries with `sectionKey: 'shared'` and `sectionKey: 'myTasks'`, already ordered by the caller
- **THEN** the content region renders one `ScheduledTaskSection` per distinct `sectionKey` present, each containing that section's `ScheduledTaskCardGrid` with items in the same order they appear in `items` (no reordering by `sortKey` inside the lib); the `'shared'` section shows a title and a count badge equal to the number of items in that section, while the `'myTasks'` section shows neither a title nor a count badge

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

`ScheduledTasksPage` SHALL fetch the list via a `useScheduledTasks` hook (`apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts`) that owns pagination, search, and sort state, and exposes `{ items, searchQuery, setSearchQuery, sortKey, setSortKey, isLoading, isLoadingMore, error, hasMore, loadMore, refetch }`. On mount, whenever `searchQuery` changes (debounced ~300ms), and whenever `sortKey` changes (immediately, no debounce — it's a discrete toolbar selection, not free text), the hook SHALL reset accumulated `items` and call `listScheduledTasks({ limit, offset: 0, search: searchQuery, sort: sortKey, signal })` from `apps/chat/src/server-api/scheduled-tasks.api.ts`, using `AbortController` to cancel any prior in-flight request for that same trigger and a cancelled flag to guard against post-unmount/post-superseded state updates. Calling `loadMore()` SHALL, only when `hasMore && !isLoadingMore && !isLoading`, fetch the next page at `offset = items.length` with the current `search` and `sort` and append the mapped, deduplicated-by-`id` results to `items` — the appended page is not locally reordered, since it is already in the same server-chosen order as page 0. The page SHALL map each `ScheduledTaskDto` to `ScheduledTaskItem` (locale-aware label formatting happens here, not in the lib) and pass `items`, `hasMore` (derived from the response's `next !== null`), `isLoadingMore`, and `loadMore` into `ScheduledTasks`. When the user navigates back to `/scheduled-tasks` from the create flow, the page SHALL call `refetch()`, which resets to page 0 with the current `search` and `sort`, so a newly created task appears without a full page reload.

#### Scenario: List fetches page 0 on mount

- **WHEN** `ScheduledTasksPage` mounts with the feature flag enabled
- **THEN** `listScheduledTasks({ offset: 0, sort: sortKey, ... })` is called exactly once, and the resolved items are passed to `ScheduledTasks` as `items`

#### Scenario: Unmount before fetch resolves does not update state

- **WHEN** `ScheduledTasksPage` unmounts while a `listScheduledTasks()` call is still in flight
- **THEN** the in-flight request is aborted and no state update is attempted after unmount

#### Scenario: Returning from create refetches page 0 with the current search and sort

- **WHEN** the user creates a task via the create flow and is navigated back to `/scheduled-tasks` with an active `searchQuery` and `sortKey`
- **THEN** `useScheduledTasks.refetch()` is invoked, resetting to `offset = 0` with the current `search` and `sort`, and the newly created task is visible once the refetch resolves (if it matches the current search), without a full page reload

#### Scenario: Fetch failure surfaces an error with retry

- **WHEN** `listScheduledTasks()` rejects
- **THEN** `useScheduledTasks` exposes a non-null `error`, and `ScheduledTasksPage` passes an `onRetry` that calls `refetch()` into `ScheduledTasks`

#### Scenario: Load more appends the next page in server order without resetting existing items

- **WHEN** `loadMore()` is called while `hasMore` is `true` and no fetch is already in flight
- **THEN** `isLoadingMore` becomes `true` during the request, the previously loaded items remain rendered, the request includes the current `sort`, and the newly fetched page's items are appended (deduplicated by `id`, in server-returned order) once the request resolves, after which `isLoadingMore` returns to `false`

#### Scenario: Load more is a no-op when there is no next page or a load is already in flight

- **WHEN** `loadMore()` is called while `hasMore` is `false`, or while `isLoadingMore`/`isLoading` is already `true`
- **THEN** no additional request is made

### Requirement: Server-driven search and sort over the full remote dataset

Both search and sort SHALL be server-driven and SHALL apply to the full remote dataset, not just loaded pages — the upstream DIAL Scheduler list endpoint supports `order_by`/`order_dir` in addition to pagination and the name filter (see the modified `scheduled-tasks-api` "List scheduled tasks" requirement), superseding the prior design decision that treated sort as a client-side-only, loaded-pages-only concern.

`ScheduledTasksPage` SHALL send `searchQuery` as the `search` query parameter and `sortKey` as the `sort` query parameter on every `listScheduledTasks` call (initial load, sort change, debounced search, load-more) instead of filtering or reordering the fetched array locally. `filterScheduledTaskItems` and `sortScheduledTaskItems` are both removed from `libs/scheduled-tasks/src/utils/filter-sort.ts` — `ScheduledTasks`/`ScheduledTasksPage` render `items` exactly in the order the server returned them, for both grouping and ordering within each `sectionKey` group. `ScheduledTasksSortKey` (the enum type) is retained: it remains the shared contract name for the toolbar's selected option and is now also the literal shape of the BFF's `sort` query parameter.

The frontend SHALL NOT reimplement "missing `nextRunAt` sorts last" logic — when `sortKey` is `firstToRun` or `lastToRun`, the upstream service already places schedules with no next run time (paused/inactive) last, and the frontend trusts the server-returned order as-is.

`map-scheduled-task-dto.ts`'s `formatCronScheduleLabel` SHALL convert the stored UTC `cron.fields.hour`/`minute` (and `day_of_week`/`day` when present) back to the current browser's local time before formatting the display label, using the same reference-`Date` conversion technique (inverse direction) as the submit-side conversion in `buildCronFields`, so the displayed recurring schedule time always matches the wall-clock time that will actually execute. This mirrors the existing local-display behavior already used for "once" schedules via `Intl.DateTimeFormat(undefined, ...)`.

#### Scenario: Search sends a server request instead of filtering locally

- **WHEN** `searchQuery = "competitor"` is set
- **THEN** `GET /api/v1/scheduled-tasks` is called with `search=competitor`, and the rendered `items` are exactly what the server returned — no additional client-side substring filtering is applied

#### Scenario: Sort sends a server request instead of reordering locally

- **WHEN** `sortKey = "nameAZ"` is set
- **THEN** `GET /api/v1/scheduled-tasks` is called with `sort=nameAZ`, and the rendered card order is exactly the order the server returned — no client-side comparator is applied

#### Scenario: Sort change resets pagination and refetches page 0

- **WHEN** the user changes `sortKey`
- **THEN** `useScheduledTasks` resets accumulated `items`, aborts any in-flight request, and issues a new `listScheduledTasks` request at `offset = 0` with the new `sort` value

#### Scenario: Load more preserves the active sort across appended pages

- **WHEN** `loadMore()` is called after the user has changed `sortKey`
- **THEN** the request for the next page includes the current `sort` value, so appended items remain in the same server-chosen order as the already-rendered pages

#### Scenario: Sort and search compose in the same request

- **WHEN** both a non-empty `searchQuery` and a non-default `sortKey` are active
- **THEN** the single `listScheduledTasks` request includes both `search` and `sort`, and the server-returned `items` reflect both constraints applied together

#### Scenario: Recurring schedule label shows the local equivalent of the stored UTC time

- **WHEN** a task's `trigger.cron.fields` stores UTC `hour = '7'`, `minute = '0'`, and the browser's timezone is UTC+2
- **THEN** `formatCronScheduleLabel` renders a label showing `09:00`, not `07:00`

#### Scenario: Weekly recurring label shows the local day, not the stored UTC day

- **WHEN** a task's `trigger.cron.fields` stores UTC `day_of_week` for Tuesday with `hour = '21'`, `minute = '30'`, and the browser's timezone is UTC+2 (so the local equivalent is Monday `23:30`)
- **THEN** `formatCronScheduleLabel` renders a label showing Monday `23:30`, not Tuesday `21:30`

### Requirement: Server-driven search triggers refetch from page 0

Changing `searchQuery` (debounced ~300ms to avoid a request per keystroke) or `sortKey` (immediately, no debounce) in `ScheduledTasksPage` SHALL reset `useScheduledTasks`'s accumulated `items` and issue a new `listScheduledTasks` request at `offset = 0` with the new `search`/`sort` value, aborting any still-in-flight request from a superseded search or sort value so a stale response cannot overwrite a newer one.

#### Scenario: Debounced search resets and refetches

- **WHEN** the user types into the search input
- **THEN** no request is sent until ~300ms after the last keystroke, at which point `items` resets and a new page-0 request is sent with `search` set to the current input value

#### Scenario: Sort change resets and refetches immediately

- **WHEN** the user selects a different sort option
- **THEN** `items` resets and a new page-0 request is sent immediately (no debounce) with `sort` set to the newly selected value

#### Scenario: A stale in-flight request does not overwrite a newer one

- **WHEN** the user changes `searchQuery` or `sortKey` again before a previous request has resolved
- **THEN** the previous request is aborted (or its resolution is ignored), and only the response for the latest `search`/`sort` combination is applied to `items`

## REMOVED Requirements

### Requirement: Client-side search and sort over the fetched list

**Reason**: Superseded by the "Server-driven search and sort over the full remote dataset" requirement above — the upstream DIAL Scheduler list endpoint's `order_by`/`order_dir` parameters were confirmed to exist after this requirement was written, reversing the earlier assumption that sort had no upstream support.

**Migration**: Callers relying on `sortScheduledTaskItems` (removed from `libs/scheduled-tasks/src/utils/filter-sort.ts`) must instead pass `sortKey` through to `listScheduledTasks({ sort: sortKey, ... })` and render server-returned order directly. No UI-facing migration is needed — the toolbar's 4 sort options and their labels are unchanged.
