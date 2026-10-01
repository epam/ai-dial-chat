## ADDED Requirements

### Requirement: Start now immediately exposes the accepted run in History

`ScheduledTaskDetailPage` SHALL use a page-scoped app hook `useStartScheduledTask` in `apps/chat/src/hooks/scheduled-tasks/` for manual-run mutation state, accepted run DTOs and status tracking; the existing `useScheduledTaskRuns` SHALL retain history pagination ownership. No new context SHALL be introduced. The feature SHALL inherit `scheduledTasksEnabled` and its existing role policy.

For a loaded, non-deleted task, Start now SHALL execute the saved definition through `startScheduledTask(scheduleId)` exactly once per activation, with no confirmation dialog or payload override. The action SHALL be disabled while its POST is pending, deletion or Active mutation is pending, or any known run is InProgress. A synchronous guard SHALL prevent duplicate dispatch before the disabled state renders. Paused, completed and expired schedules SHALL remain manually runnable; the operation SHALL NOT resume or edit them.

After HTTP 202, History SHALL immediately include the returned real run id, timestamp and InProgress spinner before older entries. No optimistic fabricated row SHALL be added before acceptance. Entries SHALL be deduplicated by id without discarding loaded pages or changing the underlying pagination offset. An earlier list response SHALL NOT erase the new row or downgrade its confirmed terminal status. Accepted rows SHALL remain visible even if the independent initial history request is pending or fails; history errors SHALL remain scoped with retry alongside available rows.

The page SHALL NOT refetch schedule/list metadata or change its loaded trigger, Active state, next-run label or update timestamp on start. Run rows without a conversation id SHALL remain non-navigable. Once a terminal response supplies a conversation id, existing navigation/unread behavior SHALL apply without automatic navigation.

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

#### Scenario: Paused or completed task runs without rescheduling

- **WHEN** Start now is activated for a non-deleted paused/completed task
- **THEN** only the start endpoint is called, without resume/update/list invalidation, and the next scheduled fire is unchanged

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

POST rejection SHALL create no fabricated History row. 404 SHALL show the localized not-found message; 409 SHALL show that a deleted task cannot run and disable Start now until detail retry establishes eligibility. Other failures SHALL use existing safe error/trace handling and localized fallback; ambiguous network/5xx outcomes SHALL say acceptance could not be confirmed and recommend checking History. No automatic POST retry SHALL occur.

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

Keyboard Enter/Space SHALL invoke the same guarded action. Decorative icons SHALL be aria-hidden. Pending controls SHALL expose disabled/busy state, acceptance/completion SHALL use a polite live region with no repeated announcements on unchanged polls, and errors SHALL use an alert. Focus visibility and text contrast SHALL satisfy the repository AAA target. Existing HTTP observability suffices; no new analytics or client cache SHALL be introduced.

#### Scenario: Keyboard launch keeps focus

- **WHEN** a keyboard user activates Start now
- **THEN** exactly one POST is initiated, pending state is accessible, acceptance is announced, and focus is not moved to History

#### Scenario: Mobile RTL launch from Details

- **WHEN** a user starts a task in Arabic at 360px while Details is selected
- **THEN** the labeled action remains reachable without horizontal overflow, acceptance is announced, and opening History shows the same new run as desktop

#### Scenario: Existing embedding host has no launch callback

- **WHEN** a host renders ScheduledTaskDetailView without the optional start props
- **THEN** no Start now control is rendered and its established detail/history behavior is preserved


## MODIFIED Requirements

### Requirement: Detail page header shows back navigation and title, plus Active/Delete/Edit actions once loaded

The detail page header SHALL render a back-navigation control and the task's `displayName` as its title on the start side. Activating the back control SHALL navigate to `ROUTES.ScheduledTasks`. Once the task has loaded successfully and `task.isDeleted` is not `true`, the header SHALL additionally render, on the inline-end side, in this order:

1. an **Active** switch (`Switch` from `@epam/ai-dial-ui-kit`) with a visible localized "Active" label, rendered only when `isActive !== undefined` on the loaded task, never an unchecked switch while the active state is unknown;
2. a destructive **Delete** action (`GhostIconButton`/equivalent destructive-treatment control from `@epam/ai-dial-ui-kit`, red/danger styling, the standard delete icon marked `aria-hidden`, and a visible localized "Delete" label). Activating Delete SHALL open the confirmation dialog described in the "Delete confirmation dialog gates the delete request" requirement — it SHALL NOT call any API directly;
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
