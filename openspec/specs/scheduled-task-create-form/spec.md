# Spec: scheduled-task-create-form

## Purpose

The create and edit routes for scheduled tasks and the shared form component behind them.

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

### Requirement: ScheduledTaskCreateForm lib component matches the BFF create contract

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCreateForm` component accepting `labels`, `values`, `errors`, `modelSelector` (`ReactNode`), `modelLabelId` (`string`), `onFieldChange`, `onCancel`, `onBack`, `onSubmit`, and optional `isSubmitting` (default `false`). `modelLabelId` is applied as the `id` of the Model or Agent field's `Label` element; the host generates it (e.g. via React `useId()`) rather than a hardcoded literal, and passes the same value as `modelSelector`'s own `aria-labelledby` target, so two concurrently-mounted form instances (or any future host reusing the component) never collide on a shared DOM id.

The form SHALL render inside the shared `BuilderFormContainer` shell (`@epam/ai-dial-builder-form`) as a full-width header followed by a responsive two-column body:

- **Header** — start side: a back control (arrow icon, mirrored in RTL via `rtl:scale-x-[-1]`) that calls `onBack` when activated, followed by the page title (`labels.pageTitle`). End side: Cancel (`labels.cancelButtonLabel`, calls `onCancel`) and the submit action (`labels.createButtonLabel`, calls `onSubmit`), in that order — shown at the `desktop` breakpoint; at `mobile` the pair moves to the form's sticky footer (see "Create-task form chrome adapts to mobile").
- **Details column** — a `role="group"` region labeled `labels.detailsSectionTitle`, holding Display name, Description, Repeat and its conditional schedule fields, and Model or Agent.
- **Configuration column** — a `role="group"` region labeled `labels.configurationSectionTitle`, holding Skill and Instructions.

At the `desktop` breakpoint the two columns SHALL render side by side, Details narrower than Configuration. At `mobile` they SHALL stack full-width, Details above Configuration. Only Tailwind logical properties and the project's named breakpoints (`mobile`, `desktop`) MAY be used for this layout.

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

#### Scenario: Back control calls onBack without submitting

- **WHEN** the user activates the back control in the header
- **THEN** `onBack` is called, `onSubmit` is not called, and no field values are reset

#### Scenario: Details and Configuration render as two distinct regions

- **WHEN** `ScheduledTaskCreateForm` renders
- **THEN** the Display name, Description, Repeat, and Model or Agent fields render inside the group labeled `labels.detailsSectionTitle`, and the Skill and Instructions fields render inside the group labeled `labels.configurationSectionTitle`

#### Scenario: Instructions editor updates the prompt value

- **WHEN** the user types in the Instructions markdown editor
- **THEN** `onFieldChange('prompt', <new value>)` is called with the editor's current text

#### Scenario: Desktop layout splits into two columns

- **WHEN** the viewport matches the `desktop` breakpoint
- **THEN** Details and Configuration render side by side, Details narrower than Configuration

#### Scenario: Mobile layout stacks the columns

- **WHEN** the viewport matches the `mobile` breakpoint
- **THEN** Details renders full-width above Configuration, both stacked in that order

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

### Requirement: Create-task strings flow through react-i18next

Every user-visible string on the create-task page (page title, repeat-field labels, model/prompt/description labels, validation messages, success/error notifications) MUST be resolved via `useTranslation().t()` in `ScheduledTaskCreatePage` and passed into the lib as plain strings. Feature-specific keys live under `scheduledTasks.create.*` in `apps/chat/src/i18n/locales/en.json`, referenced through `ScheduledTasksI18nKeys`. The display name label/required message MUST reuse `EditorI18nKeys.NameLabel` and `EditorI18nKeys.NameRequired`. Cancel MUST reuse `ButtonsI18nKeys.Cancel`; the submit action MUST reuse `ButtonsI18nKeys.Create` (labeled "Create" — the create page creates a task; the edit page keeps `ButtonsI18nKeys.Save`).

#### Scenario: New keys exist for the Repeat control and model copy

- **WHEN** the change is applied
- **THEN** `en.json` contains at minimum `scheduledTasks.create.pageTitle`, `scheduledTasks.create.repeatLabel`, `scheduledTasks.create.repeatOneTime`, `scheduledTasks.create.repeatHourly`, `scheduledTasks.create.repeatDaily`, `scheduledTasks.create.repeatWeekly`, `scheduledTasks.create.repeatMonthly`, `scheduledTasks.create.minuteLabel`, `scheduledTasks.create.minuteInvalid`, `scheduledTasks.create.timeLabel`, `scheduledTasks.create.modelLabel`, `scheduledTasks.create.promptLabel`, `scheduledTasks.create.descriptionLabel`, `scheduledTasks.create.descriptionMaxLengthError`, `scheduledTasks.create.successNotification`, and `scheduledTasks.create.errorNotification`; it no longer needs `scheduleSectionLabel`, `scheduleTypeOnce`, `scheduleTypeRecurring`, `scheduleTypeAriaLabel`, `frequencyLabel`, `frequencyDaily`, `frequencyWeekly`, `frequencyMonthly`, or `streamLabel` keys

#### Scenario: Generic labels are reused, not duplicated

- **WHEN** `ScheduledTaskCreatePage` renders `<ScheduledTaskCreateForm />`
- **THEN** display name text props resolve from `EditorI18nKeys`, Cancel from `ButtonsI18nKeys.Cancel`, and the submit action from `ButtonsI18nKeys.Create`, not duplicated feature-scoped strings

### Requirement: Create-task page supports RTL and meets AAA accessibility defaults

All directional layout in the create-task header and two-column form MUST use Tailwind logical properties (`ms/me`, `ps/pe`, `text-start/end`) instead of physical ones, per `.claude/rules/rtl.md`. The header's back arrow MUST mirror in RTL via `rtl:scale-x-[-1]`. Every form field MUST have an accessible label distinct from its placeholder. Dropdowns (Repeat, model) MUST expose `aria-expanded` and mark the selected option via `aria-selected`/`aria-current`. Focus-visible styling on the back control, Cancel, and Create MUST match hover feedback per `.claude/rules/a11y.md`.

#### Scenario: Page mirrors under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the create-task header, back arrow, and two-column form lay out mirrored with no hard-coded left/right offsets breaking the mirrored layout

#### Scenario: Form fields are labeled

- **WHEN** the create-task form renders
- **THEN** display name, the Repeat dropdown and its conditional fields, model, and prompt each have an accessible name distinct from any placeholder text

#### Scenario: Model dropdown exposes expanded/selected state

- **WHEN** the user opens the model dropdown
- **THEN** the trigger has `aria-expanded="true"` and the selected model option is marked `aria-selected="true"` (or `aria-current`)

#### Scenario: Repeat dropdown exposes expanded/selected state

- **WHEN** the user opens the Repeat dropdown
- **THEN** the trigger has `aria-expanded="true"` and the currently-selected Repeat option is marked `aria-selected="true"` (or `aria-current`)

#### Scenario: Back control is keyboard accessible

- **WHEN** the user tabs to the back control and activates it with Enter or Space
- **THEN** `onBack` is called

### Requirement: Create-task form chrome adapts to mobile

The create/edit form's action placement, header chrome, and pickers SHALL adapt at the `mobile` breakpoint; the `desktop` presentation is unchanged:

- The cancel/submit pair SHALL render in the header at `desktop`. At `mobile` it SHALL render in a sticky footer pinned over the bottom of the scrolling form, the two buttons splitting the row equally, separated from the content by an elevation shadow instead of the header's border.
- At `mobile` the header row (back control + title) SHALL sit below its divider (drawn above the row rather than below it) and use 16px horizontal gutters; `desktop` keeps the divider below the header and 32px gutters.
- At `mobile` the Model or Agent trigger (`DeploymentSelectorFieldTrigger`, supplied by the host as `modelSelector`) SHALL open the deployment selector as a bottom sheet — the same `BottomSheetShell` the chat page's picker uses, capped at 90% of the viewport height — and its Catalog action SHALL open the "Talk to" catalog modal covering the full viewport. At `desktop` the trigger keeps the dropdown popover and the centered modal.

#### Scenario: Mobile renders the actions in a sticky footer

- **WHEN** the viewport matches the `mobile` breakpoint and the form content scrolls
- **THEN** Cancel and Create pin to the bottom of the visible form, each taking half the action row, with a shadow separating the footer from the scrolled content

#### Scenario: Mobile opens the model selector as a bottom sheet

- **WHEN** the user activates the Model or Agent field at the `mobile` breakpoint
- **THEN** the deployment selector slides up from the bottom (height capped at 90% of the viewport), and activating its Catalog action opens the "Talk to" modal covering the full viewport

#### Scenario: Desktop presentation is unchanged

- **WHEN** the viewport matches the `desktop` breakpoint
- **THEN** the actions render in the header above the border divider, and the model field opens the dropdown popover and centered catalog modal as before the mobile adaptation

### Requirement: ScheduledTaskCreateForm renders optional Start date / End date pickers for recurring schedules

`ScheduledTaskCreateFormValues` SHALL gain two optional fields:

```ts
/** Date-only value bounding the start of a recurring schedule's activity window. Ignored when `repeat` is `'oneTime'`. */
startDate?: string;
/** Date-only value bounding the end of a recurring schedule's activity window. Ignored when `repeat` is `'oneTime'`. */
endDate?: string;
```

`ScheduledTaskCreateFormErrors` SHALL gain `startDate?: string` and `endDate?: string`. `ScheduledTaskCreateFormLabels` SHALL gain `startDateLabel`, `endDateLabel`, `startDatePlaceholder` (default `"Pick start date"`), and `endDatePlaceholder` (default `"Pick end date"`) — both fields are optional, so neither label renders a required marker.

`ScheduledTaskCreateForm` SHALL render both pickers whenever `values.repeat !== 'oneTime'` (i.e. for `'hourly'`, `'daily'`, `'weekly'`, and `'monthly'` alike — the activity window is not restricted to a subset of recurring cadences), positioned below the existing **Time** field when it renders (and below **Day of week**/**Day of month** when those render; for `'hourly'`, which renders no Time/Day field, the pickers are positioned directly below the Repeat dropdown), using the `Calendar` component from `@epam/ai-dial-ui-kit` with `mode={CalendarMode.Date}` — date-only, no time part. Layout SHALL be a two-column row (`flex gap-*`, each picker `flex-1`) on desktop and stacked on mobile, per `.claude/skills/responsive-design`. Errors render with the same inline-error paragraph pattern already used for `runAt`/`time` (`errors.startDate`/`errors.endDate` shown in a `<p>` with `instructionsErrorClassName`).

`libs/scheduled-tasks/src/utils/calendar-value.ts` SHALL gain `dateValueToCalendarValue` and `calendarValueToDateValue` helpers producing/consuming a `YYYY-MM-DD` date-only string — a distinct pair from `calendarValueToRunAt`, which emits a `datetime-local` string for a different consumer (`values.runAt`). The pickers' `onChange` callbacks adapt the ui-kit's `CalendarValue` into `onFieldChange('startDate', ...)` / `onFieldChange('endDate', ...)` calls using these helpers, following the same controlled-value pattern as `runAt`/`time`.

The lib remains presentational: it performs no timezone conversion, no i18n, and no cross-field ordering validation between `startDate` and `endDate` — it only renders whatever `errors.startDate`/`errors.endDate` the page supplies. The component continues to import nothing from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, notification context, deployments context, auth, env, or analytics.

#### Scenario: Pickers render only for the one-time repeat value

- **WHEN** `values.repeat === 'oneTime'`
- **THEN** neither the Start date nor End date picker renders

#### Scenario: Pickers render for every recurring repeat value, including Hourly

- **WHEN** `values.repeat` is `'hourly'`, `'daily'`, `'weekly'`, or `'monthly'` in turn
- **THEN** both the Start date and End date `Calendar` (`mode={CalendarMode.Date}`) pickers render in each case, neither carrying a required-field marker

#### Scenario: Picker onChange adapts CalendarValue to a date-only string

- **WHEN** the user selects a date in the Start date picker
- **THEN** `onFieldChange('startDate', <YYYY-MM-DD string>)` is called via `calendarValueToDateValue`, not a `datetime-local` string

#### Scenario: Inline errors render for the new fields

- **WHEN** `errors.endDate` is a non-empty string and `values.repeat !== 'oneTime'`
- **THEN** the End date field renders that message in the same inline-error paragraph style as `errors.time`

#### Scenario: Mobile layout stacks the two pickers

- **WHEN** the viewport is at the mobile breakpoint and `values.repeat !== 'oneTime'`
- **THEN** the Start date and End date pickers stack vertically instead of rendering as a two-column row

#### Scenario: Lib still has no host or integration imports

- **WHEN** `libs/scheduled-tasks` source is statically analyzed
- **THEN** it contains no new imports of `apps/chat/*`, `@epam/chat-api-client`, `server-api`, routing, feature-flag, notification, deployments, auth, env, or analytics modules

### Requirement: Create-task page validates and converts the activity window to UTC boundaries

`ScheduledTaskCreatePage`'s `DEFAULT_VALUES` SHALL include `startDate: undefined` and `endDate: undefined`. Before calling `createScheduledTask`, when both `values.startDate` and `values.endDate` are set and `endDate` is not strictly after `startDate`, the page SHALL set `errors.endDate` to a validation message and block submit; when either or both fields are empty, this check is skipped (both empty is valid — an unbounded recurring schedule). This check applies whenever `values.repeat !== 'oneTime'`, including `'hourly'`.

`mapFormValuesToCreateBody` (`apps/chat/src/utils/scheduled-task-trigger.ts`) SHALL build the `trigger.cron` object for any non-`'oneTime'` `repeat` value as `{ fields, ...(startDate ? { startDate: <iso> } : {}), ...(endDate ? { endDate: <iso> } : {}) }`, and MUST NOT include `startDate`/`endDate` when `repeat === 'oneTime'` (the one-time branch is unaffected by this change). The local calendar-day-to-UTC-instant conversion SHALL follow the same reference-`Date`-plus-UTC-getters technique `buildCronFields` already uses and documents in its own code comment, extended to cover this case: `startDate` converts to that local calendar day's `00:00:00.000` local time, then to its UTC ISO equivalent; `endDate` converts to that local calendar day's `23:59:59.999` local time, then to its UTC ISO equivalent, so the last local day the user selected is not cut off by the UTC conversion.

Feature-specific i18n keys `scheduledTasks.create.startDateLabel`, `scheduledTasks.create.endDateLabel`, `scheduledTasks.create.startDatePlaceholder`, `scheduledTasks.create.endDatePlaceholder`, and `scheduledTasks.create.endDateBeforeStartError` SHALL be added to `apps/chat/src/i18n/locales/en.json` with matching `ScheduledTasksI18nKeys` enum entries, resolved via `useTranslation().t()` in `ScheduledTaskCreatePage` and passed into the lib as plain strings, per the existing i18n requirement for this page.

#### Scenario: No dates set is a valid submit

- **WHEN** `values.repeat !== 'oneTime'` and both `startDate` and `endDate` are empty
- **THEN** submit proceeds and the POST body's `trigger.cron` has no `startDate`/`endDate` keys

#### Scenario: Both dates set sends a UTC-converted window

- **WHEN** `values.repeat !== 'oneTime'`, `startDate = '2026-08-01'`, `endDate = '2026-08-31'`, and the browser's local timezone is UTC+2
- **THEN** the POST body's `trigger.cron.startDate` is `'2026-07-31T22:00:00.000Z'` (local midnight Aug 1 in UTC+2) and `trigger.cron.endDate` is `'2026-08-31T21:59:59.999Z'` (local 23:59:59.999 Aug 31 in UTC+2)

#### Scenario: endDate not after startDate blocks submit with an inline error

- **WHEN** the user sets `endDate` equal to or earlier than `startDate` and activates Create
- **THEN** `errors.endDate` is set to the `endDateBeforeStartError` message, no `createScheduledTask` call is made, and the form remains open

#### Scenario: Switching back to One-time never sends the window

- **WHEN** the user set `startDate`/`endDate` while `values.repeat` was a recurring value, then switches `repeat` to `'oneTime'` and submits
- **THEN** the POST body's `trigger` is `{ date: <ISO> }` only — no `cron`, `startDate`, or `endDate` field is present

#### Scenario: Boundary conversion is correct across a DST transition

- **WHEN** `startDate`/`endDate` span a date range that crosses a daylight-saving-time transition in the browser's local timezone
- **THEN** both converted UTC instants still represent local `00:00:00.000` and local `23:59:59.999` respectively on their calendar days, using the timezone offset in effect on each specific day, not a single offset applied to both

#### Scenario: Activity window applies unchanged to Hourly

- **WHEN** `values.repeat === 'hourly'`, `startDate = '2026-08-01'`, and `endDate = '2026-08-31'`
- **THEN** the POST body's `trigger.cron` includes `fields: { hour: '*', minute: '0' }` alongside the same UTC-converted `startDate`/`endDate` a Daily/Weekly/Monthly schedule would receive for the same input dates

### Requirement: Edit route loads the task and reuses ScheduledTaskCreateForm

The application SHALL expose a lazy-loaded `ScheduledTaskEditPage` at `ROUTES.ScheduledTaskEdit` (`/scheduled-tasks/:scheduleId/edit`), registered in `apps/chat/src/app/app.tsx` using the same `RouteErrorBoundary` + `Suspense` + `RouteFallback` pattern as `ROUTES.ScheduledTaskCreate`/`ROUTES.ScheduledTaskDetail`, gated behind `useFeatureFlag('scheduledTasksEnabled')` inside the page component (not at route registration), matching the existing create/detail pages' gating pattern. On mount, `ScheduledTaskEditPage` SHALL call `getScheduledTask(scheduleId)` and, on success, prefill `ScheduledTaskCreateForm`'s `values` via the reverse mapping described in the "Reverse trigger mapping is fail-closed" requirement below. `ScheduledTaskEditPage` SHALL render `ScheduledTaskCreateForm` with the same component contract used by the create page (`labels`, `values`, `errors`, `modelSelector`, `modelLabelId`, `onFieldChange`, `onBack`, `onCancel`, `onSubmit`, `isSubmitting?`) — no `mode` prop is added to the lib; edit-flavored copy (page title "Edit scheduled task", Save button text) is supplied entirely by the page's `labels` object. `ScheduledTaskEditPage` SHALL build its `modelSelector` element from the loaded task's `values.modelId` (from the reverse mapping) as the trigger's `selectedId`, so the task's current deployment is preselected even when it is not present in the favorites or initially-loaded deployment subset.

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
- **THEN** `ScheduledTaskCreateForm` mounts with `values` populated from the task's `displayName`, `description`, `model`, `prompt`, schedule type/frequency/time/day fields, and activity-window `startDate`/`endDate` where present, and its `modelSelector`'s trigger displays the task's current deployment as selected

#### Scenario: Edit form preselects a deployment that isn't in favorites or the initial subset

- **WHEN** the loaded task's `model` id corresponds to a deployment that is neither favorited nor part of the initially-loaded deployment page
- **THEN** the `modelSelector` trigger still displays that deployment's resolved name as selected, the same way `useDeploymentSelectorOverlay`'s "Currently selected" row resolves an unfavorited chat selection

### Requirement: Scheduled Task forms compose the shared deployment selector for the Model or Agent field

`ScheduledTaskCreatePage` and `ScheduledTaskEditPage` SHALL each render an `apps/chat/src/components/DeploymentSelector/DeploymentSelectorFieldTrigger` element bound to `values.modelId`/`onFieldChange('modelId', ...)` and pass it as `ScheduledTaskCreateForm`'s `modelSelector` prop, replacing the previous `modelOptions: {id, label}[]` mapping built directly from `useDeployments().items`. The field label SHALL remain "Model or Agent" (required) and the trigger's placeholder SHALL read "Select Model or Agent" when no deployment is selected. Selecting a deployment SHALL call `onFieldChange('modelId', <id>)` and close the dropdown; the `model` field sent in `CreateScheduledTaskBodyDto`/`UpdateScheduledTaskBodyDto` SHALL continue to be `values.modelId` unchanged from the existing "Page maps form values to BFF trigger shape"/"Edit page submits via PUT" requirements — no request-body field renames.

Any new i18n keys this wiring requires (e.g. the placeholder, if not already covered by an existing key) SHALL be added under `scheduledTasks.create.*`/`scheduledTasks.edit.*` per the existing i18n requirements for these pages, reusing existing keys where the exact string already exists.

#### Scenario: Selecting a deployment updates modelId and closes the dropdown

- **WHEN** the user opens the Model or Agent field on the create form and selects a deployment
- **THEN** `values.modelId` updates to that deployment's id and the dropdown closes

#### Scenario: Unselected field shows the required placeholder

- **WHEN** `values.modelId` is empty on either the create or edit form
- **THEN** the Model or Agent field's trigger displays "Select Model or Agent"

#### Scenario: Selected deployment maps to the same payload field as before

- **WHEN** the user selects a deployment and submits the create form
- **THEN** the `POST /api/v1/scheduled-tasks` body's `model` field equals the selected deployment's id, exactly as when the field was a plain `Select`

#### Scenario: Edit form submits the changed deployment via PUT

- **WHEN** the user changes the preselected deployment on the edit form and activates Save
- **THEN** the `PUT /api/v1/scheduled-tasks/:scheduleId` body's `model` field equals the newly selected deployment's id

#### Scenario: Required-field validation still blocks submit when no deployment is selected

- **WHEN** `values.modelId` is empty and the user activates Create or Save
- **THEN** the action is blocked by the existing `values.modelId`-empty guard, and `errors.modelId` (from `validateScheduledTaskForm`) is surfaced the same way it was before this change

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

### Requirement: Instructions placeholder is part of the public labels contract

ScheduledTaskCreateForm SHALL accept optional labels.instructionsPlaceholder and forward it directly to its lazy markdown editor. Undefined SHALL preserve the editor default and empty string SHALL suppress the placeholder. No observer, global query or editor-private class SHALL be required.

#### Scenario: Placeholder survives lazy mounting and editor mode changes

- **WHEN** the form receives a placeholder before the editor loads and later switches preview/edit
- **THEN** the editable textarea displays the supplied placeholder whenever empty.

#### Scenario: Locale and multiple instances are independent

- **WHEN** the host changes one form's translated placeholder while another form has a different one
- **THEN** each mounted editor reflects its own latest prop without cross-instance mutation.

### Requirement: Form presentation options are forwarded through the shared shell

The form SHALL expose optional backIcon, className and typed layout customization alongside existing colors/typography/theme props. It SHALL forward backIcon through builder-form and preserve the opaque modelSelector, label linkage and unique ids. Scheduled-task defaults SHALL use a narrow back arrow and tertiary header/divider tokens.

#### Scenario: Host controls the back icon without changing SVG internals

- **WHEN** a host provides backIcon or uses the scheduler default
- **THEN** the supplied icon or default narrow arrow renders inside the existing accessible back control without changing its behavior.

#### Scenario: Configuration copy and editor theme remain host-controlled

- **WHEN** a host supplies the agreed Configuration subtitle, instructions placeholder and editor theme
- **THEN** those values render without hardcoded English copy, and no skill selector is added.

#### Scenario: Form sizing follows its own container

- **WHEN** the form is rendered with configured column sizes inside a narrow host container
- **THEN** controls fit, responsive layout falls back before overflowing, and header border retains its configured token.

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

### Requirement: Edit loading failures are distinct from unsupported schedules

Edit state SHALL distinguish loading, ready, not-found, load-error and unsupported. Unsupported SHALL only follow a successful DTO failing reverse mapping. Task identity changes SHALL reset stale state and guard late responses. Retry SHALL reload the current task. Existing feature and returnUrl policy SHALL be preserved.

#### Scenario: Network failure offers retry

- **WHEN** loading an editable task fails with a network error or 5xx
- **THEN** a translated load error with retry appears, not the unsupported-schedule message.

#### Scenario: Successful retry and task change clear stale state

- **WHEN** an unsupported/error state is followed by loading another valid task or a successful retry
- **THEN** the valid form becomes available and stale responses cannot restore the old state.

#### Scenario: Unsupported trigger is still protected

- **WHEN** a successful response contains a trigger that cannot round-trip through the form
- **THEN** the unsupported state is shown and no lossy editable form is constructed.

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
