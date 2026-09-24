## ADDED Requirements

### Requirement: Scheduled task configuration exposes a controlled optional Skill field

Create and edit SHALL render Skill above Instructions when the host's `skillUsageEnabled` is enabled. `ScheduledTaskCreateForm` SHALL accept optional `skillSelector: ReactNode`, `skillLabelId`, `skillErrorId`, and `labels.skillLabel`, and render its own label/error markup only when the slot is supplied. The host SHALL provide unique matching label/error IDs to the composed control. The library SHALL add `skillUrl?: string` to form values and `skillUrl?: string` to localized errors; it SHALL NOT resolve catalog data or feature flags.

Existing page-local controlled form values SHALL own selection. `SkillSelectorField` from `@epam/ai-dial-skills` SHALL report replacement/removal through `onFieldChange('skillUrl', value)` via the app adapter. No new context or second uncontrolled selection state SHALL be introduced. The library minimum save guard SHALL accept nonblank instructions or a nonempty skill, and SHALL reject a skill field error; checked preparation remains mandatory before writing.

#### Scenario: Select replace and remove on create and edit

- **WHEN** a user selects a skill, replaces it, or removes it in either form
- **THEN** the controlled draft has at most one matching reference and the control immediately reflects the value
- **AND** removing the last skill with blank instructions disables save

#### Scenario: Favorites picker matches the model field

- **WHEN** the user opens the Skill field
- **THEN** the app supplies favorites from personal, shared, and public skill collections using the existing favorites context, without changing chat's selection
- **AND** desktop uses an anchored dropdown and mobile uses the existing bottom-sheet shell, both with search, favorites, and a Browse button for the skill-only catalog
- **AND** the input uses the model selector's UI-kit styling with a trailing clear button
- **AND** favorite rows do not expose the hover tooltip or View details action on task forms
- **AND** the Skill field and Instructions editor share the same available width and 996px maximum width

#### Scenario: Instructions only skill only and combined content

- **WHEN** required name, model, and schedule are valid
- **THEN** instructions only, a supported skill with empty instructions, and a supported skill with instructions can each be saved
- **AND** empty or whitespace-only instructions without a skill cannot be saved

#### Scenario: Support changes without submitting

- **WHEN** a selected skill is paired with a model or agent whose `features.skillsSupported` is false, absent, or not yet resolved
- **THEN** the field immediately becomes invalid, Create/Save is disabled, and `skillSelector.unsupportedTooltipLabel` is displayed
- **AND** changing to a supporting deployment or removing the skill clears that compatibility error without discarding instructions

#### Scenario: Missing skill metadata cannot bypass validation

- **WHEN** a saved skill URL is present but the catalog is loading or no longer returns that skill
- **THEN** the field displays its raw reference, retains removal, and capability validation still uses URL presence

#### Scenario: Capability recovers after a server rejection

- **WHEN** a save returns `scheduledTaskSkillUnsupported` and deployment support subsequently changes from false to true
- **THEN** the stale server error clears and the unchanged draft can be submitted again, including when the Skill field is hidden
- **AND** unrelated rerenders do not clear a server rejection while capability data remains unchanged

#### Scenario: Feature-disabled editing is non-destructive

- **WHEN** `skillUsageEnabled` is false and an existing task has a saved skill
- **THEN** the Skill field is not rendered but the loaded reference stays in the draft and subsequent save
- **AND** an unsupported model/skill combination still blocks save with the shared message in a visible form-level alert

### Requirement: Scheduled Skill UI preserves localization accessibility and responsive behavior

The host SHALL translate `scheduledTasks.create.skillLabel`, `scheduledTasks.create.skillPlaceholder`, `scheduledTasks.create.instructionsOrSkillRequired`, `scheduledTasks.create.instructionsOnlySubtitle`, and `skillSelector.removeSkillLabel`; reuse `scheduledTasks.create.configurationSectionSubtitle` when enabled and `skillSelector.unsupportedTooltipLabel` for all unsupported messages. Existing `scheduledTasksEnabled` route gating and `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` resolution SHALL remain unchanged; no new flag/role is introduced.

The field SHALL support keyboard opening/selection/removal, Escape dismissal and focus restoration, unique label/error associations, `aria-invalid`, `aria-expanded`, and live error/status announcements. Touch removal SHALL not depend on hover. The field SHALL fit scheduler's existing container-responsive form at 360px and desktop sizes with wrapped long references, logical spacing, appropriate directional-icon mirroring, and AAA contrast. Library code SHALL inherit direction rather than read locale. Host labels/catalog callbacks SHALL have stable memoized identities; async resolution SHALL ignore stale results. No new cache or telemetry is required.

#### Scenario: Accessible instances remain independent

- **WHEN** two forms are mounted and a keyboard user opens, selects, removes, or cancels a skill selection
- **THEN** each selector has its own label/error IDs, errors are announced, focus returns to the initiating control, and neither instance changes the other

#### Scenario: Arabic in a narrow host container

- **WHEN** the form renders under RTL in a 360px container with a long skill reference
- **THEN** labels and controls follow logical direction, text wraps, and selection/removal remain reachable without horizontal overflow

## MODIFIED Requirements

### Requirement: ScheduledTaskCreateForm lib component matches the BFF create contract

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCreateForm` component accepting `labels`, `values`, `errors`, `modelSelector` (`ReactNode`), `modelLabelId` (`string`), `onFieldChange`, `onCancel`, `onSubmit`, and optional `isSubmitting` (default `false`). `modelLabelId` is applied as the `id` of the Model or Agent field's `Label` element; the host generates it (e.g. via React `useId()`) rather than a hardcoded literal, and passes the same value as `modelSelector`'s own `aria-labelledby` target, so two concurrently-mounted form instances (or any future host reusing the component) never collide on a shared DOM id.

It SHALL render:

- **Display name** — required text input (`values.displayName`)
- **Description** — optional textarea (`values.description`), rendered between Display name and Repeat, with `maxLength={500}` and accessible feedback (e.g. a character count or inline validation message per `errors.description`) shown when the field is non-empty
- **Repeat** — a single dropdown (`DialSelectField`) bound to `values.repeat: ScheduledTaskRepeat` (`'oneTime' | 'hourly' | 'daily' | 'weekly' | 'monthly'`), replacing the separate "Schedule type" (once/recurring) and "Frequency" (daily/weekly/monthly) dropdowns. It is NOT wrapped in a `<fieldset>`/`<legend>` with a visible "Schedule" section heading — the schedule controls render as a plain grouped block inside the Details column, which already carries its own `role="group"`/`aria-label` (`labels.detailsSectionTitle`)
- **Run at** — the internal `ScheduledTaskRunAtField` component (`libs/scheduled-tasks/src/components/ScheduledTaskRunAtField`, not re-exported from the package index), wrapping a `Calendar` control (`mode={CalendarMode.DateTime}`, imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat === 'oneTime'`, bound to `values.runAt` (a `datetime-local`-style string) through the field's own `runAtToCalendarValue`/`calendarValueToRunAt` adaptation, with `errors.runAt` rendered below the control in the same inline-error pattern via the field's `errorClassName` prop. The field sets the earliest selectable moment to its mount time — a `minDate` pinned once per mount — so days strictly before the mount date render unselectable in the picker's month grid and activating them fires no `onFieldChange('runAt', …)`; the mount date itself and future days remain selectable. The earliest selectable moment is "now", not "now + lead": the page's existing submit-time lead validation (`runAt` must lead "now") is unchanged and still rejects `now`-ish selections at submit
- **Time** — a `Calendar` control (`mode={CalendarMode.Time}`, imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat` is `'daily'`, `'weekly'`, or `'monthly'` (NOT shown for `'hourly'`), bound to `values.time` (`HH:mm` local wall-clock string, validated at app edge)
- **Day of week** — a `Calendar` control (`mode={CalendarMode.Weekday}`, imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat === 'weekly'`, bound to `values.dayOfWeek` via `dayOfWeekToCalendarValue`/`calendarValueToDayOfWeek` (`libs/scheduled-tasks/src/utils/calendar-value.ts`), which convert between `Calendar`'s ISO weekday value (`"1"`=Monday..`"7"`=Sunday) and `values.dayOfWeek`'s APScheduler-convention string (`"0"`=Monday..`"6"`=Sunday)
- **Day of month** — shown when `values.repeat === 'monthly'` (`values.dayOfMonth`)
- **Minute** — a required text input (matching the `Day of month` field's `Input` pattern) shown when `values.repeat === 'hourly'`, bound to `values.minute` (a `"0"`-`"59"` string); no `Time`, `Day of week`, or `Day of month` field is rendered for `'hourly'`
- **Model or Agent** — a required field rendering the host-supplied `modelSelector` element in place of a lib-owned selection control, wrapped in the lib's own required-label/error markup (the "Model or Agent" label, a required marker, and `errors.modelId` rendered below the control) using the same visual pattern already used for `Calendar` fields without a built-in `labelProps` (see `withRequiredMarker`). The lib performs no deployment lookup, filtering, or catalog navigation itself — it only renders whatever `modelSelector` the host passes.
- **Skill** - optional host-composed slot in Configuration above Instructions with `skillSelector`, `skillLabelId`, `skillErrorId`, `labels.skillLabel`, `values.skillUrl`, and `errors.skillUrl`
- **Instructions** - markdown editor (`values.prompt`), required only when no skill is selected
- **Cancel / Create** actions

`values` SHALL NOT include a `stream` field, and the form MUST NOT render a stream toggle — scheduled task runs are always non-streaming background executions and this is not a user-configurable option.

`description` is optional and MUST NOT participate in the Create-button required-field guard. The Create action SHALL be disabled while `isSubmitting` is `true` or while `displayName` or `values.modelId` is empty, while both trimmed `prompt` and `values.skillUrl` are empty, or while `errors.skillUrl` is present (minimum client-side guard; full validation uses shared checked preparation at the app boundary). `values.modelId` itself continues to be owned and set by the host via the `modelSelector` element's own `onSelect` callback (bound to `onFieldChange('modelId', ...)` by the host, outside the lib) — the lib's required-field guard reads `values.modelId` exactly as it did before this change; only the rendered control changed.

The `Run at` and `Time` `Calendar` controls' `onChange` callbacks (inside `ScheduledTaskRunAtField` for `runAt`, in the form for `time`) MUST adapt the ui-kit's `CalendarValue` (`Date | string | null`) into calls to `onFieldChange('runAt', ...)` / `onFieldChange('time', ...)` using the same value shapes the page already consumes (`values.runAt` as a `Date`-constructible value, `values.time` as an `"HH:mm"` string) — this is a UI-control swap, not a change to the `values`/`onFieldChange` contract.

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, notification context, deployments context, auth, env, or analytics. Importing `Calendar`/`CalendarMode` from `@epam/ai-dial-ui-kit` is permitted — it is a generic design-system control with no host-specific integration knowledge. `modelSelector` MUST remain an opaque `ReactNode` prop — the lib MUST NOT know it is a deployment selector, a dropdown, or anything about its internal behavior.

#### Scenario: Required-field guard blocks submit

- **WHEN** `displayName` is empty or `values.modelId` is unset
- **THEN** the Create button is disabled

#### Scenario: Submitting is reflected in the UI

- **WHEN** `isSubmitting` is `true`
- **THEN** the Create button is disabled and shows a busy/loading affordance

#### Scenario: Model field renders the host-supplied selector as an opaque slot

- **WHEN** `ScheduledTaskCreateForm` renders with `modelSelector={<button>Select Model or Agent</button>}`
- **THEN** that exact element renders in the Model or Agent field's position, wrapped by the lib's own "Model or Agent" required label and (when present) `errors.modelId` message, and the lib performs no deployment/API fetch

#### Scenario: Model field label id comes from the host, not a hardcoded literal

- **WHEN** `ScheduledTaskCreateForm` renders with `modelLabelId="a-generated-id"`
- **THEN** the "Model or Agent" `Label` element's `id` is `"a-generated-id"`, and `ScheduledTaskCreatePage`/`ScheduledTaskEditPage` each generate this value via `useId()` rather than sharing a fixed string literal, so two instances of the form never collide on the same DOM id

#### Scenario: Lib has no host or integration imports

- **WHEN** `libs/scheduled-tasks` source (including `ScheduledTaskCreateForm`) is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/ai-dial-chat-api-client`, `server-api`, routing, feature-flag, notification, deployments, auth, env, or analytics modules; imports of `Calendar`/`CalendarMode` from `@epam/ai-dial-ui-kit` are present and allowed

#### Scenario: Empty description does not block submit

- **WHEN** `description` is empty, and `displayName`, `modelId`, and `prompt` are all filled
- **THEN** the Create button is enabled

#### Scenario: Description field enforces the 500-character limit client-side

- **WHEN** the user types into the Description textarea
- **THEN** the input cannot exceed 500 characters (`maxLength={500}`), and accessible feedback is shown once the field is non-empty

#### Scenario: No visible Schedule section heading is rendered

- **WHEN** the create-task form renders
- **THEN** no "Schedule" (or equivalently-worded) section legend or heading appears above the Repeat dropdown; the Repeat control and its conditional fields render inside the Details column's existing `role="group"` with no additional heading element

#### Scenario: One-time repeat uses the Calendar DateTime control

- **WHEN** `values.repeat === 'oneTime'`
- **THEN** the "Run at" field renders `Calendar` with `mode={CalendarMode.DateTime}`, not a native `<input type="datetime-local">`, and no Time, Day of week, or Day of month field renders

#### Scenario: Hourly repeat renders a Minute field and no time, weekday, or month-day fields

- **WHEN** `values.repeat === 'hourly'`
- **THEN** the "Minute" `Input` renders bound to `values.minute`, and no Time, Day of week, or Day of month field renders

#### Scenario: Daily, Weekly, and Monthly repeat values use the Calendar Time control

- **WHEN** `values.repeat` is `'daily'`, `'weekly'`, or `'monthly'`
- **THEN** the "Time" field renders `Calendar` with `mode={CalendarMode.Time}`, not a native `<input type="time">`

#### Scenario: Weekly repeat uses the Calendar Weekday control with ISO/APScheduler conversion

- **WHEN** `values.repeat === 'weekly'` and the user selects Monday in the "Day of week" `Calendar` (`mode={CalendarMode.Weekday}`, ISO value `"1"`)
- **THEN** `onFieldChange('dayOfWeek', '0')` is called (APScheduler convention), not `'1'`

#### Scenario: Form does not expose a stream control

- **WHEN** the create-task form renders
- **THEN** no stream toggle or `values.stream`-bound control is present in the rendered output

#### Scenario: Past days are unselectable in the run-at picker

- **WHEN** `values.repeat === 'oneTime'` and the user opens the run-at picker's month grid
- **THEN** every day strictly before the field's mount date renders disabled, and activating such a day fires no `onFieldChange('runAt', …)` — the out-of-range click is a no-op

#### Scenario: The mount date and future days remain selectable

- **WHEN** the user activates the field's mount date or any later day in the run-at picker
- **THEN** `onFieldChange('runAt', <datetime-local string>)` fires with the picked moment (local midnight when no time-of-day was set yet; the pre-picked time-of-day is kept when one exists)

#### Scenario: The earliest selectable moment does not change while the form stays open

- **WHEN** the create or edit form re-renders repeatedly after the run-at field mounted (e.g. the user edits other fields for several minutes)
- **THEN** the earliest selectable moment stays pinned at the field's mount time rather than advancing with each render, and the memoized `minDate` identity does not churn the `Calendar`'s internal effects

### Requirement: Reverse trigger mapping is fail-closed for unsupported or incomplete tasks

`libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts` SHALL export a reverse mapping function that converts a `ScheduledTaskDto` into `ScheduledTaskCreateFormValues`, inverting `buildCronFields`/`buildCronWindowBoundary`'s UTC→local conversion using the same reference-`Date`-plus-getters technique (browser timezone/DST handling, not manual offset arithmetic). The function SHALL return a discriminated result — success with mapped `values`, or failure with a reason — rather than a value that may itself be invalid. `trigger.cron.fields` MUST be evaluated by presence of a non-`null` value per key, not by key presence alone — DIAL Scheduler always returns every cron field key, using `null` for ones that are not set.

Before applying the existing numeric-hour parsing, the mapper SHALL check for the Hourly shape: when `fields.hour === '*'`, `fields.minute` is present with a purely-numeric value, and neither `day` nor `day_of_week` is present, the mapper SHALL succeed with `values.repeat = 'hourly'` and `values.minute` set to the local minute-of-hour equivalent of the stored UTC minute (via a reference `Date` set with `setUTCHours(0, utcMinute)`, reading back `getMinutes()` — the inverse of the forward `setHours(0, minute)` → `getUTCMinutes()` conversion), with no `time`/`dayOfWeek`/`dayOfMonth` field set. Any other non-numeric `hour` value (cron range/list/step expressions, or `*` combined with a `day`/`day_of_week`) continues to fail closed, same as today.

For the remaining (non-Hourly) shapes, mapping SHALL fail when: the task's `trigger` shape (cron fields with a set, non-`null` value outside `hour`/`minute`/`day`/`day_of_week`, or both `day` and `day_of_week` set) falls outside what `ScheduledTaskCreateFormValues`'s `repeat`-driven fields can express; `triggerType` does not correspond to a `repeat` value the form supports; or `model` is missing/empty, `prompt` is not a string, or both trimmed `prompt` and `skillUrl` are empty on the DTO. On mapping failure, `ScheduledTaskEditPage` SHALL render a localized, non-destructive error message and SHALL NOT mount `ScheduledTaskCreateForm` in an editable/submittable state — the original task's trigger is never read, coerced, and re-submitted.

#### Scenario: Once-schedule task round-trips through reverse mapping

- **WHEN** a task's `trigger` is `{ date: '2026-07-24T07:00:00.000Z' }` (UTC) and the viewer's browser timezone is UTC+2
- **THEN** the reverse mapper succeeds with `values.repeat = 'oneTime'` and `values.runAt` equal to the local `2026-07-24T09:00` equivalent

#### Scenario: Hourly task round-trips through reverse mapping at a whole-hour offset

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '*', minute: '15' }` and the viewer's browser timezone is UTC+2
- **THEN** the reverse mapper succeeds with `values.repeat = 'hourly'`, `values.minute = '15'` (unchanged — a whole-hour offset does not shift the minute), and no `time`, `dayOfWeek`, or `dayOfMonth` value is set

#### Scenario: Hourly task round-trips through reverse mapping at a sub-hour offset

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '*', minute: '45' }` and the viewer's browser timezone is UTC+5:30 (e.g. `Asia/Kolkata`)
- **THEN** the reverse mapper succeeds with `values.repeat = 'hourly'` and `values.minute = '15'` (45 UTC minutes past the hour, shifted forward by the 30-minute sub-hour offset)

#### Scenario: Daily recurring task round-trips through reverse mapping

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '7', minute: '0' }` (UTC) and the viewer's browser timezone is UTC+2
- **THEN** the reverse mapper succeeds with `values.repeat = 'daily'` and `values.time = '09:00'` (local)

#### Scenario: Weekly recurring task with day_of_week round-trips, including a UTC day-boundary shift

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '21', minute: '30', day_of_week: '1' }` (UTC Tuesday) and the local UTC+2 equivalent falls back onto Monday `23:30`
- **THEN** the reverse mapper succeeds with `values.repeat = 'weekly'`, `values.dayOfWeek` corresponding to Monday, and `values.time = '23:30'`

#### Scenario: Activity-window boundaries round-trip to local date-only values

- **WHEN** a task's `trigger.cron` includes `startDate`/`endDate` as UTC ISO instants at local-midnight and local-`23:59:59.999` respectively
- **THEN** the reverse mapper succeeds with `values.startDate`/`values.endDate` as the corresponding local `YYYY-MM-DD` strings, whether the trigger's `fields.hour` is `'*'` (Hourly) or a fixed numeric hour

#### Scenario: DST-crossing date maps without a one-hour drift

- **WHEN** a recurring task's stored UTC `hour`/`minute` corresponds to a local wall-clock time on a date where the viewer's timezone observes a DST transition relative to the current reference date
- **THEN** the reverse mapper produces a local `time` consistent with the DST offset in effect for the mapped date, not the offset in effect "now"

#### Scenario: Unsupported cron shape fails closed

- **WHEN** a task's `trigger.cron.fields` encodes a shape the create form's `repeat` control cannot represent (e.g. multiple `day_of_week` values, a field the form has no control for, or `hour: '*'` combined with a set `day`/`day_of_week`)
- **THEN** the reverse mapper returns a failure result, no `ScheduledTaskCreateFormValues` are produced, and the edit page shows a non-destructive "can't be edited here" message with Save unavailable

#### Scenario: Null-valued cron fields are treated as absent, not as unsupported

- **WHEN** a task's `trigger.cron.fields` is the full DIAL Scheduler shape with every field key present but unset ones set to `null` (e.g. `{ hour: '9', minute: '0', day: null, week: null, year: null, month: null, second: null, day_of_week: null }`)
- **THEN** the reverse mapper succeeds as a plain daily schedule (`values.repeat = 'daily'`) — the presence of a field key alone (with a `null` value) MUST NOT be treated as an unsupported extra field or as a set `day`/`day_of_week`

#### Scenario: Missing required fields fails closed

- **WHEN** a task's `model` is missing/empty, `prompt` is not a string, or both trimmed `prompt` and `skillUrl` are empty
- **THEN** the reverse mapper returns a failure result, and the edit page shows the same non-destructive error with Save unavailable, without submitting a partial update

#### Scenario: Skill-only task hydrates without catalog metadata

- **WHEN** an otherwise supported task has `prompt: ""` and a saved `skillUrl`
- **THEN** mapping succeeds with the same reference and empty prompt, independently of skill metadata resolution

### Requirement: Create and edit integrate shared validation without duplicating policy

Both app pages SHALL use the shared validator/checked preparation before API writes and map error codes through one host translation mapping. A local useScheduledTaskFormLabels(mode) SHALL own common labels/options. Form values and notifications SHALL remain app-owned. Network failure SHALL preserve edits. The library minimum disabled guard SHALL not replace full submit validation.

#### Scenario: Both submit paths reject missing recurrence day

- **WHEN** Create or Save is activated for Weekly/Monthly without its day
- **THEN** a field error is shown and neither create nor update is called.

#### Scenario: Correcting a field clears obsolete feedback

- **WHEN** a user fixes an invalid field or changes repeat mode
- **THEN** irrelevant field errors clear/recompute consistently in create and edit while other errors remain meaningful.

#### Scenario: Save failure preserves entered values

- **WHEN** a valid write request fails
- **THEN** the form preserves values, reports the host error and re-enables actions without navigation.

Both pages SHALL pass support resolved for the draft model into shared preparation and derive immediate skill errors from the same pure predicate/validator. Server skill errors SHALL map to the existing unsupported translation. A deployment-lookup 404 SHALL be distinguished from a missing task and SHALL preserve the edit draft.

#### Scenario: Immediate and submit validation share capability errors

- **WHEN** a selected model changes to one without explicit skill support while the draft has a skill
- **THEN** the field immediately shows the shared error, Save is disabled, and checked submission returns no body even if invoked directly

### Requirement: Cancel returns to returnUrl; valid submit calls the BFF create endpoint

The create-task page SHALL read a `returnUrl` query parameter (default `ROUTES.ScheduledTasks` when absent or invalid). Cancel SHALL discard in-progress form state, perform no network call, and navigate to `returnUrl`.

A valid submit SHALL call `POST /api/v1/scheduled-tasks` through `apps/chat/src/server-api/scheduled-tasks.api.ts` (wrapping the generated `@epam/ai-dial-chat-api-client` method from `add-scheduled-tasks-api`) with a body matching `CreateScheduledTaskBodyDto`: `displayName`, `trigger`, `model`, `prompt` (possibly empty with a skill), optional `skillUrl`, and optional `description` (trimmed; included only when non-empty, otherwise omitted from the body entirely — never sent as an empty string). The body SHALL NOT include a `stream` field — streaming is fixed server-side and is not client-controllable. The page's client-side validator SHALL reject a `description` longer than 500 characters before submit, mirroring the BFF's `@MaxLength(500)`. On **201 Created**, the page SHALL show a success notification via `useNotification` and navigate to `returnUrl`. On **4xx/5xx**, the page SHALL show an error notification, remain on the form with user-entered values (including `description`) preserved, and re-enable the Create action.

**Dependency:** requires `add-scheduled-tasks-api` (`POST /api/v1/scheduled-tasks` + `scheduled-tasks.api.ts` wrapper) to be implemented first.

#### Scenario: Cancel discards changes and returns

- **WHEN** the user has typed into the display name field and activates Cancel
- **THEN** the app navigates to `returnUrl` and no notification or network call occurs

#### Scenario: Valid submit persists via BFF and returns

- **WHEN** all required fields pass validation and the user activates Create
- **THEN** the app sends `POST /api/v1/scheduled-tasks` with `{ displayName, trigger, model, prompt, skillUrl?, description? }` (no `stream` field), shows a success notification on 201, and navigates to `returnUrl`

#### Scenario: Submit failure keeps the form open

- **WHEN** the user activates Create and the BFF returns 400 or 502
- **THEN** an error notification is shown, the user remains on the create form with their input preserved, and no navigation to `returnUrl` occurs

#### Scenario: Missing returnUrl falls back to the list route

- **WHEN** the create route is opened without a `returnUrl` query parameter
- **THEN** Cancel and a successful submit both navigate to `ROUTES.ScheduledTasks`

#### Scenario: Invalid returnUrl falls back to the list route

- **WHEN** the create route is opened with an empty, absolute, protocol-relative, backslash-containing, or control-character-containing `returnUrl`
- **THEN** Cancel and a successful submit both navigate to `ROUTES.ScheduledTasks`

#### Scenario: Non-empty description is included in the submit body

- **WHEN** the user enters a `description` and activates Create
- **THEN** the `POST` body includes `description` with the trimmed entered value

#### Scenario: Empty description is omitted from the submit body

- **WHEN** the user leaves `description` empty and activates Create
- **THEN** the `POST` body has no `description` field

#### Scenario: Description over 500 characters blocks submit

- **WHEN** the user enters a `description` longer than 500 characters and activates Create
- **THEN** the page shows a validation error, no `POST` request is sent, and the Create action does not proceed

### Requirement: Edit page submits via PUT and preserves input on failure

On submit, `ScheduledTaskEditPage` SHALL run the same client-side validation rules as the create page, map the current form `values` to `UpdateScheduledTaskBodyDto` (identical shape to `CreateScheduledTaskBodyDto`) using the same trigger-building logic as `mapFormValuesToCreateBody`, and call `updateScheduledTask(scheduleId, body)` (`PUT /api/v1/scheduled-tasks/:scheduleId`) through `apps/chat/src/server-api/scheduled-tasks.api.ts`. The Save action SHALL be disabled while a submission is in flight (`isSubmitting`) to prevent duplicate submissions. On success (**200 OK**), the page SHALL show a localized success notification and navigate to `getScheduledTaskDetailRoute(scheduleId)`. On failure, all user-entered form values SHALL be preserved, an error notification SHALL be shown (including the request/trace id when available, per the existing notification pattern), `isSubmitting` SHALL be reset so Save is re-enabled, and no navigation SHALL occur. A task-not-found **404** SHALL render the same NotFoundPage treatment as an initial task-load 404; a response carrying `scheduledTaskDeploymentUnavailable` SHALL preserve the draft and show a model error instead. **400**, **403**, **429**, **502**, and **503** SHALL all surface through that same single error-notification path — the notification's message text comes from the server's own error body via `getApiErrorDetails`, so it already differs meaningfully per status without the page hardcoding four separate copy variants, matching `ScheduledTaskCreatePage`'s existing single-catch-all error handling. **401** SHALL trigger the app's existing unauthenticated-session handling in the API client layer, which intercepts it before it reaches this page's catch block in the normal flow.

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

The shared update mapper SHALL include the hydrated `skillUrl`, or explicit `null` after removal, and allow empty prompt with a skill. Skill compatibility/content errors returned by the BFF SHALL be displayed without losing draft state. A hidden feature-gated field SHALL not be cleared during hydration or serialization.

#### Scenario: Edit removes a skill explicitly

- **WHEN** a user removes the skill, retains nonblank instructions, and saves
- **THEN** the PUT body includes `skillUrl: null`, and a subsequent detail/edit read has no skill

### Requirement: Page maps form values to BFF trigger shape

`ScheduledTaskCreatePage` SHALL use `@epam/ai-dial-chat-hooks/scheduled-tasks` checked preparation to convert form `values` to the BFF `trigger` field before calling `createScheduledTask`, branching on `values.repeat`:

- `repeat === 'oneTime'`: `trigger = { date: <ISO-8601 datetime> }` built from `runAt`
- `repeat === 'hourly'`: `trigger = { cron: { fields: { hour: '*', minute } } }`, where `minute` is the UTC-equivalent minute-of-hour of the user-entered local `values.minute`, computed via `buildCronFields` using a reference `Date` set to local hour `0`/local `minute` and reading back `getUTCMinutes()`. `hour` itself is always the literal `'*'` and is never converted — only whole-hour-offset timezones make the hour boundary itself timezone-invariant; the sub-hour offset (relevant for timezones like UTC+5:30/UTC+5:45) is carried entirely in the `minute` conversion
- `repeat === 'daily'`: `trigger = { cron: { fields: { hour, minute } } }`, where `hour`/`minute` are the UTC equivalent of the local `time` the user entered, computed via `buildCronFields` in `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts` using the browser's IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
- `repeat === 'weekly'`: include `day_of_week` as the UTC-equivalent weekday (shifted ±1, mod 7, relative to the locally-selected `dayOfWeek`, whenever the local→UTC hour conversion crosses a calendar-day boundary), alongside the UTC `hour`/`minute`
- `repeat === 'monthly'`: include `day` as the UTC-equivalent day-of-month derived from the same conversion, alongside the UTC `hour`/`minute`

This mapping, including the local→UTC conversion for the `'hourly'`/`'daily'`/`'weekly'`/`'monthly'` fields, MUST remain in `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts`, reused by app adapters under the existing configured-client/type exception, not duplicated in app pages or presentation libraries. `buildCronFields` MUST use a single reference `Date` and read back UTC getters from it rather than computing the UTC offset by hand: for `'daily'`/`'weekly'`/`'monthly'`, the reference is constructed from the local `hour`/`minute` (rolled to the matching local weekday/day-of-month for weekly/monthly) and `getUTCHours()`/`getUTCMinutes()`/`getUTCDay()`/`getUTCDate()` are read back; for `'hourly'`, the reference is constructed from local hour `0`/local `minute` and only `getUTCMinutes()` is read back, with `hour` always emitted as the literal `'*'`.

#### Scenario: One-time repeat sends trigger.date

- **WHEN** the user selects Repeat = One-time with run at `2026-07-24T09:00` (local) and submits
- **THEN** the POST body includes `trigger.date` as an ISO-8601 string and no `trigger.cron`

#### Scenario: Hourly repeat sends the user-selected minute with hour always wildcarded

- **WHEN** the user selects Repeat = Hourly, enters `minute = '15'`, and submits, with the browser at a whole-hour-offset timezone (e.g. UTC+2)
- **THEN** the POST body includes `trigger.cron.fields` equal to exactly `{ hour: '*', minute: '15' }`, with no `day` or `day_of_week` key

#### Scenario: Hourly minute is converted for a sub-hour-offset timezone

- **WHEN** the user selects Repeat = Hourly, enters `minute = '15'`, and submits, with the browser at UTC+5:30 (e.g. `Asia/Kolkata`)
- **THEN** the POST body includes `trigger.cron.fields.minute = '45'` (15 local minutes past the hour, shifted back by the 30-minute sub-hour offset) and `trigger.cron.fields.hour = '*'`

#### Scenario: Daily repeat sends UTC-converted trigger.cron.fields

- **WHEN** the user selects Repeat = Daily with local time `09:00` in a timezone at UTC+2 and submits
- **THEN** the POST body includes `trigger.cron.fields.hour = '7'` and `trigger.cron.fields.minute = '0'` (the UTC equivalent), not the raw local `hour`/`minute`

#### Scenario: Weekly repeat shifts day_of_week when the UTC conversion crosses midnight

- **WHEN** the user selects Repeat = Weekly with local time `23:30` on Monday in a timezone at UTC+2, so the UTC equivalent falls on Tuesday `21:30`
- **THEN** the POST body's `trigger.cron.fields.day_of_week` reflects Tuesday (the UTC calendar day), not Monday (the locally-selected day)

#### Scenario: Daily repeat at a timezone-neutral moment is a no-op conversion

- **WHEN** the user's browser timezone is UTC and they select Repeat = Daily with local time `09:00`
- **THEN** the POST body includes `trigger.cron.fields.hour = '9'` and `trigger.cron.fields.minute = '0'`, unchanged from the entered local value
