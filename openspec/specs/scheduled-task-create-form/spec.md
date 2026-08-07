# Spec: scheduled-task-create-form

## Requirements

### Requirement: New task navigates to a dedicated create route

The Scheduled Tasks list page's primary "create" action SHALL navigate to a new route, `ROUTES.ScheduledTaskCreate` (`/scheduled-tasks/new`), passing the current list URL as a `returnUrl` query parameter, instead of invoking a no-op handler. The route SHALL be lazy-loaded and registered in `apps/chat/src/app/app.tsx` using the same `RouteErrorBoundary` + `Suspense` + `RouteFallback` pattern as `ROUTES.ScheduledTasks`. State is owned by the `ScheduledTaskCreatePage` component (local `useState`) — no new React Context is introduced.

**Feature flag:** reuses `scheduledTasksEnabled` (no new flag). **RTL impact:** page mirrors per logical-property rules (see RTL requirement below). **i18n impact:** see i18n requirement below. **Telemetry:** none in this iteration.

#### Scenario: Create button navigates with returnUrl

- **WHEN** `scheduledTasksEnabled` is `true` and the user activates the **New task** button on `/scheduled-tasks`
- **THEN** the app navigates to `/scheduled-tasks/new?returnUrl=%2Fscheduled-tasks`

#### Scenario: Flag disabled hides the create route

- **WHEN** `scheduledTasksEnabled` resolves to `false` and the user navigates directly to `/scheduled-tasks/new`
- **THEN** the app renders the same `NotFound` content it renders for any unregistered path

#### Scenario: Route is lazy-loaded

- **WHEN** the JS bundle is evaluated without navigating to `/scheduled-tasks/new`
- **THEN** the create-task page code is NOT included in the initial bundle

### Requirement: Cancel returns to returnUrl; valid submit calls the BFF create endpoint

The create-task page SHALL read a `returnUrl` query parameter (default `ROUTES.ScheduledTasks` when absent or invalid). Cancel SHALL discard in-progress form state, perform no network call, and navigate to `returnUrl`.

A valid submit SHALL call `POST /api/v1/scheduled-tasks` through `apps/chat/src/server-api/scheduled-tasks.api.ts` (wrapping the generated `@epam/chat-api-client` method from `add-scheduled-tasks-api`) with a body matching `CreateScheduledTaskBodyDto`: `displayName`, `trigger`, `model`, `prompt`, and optional `description` (trimmed; included only when non-empty, otherwise omitted from the body entirely — never sent as an empty string). The body SHALL NOT include a `stream` field — streaming is fixed server-side and is not client-controllable. The page's client-side validator SHALL reject a `description` longer than 500 characters before submit, mirroring the BFF's `@MaxLength(500)`. On **201 Created**, the page SHALL show a success notification via `useNotification` and navigate to `returnUrl`. On **4xx/5xx**, the page SHALL show an error notification, remain on the form with user-entered values (including `description`) preserved, and re-enable the Create action.

**Dependency:** requires `add-scheduled-tasks-api` (`POST /api/v1/scheduled-tasks` + `scheduled-tasks.api.ts` wrapper) to be implemented first.

#### Scenario: Cancel discards changes and returns

- **WHEN** the user has typed into the display name field and activates Cancel
- **THEN** the app navigates to `returnUrl` and no notification or network call occurs

#### Scenario: Valid submit persists via BFF and returns

- **WHEN** all required fields pass validation and the user activates Create
- **THEN** the app sends `POST /api/v1/scheduled-tasks` with `{ displayName, trigger, model, prompt, description? }` (no `stream` field), shows a success notification on 201, and navigates to `returnUrl`

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

### Requirement: ScheduledTaskCreateForm lib component matches the BFF create contract

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCreateForm` component accepting `texts`, `values`, `errors`, `modelOptions` (`{ id, label }[]`), `onFieldChange`, `onCancel`, `onSubmit`, and optional `isSubmitting` (default `false`).

It SHALL render:

- **Display name** — required text input (`values.displayName`)
- **Description** — optional textarea (`values.description`), rendered between Display name and Schedule type, with `maxLength={500}` and accessible feedback (e.g. a character count or inline validation message per `errors.description`) shown when the field is non-empty
- **Schedule type** — control to choose one-shot vs recurring (`values.scheduleType`: `'once' | 'recurring'`)
- **Run at** — a `Calendar` control (`mode={CalendarMode.DateTime}`, imported from `@epam/ai-dial-ui-kit`) shown when `scheduleType === 'once'`, bound to `values.runAt`; replaces the native `<input type="datetime-local">` previously used for this field
- **Frequency** — dropdown (Daily / Weekly / Monthly) shown when `scheduleType === 'recurring'` (`values.frequency`)
- **Time** — a `Calendar` control (`mode={CalendarMode.Time}`, imported from `@epam/ai-dial-ui-kit`) for recurring schedules, bound to `values.time` (`HH:mm` local wall-clock string, validated at app edge); replaces the native `<input type="time">` previously used for this field
- **Day of week** — a `Calendar` control (`mode={CalendarMode.Weekday}`, imported from `@epam/ai-dial-ui-kit`) shown when frequency is Weekly, bound to `values.dayOfWeek` via `dayOfWeekToCalendarValue`/`calendarValueToDayOfWeek` (`libs/scheduled-tasks/src/utils/calendar-value.ts`), which convert between `Calendar`'s ISO weekday value (`"1"`=Monday..`"7"`=Sunday) and `values.dayOfWeek`'s APScheduler-convention string (`"0"`=Monday..`"6"`=Sunday); replaces the free-text `<input>` previously used for this field
- **Day of month** — shown when frequency is Monthly (`values.dayOfMonth`)
- **Model** — required dropdown populated from `modelOptions` (`values.modelId`)
- **Prompt** — required textarea (`values.prompt`)
- **Cancel / Create** actions

`values` SHALL NOT include a `stream` field, and the form MUST NOT render a stream toggle — scheduled task runs are always non-streaming background executions and this is not a user-configurable option.

`description` is optional and MUST NOT participate in the Create-button required-field guard. The Create action SHALL be disabled while `isSubmitting` is `true` or while `displayName`, `modelId`, or `prompt` are empty (minimum client-side guard; full validation lives in the page).

The `Run at` and `Time` `Calendar` controls' `onChange` callbacks MUST adapt the ui-kit's `CalendarValue` (`Date | string | null`) into calls to `onFieldChange('runAt', ...)` / `onFieldChange('time', ...)` using the same value shapes the page already consumes (`values.runAt` as a `Date`-constructible value, `values.time` as an `"HH:mm"` string) — this is a UI-control swap, not a change to the `values`/`onFieldChange` contract.

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, notification context, deployments context, auth, env, or analytics. Importing `Calendar`/`CalendarMode` from `@epam/ai-dial-ui-kit` is permitted — it is a generic design-system control with no host-specific integration knowledge.

#### Scenario: Required-field guard blocks submit

- **WHEN** `displayName` is empty or `modelId` is unset
- **THEN** the Create button is disabled

#### Scenario: Submitting is reflected in the UI

- **WHEN** `isSubmitting` is `true`
- **THEN** the Create button is disabled and shows a busy/loading affordance

#### Scenario: Model options are passed in, not fetched

- **WHEN** `ScheduledTaskCreateForm` renders with `modelOptions={[{ id: 'gpt-4o', label: 'GPT-4o' }]}`
- **THEN** the model dropdown lists that option and the lib performs no deployment/API fetch

#### Scenario: Lib has no host or integration imports

- **WHEN** `libs/scheduled-tasks` source (including `ScheduledTaskCreateForm`) is statically analyzed
- **THEN** it contains no imports of `apps/chat/*`, `@epam/chat-api-client`, `server-api`, routing, feature-flag, notification, deployments, auth, env, or analytics modules; imports of `Calendar`/`CalendarMode` from `@epam/ai-dial-ui-kit` are present and allowed

#### Scenario: Empty description does not block submit

- **WHEN** `description` is empty, and `displayName`, `modelId`, and `prompt` are all filled
- **THEN** the Create button is enabled

#### Scenario: Description field enforces the 500-character limit client-side

- **WHEN** the user types into the Description textarea
- **THEN** the input cannot exceed 500 characters (`maxLength={500}`), and accessible feedback is shown once the field is non-empty

#### Scenario: Once schedule uses the Calendar DateTime control

- **WHEN** `scheduleType === 'once'`
- **THEN** the "Run at" field renders `Calendar` with `mode={CalendarMode.DateTime}`, not a native `<input type="datetime-local">`

#### Scenario: Recurring schedule uses the Calendar Time control

- **WHEN** `scheduleType === 'recurring'`
- **THEN** the "Time" field renders `Calendar` with `mode={CalendarMode.Time}`, not a native `<input type="time">`

#### Scenario: Weekly recurring schedule uses the Calendar Weekday control with ISO/APScheduler conversion

- **WHEN** `scheduleType === 'recurring'`, `frequency === 'weekly'`, and the user selects Monday in the "Day of week" `Calendar` (`mode={CalendarMode.Weekday}`, ISO value `"1"`)
- **THEN** `onFieldChange('dayOfWeek', '0')` is called (APScheduler convention), not `'1'`

#### Scenario: Form does not expose a stream control

- **WHEN** the create-task form renders
- **THEN** no stream toggle or `values.stream`-bound control is present in the rendered output

### Requirement: Page maps form values to BFF trigger shape

`ScheduledTaskCreatePage` SHALL convert form `values` to the BFF `trigger` field before calling `createScheduledTask`:

- When `scheduleType === 'once'`: `trigger = { date: <ISO-8601 datetime> }` built from `runAt`
- When `scheduleType === 'recurring'` and frequency is Daily: `trigger = { cron: { fields: { hour, minute } } }`, where `hour`/`minute` are the UTC equivalent of the local `time` the user entered, computed via `buildCronFields` in `apps/chat/src/utils/scheduled-task-trigger.ts` using the browser's IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
- When frequency is Weekly: include `day_of_week` as the UTC-equivalent weekday (shifted ±1, mod 7, relative to the locally-selected `dayOfWeek`, whenever the local→UTC hour conversion crosses a calendar-day boundary), alongside the UTC `hour`/`minute` (exact field name confirmed against scheduler OpenAPI during implementation)
- When frequency is Monthly: include `day` as the UTC-equivalent day-of-month derived from the same conversion, alongside the UTC `hour`/`minute`

This mapping, including the local→UTC conversion for all recurring fields, MUST live in `apps/chat` (page or `utils/`), not in the lib. `buildCronFields` MUST use a single reference `Date` (constructed from the local `hour`/`minute`, and, for weekly/monthly, rolled to the matching local weekday/day-of-month) and read back `getUTCHours()`/`getUTCMinutes()`/`getUTCDay()`/`getUTCDate()` from it, rather than computing the UTC offset by hand.

#### Scenario: Once schedule sends trigger.date

- **WHEN** the user selects schedule type Once with run at `2026-07-24T09:00` (local) and submits
- **THEN** the POST body includes `trigger.date` as an ISO-8601 string and no `trigger.cron`

#### Scenario: Daily recurring sends UTC-converted trigger.cron.fields

- **WHEN** the user selects Recurring / Daily with local time `09:00` in a timezone at UTC+2 and submits
- **THEN** the POST body includes `trigger.cron.fields.hour = '7'` and `trigger.cron.fields.minute = '0'` (the UTC equivalent), not the raw local `hour`/`minute`

#### Scenario: Weekly recurring shifts day_of_week when the UTC conversion crosses midnight

- **WHEN** the user selects Recurring / Weekly with local time `23:30` on Monday in a timezone at UTC+2, so the UTC equivalent falls on Tuesday `21:30`
- **THEN** the POST body's `trigger.cron.fields.day_of_week` reflects Tuesday (the UTC calendar day), not Monday (the locally-selected day)

#### Scenario: Daily recurring at a timezone-neutral moment is a no-op conversion

- **WHEN** the user's browser timezone is UTC and they select Recurring / Daily with local time `09:00`
- **THEN** the POST body includes `trigger.cron.fields.hour = '9'` and `trigger.cron.fields.minute = '0'`, unchanged from the entered local value

### Requirement: Create-task strings flow through react-i18next

Every user-visible string on the create-task page (page title, schedule-section labels, frequency option labels, model/prompt/description labels, validation messages, success/error notifications) MUST be resolved via `useTranslation().t()` in `ScheduledTaskCreatePage` and passed into the lib as plain strings. Feature-specific keys live under `scheduledTasks.create.*` in `apps/chat/src/i18n/locales/en.json`, referenced through `ScheduledTasksI18nKeys`. The display name label/required message MUST reuse `EditorI18nKeys.NameLabel` and `EditorI18nKeys.NameRequired`. Cancel/Create MUST reuse `ButtonsI18nKeys.Cancel` and `ButtonsI18nKeys.Create`.

#### Scenario: New keys exist for schedule and model copy

- **WHEN** the change is applied
- **THEN** `en.json` contains at minimum `scheduledTasks.create.pageTitle`, `scheduledTasks.create.scheduleSectionLabel`, `scheduledTasks.create.scheduleTypeOnce`, `scheduledTasks.create.scheduleTypeRecurring`, `scheduledTasks.create.frequencyDaily`, `scheduledTasks.create.frequencyWeekly`, `scheduledTasks.create.frequencyMonthly`, `scheduledTasks.create.timeLabel`, `scheduledTasks.create.modelLabel`, `scheduledTasks.create.promptLabel`, `scheduledTasks.create.descriptionLabel`, `scheduledTasks.create.descriptionMaxLengthError`, `scheduledTasks.create.successNotification`, and `scheduledTasks.create.errorNotification`, and no longer needs a `streamLabel` key

#### Scenario: Generic labels are reused, not duplicated

- **WHEN** `ScheduledTaskCreatePage` renders `<ScheduledTaskCreateForm />`
- **THEN** display name text props resolve from `EditorI18nKeys` and Cancel/Create from `ButtonsI18nKeys`, not duplicated feature-scoped strings

### Requirement: Create-task page supports RTL and meets AAA accessibility defaults

All directional layout in the create-task header and form MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) instead of physical ones, per `.claude/rules/rtl.md`. Every form field MUST have an accessible label distinct from its placeholder. Dropdowns (frequency, model) MUST expose `aria-expanded` and mark the selected option via `aria-selected`/`aria-current`. Focus-visible styling on Cancel/Create MUST match hover feedback per `.claude/rules/a11y.md`.

#### Scenario: Page mirrors under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the create-task header and form lay out mirrored with no hard-coded left/right offsets breaking the mirrored layout

#### Scenario: Form fields are labeled

- **WHEN** the create-task form renders
- **THEN** display name, schedule controls, model, and prompt each have an accessible name distinct from any placeholder text

#### Scenario: Model dropdown exposes expanded/selected state

- **WHEN** the user opens the model dropdown
- **THEN** the trigger has `aria-expanded="true"` and the selected model option is marked `aria-selected="true"` (or `aria-current`)

### Requirement: ScheduledTaskCreateForm renders optional Start date / End date pickers for recurring schedules

`ScheduledTaskCreateFormValues` SHALL gain two optional fields:

```ts
/** Date-only value bounding the start of a recurring schedule's activity window. Ignored when `scheduleType` is `'once'`. */
startDate?: string;
/** Date-only value bounding the end of a recurring schedule's activity window. Ignored when `scheduleType` is `'once'`. */
endDate?: string;
```

`ScheduledTaskCreateFormErrors` SHALL gain `startDate?: string` and `endDate?: string`. `ScheduledTaskCreateFormLabels` SHALL gain `startDateLabel`, `endDateLabel`, `startDatePlaceholder` (default `"Pick start date"`), and `endDatePlaceholder` (default `"Pick end date"`) — both fields are optional, so neither label renders a required marker.

`ScheduledTaskCreateForm` SHALL render both pickers only when `values.scheduleType === ScheduledTaskScheduleType.Recurring`, positioned below the existing **Time** field (and below **Day of week**/**Day of month** when those render), using the `Calendar` component from `@epam/ai-dial-ui-kit` with `mode={CalendarMode.Date}` — date-only, no time part, matching the design's "Pick start/end date" pickers. Layout SHALL be a two-column row (`flex gap-*`, each picker `flex-1`) on desktop and stacked on mobile, per `.claude/skills/responsive-design`. Errors render with the same inline-error paragraph pattern already used for `runAt`/`time` (`errors.startDate`/`errors.endDate` shown in a `<p>` with `instructionsErrorClassName`).

`libs/scheduled-tasks/src/utils/calendar-value.ts` SHALL gain `dateValueToCalendarValue` and `calendarValueToDateValue` helpers producing/consuming a `YYYY-MM-DD` date-only string — a distinct pair from `calendarValueToRunAt`, which emits a `datetime-local` string for a different consumer (`values.runAt`). The pickers' `onChange` callbacks adapt the ui-kit's `CalendarValue` into `onFieldChange('startDate', ...)` / `onFieldChange('endDate', ...)` calls using these helpers, following the same controlled-value pattern as `runAt`/`time`.

The lib remains presentational: it performs no timezone conversion, no i18n, and no cross-field ordering validation between `startDate` and `endDate` — it only renders whatever `errors.startDate`/`errors.endDate` the page supplies. The component continues to import nothing from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, notification context, deployments context, auth, env, or analytics.

#### Scenario: Pickers render only for recurring schedules

- **WHEN** `values.scheduleType === 'once'`
- **THEN** neither the Start date nor End date picker renders

#### Scenario: Pickers render below Time for recurring schedules

- **WHEN** `values.scheduleType === 'recurring'`
- **THEN** both the Start date and End date `Calendar` (`mode={CalendarMode.Date}`) pickers render below the Time field, neither carrying a required-field marker

#### Scenario: Picker onChange adapts CalendarValue to a date-only string

- **WHEN** the user selects a date in the Start date picker
- **THEN** `onFieldChange('startDate', <YYYY-MM-DD string>)` is called via `calendarValueToDateValue`, not a `datetime-local` string

#### Scenario: Inline errors render for the new fields

- **WHEN** `errors.endDate` is a non-empty string and `values.scheduleType === 'recurring'`
- **THEN** the End date field renders that message in the same inline-error paragraph style as `errors.time`

#### Scenario: Mobile layout stacks the two pickers

- **WHEN** the viewport is at the mobile breakpoint and `values.scheduleType === 'recurring'`
- **THEN** the Start date and End date pickers stack vertically instead of rendering as a two-column row

#### Scenario: Lib still has no host or integration imports

- **WHEN** `libs/scheduled-tasks` source is statically analyzed after this change
- **THEN** it contains no new imports of `apps/chat/*`, `@epam/chat-api-client`, `server-api`, routing, feature-flag, notification, deployments, auth, env, or analytics modules

### Requirement: Create-task page validates and converts the activity window to UTC boundaries

`ScheduledTaskCreatePage`'s `DEFAULT_VALUES` SHALL include `startDate: undefined` and `endDate: undefined`. Before calling `createScheduledTask`, when both `values.startDate` and `values.endDate` are set and `endDate` is not strictly after `startDate`, the page SHALL set `errors.endDate` to a validation message and block submit; when either or both fields are empty, this check is skipped (both empty is valid — an unbounded recurring schedule).

`mapFormValuesToCreateBody` (`apps/chat/src/utils/scheduled-task-trigger.ts`) SHALL build the `trigger.cron` object for a recurring schedule as `{ fields, ...(startDate ? { startDate: <iso> } : {}), ...(endDate ? { endDate: <iso> } : {}) }`, and MUST NOT include `startDate`/`endDate` when `scheduleType === 'once'` (the one-shot branch is unaffected by this change). The local calendar-day-to-UTC-instant conversion SHALL follow the same reference-`Date`-plus-UTC-getters technique `buildCronFields` already uses and documents in its own code comment, extended to cover this case: `startDate` converts to that local calendar day's `00:00:00.000` local time, then to its UTC ISO equivalent; `endDate` converts to that local calendar day's `23:59:59.999` local time, then to its UTC ISO equivalent, so the last local day the user selected is not cut off by the UTC conversion.

Feature-specific i18n keys `scheduledTasks.create.startDateLabel`, `scheduledTasks.create.endDateLabel`, `scheduledTasks.create.startDatePlaceholder`, `scheduledTasks.create.endDatePlaceholder`, and `scheduledTasks.create.endDateBeforeStartError` SHALL be added to `apps/chat/src/i18n/locales/en.json` with matching `ScheduledTasksI18nKeys` enum entries, resolved via `useTranslation().t()` in `ScheduledTaskCreatePage` and passed into the lib as plain strings, per the existing i18n requirement for this page.

#### Scenario: No dates set is a valid submit

- **WHEN** `scheduleType === 'recurring'` and both `startDate` and `endDate` are empty
- **THEN** submit proceeds and the POST body's `trigger.cron` has no `startDate`/`endDate` keys

#### Scenario: Both dates set sends a UTC-converted window

- **WHEN** `scheduleType === 'recurring'`, `startDate = '2026-08-01'`, `endDate = '2026-08-31'`, and the browser's local timezone is UTC+2
- **THEN** the POST body's `trigger.cron.startDate` is `'2026-07-31T22:00:00.000Z'` (local midnight Aug 1 in UTC+2) and `trigger.cron.endDate` is `'2026-08-31T21:59:59.999Z'` (local 23:59:59.999 Aug 31 in UTC+2)

#### Scenario: endDate not after startDate blocks submit with an inline error

- **WHEN** the user sets `endDate` equal to or earlier than `startDate` and activates Create
- **THEN** `errors.endDate` is set to the `endDateBeforeStartError` message, no `createScheduledTask` call is made, and the form remains open

#### Scenario: Switching back to Once never sends the window

- **WHEN** the user set `startDate`/`endDate` while `scheduleType === 'recurring'`, then switches `scheduleType` to `'once'` and submits
- **THEN** the POST body's `trigger` is `{ date: <ISO> }` only — no `cron`, `startDate`, or `endDate` field is present

#### Scenario: Boundary conversion is correct across a DST transition

- **WHEN** `startDate`/`endDate` span a date range that crosses a daylight-saving-time transition in the browser's local timezone
- **THEN** both converted UTC instants still represent local `00:00:00.000` and local `23:59:59.999` respectively on their calendar days, using the timezone offset in effect on each specific day, not a single offset applied to both

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
