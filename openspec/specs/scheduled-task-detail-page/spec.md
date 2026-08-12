# Spec: scheduled-task-detail-page

## Purpose

Defines the Scheduled Task Detail page: feature-flag-gated per-task route, concurrent task/runs data fetching with scoped error handling, the read-only Details/Configuration sections (including markdown-rendered instructions), the paginated History panel (a sticky-positioned header and "Show more" button, not scroll-triggered), the host-agnostic `ScheduledTaskDetailView` presentational component, i18n, and RTL/accessibility requirements.

## Requirements

### Requirement: Scheduled Task detail page renders behind a feature flag at a per-task route

The application SHALL expose a lazy-loaded Scheduled Task Detail page at `ROUTES.ScheduledTaskDetail` (`/scheduled-tasks/:scheduleId`), registered in `apps/chat/src/app/app.tsx` using the same `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper pattern as the Scheduled Tasks list page. The route SHALL only render `ScheduledTaskDetailPage` content when `useFeatureFlag('scheduledTasksEnabled')` resolves to `true` for the current session; otherwise it SHALL render the same content as an unregistered path (the app's `NotFound` page), matching the list page's existing flag-gating behavior.

#### Scenario: Flag enabled renders the detail page

- **WHEN** `scheduledTasksEnabled` resolves to `true` and the user navigates to `/scheduled-tasks/sched_123`
- **THEN** the lazy-loaded `ScheduledTaskDetailPage` mounts inside `RouteErrorBoundary`/`Suspense`

#### Scenario: Flag disabled renders NotFound instead

- **WHEN** `scheduledTasksEnabled` resolves to `false` and the user navigates directly to `/scheduled-tasks/sched_123`
- **THEN** the app renders the same `NotFound` content it renders for any unregistered path, no detail UI is mounted, and neither `getScheduledTask` nor `listScheduledTaskRuns` is called

#### Scenario: Detail page is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/scheduled-tasks/:scheduleId`
- **THEN** the `ScheduledTaskDetailPage` code is NOT included in the initial bundle; it is loaded on demand via `React.lazy`

### Requirement: Detail page fetches task and first runs page in parallel and handles not-found/error states

`ScheduledTaskDetailPage` SHALL, on mount (and whenever `scheduleId` changes), call `getScheduledTask(scheduleId)` and trigger the `useScheduledTaskRuns` hook's initial fetch concurrently — neither awaits the other, since the History panel has no data dependency on task-detail fields. A 404 response from `getScheduledTask` SHALL render the app's existing `NotFoundPage`. A non-404 error from `getScheduledTask` SHALL render a page-level error state with retry. An error from the runs fetch SHALL be scoped to the History card only — if `getScheduledTask` succeeded, task metadata (Details/Configuration sections) remains visible while the History card shows its own error and retry action.

#### Scenario: Task and runs fetch concurrently on mount

- **WHEN** `ScheduledTaskDetailPage` mounts with a valid `scheduleId` and the feature flag enabled
- **THEN** `getScheduledTask(scheduleId)` and the first `listScheduledTaskRuns({ scheduleId, limit: 10, offset: 0 })` call are both initiated without either awaiting the other's resolution

#### Scenario: Unknown schedule id renders NotFoundPage

- **WHEN** `getScheduledTask(scheduleId)` resolves with a 404
- **THEN** the app renders `NotFoundPage`, and no History content is rendered

#### Scenario: Task fetch error shows page-level retry

- **WHEN** `getScheduledTask(scheduleId)` rejects with a non-404 error
- **THEN** the page renders an error state with a retry action that re-invokes `getScheduledTask`

#### Scenario: Runs fetch error is scoped to the History card

- **WHEN** `getScheduledTask(scheduleId)` succeeds but the initial `listScheduledTaskRuns` call rejects
- **THEN** the Details and Configuration sections render normally, and only the History card shows an error message with a retry action

#### Scenario: Unmount before fetch resolves does not update state

- **WHEN** `ScheduledTaskDetailPage` unmounts (or `scheduleId` changes) while either fetch is still in flight
- **THEN** the corresponding in-flight request is aborted via `AbortController` and no state update is attempted after unmount/supersession

### Requirement: Detail page header shows back navigation and title, plus an Edit action once loaded

The detail page header SHALL render a back-navigation control and the task's `displayName` as its title on the start side. Activating the back control SHALL navigate to `ROUTES.ScheduledTasks`. Once the task has loaded successfully, the header SHALL additionally render a `NeutralButton` (`@epam/ai-dial-ui-kit`) with a pencil icon (`IconPencilMinus` from `@tabler/icons-react`) and a localized "Edit" label on the inline-end side. Activating Edit SHALL navigate to `getScheduledTaskEditRoute(scheduleId)` for the task currently being viewed. The header SHALL NOT render Delete, Active-toggle, or Run-now controls in this iteration, and SHALL NOT render the Edit button while the task is loading or failed to load.

#### Scenario: Back control returns to the list

- **WHEN** the user activates the back control on the detail page
- **THEN** the app navigates to `ROUTES.ScheduledTasks`

#### Scenario: Header shows back, title, and Edit once the task has loaded

- **WHEN** the detail page renders with a successfully loaded task
- **THEN** the header contains a back control and the task's `displayName` on the start side, a `NeutralButton` with `IconPencilMinus` and a localized "Edit" label on the end side, and no Delete/Active-toggle/Run-now control is present

#### Scenario: Edit button is absent while loading or on error

- **WHEN** the detail page is still fetching the task, or the task fetch has failed
- **THEN** the header does not render the Edit button

#### Scenario: Activating Edit navigates to the edit route for the current task

- **WHEN** the user activates the Edit button while viewing `/scheduled-tasks/sched_123`
- **THEN** the app navigates to `getScheduledTaskEditRoute('sched_123')`, which resolves to `/scheduled-tasks/sched_123/edit`

#### Scenario: Edit button is keyboard accessible

- **WHEN** a keyboard user tabs to the Edit button and presses Enter or Space
- **THEN** the same navigation occurs as with a pointer click, and the button exposes an accessible name of "Edit" (or the localized equivalent)

### Requirement: Details and Configuration sections render read-only task metadata

The detail page SHALL render a Details section showing the task's description, a "Model or Agent" value (resolved to a display name via the deployments context when possible, falling back to the raw model id), and a "Repeats" schedule label produced by the same formatter logic already used by the list page's `map-scheduled-task-dto.ts` (not duplicated inside `libs/scheduled-tasks`). The detail page SHALL render a Configuration section whose "Instructions" content is the task's `prompt` field, rendered through the same markdown stack chat assistant messages use (`MarkdownRenderer`/`MDMessageViewer` from `@epam/ai-dial-chat-shared`), as static content with no streaming/typewriter effect, and with the same default markdown class names so headings, lists, code blocks, and GFM match chat rendering.

#### Scenario: Details section shows description, model, and schedule

- **WHEN** the task detail loads with `description`, `model`, and a schedule
- **THEN** the Details section shows that description text, a model/agent display value, and a "Repeats" label produced by the shared schedule-label formatter

#### Scenario: Instructions render through the shared markdown stack

- **WHEN** the task's `prompt` contains markdown (headings, lists, a code block, and GFM syntax)
- **THEN** the Configuration section's Instructions render that markdown through `MarkdownRenderer`/`MDMessageViewer`, matching how the same markdown renders in a chat assistant message, with no streaming/typewriter animation applied

#### Scenario: Unresolvable model id falls back to raw id

- **WHEN** the task's `model` id has no matching entry in the deployments context
- **THEN** the Details section displays the raw model id string as the "Model or Agent" value, without throwing

### Requirement: History panel paginates runs via a "Show more" button inside its own scroll container

The detail page SHALL render a History panel listing the task's runs, fetched via a `useScheduledTaskRuns(scheduleId, enabled)` hook (`apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts`) exposing `{ items, isLoading, isLoadingMore, error, hasMore, loadMore, refetch }`, mirroring the shape of the existing `useScheduledTasks` hook. The hook SHALL call `listScheduledTaskRuns({ scheduleId, limit: 10, offset: 0 })` for the initial page, and `loadMore()` SHALL, only when `hasMore && !isLoadingMore && !isLoading`, fetch the next page at `offset = items.length` and append the results deduplicated by `id`, with no client-side re-sorting (server order is `created_at desc`). `hasMore` SHALL be derived from `items.length < count` when `count` is present in the response, falling back to a non-null `next` field, or — when the upstream response omits both `count` and `next` — to a full-page-size heuristic (the just-fetched page had exactly `limit` items), so pagination does not permanently stop after the first page purely because upstream didn't echo a total. The hook SHALL use `AbortController` to cancel any in-flight request when `scheduleId` changes or the hook unmounts.

The History panel SHALL be rendered inside a fixed-height, self-scrolling container (`max-h-[70vh]` at all breakpoints, `overflow-y-auto`) that does not require scrolling the whole page (except where the responsive-design skill's mobile layout requires stacking instead). Inside that scroll container: the panel title and the "Next run" label (when present) SHALL be pinned with `position: sticky; top: 0` so they stay visible while the run list scrolls beneath them; an explicit **"Show more" button** (not a scroll sentinel) SHALL render pinned with `position: sticky; bottom: 0`, below the loaded rows, only while `hasMore` is `true`. Both sticky regions SHALL use the same background as the History card so scrolled-past rows do not show through underneath them. Activating the button, while `hasMore && !isLoadingMore && !isLoading`, SHALL invoke `loadMore()`.

#### Scenario: Initial history page loads on mount

- **WHEN** `ScheduledTaskDetailPage` mounts with the feature flag enabled
- **THEN** `listScheduledTaskRuns({ scheduleId, limit: 10, offset: 0 })` is called exactly once and the resolved runs are passed to the History panel

#### Scenario: Activating "Show more" loads the next page

- **WHEN** the user activates the "Show more" button and `hasMore` is `true`
- **THEN** the next page is requested at `offset = items.length`, and once resolved its items are appended (deduplicated by `id`) below the currently rendered rows with no change to the History panel's scroll position

#### Scenario: "Show more" is not rendered once all pages are loaded

- **WHEN** `hasMore` becomes `false` (after a page response, or via the full-page-size heuristic detecting a short page)
- **THEN** the "Show more" button is not rendered and no additional `listScheduledTaskRuns` request is made

#### Scenario: "Show more" is disabled while a request is already in flight

- **WHEN** `isLoadingMore` is `true`
- **THEN** the "Show more" button is rendered disabled, and `loadMore()` invoked again is a no-op while `isLoadingMore` or `isLoading` is already `true`

#### Scenario: hasMore derives from count when present, else from next, else from a full page

- **WHEN** a `listScheduledTaskRuns` response includes `count: 42` and 10 loaded items
- **THEN** `hasMore` is `true`; when a subsequent response omits `count` but includes a non-null `next`, `hasMore` remains `true` based on `next`; when a response omits both `count` and `next` and returned exactly `limit` (10) items, `hasMore` is `true`; when such a response returns fewer than `limit` items, `hasMore` is `false`

#### Scenario: Unmount or scheduleId change aborts the in-flight runs request

- **WHEN** the hook unmounts, or `scheduleId` changes, while a runs request is in flight
- **THEN** the in-flight request is aborted via `AbortController` and its resolution does not update state

#### Scenario: Sticky header and footer stay visible while the run list scrolls

- **WHEN** the History panel has enough rows to overflow its `max-h-[70vh]` scroll container and the user scrolls it
- **THEN** the panel title (and "Next run" label, when present) remain pinned at the top of the scroll container, and the "Show more" button (when rendered) remains pinned at the bottom, both opaque against the scrolling rows beneath them

### Requirement: History rows show skeleton loading, status icon, timestamp, and duration

While the initial runs page is loading (`isLoading === true`, no items yet), the History panel SHALL render exactly 6 skeleton run rows. While a subsequent page is loading (`isLoadingMore === true`), the History panel SHALL render exactly 6 skeleton run rows appended below the already-loaded rows. Each loaded run row SHALL show: a human-readable relative/absolute timestamp derived from `startTime` (e.g. "today at 9:01 AM", "Jul 17 at 9:01 AM"); a duration suffix (e.g. `(99s)`) when `durationSeconds` is present or derivable from `startTime`/`endTime`; and a status icon reflecting the run's status — a spinner for `InProgress`, a green check for `Success`, a red X for `Error`, and a visually distinct treatment for `Missed`. Status icons SHALL be marked `aria-hidden`, and each row's accessible name SHALL include both the status and the timestamp so the status is conveyed to assistive technology without relying on icon color/shape alone.

#### Scenario: Initial load shows 6 skeleton rows

- **WHEN** the History panel is in its initial load (`isLoading === true`, no items yet)
- **THEN** exactly 6 skeleton run rows render, each marked `aria-hidden="true"`

#### Scenario: Load-more shows 6 skeleton rows below existing rows

- **WHEN** `isLoadingMore` becomes `true` after the user activates the "Show more" button
- **THEN** exactly 6 skeleton run rows render below the already-loaded rows, each marked `aria-hidden="true"`, and disappear once the request resolves and are replaced by the newly appended real rows

#### Scenario: Status icon and accessible name reflect each status value

- **WHEN** rows with `status` values `Success`, `Error`, `InProgress`, and `Missed` render
- **THEN** each shows its distinct status icon (green check, red X, spinner, and a distinct `Missed` treatment respectively), each icon is `aria-hidden`, and each row's accessible name includes the status and the row's timestamp

#### Scenario: Duration renders when available

- **WHEN** a run has `durationSeconds: 99` (or derivable `startTime`/`endTime` values yielding the same duration)
- **THEN** the row's timestamp text includes a `(99s)` duration suffix

#### Scenario: Row click is a no-op in this iteration

- **WHEN** the user clicks a history row
- **THEN** no navigation occurs (the list-runs response does not expose a conversation id in this iteration, and the row does not present a clickable affordance implying otherwise)

### Requirement: Presentational ScheduledTaskDetailView stays host-agnostic

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTaskDetailView` component accepting only props: localized label strings (including an Edit button label and a `historyShowMoreLabel` for the "Show more" button), detail field values (`description`, model display value, schedule label), either `instructionsMarkdown: string` or a `renderInstructions: (markdown: string) => ReactNode` callback, a runs list plus `{ runsHasMore, runsIsLoadingMore, runsSkeletonCount, onRunsLoadMore }` (the component renders no "Show more" button when `onRunsLoadMore` is omitted, regardless of `runsHasMore`), top-level `isLoading`/`error` flags and their History-scoped counterparts, an `onBack` callback, and an optional `onEdit?: () => void` callback. When `onEdit` is supplied, the component SHALL render the Edit button described above in an end-side header slot; when `onEdit` is omitted, no Edit button SHALL render. The component SHALL NOT import `@epam/chat-api-client`, any routing module, i18n, or auth/env/analytics modules — all host/external knowledge, including the `scheduleId`-based navigation target, is resolved by the host page and passed in via the `onEdit` callback per the repo's library-isolation rule.

#### Scenario: Lib has no host or integration imports

- **WHEN** `libs/scheduled-tasks`'s `ScheduledTaskDetailView` source is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, auth, env, or analytics modules

#### Scenario: Instructions rendering is delegated when a callback is supplied

- **WHEN** `ScheduledTaskDetailView` renders with a `renderInstructions` callback supplied
- **THEN** the Instructions content is produced by calling that callback with the `prompt` markdown string, rather than the lib rendering markdown itself

#### Scenario: onBack is invoked without the lib performing navigation

- **WHEN** the user activates the back control rendered by `ScheduledTaskDetailView`
- **THEN** `onBack` is called exactly once, and the lib performs no `navigate`/history call itself

#### Scenario: onEdit is invoked without the lib performing navigation

- **WHEN** the user activates the Edit button rendered by `ScheduledTaskDetailView`
- **THEN** `onEdit` is called exactly once, and the lib performs no `navigate`/history call or `scheduleId` resolution itself

#### Scenario: Edit button renders only when onEdit is supplied

- **WHEN** `ScheduledTaskDetailView` renders with `onEdit` left `undefined`
- **THEN** no Edit button is present in the header, regardless of loading state

### Requirement: Detail page strings flow through react-i18next

Every user-visible string on the Scheduled Task Detail page (section titles, back control accessible label, run status labels, empty-history label, error/retry labels, loading-more indicator) MUST be resolved via `useTranslation().t()` in `ScheduledTaskDetailPage` and passed into `ScheduledTaskDetailView` as plain strings. Keys MUST live under a `scheduledTasks.detail` namespace in `apps/chat/src/i18n/locales/en.json` and be referenced through the existing `ScheduledTasksI18nKeys` enum (or a new enum in the same file) in `apps/chat/src/constants/translation-keys.ts`. Existing generic labels (e.g. "Retry", "Loading…") MUST be reused from `ButtonsI18nKeys` or another shared namespace where an equivalent already exists, rather than duplicated under a new key.

#### Scenario: Detail keys are present in en.json

- **WHEN** the change is applied
- **THEN** `en.json` contains `scheduledTasks.detail.detailsTitle`, `scheduledTasks.detail.configurationTitle`, `scheduledTasks.detail.instructionsLabel`, `scheduledTasks.detail.historyTitle`, `scheduledTasks.detail.backAriaLabel`, `scheduledTasks.detail.emptyHistoryLabel`, `scheduledTasks.detail.historyErrorLabel`, and status labels for `success`/`error`/`inProgress`/`missed`

#### Scenario: Lib receives strings, not translation keys

- **WHEN** `ScheduledTaskDetailPage` renders `<ScheduledTaskDetailView />`
- **THEN** every string-typed prop passed to it is the result of `t(SomeI18nKeys.Member)`, never a raw i18n key or hard-coded English literal

### Requirement: Detail page supports RTL and meets AAA accessibility defaults

All directional layout in the detail page header, Details/Configuration sections, and History panel MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) per `.claude/rules/rtl.md`. The back control's directional icon MUST be mirrored in RTL via `rtl:scale-x-[-1]` or an equivalent. The History panel SHALL be marked up as a `<ul>`/`<li>` list with each `<li>` exposing an accessible name that includes the run's status and timestamp (per the "History rows show skeleton loading, status icon, timestamp, and duration" requirement). Status-icon-only visual differences MUST NOT be the sole means of conveying run status to assistive technology.

#### Scenario: Detail page mirrors under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the header, Details/Configuration sections, and History panel lay out mirrored, and the back icon is visually flipped

#### Scenario: History list uses semantic list markup with accessible row names

- **WHEN** a screen reader user navigates into the History panel
- **THEN** the panel is exposed as a list (`<ul>`/`<li>` or equivalent ARIA list role), and each row's accessible name conveys both its status and its timestamp
