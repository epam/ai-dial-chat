## ADDED Requirements

### Requirement: Edit route loads the task and reuses ScheduledTaskCreateForm

The application SHALL expose a lazy-loaded `ScheduledTaskEditPage` at `ROUTES.ScheduledTaskEdit` (`/scheduled-tasks/:scheduleId/edit`), registered in `apps/chat/src/app/app.tsx` using the same `RouteErrorBoundary` + `Suspense` + `RouteFallback` pattern as `ROUTES.ScheduledTaskCreate`/`ROUTES.ScheduledTaskDetail`, gated behind `useFeatureFlag('scheduledTasksEnabled')` inside the page component (not at route registration), matching the existing create/detail pages' gating pattern. On mount, `ScheduledTaskEditPage` SHALL call `getScheduledTask(scheduleId)` and, on success, prefill `ScheduledTaskCreateForm`'s `values` via the reverse mapping described in the "Reverse trigger mapping is fail-closed" requirement below. `ScheduledTaskEditPage` SHALL render `ScheduledTaskCreateForm` with the same component contract used by the create page (`labels`, `values`, `errors`, `modelOptions`, `onFieldChange`, `onBack`, `onCancel`, `onSubmit`, `isSubmitting?`) — no `mode` prop is added to the lib; edit-flavored copy (page title "Edit scheduled task", Save button text) is supplied entirely by the page's `labels` object.

#### Scenario: Flag enabled renders the edit page

- **WHEN** `scheduledTasksEnabled` resolves to `true` and the user navigates to `/scheduled-tasks/sched_123/edit`
- **THEN** the lazy-loaded `ScheduledTaskEditPage` mounts inside `RouteErrorBoundary`/`Suspense` and calls `getScheduledTask('sched_123')`

#### Scenario: Flag disabled renders NotFound instead

- **WHEN** `scheduledTasksEnabled` resolves to `false` and the user navigates directly to `/scheduled-tasks/sched_123/edit`
- **THEN** the app renders the same `NotFound` content it renders for any unregistered path, and `getScheduledTask` is not called

#### Scenario: Edit route is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/scheduled-tasks/:scheduleId/edit`
- **THEN** the `ScheduledTaskEditPage` code is NOT included in the initial bundle

#### Scenario: Unknown schedule id renders NotFoundPage

- **WHEN** `getScheduledTask(scheduleId)` resolves with a 404
- **THEN** the edit page renders the app's `NotFoundPage`, and `ScheduledTaskCreateForm` is not mounted

#### Scenario: Task fetch error shows a retryable error state

- **WHEN** `getScheduledTask(scheduleId)` rejects with a non-404 error
- **THEN** the edit page renders an error state with a retry action that re-invokes `getScheduledTask`, and `ScheduledTaskCreateForm` is not mounted

#### Scenario: Successful load prefills the form

- **WHEN** `getScheduledTask(scheduleId)` resolves with a representable task (see the reverse-mapping requirement)
- **THEN** `ScheduledTaskCreateForm` mounts with `values` populated from the task's `displayName`, `description`, `model`, `prompt`, schedule type/frequency/time/day fields, and activity-window `startDate`/`endDate` where present

### Requirement: Reverse trigger mapping is fail-closed for unsupported or incomplete tasks

`apps/chat/src/utils/scheduled-task-trigger.ts` SHALL export a reverse mapping function that converts a `ScheduledTaskDto` into `ScheduledTaskCreateFormValues`, inverting `buildCronFields`/`buildCronWindowBoundary`'s UTC→local conversion using the same reference-`Date`-plus-getters technique (browser timezone/DST handling, not manual offset arithmetic). The function SHALL return a discriminated result — success with mapped `values`, or failure with a reason — rather than a value that may itself be invalid. Mapping SHALL fail when: the task's `trigger` shape (cron fields or day-of-week/day-of-month combination) falls outside what `ScheduledTaskCreateFormValues`' schedule-type/frequency fields can express; `triggerType` does not correspond to a schedule type the form supports; or `model`/`prompt` is missing or empty on the DTO. On mapping failure, `ScheduledTaskEditPage` SHALL render a localized, non-destructive error message and SHALL NOT mount `ScheduledTaskCreateForm` in an editable/submittable state — the original task's trigger is never read, coerced, and re-submitted.

#### Scenario: Once-schedule task round-trips through reverse mapping

- **WHEN** a task's `trigger` is `{ date: '2026-07-24T07:00:00.000Z' }` (UTC) and the viewer's browser timezone is UTC+2
- **THEN** the reverse mapper succeeds with `values.scheduleType = 'once'` and `values.runAt` equal to the local `2026-07-24T09:00` equivalent

#### Scenario: Daily recurring task round-trips through reverse mapping

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '7', minute: '0' }` (UTC) and the viewer's browser timezone is UTC+2
- **THEN** the reverse mapper succeeds with `values.frequency = 'daily'` and `values.time = '09:00'` (local)

#### Scenario: Weekly recurring task with day_of_week round-trips, including a UTC day-boundary shift

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '21', minute: '30', day_of_week: '1' }` (UTC Tuesday) and the local UTC+2 equivalent falls back onto Monday `23:30`
- **THEN** the reverse mapper succeeds with `values.dayOfWeek` corresponding to Monday and `values.time = '23:30'`

#### Scenario: Activity-window boundaries round-trip to local date-only values

- **WHEN** a task's `trigger.cron` includes `startDate`/`endDate` as UTC ISO instants at local-midnight and local-`23:59:59.999` respectively
- **THEN** the reverse mapper succeeds with `values.startDate`/`values.endDate` as the corresponding local `YYYY-MM-DD` strings

#### Scenario: DST-crossing date maps without a one-hour drift

- **WHEN** a recurring task's stored UTC `hour`/`minute` corresponds to a local wall-clock time on a date where the viewer's timezone observes a DST transition relative to the current reference date
- **THEN** the reverse mapper produces a local `time` consistent with the DST offset in effect for the mapped date, not the offset in effect "now"

#### Scenario: Unsupported cron shape fails closed

- **WHEN** a task's `trigger.cron.fields` encodes a shape the create form's schedule-type/frequency controls cannot represent (e.g. multiple `day_of_week` values, or a field the form has no control for)
- **THEN** the reverse mapper returns a failure result, no `ScheduledTaskCreateFormValues` are produced, and the edit page shows a non-destructive "can't be edited here" message with Save unavailable

#### Scenario: Missing required fields fails closed

- **WHEN** a task's `model` or `prompt` is missing or empty (e.g. a legacy task)
- **THEN** the reverse mapper returns a failure result, and the edit page shows the same non-destructive error with Save unavailable, without submitting a partial update

### Requirement: Edit page submits via PUT and preserves input on failure

On submit, `ScheduledTaskEditPage` SHALL run the same client-side validation rules as the create page, map the current form `values` to `UpdateScheduledTaskBodyDto` (identical shape to `CreateScheduledTaskBodyDto`) using the same trigger-building logic as `mapFormValuesToCreateBody`, and call `updateScheduledTask(scheduleId, body)` (`PUT /api/v1/scheduled-tasks/:scheduleId`) through `apps/chat/src/server-api/scheduled-tasks.api.ts`. The Save action SHALL be disabled while a submission is in flight (`isSubmitting`) to prevent duplicate submissions. On success (**200 OK**), the page SHALL show a localized success notification and navigate to `getScheduledTaskDetailRoute(scheduleId)`. On failure, all user-entered form values SHALL be preserved, an error notification SHALL be shown (including the request/trace id when available, per the existing notification pattern), `isSubmitting` SHALL be reset so Save is re-enabled, and no navigation SHALL occur. A **404** SHALL render the same NotFoundPage treatment as an initial load 404. **400**, **403**, **429**, **502**, and **503** SHALL all surface through that same single error-notification path — the notification's message text comes from the server's own error body via `getApiErrorDetails`, so it already differs meaningfully per status without the page hardcoding four separate copy variants, matching `ScheduledTaskCreatePage`'s existing single-catch-all error handling. **401** SHALL trigger the app's existing unauthenticated-session handling in the API client layer, which intercepts it before it reaches this page's catch block in the normal flow.

#### Scenario: Back and Cancel both return to the detail page without a network call

- **WHEN** the user activates Back or Cancel on the edit page for `sched_123`
- **THEN** the app navigates to `getScheduledTaskDetailRoute('sched_123')` and no `updateScheduledTask` call is made

#### Scenario: Valid submit calls PUT and returns to the detail page

- **WHEN** all required fields pass validation and the user activates Save on the edit page for `sched_123`
- **THEN** the app calls `updateScheduledTask('sched_123', body)`, shows a success notification on 200, and navigates to `getScheduledTaskDetailRoute('sched_123')`

#### Scenario: Submit failure preserves entered values and re-enables Save

- **WHEN** the user activates Save and `updateScheduledTask` rejects with a 400, 403, 429, 502, or 503
- **THEN** an error notification is shown with the server's error message and a trace id when present, the form remains open with all entered values unchanged, `isSubmitting` returns to `false`, and no navigation occurs

#### Scenario: Duplicate submission is prevented while a save is in flight

- **WHEN** the user activates Save a second time while the first `updateScheduledTask` call is still pending
- **THEN** no second `updateScheduledTask` call is made, because Save is disabled while `isSubmitting` is `true`

#### Scenario: 404 on submit renders NotFoundPage

- **WHEN** `updateScheduledTask` rejects with a 404 (task deleted or inaccessible between load and save)
- **THEN** the edit page renders `NotFoundPage`

### Requirement: Edit-task strings flow through react-i18next

Every user-visible string on the edit-task page (page title, Save button label, loading/error/not-found/unsupported-trigger messages, success/error notifications) MUST be resolved via `useTranslation().t()` in `ScheduledTaskEditPage` and passed into `ScheduledTaskCreateForm` as plain strings, reusing the create page's existing `scheduledTasks.create.*` field-level keys (display name, description, schedule, model, prompt labels are identical between create and edit), reusing `ButtonsI18nKeys.Save` for the Save label (the create form's own submit button already reads "Save", not "Create") and the detail page's existing `scheduledTasks.detail.errorLabel`/`scheduledTasks.list.retryLabel` for the load-error state, and adding edit-specific keys under `scheduledTasks.edit.*` only for copy with no existing generic equivalent: the page title, the unsupported-trigger message, and the success/error notifications.

#### Scenario: Edit-specific keys exist

- **WHEN** the change is applied
- **THEN** `en.json` contains at minimum `scheduledTasks.edit.pageTitle`, `scheduledTasks.edit.unsupportedTriggerMessage`, `scheduledTasks.edit.successNotification`, and `scheduledTasks.edit.errorNotification`, and the Save button label and load-error/retry copy resolve from `ButtonsI18nKeys.Save`, `scheduledTasks.detail.errorLabel`, and `scheduledTasks.list.retryLabel` respectively rather than new duplicate keys

#### Scenario: Field-level labels are reused from the create flow, not duplicated

- **WHEN** `ScheduledTaskEditPage` renders `<ScheduledTaskCreateForm />`
- **THEN** the display name, description, schedule, model, and prompt label props resolve from the same keys/enum members the create page already uses, not new edit-scoped duplicates

### Requirement: Detail-page card Edit action is wired to the edit route

`ScheduledTasksPage` SHALL wire `ScheduledTaskCard`'s existing `onEdit?: (id: string) => void` prop (previously left unset) to navigate to `getScheduledTaskEditRoute(id)`, reusing the same route the detail-page header Edit button navigates to.

#### Scenario: List card overflow-menu Edit navigates to the edit route

- **WHEN** the user activates "Edit" in a `ScheduledTaskCard`'s overflow menu for task `sched_123`
- **THEN** the app navigates to `/scheduled-tasks/sched_123/edit`
