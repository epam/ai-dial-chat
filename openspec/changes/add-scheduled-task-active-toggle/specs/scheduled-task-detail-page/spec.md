## MODIFIED Requirements

### Requirement: Detail page header shows back navigation and title, plus an Edit action once loaded

The detail page header SHALL render a back-navigation control and the task's `displayName` as its title on the start side. Activating the back control SHALL navigate to `ROUTES.ScheduledTasks`. Once the task has loaded successfully, the header SHALL additionally render, on the inline-end side, in this order:

1. an **Active** switch (`DialSwitch` from `@epam/ai-dial-ui-kit`) with a visible localized "Active" label, rendered only when `isActive !== undefined` on the loaded task (per the "Scheduled task active state field" requirement in `scheduled-tasks-api`) — never an unchecked switch while the active state is unknown;
2. a `NeutralButton` (`@epam/ai-dial-ui-kit`) with a pencil icon (`IconPencilMinus` from `@tabler/icons-react`) and a localized "Edit" label. Activating Edit SHALL navigate to `getScheduledTaskEditRoute(scheduleId)` for the task currently being viewed.

The header SHALL NOT render Delete or Run-now controls in this iteration, and SHALL NOT render the Edit button or the Active switch while the task is loading or failed to load.

#### Scenario: Back control returns to the list

- **WHEN** the user activates the back control on the detail page
- **THEN** the app navigates to `ROUTES.ScheduledTasks`

#### Scenario: Header shows back, title, Active switch, and Edit once the task has loaded

- **WHEN** the detail page renders with a successfully loaded task whose `isActive` is defined
- **THEN** the header contains a back control and the task's `displayName` on the start side, and on the end side — in order — the Active switch (before Edit) and a `NeutralButton` with `IconPencilMinus` and a localized "Edit" label, and no Delete/Run-now control is present

#### Scenario: Edit button and Active switch are absent while loading or on error

- **WHEN** the detail page is still fetching the task, or the task fetch has failed
- **THEN** the header does not render the Edit button or the Active switch

#### Scenario: Activating Edit navigates to the edit route for the current task

- **WHEN** the user activates the Edit button while viewing `/scheduled-tasks/sched_123`
- **THEN** the app navigates to `getScheduledTaskEditRoute('sched_123')`, which resolves to `/scheduled-tasks/sched_123/edit`

#### Scenario: Edit button is keyboard accessible

- **WHEN** a keyboard user tabs to the Edit button and presses Enter or Space
- **THEN** the same navigation occurs as with a pointer click, and the button exposes an accessible name of "Edit" (or the localized equivalent)

### Requirement: Presentational ScheduledTaskDetailView stays host-agnostic

`libs/scheduled-tasks` SHALL export a presentational `ScheduledTaskDetailView` component accepting only props: localized label strings (including an Edit button label and the Active switch's label/status announcements), detail field values (`description`, model display value, schedule label), either `instructionsMarkdown: string` or a `renderInstructions: (markdown: string) => ReactNode` callback, a runs list plus `{ runsHasMore, runsIsLoadingMore, runsSkeletonCount, onRunsLoadMore }`, top-level `isLoading`/`error` flags and their History-scoped counterparts, an `onBack` callback, an optional `onEdit?: () => void` callback, and optional `isActive?: boolean`, `isActiveUpdating?: boolean`, `isActiveDisabled?: boolean`, and `onActiveChange?: (nextActive: boolean) => void` for the Active switch. When `onEdit` is supplied, the component SHALL render the Edit button described above in an end-side header slot; when `onEdit` is omitted, no Edit button SHALL render. When `isActive` is `undefined`, no Active switch SHALL render, regardless of whether `onActiveChange` is supplied. When `isActive` is defined and `onActiveChange` is supplied, the switch SHALL render checked/unchecked to match `isActive`, disabled while `isActiveUpdating` or `isActiveDisabled` is `true`, and SHALL call `onActiveChange` with the newly requested boolean value on toggle — the component performs no network call, no optimistic state of its own, and no `scheduleId` resolution; all of that is owned by the host page. The component SHALL NOT import `@epam/chat-api-client`, any routing module, i18n, or auth/env/analytics modules — all host/external knowledge, including the `scheduleId`-based navigation target and the pause/resume API calls, is resolved by the host page and passed in via the `onEdit`/`onActiveChange` callbacks per the repo's library-isolation rule.

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

#### Scenario: Active switch renders only when isActive is defined

- **WHEN** `ScheduledTaskDetailView` renders with `isActive` left `undefined` (loading, error, or an upstream response with no basis to decide)
- **THEN** no Active switch is present in the header

#### Scenario: onActiveChange is invoked with the requested value without the lib calling any API

- **WHEN** the user toggles the Active switch from checked to unchecked (or vice versa)
- **THEN** `onActiveChange` is called exactly once with the newly requested boolean value, and the lib performs no network call, optimistic update, or `scheduleId` resolution itself

#### Scenario: Active switch is disabled while updating or explicitly disabled

- **WHEN** `isActiveUpdating` or `isActiveDisabled` is `true`
- **THEN** the rendered switch exposes a disabled state and does not call `onActiveChange` when interacted with

### Requirement: Detail page strings flow through react-i18next

Every user-visible string on the Scheduled Task Detail page (section titles, back control accessible label, Active switch label and status announcements, run status labels, empty-history label, error/retry labels, loading-more indicator) MUST be resolved via `useTranslation().t()` in `ScheduledTaskDetailPage` and passed into `ScheduledTaskDetailView` as plain strings. Keys MUST live under a `scheduledTasks.detail` namespace in `apps/chat/src/i18n/locales/en.json` and be referenced through the existing `ScheduledTasksI18nKeys` enum (or a new enum in the same file) in `apps/chat/src/constants/translation-keys.ts`. Existing generic labels (e.g. "Retry", "Loading…") MUST be reused from `ButtonsI18nKeys` or another shared namespace where an equivalent already exists, rather than duplicated under a new key. The Active switch's visible label key (`scheduledTasks.detail.activeStatusLabel`) MUST be distinct from the existing `scheduledTasks.detail.activeWindowLabel` key (`ScheduledTasksI18nKeys.DetailActiveWindowLabel`), which refers to the cron activity date window shown in the Details column and is unrelated to this switch, even though both currently render the English word "Active".

#### Scenario: Detail keys are present in en.json

- **WHEN** the change is applied
- **THEN** `en.json` contains `scheduledTasks.detail.detailsTitle`, `scheduledTasks.detail.configurationTitle`, `scheduledTasks.detail.instructionsLabel`, `scheduledTasks.detail.historyTitle`, `scheduledTasks.detail.backAriaLabel`, `scheduledTasks.detail.emptyHistoryLabel`, `scheduledTasks.detail.historyErrorLabel`, status labels for `success`/`error`/`inProgress`/`missed`, `scheduledTasks.detail.activeStatusLabel`, `scheduledTasks.detail.pauseSuccess`, `scheduledTasks.detail.resumeSuccess`, and `scheduledTasks.detail.activeStatusUpdateError`

#### Scenario: Lib receives strings, not translation keys

- **WHEN** `ScheduledTaskDetailPage` renders `<ScheduledTaskDetailView />`
- **THEN** every string-typed prop passed to it is the result of `t(SomeI18nKeys.Member)`, never a raw i18n key or hard-coded English literal

#### Scenario: Active switch label is not the cron-window label

- **WHEN** the Active switch and the Details column's cron activity-window field both render on the same page
- **THEN** the switch's accessible name is resolved from `scheduledTasks.detail.activeStatusLabel`, and the Details column's window field is resolved from `scheduledTasks.detail.activeWindowLabel` — two distinct keys, not a shared key

### Requirement: Detail page supports RTL and meets AAA accessibility defaults

All directional layout in the detail page header, Details/Configuration sections, and History panel MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) per `.claude/rules/rtl.md`. The back control's directional icon MUST be mirrored in RTL via `rtl:scale-x-[-1]` or an equivalent. The Active switch MUST NOT be mirrored in RTL (a switch is not a directional icon) and MUST remain at the inline end of the header, before Edit, in both LTR and RTL. The switch MUST expose native switch semantics or `role="switch"` with `aria-checked` reflecting its current state, an accessible name matching the localized "Active" label, a visible focus indicator matching its hover treatment, a disabled state exposed via the native `disabled` attribute while updating, and a minimum 44×44 CSS pixel touch target on mobile. A successful pause or resume MUST be announced via an `aria-live="polite"` status region separate from the switch's own accessible name (which stays "Active" in both states); a failed pause/resume MUST use the established notification/alert pattern rather than the `aria-live` region alone. The History panel SHALL be marked up as a `<ul>`/`<li>` list with each `<li>` exposing an accessible name that includes the run's status and timestamp (per the "History rows show skeleton loading, status icon, timestamp, and duration" requirement). Status-icon-only and switch-color-only visual differences MUST NOT be the sole means of conveying state to assistive technology.

#### Scenario: Detail page mirrors under RTL without flipping the switch

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the header, Details/Configuration sections, and History panel lay out mirrored, the back icon is visually flipped, and the Active switch is not mirrored and remains at the inline end (visually the leftmost end-side control) before Edit

#### Scenario: Active switch exposes native switch semantics and state

- **WHEN** the Active switch renders with `isActive: true`
- **THEN** it exposes `role="switch"` (or native switch semantics) with `aria-checked="true"`, an accessible name equal to the localized "Active" label, and a visible focus indicator when focused via keyboard

#### Scenario: Successful pause/resume is announced via aria-live

- **WHEN** a pause or resume mutation completes successfully
- **THEN** an `aria-live="polite"` region announces the localized success message (`scheduledTasks.detail.pauseSuccess` or `scheduledTasks.detail.resumeSuccess`), separate from the switch's own accessible name

#### Scenario: History list uses semantic list markup with accessible row names

- **WHEN** a screen reader user navigates into the History panel
- **THEN** the panel is exposed as a list (`<ul>`/`<li>` or equivalent ARIA list role), and each row's accessible name conveys both its status and its timestamp

## ADDED Requirements

### Requirement: Active switch toggles pause/resume with optimistic update and rollback

`ScheduledTaskDetailPage` SHALL wire the Active switch's `onActiveChange` callback to call `pauseScheduledTask(scheduleId)` when the requested value is `false`, or `resumeScheduledTask(scheduleId)` when the requested value is `true`, exactly once per toggle, while `isActiveUpdating` is `true` for the duration of that call. Before the call resolves, the page SHALL optimistically display the requested `isActive` value. On success, the page SHALL merge the returned `ScheduledTaskDto`'s `isActive` and `nextRunTime` into its task state and show the corresponding localized success message (`scheduledTasks.detail.pauseSuccess` / `scheduledTasks.detail.resumeSuccess`). On failure, the page SHALL revert `isActive` to its pre-toggle value, leave the rest of the loaded task state unchanged, and show a localized error notification (`scheduledTasks.detail.activeStatusUpdateError`) that includes the request/trace id when the error response provides one. While a pause/resume call is in flight, the switch SHALL be disabled so a second toggle cannot start an overlapping request. A pause/resume response that resolves after the user has navigated away from the schedule it was requested for (`scheduleId` changed or the page unmounted) SHALL NOT update any component state. This flow SHALL NOT issue a `PUT` to `updateScheduledTask` and SHALL NOT modify `trigger`, `model`, `prompt`, or `description`, and SHALL NOT trigger a run-history refetch.

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

- **WHEN** `pauseScheduledTask` or `resumeScheduledTask` rejects
- **THEN** the switch reverts to its pre-toggle checked/unchecked state, re-enables, the rest of the detail page (Details, Configuration, History) remains visible and unaffected, and a localized error notification is shown including the request/trace id when available

#### Scenario: Rapid interaction cannot produce overlapping requests

- **WHEN** the user attempts to toggle the switch again while a previous pause/resume call is still in flight
- **THEN** the switch is disabled during the in-flight call and the second interaction has no effect until the first call resolves

#### Scenario: A stale response cannot update a different task after navigation

- **WHEN** the user navigates away from `/scheduled-tasks/sched_123` (unmount or `scheduleId` change) while a pause/resume call for `sched_123` is still in flight, and that call later resolves
- **THEN** no component state is updated as a result of that resolution

### Requirement: Active switch is disabled, not hidden, for a completed one-time schedule

When a loaded task's `triggerType` is `date` (one-time) and its `nextRunTime` is `null` (the schedule has already run and cannot be resumed), `ScheduledTaskDetailPage` SHALL still render the Active switch (since `isActive` is defined — `false`, per the "Scheduled task active state field" requirement in `scheduled-tasks-api`), but SHALL pass `isActiveDisabled={true}` so the switch renders checked=false and disabled, rather than omitting the control or offering a resume action that DIAL Scheduler cannot fulfill.

#### Scenario: Completed one-time schedule shows a disabled, unchecked switch

- **WHEN** the loaded task has `triggerType: 'date'` and `nextRunTime: null`
- **THEN** the Active switch renders unchecked and disabled, and toggling it (via pointer or keyboard) has no effect and calls neither `pauseScheduledTask` nor `resumeScheduledTask`

#### Scenario: Recurring schedule with no upcoming run remains togglable

- **WHEN** the loaded task has `triggerType: 'cron'` and `nextRunTime: null` (paused, not completed)
- **THEN** the Active switch renders unchecked but NOT disabled, and toggling it on calls `resumeScheduledTask`
