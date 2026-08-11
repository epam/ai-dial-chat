# Spec: scheduled-tasks-page-ui

## Purpose

Defines the Scheduled Tasks list page: feature-flag gating, the presentational `ScheduledTasks` lib component's header/toolbar/content-state rendering, data fetching and DTO mapping in the app, server-driven search/sort, i18n, and RTL/accessibility requirements.
## Requirements
### Requirement: Scheduled Tasks page renders behind a feature flag

The application SHALL expose a lazy-loaded Scheduled Tasks page at `ROUTES.ScheduledTasks` (`/scheduled-tasks`), registered in `apps/chat/src/app/app.tsx` using the same `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper pattern as other standalone pages. The route SHALL only render the Scheduled Tasks page content when `useFeatureFlag('scheduledTasksEnabled')` returns `true` for the current session; otherwise it SHALL render the same content as an unregistered path (the app's `NotFound` page).

**Feature flag:** `scheduledTasksEnabled` (registry key `features.scheduledTasksEnabled`, default `false`, optional role restriction via `SCHEDULED_TASKS_ENABLED_ROLES`). **RTL impact:** page mirrors per logical-property rules below. **i18n impact:** see i18n requirement below.

#### Scenario: Flag enabled renders the page

- **WHEN** `scheduledTasksEnabled` resolves to `true` and the user navigates to `/scheduled-tasks`
- **THEN** the lazy-loaded Scheduled Tasks page mounts inside `RouteErrorBoundary`/`Suspense`

#### Scenario: Flag disabled renders NotFound instead

- **WHEN** `scheduledTasksEnabled` resolves to `false` and the user navigates directly to `/scheduled-tasks`
- **THEN** the app renders the same `NotFound` content it renders for any unregistered path, no Scheduled Tasks UI is mounted, and no Scheduled Tasks API request is sent

#### Scenario: Page is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/scheduled-tasks`
- **THEN** the Scheduled Tasks page code is NOT included in the initial bundle; it is loaded on demand via `React.lazy`

### Requirement: Scheduled Tasks page strings flow through react-i18next

Every user-visible string on the Scheduled Tasks page (title, subtitle, create button, search placeholder, search accessible label, clear-search accessible label, sort label/options, empty-state label) MUST be resolved via `useTranslation().t()` in the app-level page component and passed into the lib as plain strings. Keys MUST live under a `scheduledTasks` namespace in `apps/chat/src/i18n/locales/en.json` and be referenced through a typed `ScheduledTasksI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`. Generic action labels that already exist (e.g. a generic "Create" label) MUST reuse `ButtonsI18nKeys` rather than duplicating the string under a new key.

#### Scenario: Scheduled Tasks keys are present in en.json

- **WHEN** the change is applied
- **THEN** `en.json` contains `scheduledTasks.page.title`, `scheduledTasks.page.subtitle`, `scheduledTasks.page.navLabel`, `scheduledTasks.toolbar.searchPlaceholder`, `scheduledTasks.toolbar.searchAriaLabel`, `scheduledTasks.toolbar.clearSearchLabel`, `scheduledTasks.toolbar.sortLabel`, and `scheduledTasks.emptyState.label`

#### Scenario: Lib receives strings, not translation keys

- **WHEN** `ScheduledTasksPage` renders `<ScheduledTasks />`
- **THEN** every string-typed prop passed to it is the result of `t(SomeI18nKeys.Member)`, never a raw i18n key or hard-coded English literal

### Requirement: Scheduled Tasks page supports RTL and meets AAA accessibility defaults

All directional layout in the Scheduled Tasks header, toolbar, and empty state MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) instead of physical ones, per `.claude/rules/rtl.md`. Any directional icon (e.g. a sort/chevron indicator) MUST be mirrored in RTL via `rtl:scale-x-[-1]` or an equivalent. The search input MUST have an accessible label; the sort control MUST expose its expanded/collapsed state via `aria-expanded` and the currently selected option via `aria-selected` or `aria-current` on the option list.

#### Scenario: Page mirrors under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the header, toolbar, and empty state lay out mirrored with no hard-coded left/right offsets breaking the mirrored layout

#### Scenario: Sort control exposes expanded state

- **WHEN** the user opens the sort dropdown
- **THEN** the sort trigger has `aria-expanded="true"` and the currently active sort option is marked `aria-selected="true"` (or `aria-current`)

#### Scenario: Search input is labeled

- **WHEN** the search input renders
- **THEN** it has a localized accessible name (via `aria-label` or an associated `<label>`) distinct from its placeholder text, and its clear action has a localized accessible name

### Requirement: ScheduledTasks lib component renders header, toolbar, and data-driven content states

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTasks` root component accepting `texts`, `onCreateClick`, `searchQuery`/`onSearchQueryChange`, `sortKey`/`onSortChange`, `items: ScheduledTaskItem[]`, `isLoading` (default `false`), `hasMore: boolean` (default `false`), `isLoadingMore?: boolean` (default `false`), `skeletonCount?: number` (default `6`), `onLoadMore?: () => void`, and optional `error`/`onRetry`. It SHALL render, in order: a header (title, subtitle, primary "create" action button), a toolbar (search input, sort control with options), and a content region whose rendering depends on state:

- `isLoading` is `true` (initial load) → the content region renders a `Spinner` and no other content-region markup.
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
- **THEN** the content region renders `Spinner` and no empty-state, no-results, card-grid, or skeleton markup

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

### Requirement: ScheduledTaskCard renders a single task with highlighted search matches

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCard` component rendering: a title (highlighting the current search match via the shared `Highlight` component from `@epam/ai-dial-chat-shared`, per `.claude/rules/search-results-highlight.md`), an optional "N NEW"-style badge when `isNew`/a new-count is set, an optional description/prompt-preview line, a schedule/status pill, and an optional location breadcrumb built from `locationSegments` (outermost segment first, chevron separator between segments). The card exposes an overflow-menu trigger only when at least one action callback is supplied; the menu renders only the actions for which a corresponding callback prop (`onEdit`, `onRunNow`, `onDelete`) was provided by the caller.

The schedule/status pill SHALL render the schedule pill showing `scheduleLabel` when `item.isActive` is `true` or `undefined`, and a "Paused" badge (with a pause icon) in that same position when `item.isActive` is explicitly `false`. The two are mutually exclusive — the card never renders both at once. This is a display-only distinction; the card issues no pause/resume request and takes no other action based on `isActive` (the mutating pause/resume switch is confined to the detail page — see `scheduled-task-detail-page`).

`ScheduledTaskCard` SHALL accept an optional `onCardClick?: (id: string) => void` prop. When supplied, the card's root SHALL be an activatable element (clickable and keyboard-operable) that calls `onCardClick(id)` when activated by click or Enter/Space. The overflow-menu trigger button, and every action inside the opened overflow menu, MUST call `event.stopPropagation()` so activating the trigger or any menu action never also invokes `onCardClick`. When `onCardClick` is not supplied, the card renders exactly as before (no added interactive root semantics).

#### Scenario: Title highlights the active search query

- **WHEN** `ScheduledTaskCard` renders with `displayName="Competitor Updates"` and `searchQuery="comp"`
- **THEN** the title is rendered through `Highlight` with the matching substring marked, not as plain unhighlighted text

#### Scenario: Schedule pill and location breadcrumb render from pre-formatted values

- **WHEN** `ScheduledTaskCard` renders with `scheduleLabel="Every Monday 12:00"`, `isActive` omitted, and `locationSegments=["Public", "Project folder"]`
- **THEN** the schedule pill renders the label verbatim and the breadcrumb renders each segment in order with a chevron separator between them; the component performs no date formatting or trigger-shape parsing itself

#### Scenario: Paused badge replaces the schedule pill when isActive is false

- **WHEN** `ScheduledTaskCard` renders with `isActive: false`
- **THEN** a "Paused" badge renders in place of the schedule pill, and the schedule pill's own text (`scheduleLabel`) is not rendered anywhere on the card

#### Scenario: Schedule pill renders when isActive is true

- **WHEN** `ScheduledTaskCard` renders with `isActive: true`
- **THEN** the schedule pill renders as usual and no "Paused" badge is shown

#### Scenario: Overflow menu only shows actions with a supplied handler

- **WHEN** `ScheduledTaskCard` renders with only `onDelete` supplied (no `onEdit`, no `onRunNow`)
- **THEN** the overflow menu, when opened, shows exactly one action item, and activating it calls `onDelete` with the card's `id`

#### Scenario: Clicking the card body invokes onCardClick

- **WHEN** `onCardClick` is supplied and the user clicks anywhere on the card body outside the overflow-menu trigger
- **THEN** `onCardClick` is called exactly once with the card's `id`

#### Scenario: Clicking the overflow-menu trigger or an action does not invoke onCardClick

- **WHEN** `onCardClick` and at least one action callback are both supplied, and the user clicks the overflow-menu trigger, or opens the menu and clicks an action item
- **THEN** `onCardClick` is not called, and only the trigger's open behavior (or the clicked action's own callback) fires

#### Scenario: Card without onCardClick has no added interactive semantics

- **WHEN** `ScheduledTaskCard` renders without `onCardClick`
- **THEN** the card root is not exposed as a button/clickable element and clicking it invokes no navigation-related callback

### Requirement: Card click navigates to the task detail route

`onCardClick` SHALL be threaded from `ScheduledTasksPage` through `ScheduledTasks` and `ScheduledTaskCardGrid` down to each rendered `ScheduledTaskCard`, without either intermediate component inspecting or transforming the id. `ScheduledTasksPage` SHALL supply an `onCardClick` implementation that calls `navigate(getScheduledTaskDetailRoute(id))` (from `apps/chat/src/constants/routes.ts`). `ScheduledTasks` and `ScheduledTaskCardGrid` remain host-agnostic: they accept and forward the callback as a prop and perform no navigation, routing import, or id transformation themselves.

#### Scenario: Clicking a card navigates to its detail route

- **WHEN** the user clicks a task card's body on `/scheduled-tasks`
- **THEN** the app navigates to `/scheduled-tasks/{id}` for that card's task id

#### Scenario: Overflow menu actions do not trigger navigation

- **WHEN** the user clicks the overflow-menu trigger on a card, or an action inside the opened menu (Edit/Run/Delete)
- **THEN** the app does not navigate away from `/scheduled-tasks`, and only the corresponding action callback (if any) is invoked

#### Scenario: Intermediate components forward the callback without transformation

- **WHEN** `ScheduledTasks`/`ScheduledTaskCardGrid` source is statically analyzed
- **THEN** `onCardClick` is passed through as received, with no routing import, `useNavigate` call, or id transformation present in either component

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

### Requirement: Card grouping reflects real ownership via createdBy

`map-scheduled-task-dto.ts` SHALL assign each mapped `ScheduledTaskItem`'s `sectionKey` to `'shared'` when the upstream `createdBy` differs from the current session user's sub, and `'myTasks'` otherwise — including when `createdBy` or the current user's sub is unavailable, which falls back to `'myTasks'` to match prior behavior. `ScheduledTasksPage` SHALL resolve the current user's sub from `useUser()` (`apps/chat/src/context/auth/UserContext.tsx`) and pass it into the mapper.

#### Scenario: Own task groups under My tasks

- **WHEN** a mapped task's `createdBy` equals the current user's sub
- **THEN** its `sectionKey` is `'myTasks'`

#### Scenario: Task created by another user groups under Shared

- **WHEN** a mapped task's `createdBy` differs from the current user's sub
- **THEN** its `sectionKey` is `'shared'`

#### Scenario: Missing createdBy or current-user sub falls back to My tasks

- **WHEN** the upstream task omits `createdBy`, or the current user's sub isn't available yet
- **THEN** the mapped item's `sectionKey` is `'myTasks'`

### Requirement: Card description is populated from the BFF description field

`map-scheduled-task-dto.ts` SHALL map `ScheduledTaskDto.description` to `ScheduledTaskItem.descriptionPreview` in `mapScheduledTaskDtoToItem`, with no truncation or reformatting applied in the mapper (the 500-character BFF limit already bounds the value; `ScheduledTaskCard`'s existing line-clamp/ellipsis handling is the presentation-layer truncation boundary). When `ScheduledTaskDto.description` is `undefined`, `descriptionPreview` SHALL be `undefined`, matching the card's existing optional-description rendering and the client-side search behavior already speced against `descriptionPreview`.

#### Scenario: Description maps to descriptionPreview

- **WHEN** a `ScheduledTaskDto` with `description: "Summarizes unread inbox items every morning"` is mapped
- **THEN** the resulting `ScheduledTaskItem.descriptionPreview` equals that same string, unmodified

#### Scenario: Missing description maps to undefined

- **WHEN** a `ScheduledTaskDto` omits `description`
- **THEN** the resulting `ScheduledTaskItem.descriptionPreview` is `undefined`, and mapping does not throw

#### Scenario: Newly created task with a description is searchable by that description immediately after list refresh

- **WHEN** a task is created with a `description`, and the list is refetched afterward
- **THEN** searching by a substring of that description matches the task's card, consistent with the existing `descriptionPreview` search-matching behavior

### Requirement: Card active state is populated from the BFF isActive field

`map-scheduled-task-dto.ts` SHALL map `ScheduledTaskDto.isActive` to `ScheduledTaskItem.isActive` in `mapScheduledTaskDtoToItem`, with no reinterpretation of the value — the frontend SHALL NOT re-derive active/paused state from `nextRunTime`, `triggerType`, or any other field itself; that derivation is owned entirely by the BFF mapper (see `scheduled-tasks-api`'s "Scheduled task active-state field"). When `ScheduledTaskDto.isActive` is `undefined`, `ScheduledTaskItem.isActive` SHALL be `undefined`, which `ScheduledTaskCard` renders identically to `true` (schedule pill shown, no "Paused" badge).

#### Scenario: isActive false maps through to the card

- **WHEN** a `ScheduledTaskDto` with `isActive: false` is mapped and rendered
- **THEN** the resulting `ScheduledTaskItem.isActive` is `false`, and the card shows the "Paused" badge

#### Scenario: isActive true maps through to the card

- **WHEN** a `ScheduledTaskDto` with `isActive: true` is mapped and rendered
- **THEN** the resulting `ScheduledTaskItem.isActive` is `true`, and the card shows the schedule pill

#### Scenario: Missing isActive does not throw and shows the schedule pill

- **WHEN** a `ScheduledTaskDto` omits `isActive`
- **THEN** the resulting `ScheduledTaskItem.isActive` is `undefined`, mapping does not throw, and the card shows the schedule pill (not the "Paused" badge)

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

### Requirement: Scheduled Tasks card and list strings flow through react-i18next

New user-visible strings introduced for card/grid/loading/error/no-results states MUST be resolved via `useTranslation().t()` in `ScheduledTasksPage` and passed into the lib as plain strings, under new keys in the `scheduledTasks` namespace (`scheduledTasks.list.*`, `scheduledTasks.card.*`) referenced through `ScheduledTasksI18nKeys` in `apps/chat/src/constants/translation-keys.ts`. When additional locale files exist under `apps/chat/src/i18n/locales/`, the same keys MUST be added there.

#### Scenario: New keys are present in en.json

- **WHEN** the change is applied
- **THEN** `en.json` contains `scheduledTasks.list.noResultsLabel`, `scheduledTasks.list.errorLabel`, `scheduledTasks.list.retryLabel`, and card-facing keys for section titles and menu action labels

#### Scenario: Lib receives strings, not translation keys

- **WHEN** `ScheduledTasksPage` renders `<ScheduledTasks />` with the new props
- **THEN** every new string-typed prop passed to it is the result of `t(ScheduledTasksI18nKeys.Member)`, never a raw i18n key or hard-coded English literal

### Requirement: Card grid and states support RTL and meet AAA accessibility defaults

All directional layout in the card, section, grid, loading, error, and no-results surfaces MUST use Tailwind logical properties per `.claude/rules/rtl.md`. The location breadcrumb's chevron separator MUST be mirrored in RTL via `rtl:scale-x-[-1]` or an equivalent. Each card's root MUST expose `role="group"` with an accessible name derived from its title (per `.claude/rules/a11y.md` author/role identification pattern). The overflow-menu trigger MUST have an accessible name and expose `aria-expanded`; the retry action in the error state MUST be a real, keyboard-activatable control (not a non-interactive element with a click handler). Dynamic transitions between loading/error/empty/no-results/grid states MUST be announced via an `aria-live="polite"` status region so screen-reader users are notified when results appear or change.

#### Scenario: Card grid mirrors under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** cards, sections, and the grid lay out mirrored, and the breadcrumb chevron is flipped

#### Scenario: State transitions are announced

- **WHEN** the content region transitions from loading to a populated card grid
- **THEN** an `aria-live="polite"` region announces the change (e.g. a result-count summary)

#### Scenario: Card is identifiable as a named group

- **WHEN** a screen reader user navigates into a `ScheduledTaskCard`
- **THEN** the card's root exposes `role="group"` with an accessible name matching (or derived from) its title

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

### Requirement: Infinite scroll loads and appends additional pages

The Scheduled Tasks list SHALL support loading beyond the first page by scrolling: when the user scrolls the card grid's scroll container to reach a sentinel positioned at the end of the currently loaded content, and more pages exist (`hasMore`), the next page SHALL be requested and its items appended to the currently displayed list, without resetting scroll position or already-rendered cards. Scroll-position detection SHALL reuse the scroll-parent detection pattern already used by `libs/catalog/src/components/ListView/ListView.tsx` (`findScrollParent` + scroll-listener), not a bare `IntersectionObserver` against a non-document root, for consistency with the codebase's one existing infinite-scroll implementation.

#### Scenario: Scrolling to the bottom loads the next page

- **WHEN** the user scrolls the list's scroll container so the trailing sentinel enters the visible area, and `hasMore` is `true`
- **THEN** the next page is requested and, once resolved, its items are appended below the currently rendered cards with no change to the user's current scroll position

#### Scenario: No further requests once all pages are loaded

- **WHEN** the sentinel enters the visible area but `hasMore` is `false` (the last page has already been loaded)
- **THEN** no additional request is made

### Requirement: Load-more state shows exactly six skeleton cards

While a subsequent page is being fetched (`isLoadingMore === true`), the list SHALL render exactly 6 `ScheduledTaskCardSkeleton` elements as trailing children inside the last section's own `ScheduledTaskCardGrid` (continuing that grid's row/column flow rather than starting a new row in a separate container), distinct from the initial-load `Spinner` state (which remains reserved for `isLoading === true && items.length === 0`). Each skeleton card SHALL be built on `Skeleton` from `@epam/ai-dial-ui-kit` with an explicit `color` override (the default `bg-layer-raised` token is not visibly distinct from the card background in this app), sized to match `ScheduledTaskCard`'s footprint (title block, description lines, schedule pill area), and marked `aria-hidden="true"` so screen readers do not announce placeholder content as real cards.

#### Scenario: Six skeletons render during load-more, continuing the grid's current row

- **WHEN** `isLoadingMore` becomes `true` after the user triggers a load-more via scroll
- **THEN** exactly 6 `ScheduledTaskCardSkeleton` elements render as additional children of the same grid the existing cards are in (not a new grid container), each with `aria-hidden="true"` — if the last real card left a partially-filled row, the first skeleton(s) fill that row's remaining cells before any wrap to a new row

#### Scenario: Skeletons disappear once the next page resolves

- **WHEN** the load-more request resolves and `isLoadingMore` returns to `false`
- **THEN** the 6 skeleton cards are removed and replaced by the newly appended real cards

#### Scenario: Initial load never shows load-more skeletons

- **WHEN** the list is in its initial load (`isLoading === true`, no items yet loaded)
- **THEN** the content region shows the existing `Spinner` state, not skeleton cards
