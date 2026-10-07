# Spec: scheduled-task-detail-page

## Purpose

Defines the Scheduled Task Detail page: feature-flag-gated per-task route, concurrent task/runs data fetching with scoped error handling, the read-only Details/Configuration sections (including markdown-rendered instructions), the paginated History panel (a sticky-positioned header and "Show more" button, not scroll-triggered), the host-agnostic `ScheduledTaskDetailView` presentational component, i18n, and RTL/accessibility requirements.

## Requirements

### Requirement: Scheduled Task detail page renders behind a feature flag at a per-task route

The application SHALL expose a lazy-loaded Scheduled Task Detail page at `ROUTES.ScheduledTaskDetail` (`/scheduled-tasks/:scheduleId`), registered in `apps/chat/src/app/app.tsx` using the same `RouteErrorBoundary` + `Suspense` + `RouteFallback` wrapper pattern as the Scheduled Tasks list page. The route always mounts `ScheduledTaskDetailPage`; the page itself SHALL render `RouteFallback` until the app config status is `UserConfigStatus.Ready`, and SHALL only render detail content when `useFeatureFlag('scheduledTasksEnabled')` resolves to `true` for the current session; otherwise it SHALL render the same content as an unregistered path (the app's `NotFound` page), matching the list page's existing flag-gating behavior.

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
- **THEN** the in-flight runs request is aborted via `AbortController`, the task request's resolution is ignored through an effect-scoped cancellation flag (`getScheduledTask` takes no abort signal), and no state update is attempted after unmount/supersession

### Requirement: Detail page header shows back navigation and title, plus Active/Delete/Edit actions once loaded

The detail page header SHALL render a back-navigation control and the task's `displayName` as its title on the start side. Activating the back control SHALL navigate to `ROUTES.ScheduledTasks`. Once the task has loaded successfully and `task.isDeleted` is not `true`, the header SHALL additionally render, on the inline-end side, in this order:

1. an **Active** switch (`Switch` from `@epam/ai-dial-ui-kit`) with a visible localized "Active" label, rendered only when `isActive !== undefined` on the loaded task, never an unchecked switch while the active state is unknown;
2. a destructive **Delete** action (`GhostButton` from `@epam/ai-dial-ui-kit` with `variant={ButtonVariant.Danger}`, a leading `IconTrashX` marked `aria-hidden`, and a visible localized "Delete" label). Activating Delete SHALL open the confirmation dialog described in the "Delete confirmation dialog gates the delete request" requirement — it SHALL NOT call any API directly;
3. a `NeutralButton` (`@epam/ai-dial-ui-kit`) with a pencil icon (`IconPencilMinus` from `@tabler/icons-react`) and a localized "Edit" label. Activating Edit SHALL navigate to `getScheduledTaskEditRoute(scheduleId)` for the task currently being viewed;
4. a localized **Start now** button with a decorative play icon, invoking the manual-run action described above.

When `task.isDeleted` is `true`, the header SHALL render none of the Active switch, Delete action, Edit button, or Start now button — only the back control, title, and the read-only deleted-state indicator described in the "Soft-deleted task renders as a read-only deleted state" requirement. The header SHALL render a localized Start now button after Edit as specified by the manual-run requirements, and SHALL NOT render Start now, the Edit button, Active switch, or Delete action while the task is loading or failed to load. While a delete request is in flight (`isDeleting` is `true`), the Active switch, Delete action, Edit button, and Start now button SHALL all render disabled rather than absent.

#### Scenario: Back control returns to the list

- **WHEN** the user activates the back control on the detail page
- **THEN** the app navigates to `ROUTES.ScheduledTasks`

#### Scenario: Header shows back, title, Active switch, Delete, and Edit in order once the task has loaded

- **WHEN** the detail page renders with a successfully loaded, non-deleted task whose `isActive` is defined
- **THEN** the header contains a back control and the task's `displayName` on the start side, and on the end side — in order — the Active switch, a destructive Delete action with a visible "Delete" label, and a `NeutralButton` with `IconPencilMinus` and a localized "Edit" label

#### Scenario: Edit, Active, and Delete are absent while loading or on error

- **WHEN** the detail page is still fetching the task, or the task fetch has failed
- **THEN** the header does not render the Edit button, the Active switch, or the Delete action

#### Scenario: Activating Edit navigates to the edit route for the current task

- **WHEN** the user activates the Edit button while viewing `/scheduled-tasks/sched_123`
- **THEN** the app navigates to `getScheduledTaskEditRoute('sched_123')`, which resolves to `/scheduled-tasks/sched_123/edit`

#### Scenario: Edit button is keyboard accessible

- **WHEN** a keyboard user tabs to the Edit button and presses Enter or Space
- **THEN** the same navigation occurs as with a pointer click, and the button exposes an accessible name of "Edit" (or the localized equivalent)

#### Scenario: Activating Delete opens the confirmation dialog without calling the API

- **WHEN** the user activates the Delete action
- **THEN** the confirmation dialog opens and no `deleteScheduledTask` call is made

#### Scenario: Header actions are disabled, not removed, while a delete is in flight

- **WHEN** `isDeleting` is `true`
- **THEN** the Active switch, Delete action, and Edit button all render in a disabled state and none of their activation handlers fire

#### Scenario: Deleted task header shows only back, title, and the deleted indicator

- **WHEN** the loaded task has `isDeleted: true`
- **THEN** the header shows the back control, the title, and the deleted-state indicator, and none of the Active switch, Delete action, or Edit button render

#### Scenario: Start now follows Edit

- **WHEN** the loaded task is not deleted and the host supplies the start action
- **THEN** the header displays Start now after Edit, with eligibility and pending behavior defined by the manual-run requirements

#### Scenario: Start now is absent during task load failure or deletion

- **WHEN** task details are loading, failed, or soft-deleted
- **THEN** Start now is absent along with the other unavailable task actions

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

The Configuration section SHALL render an optional Skill field above Instructions using a host-resolved display name or full raw reference. It SHALL hide Skill only when no reference is saved, and hide empty Instructions for a skill-only task. The existing Model location and schedule formatting remain unchanged.

#### Scenario: Read-only skill is independent of metadata availability

- **WHEN** a saved skill cannot be resolved
- **THEN** Configuration displays the raw reference and retains the rest of the task without a broken link or error screen

### Requirement: History panel paginates runs via a "Show more" button inside its own scroll container

The detail page SHALL render a History panel listing the task's runs, fetched via a `useScheduledTaskRuns(scheduleId, enabled, nextRunTime)` app adapter (`apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts`) over the shared `useScheduledTaskRuns(client, { scheduleId, enabled, pageSize, nextRunTime })` hook (`libs/chat-hooks/src/scheduled-task/use-scheduled-task-runs.ts`, exported from `@epam/ai-dial-chat-hooks/scheduled-tasks`), exposing `{ items, isLoading, isLoadingMore, error, loadMoreError, hasMore, loadMore, retryLoadMore, refetch }` (the adapter maps the shared hook's `initialError` to `error`). `nextRunTime` is the currently-loaded task's `ScheduledTaskDto.nextRunTime` (`undefined`/`null` when not yet known); the page SHALL NOT fetch the task a second time to obtain it. The hook SHALL call `listScheduledTaskRuns({ scheduleId, limit: 10, offset: 0 })` for the initial page, and `loadMore()` SHALL, only when `hasMore && !isLoadingMore && !isLoading`, fetch the next page at an offset equal to the number of run rows fetched so far (initial page plus every appended page) and append the results deduplicated by `id`, with no client-side re-sorting (server order is `created_at desc`). `hasMore` SHALL be `true` when the response carries a non-null `next`; otherwise it SHALL be derived from the fetched-row offset being below `count` when `count` is present, or — when the upstream response omits both `count` and `next` — from a full-page-size heuristic (the just-fetched page had exactly `limit` items), so pagination does not permanently stop after the first page purely because upstream didn't echo a total. The hook SHALL use `AbortController` to cancel any in-flight request when `scheduleId` changes or the hook unmounts.

The hook SHALL additionally keep the History panel fresh without a manual reload, via two background-refresh triggers that merge into `items` rather than resetting them (`refetch()`'s existing full-reset-to-page-0 behavior is unchanged and is never invoked by either trigger):

- **Poll while a run is in progress**: while any entry in `items` has `status === ScheduledTaskRunDtoStatusEnum.InProgress`, the hook SHALL re-fetch page 0 (`offset: 0, limit: 10`) every 15 seconds and merge the response into `items` by `id` — an existing `id` is updated in place at its current array position (no reordering), an unseen `id` is prepended, and no entry absent from the response is removed. Polling SHALL stop as soon as no entry has `InProgress` status, or after 20 consecutive polls that each either leave the merge unchanged or fail outright (5 minutes total), whichever happens first — a poll that errors counts toward the stop threshold the same as one that resolves with no change, so a permanently-failing upstream does not poll indefinitely.
- **One-shot refresh at the next scheduled run**: when `nextRunTime` is a future instant, the hook SHALL schedule exactly one refresh for 5 seconds after that instant, merged the same way as the poll trigger. When `nextRunTime` is already in the past when the hook first receives it, it SHALL refresh once immediately instead of scheduling a future timer.

Both triggers SHALL run only while `document.visibilityState === 'visible'`; while hidden, no refresh fires, and on returning to visible the hook SHALL perform at most one catch-up refresh if a scheduled one was missed while hidden. Neither trigger SHALL fire while `isLoading` or `isLoadingMore` is `true` — this includes the one-shot trigger for an already-past `nextRunTime`: if `nextRunTime` is supplied (or first found to be past) while the initial fetch is still in flight, the immediate refresh SHALL be deferred until that fetch settles, issuing a second, distinct `listScheduledTaskRuns({ offset: 0 })` request rather than racing or replacing the initial one. Each background-refresh request (poll tick or one-shot) SHALL use its own `AbortController`, exactly as the initial fetch and `loadMore` already do. A background refresh that fails SHALL leave `items` and the foreground `error`/`loadMoreError` state untouched — it SHALL NOT surface the failure to the user — and SHALL simply be retried on the next tick. All timers and listeners created by either trigger, and any in-flight background-refresh request, SHALL be cleared/aborted on unmount and on `scheduleId` change, alongside the existing initial-fetch `AbortController` cleanup.

At the **desktop breakpoint (≥1280px)**, the History panel SHALL be rendered inside a fixed-height, self-scrolling container (`max-h-[70vh]`, `overflow-y-auto`) that does not require scrolling the whole page. Inside that scroll container: the panel title and the "Next run" label (when present) SHALL be pinned with `position: sticky; top: 0` so they stay visible while the run list scrolls beneath them; an explicit **"Show more" button** (not a scroll sentinel) SHALL render pinned with `position: sticky; bottom: 0`, below the loaded rows, only while `hasMore` is `true`. Both sticky regions SHALL use the same background as the History card so scrolled-past rows do not show through underneath them.

Below the desktop breakpoint (mobile and tablet, where the body renders as tabs), the History section SHALL render as a tab panel in **standard top-to-bottom flow** within the page's own scroll container: no inner `max-h-[70vh]` self-scrolling container, no sticky title/"Next run" header, and no sticky footer — the "Next run" label (when present) renders above the run list unstuck, and the "Show more" button renders inline below the loaded rows, only while `hasMore` is `true`, disabled while `isLoadingMore` is `true`. Activating the button, while `hasMore && !isLoadingMore && !isLoading`, SHALL invoke `loadMore()` at both breakpoints.

#### Scenario: Initial history page loads on mount

- **WHEN** `ScheduledTaskDetailPage` mounts with the feature flag enabled
- **THEN** `listScheduledTaskRuns({ scheduleId, limit: 10, offset: 0 })` is called exactly once as the initial load, and the resolved runs are passed to the History panel — independent of whether a separate immediate background refresh additionally fires afterward per the "past-due immediate refresh" scenario below

#### Scenario: Activating "Show more" loads the next page

- **WHEN** the user activates the "Show more" button and `hasMore` is `true`
- **THEN** the next page is requested at `offset = items.length`, and once resolved its items are appended (deduplicated by `id`) below the currently rendered rows with no change to the History panel's scroll position

#### Scenario: "Show more" is not rendered once all pages are loaded

- **WHEN** `hasMore` becomes `false` (after a page response, or via the full-page-size heuristic detecting a short page)
- **THEN** the "Show more" button is not rendered and no additional `listScheduledTaskRuns` request is made

#### Scenario: "Show more" is disabled while a request is already in flight

- **WHEN** `isLoadingMore` is `true`
- **THEN** the "Show more" button is rendered disabled, and `loadMore()` invoked again is a no-op while `isLoadingMore` or `isLoading` is already `true`

#### Scenario: hasMore derives from next, else from count, else from a full page

- **WHEN** a `listScheduledTaskRuns` response includes `count: 42` and 10 loaded items
- **THEN** `hasMore` is `true`; a response with a non-null `next` yields `hasMore: true` regardless of `count`; when a response omits both `count` and `next` and returned exactly `limit` (10) items, `hasMore` is `true`; when such a response returns fewer than `limit` items, `hasMore` is `false`

#### Scenario: Unmount or scheduleId change aborts the in-flight runs request

- **WHEN** the hook unmounts, or `scheduleId` changes, while a runs request is in flight
- **THEN** the in-flight request is aborted via `AbortController` and its resolution does not update state

#### Scenario: Sticky header and footer stay visible while the run list scrolls at desktop

- **WHEN** at the desktop breakpoint the History panel has enough rows to overflow its `max-h-[70vh]` scroll container and the user scrolls it
- **THEN** the panel title (and "Next run" label, when present) remain pinned at the top of the scroll container, and the "Show more" button (when rendered) remains pinned at the bottom, both opaque against the scrolling rows beneath them

#### Scenario: Mobile History panel renders in standard top-to-bottom flow

- **WHEN** the History tab is active below the desktop breakpoint and its run list is long enough to overflow the viewport
- **THEN** the runs scroll with the page (no inner self-scrolling container), the panel title and "Next run" label are not sticky, and the "Show more" button renders inline below the loaded rows — not pinned to the panel's bottom edge

#### Scenario: Polling starts while an in-progress run is loaded and stops once it settles

- **WHEN** `items` contains a run with `status === ScheduledTaskRunDtoStatusEnum.InProgress`
- **THEN** the hook re-fetches page 0 every 15 seconds and merges the response into `items`; once a subsequent merge leaves no entry with `InProgress` status, no further poll is scheduled

#### Scenario: Polling stops after 20 consecutive polls with no status change

- **WHEN** a run stays `InProgress` across 20 consecutive 15-second polls with no status change in the merged response
- **THEN** the hook stops polling entirely for that run without further requests, even though the run is still `InProgress`

#### Scenario: A poll that errors counts toward the stop threshold the same as one with no change

- **WHEN** a run stays `InProgress` and 20 consecutive 15-second polls each either resolve with no status change or reject outright, in any mix
- **THEN** the hook stops polling entirely once the 20th such poll completes, without waiting for a poll that never resolves successfully

#### Scenario: A background refresh merges without resetting pagination or scroll position

- **WHEN** a poll or one-shot refresh's page-0 response contains a mix of ids already present in `items` and ids not yet present
- **THEN** each already-present id is updated in place at its existing array position, each new id is prepended to the front of `items`, no id absent from the response is removed, and `hasMore`/the loaded-page `offset` are left unchanged

#### Scenario: One-shot refresh fires shortly after the next scheduled run

- **WHEN** `nextRunTime` is a future instant and the panel remains visible
- **THEN** exactly one refresh is triggered 5 seconds after `nextRunTime`, merged the same way as a poll refresh

#### Scenario: A next-run time already in the past triggers one immediate refresh

- **WHEN** the hook first receives a `nextRunTime` that is already earlier than the current time
- **THEN** it performs one refresh immediately instead of scheduling a future timer

#### Scenario: The past-due immediate refresh waits for the initial fetch to settle

- **WHEN** the hook first receives an already-past `nextRunTime` while the initial page load is still in flight (`isLoading === true`)
- **THEN** the immediate refresh does not fire until the initial fetch settles, and then issues a second, distinct `listScheduledTaskRuns({ offset: 0 })` request rather than racing or being merged into the initial one

#### Scenario: Background refresh requests are individually abortable

- **WHEN** a poll tick or a one-shot refresh issues a `listScheduledTaskRuns` request
- **THEN** that request carries its own `AbortController` signal, independent of the initial fetch's and `loadMore`'s controllers

#### Scenario: No refresh while the tab is hidden, with one catch-up refresh on return

- **WHEN** `document.visibilityState` is `'hidden'` while a poll interval or the one-shot timer would otherwise fire
- **THEN** no request is made while hidden, and on `visibilitychange` back to `'visible'` at most one catch-up refresh runs to cover what was missed

#### Scenario: Background refresh never overlaps a foreground fetch and fails silently

- **WHEN** `isLoading` or `isLoadingMore` is `true`, or a background refresh's request rejects
- **THEN** no background refresh request is made while a foreground fetch is in flight, and a rejected background refresh leaves `items`, `error`, and `loadMoreError` unchanged, retrying on the next tick without surfacing the foreground error state

#### Scenario: Unmount or scheduleId change stops all polling and scheduled refreshes

- **WHEN** the hook unmounts, or `scheduleId` changes, while a poll interval or the one-shot `nextRunTime` timer is pending, or a background-refresh request is in flight
- **THEN** the interval and timer are cleared, any in-flight background-refresh request is aborted via its `AbortController`, and no further background-refresh request fires for the previous `scheduleId`

### Requirement: History rows show skeleton loading, status icon, timestamp, and duration

While the initial runs page is loading (`isLoading === true`, no items yet), the History panel SHALL render exactly 6 skeleton run rows. While a subsequent page is loading (`isLoadingMore === true`), the History panel SHALL render exactly 6 skeleton run rows appended below the already-loaded rows. Each loaded run row SHALL show: a human-readable relative/absolute timestamp derived from `startTime` (e.g. "today at 9:01 AM", "Jul 17 at 9:01 AM"); a duration suffix (e.g. `(99s)`) when `durationSeconds` is present or derivable from `startTime`/`endTime`; and a status icon reflecting the run's status — a spinner for `InProgress`, a green check for `Success`, a red X for `Error`, and a visually distinct treatment for `Missed`. Status icons SHALL be marked `aria-hidden`, and each row's accessible name SHALL include both the status and the timestamp so the status is conveyed to assistive technology without relying on icon color/shape alone.

A row whose run has a non-empty `conversationId` and for which the page supplies `onRunClick` SHALL render as interactive (`role="button"`, `tabIndex={0}`, activatable via click, Enter, or Space, `cursor-pointer`) and, on activation, invoke `onRunClick` with that run. A row whose run has no `conversationId` — regardless of whether `onRunClick` is supplied — SHALL render exactly as a non-interactive row: no button role, no `tabIndex`, no pointer cursor, and activating it (click or keyboard) SHALL have no effect and SHALL NOT invoke `onRunClick`. When a row is interactive, activating it SHALL NOT navigate directly from within `libs/scheduled-tasks` — only the host-supplied `onRunClick` callback fires.

When `item.isUnread` is `true`, the row SHALL additionally render the shared unread-dot treatment (a reserved `size-3` slot immediately before the timestamp, a `size-[5.33px] rounded-full` disk filled with `var(--text-accent, #1d4ed8)` by default — overridable via an `unreadDotColor` style — marked `aria-hidden`) so timestamps stay aligned across unread and read rows. Because the row's own `aria-label` (built from the status label and timestamp per the requirement above) overrides all descendant text per the ARIA accessible-name algorithm, the unread state MUST be conveyed by appending the row's `unreadIndicatorLabel` to that same `aria-label` — not by a nested `sr-only` span, which an ancestor `aria-label` renders unreachable to assistive technology. When `item.isUnread` is `false` or omitted, no dot renders and the accessible name carries no unread suffix.

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

#### Scenario: Row with a conversation id and onRunClick is interactive and invokes the callback

- **WHEN** a row's run has `conversationId: "conversations/bucket/.scheduler/sched_123/run_9f2a"` and the panel was given `onRunClick`
- **THEN** the row exposes `role="button"`, `tabIndex={0}`, and a pointer cursor, and clicking it (or pressing Enter/Space while it is focused) calls `onRunClick` exactly once with that run

#### Scenario: Row without a conversation id stays static even when onRunClick is supplied

- **WHEN** a row's run has no `conversationId` (absent or `undefined`) and the panel was given `onRunClick`
- **THEN** the row renders with no button role, no `tabIndex`, and no pointer-cursor affordance, and clicking it or pressing Enter/Space while it is focused does not call `onRunClick`

#### Scenario: Row with a conversation id stays static when onRunClick is omitted

- **WHEN** a row's run has `conversationId` set but the panel was not given `onRunClick`
- **THEN** the row renders as a static, non-interactive row identical to today's behavior

#### Scenario: Unread row shows the dot and folds the label into the accessible name

- **WHEN** a row's item has `isUnread: true`
- **THEN** the row renders the unread dot (`aria-hidden`) immediately before the timestamp, the timestamp's horizontal position matches a read row's timestamp position, and the row's `aria-label` ends with the row's `unreadIndicatorLabel` text (e.g. `"Succeeded today at 9:01 AM (99s) — Unread"`)

#### Scenario: Read row renders no dot and no unread suffix

- **WHEN** a row's item has `isUnread: false` or `isUnread` is omitted
- **THEN** no unread dot renders, and the row's `aria-label` contains no unread suffix

### Requirement: Presentational ScheduledTaskDetailView stays host-agnostic

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTaskDetailView` component accepting only props: localized label strings (including Edit and Delete button labels, the Active switch's label/status announcements, a deleted-state label, and the History panel's `unreadIndicatorLabel`), detail field values (`description`, model display value, schedule label), either `instructionsMarkdown: string` or a `renderInstructions: (markdown: string) => ReactNode` callback, a runs list (each item optionally carrying `conversationId` and `isUnread`) plus `{ runsHasMore, runsIsLoadingMore, runsSkeletonCount, onRunsLoadMore, onRunClick? }`, top-level `isLoading`/`error` flags and their History-scoped counterparts, an `onBack` callback, an optional `onEdit?: () => void` callback, optional `isActive?: boolean`/`isActiveUpdating?: boolean`/`isActiveDisabled?: boolean`/`isCompleted?: boolean`/`onActiveChange?: (nextActive: boolean) => void` for the Active switch (no switch renders when `isCompleted` is `true`), an optional `onDelete?: () => void` callback, an optional `isDeleting?: boolean` flag, and an optional `isDeleted?: boolean` flag.

When `onEdit` is supplied, the component SHALL render the Edit button; when omitted, no Edit button renders. When `onDelete` is supplied, the component SHALL render the Delete action; when omitted, no Delete action renders. When `isActive` is `undefined`, no Active switch SHALL render. When `isDeleted` is `true`, the component SHALL render its read-only deleted-state indicator and SHALL NOT render the Edit button, Delete action, or Active switch regardless of whether `onEdit`/`onDelete`/`isActive` are supplied — `isDeleted` takes precedence over the presence of those callbacks. When `isDeleting` is `true`, the component SHALL render the Edit button, Delete action, and Active switch (whichever are otherwise eligible to render) in a disabled state rather than omitting them. `onRunClick`, when supplied, SHALL be invoked by the History panel only for a row whose run carries a non-empty `conversationId`, per the "History rows show skeleton loading, status icon, timestamp, and duration" requirement; the component SHALL NOT itself navigate, resolve routes, or call `markConversationViewed`. The component SHALL NOT import `@epam/chat-api-client`, any routing module, i18n, or auth/env/analytics modules, and SHALL NOT render any confirmation dialog itself — activating Delete only invokes `onDelete`; the host page owns opening/closing the confirmation dialog, the API call, and all post-delete navigation.

#### Scenario: Lib has no host or integration imports

- **WHEN** `libs/scheduled-tasks`'s `ScheduledTaskDetailView` source is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, feature-flag, auth, env, or analytics modules, and no import of a confirmation-dialog component, and no import of `@epam/ai-dial-conversation-panel`

#### Scenario: Instructions rendering is delegated when a callback is supplied

- **WHEN** `ScheduledTaskDetailView` renders with a `renderInstructions` callback supplied
- **THEN** the Instructions content is produced by calling that callback with the `prompt` markdown string, rather than the lib rendering markdown itself

#### Scenario: Built-in instructions viewer uses host-supplied markdown labels

- **WHEN** `ScheduledTaskDetailView` renders `instructionsMarkdown` without a `renderInstructions` callback and `labels` carries `codeBlockCopyLabel`, `codeBlockCopiedLabel`, `codeBlockDownloadLabel`, `tableScrollRegionAriaLabel` and `mathScrollRegionAriaLabel`
- **THEN** the built-in `MDMessageViewer` names the code-block copy/download buttons, the copied announcement, a wide table's scroll region and a wide formula's scroll region with those labels, falling back to `'Copy code'` / `'Copied!'` / `'Download code'` / `'Scrollable table'` / `'Scrollable formula'` for any unset field
- **AND** the chat app's `ScheduledTaskDetailPage` passes `buttons.copy`, `buttons.copied`, `buttons.download`, `chat.scrollableTable` and `chat.scrollableFormula` through `t()`

#### Scenario: onBack is invoked without the lib performing navigation

- **WHEN** the user activates the back control rendered by `ScheduledTaskDetailView`
- **THEN** `onBack` is called exactly once, and the lib performs no `navigate`/history call itself

#### Scenario: onEdit is invoked without the lib performing navigation

- **WHEN** the user activates the Edit button rendered by `ScheduledTaskDetailView`
- **THEN** `onEdit` is called exactly once, and the lib performs no `navigate`/history call or `scheduleId` resolution itself

#### Scenario: Edit button renders only when onEdit is supplied

- **WHEN** `ScheduledTaskDetailView` renders with `onEdit` left `undefined` and `isDeleted` is not `true`
- **THEN** no Edit button is present in the header, regardless of loading state

#### Scenario: onDelete is invoked without the lib opening a dialog or calling an API

- **WHEN** the user activates the Delete action rendered by `ScheduledTaskDetailView`
- **THEN** `onDelete` is called exactly once, and the lib renders no dialog, performs no network call, and performs no `scheduleId` resolution itself

#### Scenario: Delete action renders only when onDelete is supplied and the task is not deleted

- **WHEN** `ScheduledTaskDetailView` renders with `onDelete` left `undefined`, or with `isDeleted: true` regardless of whether `onDelete` is supplied
- **THEN** no Delete action is present in the header

#### Scenario: isDeleted suppresses Edit, Delete, and Active regardless of callback presence

- **WHEN** `ScheduledTaskDetailView` renders with `isDeleted: true` and `onEdit`, `onDelete`, and `isActive` all supplied with defined values
- **THEN** none of the Edit button, Delete action, or Active switch render; only the deleted-state indicator renders in their place

#### Scenario: Active switch renders only when isActive is defined

- **WHEN** `ScheduledTaskDetailView` renders with `isActive` left `undefined` (loading, error, or an upstream response with no basis to decide)
- **THEN** no Active switch is present in the header

#### Scenario: onActiveChange is invoked with the requested value without the lib calling any API

- **WHEN** the user toggles the Active switch from checked to unchecked (or vice versa)
- **THEN** `onActiveChange` is called exactly once with the newly requested boolean value, and the lib performs no network call, optimistic update, or `scheduleId` resolution itself

#### Scenario: Active switch is disabled while updating or explicitly disabled

- **WHEN** `isActiveUpdating` or `isActiveDisabled` is `true`
- **THEN** the rendered switch exposes a disabled state and does not call `onActiveChange` when interacted with

#### Scenario: onRunClick fires only for clickable rows and never navigates from the lib

- **WHEN** `onRunClick` is supplied and the user activates a row whose run has `conversationId` set, versus a row whose run has no `conversationId`
- **THEN** `onRunClick` is called exactly once for the first row and not at all for the second, and in neither case does the lib call `navigate`, resolve a route, or call `markConversationViewed`

### Requirement: Detail page navigates from a History run to its conversation

`ScheduledTaskDetailPage` SHALL pass `onRunClick` to `ScheduledTaskDetailView`. On activation of a row whose run item has a non-empty `conversationId`, the page SHALL call `navigate(getConversationRoute(run.conversationId))` (`apps/chat/src/constants/routes.ts`, which already strips a leading `conversations/` segment and rejects `.`/`..` path segments). The page SHALL NOT call `markConversationViewed` itself for this navigation — marking the newly active conversation viewed is already handled, for every route in the app, by the existing `useActiveConversationSync` hook (`@epam/ai-dial-chat-hooks`, wired into the always-mounted `ConversationPanelView` in `apps/chat/src/app/app.tsx`), which reacts to the URL-derived active conversation id changing and matching a loaded conversation-list item. `ScheduledTaskDetailView`'s own row-interactivity rule (no `conversationId` → no click) means the page never receives an activation for a run lacking one; the page SHALL NOT additionally guard against that case with its own no-op branch beyond what type-narrowing already requires.

#### Scenario: Activating a run with a conversation id navigates to it

- **WHEN** the user clicks (or activates via keyboard) a History row whose run has `conversationId: "conversations/bucket/.scheduler/sched_123/run_9f2a"`
- **THEN** the app navigates to `getConversationRoute("conversations/bucket/.scheduler/sched_123/run_9f2a")`, and the page itself makes no direct call to `markConversationViewed`

#### Scenario: Navigating to the conversation clears the History dot on the next render

- **GIVEN** a run row rendered with `isUnread: true` because its matched conversation's `isUnread` was `true`
- **WHEN** the user activates that row, the app navigates to the matched conversation, the existing `useActiveConversationSync` effect marks it viewed, and the conversation list subsequently reflects `isUnread: false` for that conversation
- **THEN** the same run row no longer renders the unread dot on the next render

### Requirement: History run unread state is derived from the existing conversation list, not a new source

`ScheduledTaskDetailPage` SHALL compute each run's `isUnread` by matching `run.conversationId` against the conversation items already loaded via `ConversationsContext`, using `conversationIdsMatch` (`apps/chat/src/utils/conversation-id-match.ts`) to tolerate id-format differences (a `conversations/`-prefixed resource path versus an unprefixed panel id, and URI-encoding differences) between the run's `conversationId` and a conversation list item's `id`. A run whose `conversationId` is absent, or which matches no loaded conversation item, SHALL resolve to `isUnread: false` (never `undefined` and never treated as an error). A run whose `conversationId` matches a loaded conversation item SHALL resolve to that item's own `isUnread` value exactly (`true` only when the matched item's `isUnread` is `true`). This computation SHALL NOT trigger a new fetch of the conversation list, a new fetch of run data, or persist anything — it is a pure derivation over data both contexts already hold.

The app's history adapter and accepted-run effects SHALL separately refresh shared conversation metadata, with bounded discovery of missing chat ids as specified in [scheduled-task-unread-tracking](../scheduled-task-unread-tracking/spec.md). Discovery SHALL remain independent of the pure row mapping and of whether a run is still InProgress.

#### Scenario: Matching conversation with isUnread true produces a dot

- **GIVEN** `ConversationsContext` holds a loaded conversation item with `id: "bucket/.scheduler/sched_123/run_9f2a"` and `isUnread: true`
- **WHEN** a run's `conversationId` is `"conversations/bucket/.scheduler/sched_123/run_9f2a"` (prefixed differently than the list item's `id`)
- **THEN** `conversationIdsMatch` resolves them as the same conversation, and the run's item passed to `ScheduledTaskRunHistoryList` has `isUnread: true`

#### Scenario: No matching conversation produces no dot

- **WHEN** a run's `conversationId` does not match any conversation item currently loaded in `ConversationsContext` (e.g. the conversation was deleted, or the list has not finished loading)
- **THEN** the run's item passed to `ScheduledTaskRunHistoryList` has `isUnread: false`, and no error is raised

#### Scenario: Absent conversation id produces no dot

- **WHEN** a run has no `conversationId`
- **THEN** the run's item passed to `ScheduledTaskRunHistoryList` has `isUnread: false`

#### Scenario: Delayed metadata updates the History unread indicator

- **WHEN** a run has a conversation id whose metadata becomes available after the initial list refresh, including after the run completes
- **THEN** bounded discovery updates `ConversationsContext` and the row reflects the backend unread state without reloading the page

### Requirement: Delete confirmation dialog gates the delete request

`ScheduledTaskDetailPage` SHALL render a confirmation dialog (`ScheduledTaskDeleteModal` in `apps/chat/src/components/ScheduledTaskDeleteModal/`, which renders `ScheduledTaskDeleteConfirmation` from `@epam/ai-dial-scheduled-tasks`, itself the shared `ConfirmationDialog` from `@epam/ai-dial-chat-shared` in its `ConfirmationPopupVariant.Danger` variant — see the `shared-delete-confirmation` spec) that opens when the header's Delete action is activated and MUST NOT issue any `deleteScheduledTask` call until the dialog's destructive confirm action is explicitly activated. The dialog SHALL present the title "Delete task"; an identity card carrying only the task name (no glyph and no type label); the sentence "Are you sure you want to delete **{taskName}**? This action is permanent and cannot be undone." with the task name bold; the consequence bullets "All run conversations will still be accessible" and "Cannot be undone"; and a text `Cancel` action beside a destructive `Delete` confirm action with a leading trash icon. Activating `Cancel`, pressing `Escape`, or otherwise closing the dialog SHALL close it without making any API call and SHALL NOT change any task state. While a delete request triggered by the confirm action is in flight, the dialog SHALL remain open, its confirm action SHALL show a spinner in place of the trash icon and be disabled so it cannot fire a second concurrent call, the localized "Deleting…" status SHALL be announced through a polite live region (the confirm label itself stays "Delete", so the button keeps one accessible name), and `Cancel`/`Escape`/close SHALL be inert until the request settles. When the dialog closes without a completed deletion (`Cancel`, `Escape`, close, or a failed request that the user dismisses), focus SHALL return to the header's Delete action.

#### Scenario: Opening the dialog makes no API call

- **WHEN** the user activates Delete
- **THEN** the confirmation dialog opens with a permanent/irreversible description, `Cancel`, and a destructive `Delete` confirm action, and no `deleteScheduledTask` call has been made

#### Scenario: Cancel makes no API call and returns focus to Delete

- **WHEN** the user activates `Cancel` in the open dialog
- **THEN** the dialog closes, no `deleteScheduledTask` call is made, and keyboard focus returns to the header's Delete action

#### Scenario: Escape makes no API call and returns focus to Delete

- **WHEN** the dialog is open and the user presses `Escape`
- **THEN** the dialog closes, no `deleteScheduledTask` call is made, and keyboard focus returns to the header's Delete action

#### Scenario: Confirming calls the delete operation exactly once

- **WHEN** the user activates the dialog's destructive `Delete` confirm action
- **THEN** `deleteScheduledTask(scheduleId)` is called exactly once for the task currently being viewed

#### Scenario: Repeated confirmation is prevented while a request is pending

- **WHEN** the user activates the confirm action again while a previous `deleteScheduledTask` call for the same task is still in flight
- **THEN** no second `deleteScheduledTask` call is made, and the confirm action stays disabled with a spinner throughout while its label stays "Delete"

#### Scenario: Cancel, Escape, and close are inert while a request is pending

- **WHEN** a `deleteScheduledTask` call is in flight
- **THEN** activating `Cancel`, pressing `Escape`, or otherwise attempting to close the dialog has no effect until the request settles

### Requirement: Delete action calls the BFF and handles success/failure

`ScheduledTaskDetailPage` SHALL call `deleteScheduledTask(scheduleId)` (via `apps/chat/src/server-api/scheduled-tasks.api.ts`) exactly once per confirmed delete, setting `isDeleting: true` for the call's duration. On a successful `204` response, the page SHALL close the confirmation dialog, invalidate or refresh any Scheduled Task queries it holds, show a localized success notification, and navigate to `ROUTES.ScheduledTasks`, leaving no browser-visible application state referencing the deleted task's detail page. On failure, the page SHALL keep the user on the detail page with the previously loaded task data intact, set `isDeleting: false`, allow the user to retry, and show an actionable error notification that distinguishes an already-deleted/not-found failure (upstream 404/409) from a retryable scheduler-unregistration failure (upstream 502) with their localized messages; for any other failure it SHALL show the response's `upstreamMessage` from DIAL Scheduler when present, else a third localized generic message. The page SHALL NOT navigate away from the detail page, and SHALL NOT remove or mark the task as deleted in its own state, before receiving a successful `204` response.

#### Scenario: Successful delete closes the dialog, notifies, and navigates to the list

- **WHEN** `deleteScheduledTask(scheduleId)` resolves with `204`
- **THEN** the confirmation dialog closes, a localized success notification is shown, and the app navigates to `ROUTES.ScheduledTasks`

#### Scenario: Not-found/already-deleted failure keeps the user on the page with a distinct message

- **WHEN** `deleteScheduledTask(scheduleId)` rejects with an upstream-mapped 404 or 409
- **THEN** the user remains on the detail page, the task's previously loaded data is unchanged, `isDeleting` becomes `false`, and a localized "already deleted / not found" error notification is shown

#### Scenario: Retryable scheduler failure keeps the user on the page with a distinct message

- **WHEN** `deleteScheduledTask(scheduleId)` rejects with an upstream-mapped 502
- **THEN** the user remains on the detail page, the task's previously loaded data is unchanged, `isDeleting` becomes `false`, and a localized retryable-error notification is shown that does not claim the task was deleted

#### Scenario: Generic failure keeps the user on the page

- **WHEN** `deleteScheduledTask(scheduleId)` rejects with any error other than a mapped 404/409/502 and without `upstreamMessage`
- **THEN** the user remains on the detail page, the task's previously loaded data is unchanged, `isDeleting` becomes `false`, and a localized generic error notification is shown

#### Scenario: Generic failure with a Scheduler reason shows that reason

- **WHEN** `deleteScheduledTask(scheduleId)` rejects with `400 { upstreamMessage: "Schedule is running; retry later" }`
- **THEN** the user remains on the detail page and the notification text is `Schedule is running; retry later`

#### Scenario: No optimistic removal before a confirmed 204

- **WHEN** a `deleteScheduledTask(scheduleId)` call is in flight and has not yet resolved
- **THEN** the task's data remains fully visible and unmodified on the detail page, and no navigation has occurred

### Requirement: Soft-deleted task renders as a read-only deleted state

When `ScheduledTaskDetailPage` loads a task whose `isDeleted` is `true` — whether reached via a direct URL, a stale bookmark, or an existing conversation link — the page SHALL pass `isDeleted: true` to `ScheduledTaskDetailView` and SHALL NOT supply `onEdit`, `onDelete`, or `isActive`/`onActiveChange` for that render, so the view suppresses Edit, Delete, and the Active switch and instead renders a read-only deleted-state indicator using the existing UI conventions for status badges. The Details, Configuration, and History sections SHALL continue to render using the task's last-known data and run history, exactly as they do for a non-deleted task, since run history remains available for a soft-deleted schedule per the upstream contract. The page SHALL NOT offer any restore action.

#### Scenario: Direct navigation to a soft-deleted task's URL renders it read-only

- **WHEN** the user navigates directly to `/scheduled-tasks/:scheduleId` for a schedule whose `GET` response has `isDeleted: true`
- **THEN** the page renders the deleted-state indicator, and none of Edit, Delete, or the Active switch are present or enabled

#### Scenario: History remains visible for a soft-deleted task

- **WHEN** a soft-deleted task's detail page renders
- **THEN** the History panel renders the task's run history exactly as it would for a non-deleted task

#### Scenario: No restore action is offered

- **WHEN** a soft-deleted task's detail page renders
- **THEN** no restore/undelete control is present anywhere on the page

### Requirement: Detail page strings flow through react-i18next

Every user-visible string on the Scheduled Task Detail page (section titles, back control accessible label, Active switch label and status announcements, Delete action label, deletion confirmation dialog title/description/Cancel/confirm/loading labels, deletion success/error notifications, deleted-state label, run status labels, empty-history label, error/retry labels, loading-more indicator) MUST be resolved via `useTranslation().t()` in `ScheduledTaskDetailPage` and passed into `ScheduledTaskDetailView` as plain strings. New keys MUST live under a `scheduledTasks.detail` namespace in `apps/chat/src/i18n/locales/en.json` and be referenced through the existing `ScheduledTasksI18nKeys` enum (or a new enum in the same file) in `apps/chat/src/constants/translation-keys.ts`. Section titles and field labels shared with the create form reuse their `scheduledTasks.create.*` keys (`detailsSectionTitle`, `configurationSectionTitle`, `instructionsLabel`, `backButtonLabel`, `descriptionLabel`, `modelOrAgentLabel`, `skillLabel`), the Edit label reuses `ScheduledTasksI18nKeys.CardEditActionLabel`, the retry labels reuse `ScheduledTasksI18nKeys.ListRetryLabel`, and "Show more" reuses `ButtonsI18nKeys.ShowMore`. Existing generic labels (e.g. "Retry", "Loading…", `ButtonsI18nKeys.Delete`, `ButtonsI18nKeys.Cancel`) MUST be reused from `ButtonsI18nKeys` or another shared namespace where an equivalent already exists, rather than duplicated under a new key. The Active switch's visible label key (`scheduledTasks.detail.activeStatusLabel`) MUST be distinct from the existing `scheduledTasks.detail.activeWindowLabel` key (`ScheduledTasksI18nKeys.DetailActiveWindowLabel`), which refers to the cron activity date window shown in the Details column and is unrelated to this switch, even though both currently render the English word "Active".

#### Scenario: Detail keys are present in en.json

- **WHEN** the change is applied
- **THEN** `en.json` contains `scheduledTasks.detail.historyTitle`, `scheduledTasks.detail.historyEmptyLabel`, `scheduledTasks.detail.historyErrorLabel`, `scheduledTasks.detail.historyLoadingMoreLabel`, `scheduledTasks.detail.repeatsLabel`, `scheduledTasks.detail.errorLabel`, status labels `scheduledTasks.detail.statusSuccess`/`statusError`/`statusInProgress`/`statusMissed`, `scheduledTasks.detail.activeStatusLabel`, `scheduledTasks.detail.pauseSuccess`, `scheduledTasks.detail.resumeSuccess`, and `scheduledTasks.detail.activeStatusUpdateError`

#### Scenario: Delete-related keys are present in en.json

- **WHEN** the change is applied
- **THEN** `en.json` contains `scheduledTasks.detail.deleteConfirmTitle`, `scheduledTasks.detail.deleteConfirmDescription`, `scheduledTasks.detail.deleteConsequenceConversationsAccessible`, `scheduledTasks.detail.deleteSuccess`, `scheduledTasks.detail.deleteNotFoundError`, `scheduledTasks.detail.deleteRetryableError`, `scheduledTasks.detail.deleteGenericError`, `scheduledTasks.detail.deletedStateLabel`, and `scheduledTasks.typeLabel`
- **AND** the Delete action, confirm button, and Cancel reuse `buttons.delete` / `buttons.cancel`, while the "Cannot be undone" bullet and the in-flight "Deleting…" status reuse `basic.consequenceCannotBeUndone` / `basic.deletingStatus`, with no `scheduledTasks.detail.*` duplicate of any of them

#### Scenario: Lib receives strings, not translation keys

- **WHEN** `ScheduledTaskDetailPage` renders `<ScheduledTaskDetailView />`
- **THEN** every string-typed prop passed to it is the result of `t(SomeI18nKeys.Member)`, never a raw i18n key or hard-coded English literal

#### Scenario: Active switch label is not the cron-window label

- **WHEN** the Active switch and the Details column's cron activity-window field both render on the same page
- **THEN** the switch's accessible name is resolved from `scheduledTasks.detail.activeStatusLabel`, and the Details column's window field is resolved from `scheduledTasks.detail.activeWindowLabel` — two distinct keys, not a shared key

### Requirement: Detail page supports RTL and meets AAA accessibility defaults

All directional layout in the detail page header, Details/Configuration sections, History panel, and the delete confirmation dialog MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) per `.claude/rules/rtl.md`. The back control's directional icon MUST be mirrored in RTL via `rtl:scale-x-[-1]` or an equivalent; the delete icon is symmetric and MUST NOT be mirrored. The Active switch and the Delete action MUST NOT be mirrored in RTL and MUST remain at the inline end of the header, in the order Active → Delete → Edit, in both LTR and RTL. The switch MUST expose native switch semantics or `role="switch"` with `aria-checked` reflecting its current state, an accessible name matching the localized "Active" label, a visible focus indicator matching its hover treatment, a disabled state exposed via the native `disabled` attribute while updating, and a minimum 44×44 CSS pixel touch target on mobile. The Delete action MUST expose an accessible name equal to its localized "Delete" label, a minimum 44×44 CSS pixel touch target, a visible focus indicator matching its hover treatment, and (when disabled during an in-flight delete or a loaded-deleted task) the native `disabled` attribute rather than a purely visual disabled treatment. The confirmation dialog MUST expose an accessible title and description, trap focus while open, support closing via `Escape`, and restore focus to the Delete action on close without a completed deletion. A successful pause or resume MUST be announced via an `aria-live="polite"` status region separate from the switch's own accessible name (which stays "Active" in both states); a failed pause/resume MUST use the established notification/alert pattern rather than the `aria-live` region alone. Deletion success and failure notifications MUST be announced through the application's existing accessible live-region/notification pattern. The History panel SHALL be marked up as a `<ul>`/`<li>` list with each `<li>` exposing an accessible name that includes the run's status and timestamp (per the "History rows show skeleton loading, status icon, timestamp, and duration" requirement). Status-icon-only, switch-color-only, and Delete-icon-color-only visual differences MUST NOT be the sole means of conveying state to assistive technology.

#### Scenario: Detail page mirrors under RTL without flipping the switch or the delete icon

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the header, Details/Configuration sections, History panel, and delete confirmation dialog lay out mirrored, the back icon is visually flipped, and neither the Active switch nor the Delete icon is mirrored, with both remaining at the inline end in the order Active → Delete → Edit

#### Scenario: Delete action meets AAA target size and accessible name

- **WHEN** the Delete action renders
- **THEN** it exposes an accessible name equal to the localized "Delete" label and a touch target of at least 44×44 CSS pixels

#### Scenario: Confirmation dialog traps focus and supports Escape

- **WHEN** the confirmation dialog is open
- **THEN** keyboard focus is trapped within the dialog, pressing `Escape` closes it without an API call, and closing it without a completed deletion restores focus to the Delete action

#### Scenario: Deletion outcome is announced accessibly

- **WHEN** a delete request succeeds or fails
- **THEN** the corresponding localized notification is announced through the application's accessible live-region/notification pattern, not conveyed by visual change alone

#### Scenario: Active switch exposes native switch semantics and state

- **WHEN** the Active switch renders with `isActive: true`
- **THEN** it exposes `role="switch"` (or native switch semantics) with `aria-checked="true"`, an accessible name equal to the localized "Active" label, and a visible focus indicator when focused via keyboard

#### Scenario: Successful pause/resume is announced via aria-live

- **WHEN** a pause or resume mutation completes successfully
- **THEN** an `aria-live="polite"` region announces the localized success message (`scheduledTasks.detail.pauseSuccess` or `scheduledTasks.detail.resumeSuccess`), separate from the switch's own accessible name

#### Scenario: History list uses semantic list markup with accessible row names

- **WHEN** a screen reader user navigates into the History panel
- **THEN** the panel is exposed as a list (`<ul>`/`<li>` or equivalent ARIA list role), and each row's accessible name conveys both its status and its timestamp

### Requirement: Active switch toggles pause/resume with optimistic update and rollback

`ScheduledTaskDetailPage` SHALL wire the Active switch's `onActiveChange` callback to call `pauseScheduledTask(scheduleId)` when the requested value is `false`, or `resumeScheduledTask(scheduleId)` when the requested value is `true`, exactly once per toggle, while `isActiveUpdating` is `true` for the duration of that call. Before the call resolves, the page SHALL optimistically display the requested `isActive` value. On success, the page SHALL replace its task state with the returned `ScheduledTaskDto` (so its `isActive` and `nextRunTime` take effect) and show the corresponding localized success message (`scheduledTasks.detail.pauseSuccess` / `scheduledTasks.detail.resumeSuccess`). On failure, the page SHALL revert `isActive` to its pre-toggle value, leave the rest of the loaded task state unchanged, and show an error notification that includes the request/trace id when the error response provides one, whose message `resolveScheduledTaskErrorMessage` (`apps/chat/src/utils/map-scheduled-task-dto.ts`) chooses from the `getApiErrorDetails` result: `toolsetSignin.adminConsentRequired` when `code` is `scheduledTaskAdminConsentRequired`, else a non-empty `upstreamMessage` from DIAL Scheduler as received, else the localized `scheduledTasks.detail.activeStatusUpdateError`; the BFF's generic `message` is never displayed. While a pause/resume call is in flight, the switch SHALL be disabled so a second toggle cannot start an overlapping request. A pause/resume response that resolves after the user has navigated away from the schedule it was requested for (`scheduleId` changed or the page unmounted) SHALL NOT update any component state. This flow SHALL NOT issue a `PUT` to `updateScheduledTask` and SHALL NOT modify `trigger`, `model`, `prompt`, or `description`, and SHALL NOT trigger a run-history refetch.

#### Scenario: Turning the switch off pauses the task exactly once

- **WHEN** the user toggles the Active switch from on to off
- **THEN** `pauseScheduledTask(scheduleId)` is called exactly once, the switch immediately shows unchecked and disabled, and no `updateScheduledTask` call is made

#### Scenario: Turning the switch on resumes the task exactly once

- **WHEN** the user toggles the Active switch from off to on
- **THEN** `resumeScheduledTask(scheduleId)` is called exactly once, the switch immediately shows checked and disabled, and no `updateScheduledTask` call is made

#### Scenario: Successful pause updates state and shows a success message

- **WHEN** `pauseScheduledTask` resolves successfully
- **THEN** the switch remains unchecked and re-enabled, the stale next-run label is removed or refreshed from the returned `ScheduledTaskDto`, and a localized success notification is shown

#### Scenario: Successful resume updates state and shows the recalculated next-run time

- **WHEN** `resumeScheduledTask` resolves successfully
- **THEN** the switch remains checked and re-enabled, the next-run label reflects the returned `ScheduledTaskDto.nextRunTime`, and a localized success notification is shown

#### Scenario: Failed toggle rolls back to the previous state and preserves the rest of the page

- **WHEN** `pauseScheduledTask` or `resumeScheduledTask` rejects without a known code or `upstreamMessage`
- **THEN** the switch reverts to its pre-toggle checked/unchecked state, re-enables, the rest of the detail page (Details, Configuration, History) remains visible and unaffected, and a localized `scheduledTasks.detail.activeStatusUpdateError` notification is shown including the request/trace id when available

#### Scenario: Resume blocked by revoked consent shows the admin-consent message

- **WHEN** the user turns the Active switch on and `resumeScheduledTask` rejects with `403 { code: "scheduledTaskAdminConsentRequired" }`
- **THEN** the switch reverts to unchecked and re-enables, and an error notification with `toolsetSignin.adminConsentRequired` is shown

#### Scenario: Toggle failure shows the Scheduler's reason

- **WHEN** `pauseScheduledTask` rejects with `502 { upstreamMessage: "Schedule is locked by another operation" }`
- **THEN** the switch reverts and the notification text is `Schedule is locked by another operation`

#### Scenario: Rapid interaction cannot produce overlapping requests

- **WHEN** the user attempts to toggle the switch again while a previous pause/resume call is still in flight
- **THEN** the switch is disabled during the in-flight call and the second interaction has no effect until the first call resolves

#### Scenario: A stale response cannot update a different task after navigation

- **WHEN** the user navigates away from `/scheduled-tasks/sched_123` (unmount or `scheduleId` change) while a pause/resume call for `sched_123` is still in flight, and that call later resolves
- **THEN** no component state is updated as a result of that resolution

### Requirement: Active switch is hidden for completed tasks, disabled only when the completed signal degrades

`ScheduledTaskDetailPage` SHALL pass `isCompleted={true}` to `ScheduledTaskDetailView` when the loaded task has `isCompleted: true`, and the view SHALL NOT render the Active switch (nor any disabled-switch reason) in that case — a completed task cannot produce another automatic run from its exhausted trigger, so no dead-end control is offered; the completed line in the details summary carries the state. When the BFF's `isCompleted` is `undefined` or `false` but the loaded task's fields show it can no longer produce a future automatic run — the enrichment degraded (a failed runs check) or a run is still in flight — the page SHALL pass `isActiveDisabled={true}` so the switch still renders (since `isActive` is defined) but disabled, with an explanatory reason label (a `labels` entry with an English default, localized by the page). Two field shapes qualify for the disabled fallback:

- **Completed one-time schedule:** `triggerType` is `date` (one-time) and `nextRunTime` is `null` — the schedule has already run once and a `date` trigger cannot be rescheduled.
- **Expired recurring schedule:** `triggerType` is `cron` and `trigger.cron.endDate` is a past timestamp — the schedule's activity window has closed, so resuming it cannot produce a future run within that window either.

A recurring (`cron`) schedule with no upcoming run but an `endDate` that has not yet passed (or no `endDate` at all) is merely paused, not exhausted, and MUST remain togglable.

#### Scenario: Completed one-time task renders no switch at all

- **WHEN** the loaded task has `isCompleted: true`, `triggerType: 'date'`, and `nextRunTime: null`
- **THEN** no Active switch and no disabled-switch reason render, the details summary shows the completed line, and neither `pauseScheduledTask` nor `resumeScheduledTask` can be called from the page

#### Scenario: Recurring schedule whose activity window has ended renders no switch

- **WHEN** the loaded task has `isCompleted: true` and `triggerType: 'cron'` with a past `trigger.cron.endDate`
- **THEN** no Active switch renders and the details summary shows the completed line

#### Scenario: Degraded completed signal keeps the switch visible but disabled with a reason

- **WHEN** the loaded task omits `isCompleted` (a failed runs check) and has `triggerType: 'date'` with `nextRunTime: null`
- **THEN** the Active switch renders unchecked and disabled with the explanatory reason label visible, and toggling it (via pointer or keyboard) has no effect and calls neither `pauseScheduledTask` nor `resumeScheduledTask`

#### Scenario: Recurring schedule with no upcoming run remains togglable

- **WHEN** the loaded task has `triggerType: 'cron'`, `nextRunTime: null` (paused, not completed), and `trigger.cron.endDate` is absent or in the future
- **THEN** the Active switch renders unchecked but NOT disabled, no reason label is shown, and toggling it on calls `resumeScheduledTask`

Manual execution is independent of the Active switch: a non-deleted completed task SHALL still offer Start now under the manual-run requirements.

#### Scenario: Completed task is manually runnable

- **WHEN** a completed non-deleted task has no known InProgress run
- **THEN** the Active switch remains hidden while Start now is available without resuming the schedule

### Requirement: Detail and history layout have public per-instance settings

ScheduledTaskDetailView SHALL expose className, backIcon, typed column layout and forwarded historyStyles. The Details/Configuration divider SHALL stretch the full shared desktop content height. History SHALL expose maxHeight, rowMinHeight, hover/focus colors and retain its own vertical scroll. An interactive run row SHALL show a visible hover background even when the host configures none: `rowHoverBackground` (`--strhl-row-hover-bg`) defaults to `--bg-control-accent-alpha`, and `rowFocusBackground` (`--strhl-row-focus-bg`) defaults to the hover background. Responsive fallback SHALL preserve existing mobile tabs; no structural child selectors SHALL be needed by a host.

#### Scenario: Short metadata does not shorten the divider

- **WHEN** Details text is shorter than Configuration content in desktop columns
- **THEN** the divider spans the shared content height.

#### Scenario: Wider history is configurable without stealing configuration width

- **WHEN** the host configures the design.md column sizes including history up to 408px
- **THEN** history expands within available space, configuration retains its minimum, and the layout falls back rather than causing horizontal overflow.

#### Scenario: History interactions and empty label are configurable

- **WHEN** a history row is hovered or keyboard-focused, or there are no runs
- **THEN** the configured interaction background/focus treatment is visible, falling back to `--bg-control-accent-alpha` when the host configures none; an empty panel renders the host label, including 'No tasks runs yet' when supplied.

### Requirement: Details show independent metadata and load states

The app SHALL use trigger-only descriptions and host-resolved model display names with stored-id fallback. It SHALL preserve explicit not-found/retry states already required by the detail specification. History initial and incremental errors SHALL be separate from task loading; later-page failure SHALL preserve runs.

#### Scenario: Model name is resolved for display

- **WHEN** a task model id resolves to a deployment with a display name
- **THEN** details show that name; unresolved ids remain visible as raw-id fallback.

#### Scenario: Task not-found never becomes a blank page

- **WHEN** getScheduledTask returns 404
- **THEN** the existing NotFound content renders.

#### Scenario: History retry does not erase task details or prior runs

- **WHEN** task details and first history page succeeded but the next runs request fails
- **THEN** details and runs remain visible and the retry targets only the failed history page.

### Requirement: Delete confirmation presentation is reusable and host-configurable

`@epam/ai-dial-scheduled-tasks` SHALL export `ScheduledTaskDeleteConfirmation`, a thin composition of the shared `ConfirmationDialog`, `ConfirmationIdentityCard`, and `ConfirmationIdentityRow` from `@epam/ai-dial-chat-shared` (see the `shared-delete-confirmation` spec), always in the `ConfirmationPopupVariant.Danger` variant. Its props are the controlled `open` and `isDeleting` state; `taskName`; a host-supplied `icon` and `typeLabel` for the identity card; host-provided `title` (a `string`, not a `ReactNode`, because the kit names the dialog only from a string header), `body` (`ReactNode`, so the host can bold the task name), `consequences`, `cancelLabel`, `confirmLabel`, and `pendingLabel`; `onConfirm` / `onClose`; and `styles` (`popupClassName`, `titleClassName`, `messageClassName` defaulting to `'dial-body-paragraph-text'`, and `colors.typeLabelText`). It SHALL NOT carry its own Tailwind colors, its own button row, or a cancel-appearance switch — Cancel is always the shared footer's text button. It SHALL render safe React content and contain no API, routing or i18n imports. The parent SHALL retain mutation, notification and navigation ownership.

#### Scenario: Host supplies the complete deletion design

- **WHEN** the host passes the title 'Delete task', a clock icon, the type label 'Scheduled task', a body with the bolded task name, and the consequence bullets
- **THEN** the confirmation renders the danger identity card (icon, uppercased type, name), the body, the bullets, a text Cancel, and a danger Delete with a leading trash icon, without private selectors or hardcoded package English.

#### Scenario: Cancel and confirm have distinct effects

- **WHEN** the user cancels or confirms an idle dialog
- **THEN** Cancel requests close without mutation; Confirm invokes the supplied confirmation callback once per activation.

#### Scenario: Pending deletion prevents duplicate actions and dismissal

- **WHEN** isDeleting is true and the user activates actions, Escape or backdrop
- **THEN** no further confirm or dismissal callback is emitted and pending feedback is accessible.

#### Scenario: Task name remains data

- **WHEN** a task name contains markup-like characters
- **THEN** the name is rendered as text/React content and never executed as HTML.

### Requirement: Details summary shows the completed state for terminal tasks

When the loaded task has `isCompleted: true` (a finished one-time schedule, or a recurring schedule whose activity window has closed), `ScheduledTaskDetailView` SHALL render a completed line in the details summary (label from a required `labels` entry, like the section's other field labels, localized by the page via a `ScheduledTasksI18nKeys` member — the lib carries no English fallback). The completed line SHALL be informational text, not a control, and SHALL NOT replace or hide the existing summary fields (schedule, next run, timestamps).

#### Scenario: Completed task shows the completed line

- **WHEN** the detail page loads a task with `isCompleted: true`
- **THEN** the details summary renders the localized completed line alongside the existing fields

#### Scenario: Non-completed task shows no completed line

- **WHEN** the detail page loads a task with `isCompleted: false` or omitted
- **THEN** the details summary renders exactly as before this change, with no completed line

### Requirement: Skill display covers reusable summaries and the active Configuration view

`ScheduledTaskDetailsSummary` and `ScheduledTaskConfigurationSection` SHALL accept optional localized `skillLabel` and resolved `skillDisplayNames: string[]`; `ScheduledTaskDetailView` SHALL forward its optional skill value and label to Configuration. The host SHALL pass the skill's resolved display name or full raw reference, independent of catalog loading/failure. No skill SHALL produce no Skill field. Values SHALL be plain text, without a details link. Libraries SHALL perform no lookup or navigation.

The full detail page SHALL render Skill above Instructions in Configuration on desktop and in the mobile Configuration tab, preserving Model in Details. The conversation sources panel SHALL pass the same saved-task metadata to the reusable summary, ordered Model, Skill, Instructions. Skill-only tasks SHALL render without an empty Instructions block or an empty Configuration section. Lookup failure SHALL NOT replace task content with an error screen. The page root SHALL clip overflow: the active mobile tab owns the body scrollbar, while the desktop body is a non-wrapping clipped row whose Details, Configuration, and History columns scroll independently beneath the fixed header. The existing detail task state remains the source of truth; no new context is added.

#### Scenario: Present skill resolves to a readable name

- **WHEN** task detail or its conversation sources panel has a saved skill and readable metadata
- **THEN** Skill displays the name above Instructions in the relevant reusable surface

#### Scenario: Deleted unreadable or loading skill metadata

- **WHEN** the saved reference cannot be resolved because it is deleted, unreadable, loading, or lookup failed
- **THEN** the full reference is displayed as text, other task metadata remains visible, and no broken details link appears

#### Scenario: No skill preserves the established view

- **WHEN** a task has instructions and no skill
- **THEN** no Skill label or empty placeholder is rendered and existing Model/Instructions content is unchanged

#### Scenario: Skill-only task on mobile and RTL

- **WHEN** a skill-only task is viewed in a narrow RTL Configuration tab
- **THEN** the Skill field remains visible, wraps its name/reference, inherits direction, and no empty instructions field is shown
### Requirement: Detail view body renders section tabs at mobile and tablet

`ScheduledTaskDetailView` SHALL branch its body layout on the app-wide mobile boundary (`useIsMobile` from `@epam/ai-dial-chat-shared`, `(max-width: 1279px)`), mounting exactly one layout's subtree at a time — never mounting both layouts and hiding one with CSS.

Below the desktop breakpoint (mobile and tablet), the body SHALL render a tab row (`Tabs` from `@epam/ai-dial-ui-kit`, generation 2.0) with exactly three tabs, in this order: **Details**, **Configuration**, **History**. Tab labels SHALL reuse the existing section-title label strings (`detailsTitle`, `configurationTitle`, `historyTitle`) — no new i18n keys. The **Details** tab SHALL be active by default, and tab selection SHALL be internal component state that survives a viewport resize across the boundary. Exactly one section's content SHALL be visible at a time; activating a tab SHALL swap the visible panel. Tabs SHALL NOT render count badges.

The tab row SHALL expose an accessible name (from an optional `tabsAriaLabel` label with an English default). Each visible panel SHALL expose `role="tabpanel"` with an accessible name matching its tab's label (via `aria-label`, or `aria-labelledby` when the kit's tab elements expose referenceable ids).

The three section bodies (Details fields, Configuration instructions, History run list) SHALL be extracted into presentational section components (`ScheduledTaskDetailsSection`, `ScheduledTaskConfigurationSection`, `ScheduledTaskHistorySection`) and both layouts SHALL compose those same components, so section content is identical across breakpoints. At the desktop breakpoint (≥1280px) the body SHALL render no tab row and SHALL render all three sections simultaneously in the existing three-column layout, each column keeping its `<h2>` section title. `ScheduledTaskDetailsSection` and `ScheduledTaskConfigurationSection` SHALL NOT be re-exported from the lib's public API; `ScheduledTaskHistorySection` (with its `ScheduledTaskHistorySectionStyles` type) is exported from `@epam/ai-dial-scheduled-tasks`.

#### Scenario: Mobile renders the tab row in order with Details active by default

- **WHEN** `ScheduledTaskDetailView` renders below the desktop breakpoint with a loaded task
- **THEN** the body renders a tab row whose tabs read Details, Configuration, History in that order, the Details tab is the active one, and only the Details section's content is visible

#### Scenario: Activating a tab swaps the visible panel

- **WHEN** the user activates the History tab on a mobile/tablet body
- **THEN** the History run list becomes the visible panel, the previously visible section's content is no longer rendered, and no `onRunClick`/`onRunsLoadMore` behavior differs from the desktop History panel

#### Scenario: Desktop renders three columns and no tab row

- **WHEN** `ScheduledTaskDetailView` renders at the desktop breakpoint with a loaded task
- **THEN** no tab row is present, and the Details, Configuration, and History sections render simultaneously in the three-column layout, each with its `<h2>` section title

#### Scenario: Section content is identical across breakpoints

- **WHEN** the same loaded task renders below and at the desktop breakpoint
- **THEN** each section shows the same field values, instructions rendering, and run rows in both layouts — only the container chrome (tabs + panel vs. three columns with titles) differs

#### Scenario: Tab selection survives a viewport resize across the boundary

- **WHEN** the History tab is active and the viewport is resized past the boundary to desktop and back below it
- **THEN** the History tab is still the active tab when the tab row re-renders

#### Scenario: Tablist and panels expose accessible names

- **WHEN** the mobile/tab body renders
- **THEN** the tab row exposes an accessible name, and the visible panel exposes `role="tabpanel"` with an accessible name matching its tab's label

#### Scenario: Tabs render no count badges

- **WHEN** the tab row renders at any breakpoint
- **THEN** no tab renders a count or badge value

### Requirement: Start now immediately exposes the accepted run in History

`ScheduledTaskDetailPage` SHALL use a page-scoped app hook `useStartScheduledTask` in `apps/chat/src/hooks/scheduled-tasks/` for manual-run mutation state, accepted run DTOs and status tracking; the existing `useScheduledTaskRuns` SHALL retain history pagination ownership. No new context SHALL be introduced. The feature SHALL inherit `scheduledTasksEnabled` and its existing role policy.

For a loaded, non-deleted task, Start now SHALL execute the saved definition through `startScheduledTask(scheduleId)` exactly once per activation, with no confirmation dialog or payload override. The action SHALL be disabled while its POST is pending, deletion or Active mutation is pending, or any known run is InProgress. A synchronous guard SHALL prevent duplicate dispatch before the disabled state renders. Paused, completed and expired schedules SHALL remain manually runnable; the operation SHALL NOT resume or edit them.

After HTTP 202, History SHALL immediately include the returned real run id, timestamp and InProgress spinner before older entries. No optimistic fabricated row SHALL be added before acceptance. Entries SHALL be deduplicated by id without discarding loaded pages or changing the underlying pagination offset. An earlier list response SHALL NOT erase the new row or downgrade its confirmed terminal status. Accepted rows SHALL remain visible even if the independent initial history request is pending or fails; history errors SHALL remain scoped with retry alongside available rows.

The page SHALL NOT refetch schedule or task-list metadata or change its loaded trigger, Active state, next-run label or update timestamp on start. This restriction SHALL NOT prevent conversation-list refreshes: acceptance or status polling that exposes a conversation id, and subsequent run-status changes, SHALL trigger shared unread-metadata discovery as specified in [scheduled-task-unread-tracking](../scheduled-task-unread-tracking/spec.md). Run rows without a conversation id SHALL remain non-navigable. Once a response supplies a conversation id, existing navigation/unread behavior SHALL apply without automatic navigation.

The library SHALL receive only optional `onStartNow`, `isStarting`, `isStartNowDisabled` and localized label/announcement props described in design.md. It SHALL NOT import app hooks, clients, auth, routing or i18n. Existing hosts omitting the action SHALL retain current behavior. The app SHALL memoize merged run items/labels and stabilize supplied callbacks.

#### Scenario: New row appears before any polling response

- **WHEN** Start now returns 202 with an InProgress run while previous history is loaded
- **THEN** that run appears exactly once as the newest row with a spinner and no duration/link, all previous rows remain, and schedule metadata is unchanged

#### Scenario: First ever run replaces empty history

- **WHEN** an empty task history receives an accepted run
- **THEN** the empty-state message is replaced by the accepted InProgress row

#### Scenario: Acceptance survives a pending or failed history fetch

- **WHEN** the POST succeeds before initial history finishes or after that independent fetch fails
- **THEN** the accepted row is visible, and history loading/error feedback does not hide it

#### Scenario: Double click and an existing active run

- **WHEN** the user activates Start now twice in one render cycle or while a known run is InProgress
- **THEN** no overlapping POST is sent and the disabled action exposes the localized pending/busy reason

#### Scenario: A known in-progress run exposes the busy reason

- **GIVEN** the merged History contains a run whose status is InProgress and no Start now POST is pending
- **THEN** `ScheduledTaskDetailPage` passes `isStartNowBusy` and `labels.startNowBusyLabel = t(scheduledTasks.detail.startBusy)` to `ScheduledTaskDetailView`
- **AND** the Start now action renders disabled (`aria-disabled`, still focusable, click ignored) with that reason as its UI Kit tooltip and as its `aria-describedby` description
- **AND** while the POST itself is pending the action shows the `starting` label with `aria-busy` instead of the busy reason

#### Scenario: Paused or completed task runs without rescheduling

- **WHEN** Start now is activated for a non-deleted paused/completed task
- **THEN** the task is started without resume/update or task-list invalidation, and the next scheduled fire is unchanged; conversation discovery remains available

#### Scenario: Start now discovers a new unread chat

- **WHEN** acceptance or a status response supplies the manual run's conversation id
- **THEN** the page requests shared conversation metadata and shows the backend unread state without marking the chat viewed
- **AND** opening that chat applies the shared viewed-state behavior even if its metadata arrives after navigation

#### Scenario: Pagination overlaps with an accepted run

- **WHEN** initial, load-more or background history responses contain the accepted run or older snapshots
- **THEN** rows are deduplicated, previous pages remain available, and terminal status cannot regress to InProgress

### Requirement: Manual run tracking is bounded and scoped to the current task

The app hook SHALL poll `getScheduledTaskRun(scheduleId, returnedRunId)` every two seconds while InProgress, with at most one GET in flight and an absolute 70-second deadline from acceptance. It SHALL update the existing row by id and stop on terminal status (including one learned from ordinary history refresh), unmount, task-id change or feature disablement. Ordinary shared-history polling SHALL retain its current 15-second behavior. Hidden tabs SHALL pause fast network polling; visibility restoration SHALL request at most one catch-up within the original deadline.

On deadline/transient poll failure, the UI SHALL retain the last confirmed status and expose scoped feedback and Refresh status, which SHALL issue a GET only. The deadline SHALL NOT create an Error status or enable another start while the known run remains InProgress. 401 SHALL follow existing session-expiry handling; 403/404 SHALL stop fast polling with scoped feedback. Transient errors SHALL remain bounded by the deadline; rate limiting SHALL respect Retry-After when present. Timers/read requests SHALL be cleaned up and stale POST/GET outcomes ignored across schedule generations. Stopping observation SHALL NOT claim to cancel server execution.

#### Scenario: Run finishes successfully

- **WHEN** a status GET returns Success with end time and conversation id
- **THEN** the existing row displays completion/duration, becomes navigable, announces completion once and stops fast polling

#### Scenario: Polling deadline is reached

- **WHEN** the run still reports InProgress at 70 seconds
- **THEN** fast polling stops, the row remains InProgress, Start now remains disabled, and Refresh status performs one GET without starting another run

#### Scenario: User leaves while requests are pending

- **WHEN** the task id changes, the page unmounts or the feature becomes disabled before POST/GET resolution
- **THEN** pending timers/read requests are cleaned up and late responses cause no rows, notifications or state changes for another task

#### Scenario: A hidden tab becomes visible

- **WHEN** the tab returns before or after the absolute deadline
- **THEN** it performs at most one catch-up GET before the deadline, or offers status refresh after it, without extending fast polling indefinitely

### Requirement: Start and execution failures remain actionable

POST rejection SHALL create no fabricated History row. 404 SHALL show the localized not-found message; 409 SHALL show that a deleted task cannot run and disable Start now until detail retry establishes eligibility. For every other failure, the error notification SHALL include the trace id when present and use `resolveScheduledTaskErrorMessage`: `toolsetSignin.adminConsentRequired` for `scheduledTaskAdminConsentRequired`, then a non-empty Scheduler `upstreamMessage`, then the localized `scheduledTasks.detail.startError` fallback. Ambiguous network/5xx outcomes without an upstream reason SHALL say acceptance could not be confirmed and recommend checking History. No automatic POST retry SHALL occur.

An Error run with `resultStage === 'credentials'` SHALL retain its History row and show a sign-in-to-DIAL-Chat prompt instead of a generic task-failure notification. The app SHALL reuse its existing offline-credentials login behavior/banner, initiated by the user. Successful login SHALL NOT automatically rerun the task. Ordinary terminal errors SHALL continue to display Error in History.

#### Scenario: Deleted task is rejected after the page loaded

- **WHEN** Start now returns 409 after the task was deleted elsewhere
- **THEN** the UI reports that a deleted task cannot run, inserts no new row, and disables the action until detail retry

#### Scenario: Acceptance is uncertain after a network failure

- **WHEN** the POST response is lost or fails with an ambiguous server/network error
- **THEN** the UI offers the localized check-History message without fabricating a run or automatically repeating the POST

#### Scenario: Credential recovery does not rerun silently

- **WHEN** the tracked run ends with Error and `resultStage: "credentials"`, and the user completes the offered login
- **THEN** the failed row remains in History and any subsequent run requires a new explicit Start now activation

### Requirement: Start now supports localization responsive layout and accessibility

The app SHALL translate all new UI strings using the `scheduledTasks.detail` keys `startNow`, `starting`, `startAccepted`, `startBusy`, `startNotFound`, `startDeleted`, `startError`, `runStatusUnavailable`, `runStatusDelayed`, `refreshRunStatus`, `runCredentialsRequired` and `runFinished`, plus existing status/login labels. Libraries SHALL receive resolved strings as props. The action SHALL use a generation-2 UI Kit button and a decorative Tabler play icon with `DIAL_KIT_ICON_STROKE`.

Desktop SHALL show Start now after Edit. Below 1280px, header actions SHALL wrap as needed, retain the Start now text, and use at least 44-by-44px touch targets without horizontal overflow at 360px; existing Details/Configuration/History tabs and selection SHALL remain. Acceptance SHALL be announced even when the History tab is not selected, without switching tabs or stealing focus. RTL SHALL inherit direction, use logical properties and mirror navigation arrows; the media-play symbol SHALL remain direction-independent.

Keyboard Enter/Space SHALL invoke the same guarded action. Decorative icons SHALL be aria-hidden. Pending controls SHALL expose disabled/busy state, acceptance/completion SHALL use a polite live region with no repeated announcements on unchanged polls, and errors SHALL use an alert. The delayed-status Refresh status control SHALL use a generation-2 `GhostButton` with a minimum 44px touch target; the status text itself SHALL not create a second live announcement. Completion announcements SHALL interpolate the localized run-status label, never the raw Scheduler status enum. Focus visibility and text contrast SHALL satisfy the repository AAA target. Existing HTTP observability suffices; no new analytics or client cache SHALL be introduced.

#### Scenario: Keyboard launch keeps focus

- **WHEN** a keyboard user activates Start now
- **THEN** exactly one POST is initiated, pending state is accessible, acceptance is announced, and focus is not moved to History

#### Scenario: Mobile RTL launch from Details

- **WHEN** a user starts a task in Arabic at 360px while Details is selected
- **THEN** the labeled action remains reachable without horizontal overflow, acceptance is announced, and opening History shows the same new run as desktop

#### Scenario: Existing embedding host has no launch callback

- **WHEN** a host renders ScheduledTaskDetailView without the optional start props
- **THEN** no Start now control is rendered and its established detail/history behavior is preserved
