## MODIFIED Requirements

### Requirement: ScheduledTasks lib component renders header, toolbar, and data-driven content states

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTasks` root component accepting `texts`, `onCreateClick`, `searchQuery`/`onSearchQueryChange`, `sortKey`/`onSortChange`, `items: ScheduledTaskItem[]`, `isLoading` (default `false`), and optional `error`/`onRetry`. It SHALL render, in order: a header (title, subtitle, primary "create" action button), a toolbar (search input, sort control with options), and a content region whose rendering depends on state:

- `isLoading` is `true` → the content region renders a `Spinner` and no other content-region markup.
- `error` is set → the content region renders an error message with a retry action that invokes `onRetry`.
- `isLoading` is `false`, `error` is unset, and `items` (after client-side search filtering) is empty because the source list itself is empty → the content region renders the shared `PanelEmptyState` component (from `@epam/ai-dial-chat-shared`) with `texts.emptyStateLabel`.
- `isLoading` is `false`, `error` is unset, the source list is non-empty, but `searchQuery` filters every item out → the content region renders a distinct "no results" state (not `PanelEmptyState`, not the card grid) using `texts.noResultsLabel`.
- `isLoading` is `false`, `error` is unset, and at least one item survives the `searchQuery` filter → the content region renders the card grid: items are grouped by `sectionKey`, each group rendered as a `ScheduledTaskSection` (title + count badge) containing a `ScheduledTaskCardGrid` of `ScheduledTaskCard`s, ordered by `sortKey`.

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, auth, env, or analytics — all such knowledge is passed in via props. Search filtering and sorting of `items` happen inside the lib (pure, deterministic given `items`/`searchQuery`/`sortKey`); fetching, DTO mapping, and locale-aware label formatting happen in the app.

#### Scenario: Header and toolbar render from props

- **WHEN** `ScheduledTasks` renders with `texts.title = 'Scheduled tasks'` and `texts.createButtonLabel = 'New task'`
- **THEN** the page shows a heading with that title and a button with that accessible name

#### Scenario: Loading state shows a spinner

- **WHEN** `ScheduledTasks` renders with `isLoading={true}`
- **THEN** the content region renders `Spinner` and no empty-state, no-results, or card-grid markup

#### Scenario: Error state shows retry

- **WHEN** `ScheduledTasks` renders with `error` set and the user activates the retry action
- **THEN** the content region renders an error message and `onRetry` is called exactly once per activation

#### Scenario: Empty source list shows PanelEmptyState

- **WHEN** `ScheduledTasks` renders with `isLoading={false}`, no `error`, and `items = []`
- **THEN** the content region renders `PanelEmptyState` with `texts.emptyStateLabel`, and no card/grid/section markup is present

#### Scenario: Search filtering to zero results shows no-results state, not empty state

- **WHEN** `items` is non-empty but every item's `displayName` fails to match `searchQuery`
- **THEN** the content region renders the no-results state with `texts.noResultsLabel`, distinct from `PanelEmptyState`

#### Scenario: Non-empty filtered items render grouped card grid

- **WHEN** `items` contains entries with `sectionKey: 'shared'` and `sectionKey: 'myTasks'`, and at least one item matches `searchQuery`
- **THEN** the content region renders one `ScheduledTaskSection` per distinct `sectionKey` present among the matching items, each showing a count badge equal to the number of matching items in that section, followed by that section's `ScheduledTaskCardGrid`

#### Scenario: Create button invokes the injected callback

- **WHEN** the user activates the create button
- **THEN** `onCreateClick` is called exactly once, with no navigation or network call performed by the lib itself

#### Scenario: Lib has no host or integration imports

- **WHEN** the `libs/scheduled-tasks` source is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, auth, env, or analytics modules

## ADDED Requirements

### Requirement: ScheduledTaskCard renders a single task with highlighted search matches

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCard` component rendering: a title (highlighting the current search match via the shared `Highlight` component from `@epam/ai-dial-chat-shared`, per `.claude/rules/search-results-highlight.md`), an optional "N NEW"-style badge when `isNew`/a new-count is set, an optional description/prompt-preview line, a schedule pill showing `scheduleLabel`, and an optional location breadcrumb built from `locationSegments` (outermost segment first, chevron separator between segments). The card exposes an overflow-menu trigger only when at least one action callback is supplied; the menu renders only the actions for which a corresponding callback prop (`onEdit`, `onRunNow`, `onDelete`) was provided by the caller.

#### Scenario: Title highlights the active search query

- **WHEN** `ScheduledTaskCard` renders with `displayName="Competitor Updates"` and `searchQuery="comp"`
- **THEN** the title is rendered through `Highlight` with the matching substring marked, not as plain unhighlighted text

#### Scenario: Schedule pill and location breadcrumb render from pre-formatted values

- **WHEN** `ScheduledTaskCard` renders with `scheduleLabel="Every Monday 12:00"` and `locationSegments=["Public", "Project folder"]`
- **THEN** the schedule pill renders the label verbatim and the breadcrumb renders each segment in order with a chevron separator between them; the component performs no date formatting or trigger-shape parsing itself

#### Scenario: Overflow menu only shows actions with a supplied handler

- **WHEN** `ScheduledTaskCard` renders with only `onDelete` supplied (no `onEdit`, no `onRunNow`)
- **THEN** the overflow menu, when opened, shows exactly one action item, and activating it calls `onDelete` with the card's `id`

### Requirement: List page fetches scheduled tasks and refreshes after create

`ScheduledTasksPage` SHALL fetch the list via a `useScheduledTasks` hook (`apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts`) that calls `listScheduledTasks()` from `apps/chat/src/server-api/scheduled-tasks.api.ts` on mount, using `AbortController` and a cancelled flag to guard against post-unmount state updates, and exposes `{ items, isLoading, error, refetch }`. The page SHALL map `ScheduledTaskDto[]` to `ScheduledTaskItem[]` (locale-aware label formatting happens here, not in the lib) and pass the result into `ScheduledTasks`. When the user navigates back to `/scheduled-tasks` from the create flow, the page SHALL call `refetch()` so a newly created task appears without a full page reload.

#### Scenario: List fetches on mount

- **WHEN** `ScheduledTasksPage` mounts with the feature flag enabled
- **THEN** `listScheduledTasks()` is called exactly once, and the resolved items are passed to `ScheduledTasks` as `items`

#### Scenario: Unmount before fetch resolves does not update state

- **WHEN** `ScheduledTasksPage` unmounts while the `listScheduledTasks()` call is still in flight
- **THEN** the in-flight request is aborted and no state update is attempted after unmount

#### Scenario: Returning from create refetches the list

- **WHEN** the user creates a task via the create flow and is navigated back to `/scheduled-tasks`
- **THEN** `useScheduledTasks.refetch()` is invoked, and the newly created task is visible once the refetch resolves, without a full page reload

#### Scenario: Fetch failure surfaces an error with retry

- **WHEN** `listScheduledTasks()` rejects
- **THEN** `useScheduledTasks` exposes a non-null `error`, and `ScheduledTasksPage` passes an `onRetry` that calls `refetch()` into `ScheduledTasks`

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

### Requirement: Client-side search and sort over the fetched list

`ScheduledTasksPage`/`ScheduledTasks` SHALL filter the fetched `items` by case-insensitive substring match against `displayName` (and `descriptionPreview` when present) using `searchQuery`, and SHALL sort the filtered items by `sortKey`: `firstToRun`/`lastToRun` order by `sortValues.nextRunAt` ascending/descending (items missing `nextRunAt` sort last), `newest` orders by `sortValues.createdAt` descending (items missing `createdAt` sort last), and `nameAZ` orders by `displayName` ascending. No new query parameters are sent to `GET /api/v1/scheduled-tasks`; filtering and sorting operate entirely on the already-fetched array.

#### Scenario: Search matches display name

- **WHEN** `searchQuery = "competitor"` and `items` includes one entry with `displayName = "Competitor Updates"` and others that don't match
- **THEN** only the matching entry is rendered in the card grid

#### Scenario: Sort by nameAZ orders alphabetically

- **WHEN** `sortKey = "nameAZ"` and `items` contains `displayName` values `"Zeta"`, `"Alpha"`
- **THEN** the rendered card order is `"Alpha"`, `"Zeta"`

#### Scenario: Items missing sort field sort last

- **WHEN** `sortKey = "newest"` and one item has no `sortValues.createdAt` while others do
- **THEN** the item without `createdAt` renders after all items that have it

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

## RENAMED Requirements

FROM: ### Requirement: ScheduledTasks lib component renders header, toolbar, and empty state only
TO: ### Requirement: ScheduledTasks lib component renders header, toolbar, and data-driven content states
