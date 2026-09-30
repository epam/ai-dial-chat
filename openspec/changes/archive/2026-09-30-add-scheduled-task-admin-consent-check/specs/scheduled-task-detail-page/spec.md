## MODIFIED Requirements

### Requirement: Active switch toggles pause/resume with optimistic update and rollback

`ScheduledTaskDetailPage` SHALL wire the Active switch's `onActiveChange` callback to call `pauseScheduledTask(scheduleId)` when the requested value is `false`, or `resumeScheduledTask(scheduleId)` when the requested value is `true`, exactly once per toggle, while `isActiveUpdating` is `true` for the duration of that call. Before the call resolves, the page SHALL optimistically display the requested `isActive` value. On success, the page SHALL merge the returned `ScheduledTaskDto`'s `isActive` and `nextRunTime` into its task state and show the corresponding localized success message (`scheduledTasks.detail.pauseSuccess` / `scheduledTasks.detail.resumeSuccess`). On failure, the page SHALL revert `isActive` to its pre-toggle value, leave the rest of the loaded task state unchanged, and show an error notification that includes the request/trace id when the error response provides one, whose message `resolveScheduledTaskErrorMessage` (`apps/chat/src/utils/map-scheduled-task-dto.ts`) chooses from the `getApiErrorDetails` result: `toolsetSignin.adminConsentRequired` when `code` is `scheduledTaskAdminConsentRequired`, else a non-empty `upstreamMessage` from DIAL Scheduler as received, else the localized `scheduledTasks.detail.activeStatusUpdateError`; the BFF's generic `message` is never displayed. While a pause/resume call is in flight, the switch SHALL be disabled so a second toggle cannot start an overlapping request. A pause/resume response that resolves after the user has navigated away from the schedule it was requested for (`scheduleId` changed or the page unmounted) SHALL NOT update any component state. This flow SHALL NOT issue a `PUT` to `updateScheduledTask` and SHALL NOT modify `trigger`, `model`, `prompt`, or `description`, and SHALL NOT trigger a run-history refetch.

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
