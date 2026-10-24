# Delta: scheduled-task-create-form

## MODIFIED Requirements

### Requirement: ScheduledTaskCreateForm lib component matches the BFF create contract

`libs/scheduled-tasks` SHALL export a `ScheduledTaskCreateForm` component accepting `labels`, `values`, `errors`, `modelSelector` (`ReactNode`), `modelLabelId` (`string`), `onFieldChange`, `onCancel`, `onBack`, `onSubmit`, and optional `isSubmitting` (default `false`). `modelLabelId` is applied as the `id` of the Model or Agent field's `Label` element; the host generates it (e.g. via React `useId()`) rather than a hardcoded literal, and passes the same value as `modelSelector`'s own `aria-labelledby` target, so two concurrently-mounted form instances (or any future host reusing the component) never collide on a shared DOM id.

The form SHALL render inside the shared `BuilderFormContainer` shell (`@epam/ai-dial-builder-form`) as a full-width header followed by a responsive two-column body:

- **Header** — start side: a back control (arrow icon, mirrored in RTL via `rtl:scale-x-[-1]`) that calls `onBack` when activated, followed by the page title (`labels.pageTitle`). End side: Cancel (`labels.cancelButtonLabel`, calls `onCancel`) and the submit action (`labels.createButtonLabel`, calls `onSubmit`), in that order — shown at the `desktop` breakpoint; at `mobile` the pair moves to the form's sticky footer (see "Create-task form chrome adapts to mobile").
- **Details column** — a `role="group"` region labeled `labels.detailsSectionTitle`, holding Display name, Description, Repeat and its conditional schedule fields, and Model or Agent.
- **Configuration column** — a `role="group"` region labeled `labels.configurationSectionTitle`, holding Skill and Instructions.

At the `desktop` breakpoint the two columns SHALL render side by side, Details narrower than Configuration. At `mobile` they SHALL stack full-width, Details above Configuration. Only Tailwind logical properties and the project's named breakpoints (`mobile`, `desktop`) MAY be used for this layout.

The page shell SHALL keep its header outside the scrolling region and use the same responsive header spacing as the detail view (`px-4 py-2` below desktop; `px-8 py-0` with a 64 px height at desktop). The stacked mobile body SHALL own one vertical scrollbar; at desktop the body SHALL be a non-wrapping clipped row whose Details and Configuration columns scroll independently, matching the agent editor layout and preventing document-level scrolling.

It SHALL render:

- **Display name** — required text input (`values.displayName`)
- **Description** — optional textarea (`values.description`), rendered between Display name and Repeat, with `maxLength={500}`, inline validation per `errors.description`, and a character counter (`{length}/500`, `0/500` when empty) that is always shown at the end of the row below the field — passed as `TextRefinementField`'s `caption` — so typing never shifts the fields below it
- **Repeat** — a single dropdown (`DialSelectField`) bound to `values.repeat: ScheduledTaskRepeat` (`'oneTime' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'`), replacing the separate "Schedule type" (once/recurring) and "Frequency" (daily/weekly/monthly) dropdowns. It is NOT wrapped in a `<fieldset>`/`<legend>` with a visible "Schedule" section heading — the schedule controls render as a plain grouped block inside the Details column, which already carries its own `role="group"`/`aria-label` (`labels.detailsSectionTitle`)
- **Run at** — the internal `ScheduledTaskRunAtField` component (`libs/scheduled-tasks/src/components/ScheduledTaskRunAtField`, not re-exported from the package index), wrapping a `Calendar` control (`mode={CalendarMode.DateTime}`, imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat === 'oneTime'`, bound to `values.runAt` (a `datetime-local`-style string) through the field's own `runAtToCalendarValue`/`calendarValueToRunAt` adaptation, with `errors.runAt` rendered below the control in the same inline-error pattern via the field's `errorClassName` prop. The field sets the earliest selectable moment to its mount time — a `minDate` pinned once per mount — so days strictly before the mount date render unselectable in the picker's month grid and activating them fires no `onFieldChange('runAt', …)`; the mount date itself and future days remain selectable. The earliest selectable moment is "now", not "now + lead": the page's existing submit-time lead validation (`runAt` must lead "now") is unchanged and still rejects `now`-ish selections at submit
- **Time** — a `Calendar` control (`mode={CalendarMode.Time}`, imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat` is `'daily'`, `'weekly'`, `'monthly'`, or `'custom'` (NOT shown for `'hourly'`), bound to `values.time` (`HH:mm` local wall-clock string, validated at app edge)
- **Day of week** — a `Calendar` control (`mode={CalendarMode.Weekday}`, imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat === 'weekly'`, bound to `values.dayOfWeek` via `dayOfWeekToCalendarValue`/`calendarValueToDayOfWeek` (`libs/scheduled-tasks/src/utils/calendar-value.ts`), which convert between `Calendar`'s ISO weekday value (`"1"`=Monday..`"7"`=Sunday) and `values.dayOfWeek`'s APScheduler-convention string (`"0"`=Monday..`"6"`=Sunday)
- **Every** — a `Select` control (imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat === 'custom'`, labeled `labels.everyLabel` ("Every"), bound to `values.everyWeeks` (a `"1"`–`"10"` string) with options built from `labels.everyWeekOptions` (`{ value: '1', label: '1 week' }` … `{ value: '10', label: '10 weeks' }`). A dropdown always yields a valid value, so no `errors.everyWeeks` is rendered and no validation error exists for this field
- **Day of week (custom)** — a row of circular `Button` controls (imported from `@epam/ai-dial-ui-kit`) shown when `values.repeat === 'custom'`, rendered below the Time field under a visible required `Label` carrying the existing `labels.dayOfWeekLabel` ("Day") with a required marker; the Label's host-generated `id` is referenced by the row's `role="group"` via `aria-labelledby`, so the visible label doubles as the group's accessible name (the same Label-id + `aria-labelledby` linkage the Model or Agent field uses). Seven buttons — one per weekday, separated by a 2px gap (`gap-0.5`) — each render `labels.customDayOptions[day].shortLabel` (a single letter, e.g. "M") as the visible label and carry `labels.customDayOptions[day].fullName` as `aria-label`, so assistive tech announces the full day name, not the letter. The selected day's button carries `variant={ButtonVariant.Primary}` and the rest `variant={ButtonVariant.Neutral}`, all with `appearance={ButtonAppearance.Solid}` and a `w-10 rounded-full` class pair fixing each button at 40×40px and circular; each button carries `aria-pressed` reflecting its selection. The row is single-select: activating an unselected button calls `onFieldChange('dayOfWeek', <APScheduler day string>)`; activating the already-selected button is a no-op (the field is required, so there is always exactly one selected day). `errors.dayOfWeek` renders below the row in the same inline-error pattern
- **Day of month** — shown when `values.repeat === 'monthly'` (`values.dayOfMonth`)
- **Minute** — a required text input (matching the `Day of month` field's `Input` pattern) shown when `values.repeat === 'hourly'`, bound to `values.minute` (a `"0"`-`"59"` string); no `Time`, `Day of week`, or `Day of month` field is rendered for `'hourly'`
- **Model or Agent** — a required field rendering the host-supplied `modelSelector` element in place of a lib-owned selection control, wrapped in the lib's own required-label/error markup (the "Model or Agent" label, a required marker, and `errors.modelId` rendered below the control) using the same visual pattern already used for `Calendar` fields without a built-in `labelProps` (see `withRequiredMarker`). The lib performs no deployment lookup, filtering, or catalog navigation itself — it only renders whatever `modelSelector` the host passes.
- **Skill** - optional host-composed slot in Configuration above Instructions with `skillSelector`, `labels.skillLabel`, `values.skillUrls`, and `errors.skillUrls`; the composed UI-kit Select owns its label/error association
- **Instructions** - markdown editor (`values.prompt`), required only when no skill is selected; its label carries the required marker (red asterisk) exactly while `values.skillUrls` is empty and drops it once a skill is selected, with or without the Refine action
- **Cancel / Create** actions

When `values.repeat === 'custom'`, the form SHALL render exactly the **Every** dropdown, the **Time** field, and the **Day of week (custom)** button row below it, in that order — and SHALL NOT render the Start date / End date pickers (Custom has no activity window; see "ScheduledTaskCreateForm renders optional Start date / End date pickers for recurring schedules").

`values` SHALL NOT include a `stream` field, and the form MUST NOT render a stream toggle — streaming is fixed server-side (`stream: true`) and is not a user-configurable option.

`description` is optional and MUST NOT participate in the Create-button required-field guard. The Create action SHALL be disabled while `isSubmitting` is `true` or while `displayName` or `values.modelId` is empty, while both trimmed `prompt` and `values.skillUrls` are empty, while `errors.skillUrls` is present, or — when `values.repeat === 'custom'` — while `values.dayOfWeek` or `values.time` is empty (minimum client-side guard; full validation uses shared checked preparation at the app boundary). `values.modelId` itself continues to be owned and set by the host via the `modelSelector` element's own `onSelect` callback (bound to `onFieldChange('modelId', ...)` by the host, outside the lib) — the lib's required-field guard reads `values.modelId` exactly as it did before this change; only the rendered control changed.

The `Run at` and `Time` `Calendar` controls' `onChange` callbacks (inside `ScheduledTaskRunAtField` for `runAt`, in the form for `time`) MUST adapt the ui-kit's `CalendarValue` (`Date | string | null`) into calls to `onFieldChange('runAt', ...)` / `onFieldChange('time', ...)` using the same value shapes the page already consumes (`values.runAt` as a `Date`-constructible value, `values.time` as an `"HH:mm"` string) — this is a UI-control swap, not a change to the `values`/`onFieldChange` contract.

The component MUST NOT import from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, notification context, deployments context, auth, env, or analytics. Importing `Calendar`/`CalendarMode`/`Select`/`Button` (with `ButtonVariant`/`ButtonAppearance`) from `@epam/ai-dial-ui-kit` is permitted — they are generic design-system controls with no host-specific integration knowledge. `modelSelector` MUST remain an opaque `ReactNode` prop — the lib MUST NOT know it is a deployment selector, a dropdown, or anything about its internal behavior.

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
- **THEN** it contains no imports of `apps/chat/*`, `@epam/ai-dial-chat-api-client`, `server-api`, routing, feature-flag, notification, deployments, auth, env, or analytics modules; imports of `Calendar`/`CalendarMode`/`Select`/`Button` from `@epam/ai-dial-ui-kit` are present and allowed

#### Scenario: Empty description does not block submit

- **WHEN** `description` is empty, and `displayName`, `modelId`, and `prompt` are all filled
- **THEN** the Create button is enabled

#### Scenario: Description field enforces the 500-character limit client-side

- **WHEN** the user types into the Description textarea
- **THEN** the input cannot exceed 500 characters (`maxLength={500}`), and the counter below it reads `0/500` before any input and updates as the user types

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

#### Scenario: Custom repeat renders the Every dropdown, Time field, and labeled day button row in that order

- **WHEN** `values.repeat === 'custom'`
- **THEN** the "Every" `Select` renders bound to `values.everyWeeks` with ten options ("1 week"…"10 weeks"), the "Time" `Calendar` (`mode={CalendarMode.Time}`) renders with the timezone hint, and the day-of-week button row renders below it under a visible required "Day" label — seven circular 40×40px `Button`s, the selected day Primary Solid and the rest Neutral Solid, each labeled with its `customDayOptions` short label and carrying its full-name `aria-label` and an `aria-pressed` state, inside a `role="group"` whose accessible name is the visible label — and neither the Start date nor End date picker renders

#### Scenario: Custom day button selection uses the APScheduler day convention

- **WHEN** `values.repeat === 'custom'` and the user activates the Monday button (short label "M")
- **THEN** `onFieldChange('dayOfWeek', '0')` is called (APScheduler convention), the Monday button becomes the selected one (Primary Solid, `aria-pressed="true"`), and activating Monday again fires no `onFieldChange`

#### Scenario: Required-field guard blocks submit until the Custom schedule is complete

- **WHEN** `values.repeat === 'custom'` and either `values.dayOfWeek` or `values.time` is empty
- **THEN** the Create button is disabled, regardless of the other fields being valid

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
- `repeat === 'daily'`: `trigger = { cron: { fields: { hour, minute } } }`, where `hour`/`minute` are the UTC equivalent of the local `time` the user entered, computed via `buildCronFields` in `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts` from a reference `Date` set with the local `setHours(hour, minute)` and read back through `getUTCHours()`/`getUTCMinutes()` (the browser's own timezone and DST rules apply; no explicit IANA zone is read)
- `repeat === 'weekly'`: include `day_of_week` as the UTC-equivalent weekday (shifted ±1, mod 7, relative to the locally-selected `dayOfWeek`, whenever the local→UTC hour conversion crosses a calendar-day boundary), alongside the UTC `hour`/`minute`
- `repeat === 'monthly'`: include `day` as the local `dayOfMonth` shifted by the UTC calendar-day shift (−1, 0, or +1) of the same conversion, alongside the UTC `hour`/`minute`. The shift is applied to the number, never by rolling a `Date` to that day, so a day the current month lacks (e.g. the 31st in November) is not carried into the next month. A local 1st shifted back emits the APScheduler expression `day: 'last'`, because the UTC predecessor of the 1st is the previous month's last day, whose number varies; a local 31st shifted forward emits `day: '1'`
- `repeat === 'custom'`: `trigger = { cron: { fields: { week: '*/<everyWeeks>', day_of_week, hour, minute } } }`, where `day_of_week`/`hour`/`minute` are computed exactly as for `'weekly'` (reference `Date` rolled to the locally-selected weekday, local→UTC via getters, including the ±1 day shift when the conversion crosses midnight) and `week` is the literal step expression built from `values.everyWeeks` with no conversion — a week count is timezone-invariant. The `week` field is emitted for every `everyWeeks` value including `1` (`'*/1'`): its presence is what distinguishes a Custom task from a Weekly task on the reverse mapping. No `startDate`/`endDate` is ever sent for `'custom'`, even when stale boundary values linger in form state from a prior cadence selection

This mapping, including the local→UTC conversion for the `'hourly'`/`'daily'`/`'weekly'`/`'monthly'`/`'custom'` fields, MUST remain in `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts`, reused by app adapters under the existing configured-client/type exception, not duplicated in app pages or presentation libraries. `buildCronFields` MUST use a single reference `Date` and read back UTC getters from it rather than computing the UTC offset by hand: for `'daily'`/`'weekly'`/`'monthly'`/`'custom'`, the reference is constructed from the local `hour`/`minute` (rolled to the matching local weekday for weekly and custom) and `getUTCHours()`/`getUTCMinutes()`/`getUTCDay()` are read back, with the monthly `day` derived from the reference's UTC calendar-day shift as described above; for `'hourly'`, the reference is constructed from local hour `0`/local `minute` and only `getUTCMinutes()` is read back, with `hour` always emitted as the literal `'*'`.

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

#### Scenario: Monthly repeat on the 1st maps to the last UTC day of the month

- **WHEN** the user selects Repeat = Monthly with local time `00:30` on day `1` in a timezone at UTC+3, so the UTC equivalent falls on the previous calendar day at `21:30`
- **THEN** the POST body's `trigger.cron.fields` is `{ hour: '21', minute: '30', day: 'last' }`, not the number of whichever month preceded the submission

#### Scenario: Monthly day survives a submission during a shorter month

- **WHEN** the user selects Repeat = Monthly with day `31` and local time `09:00` while the current month has 30 days
- **THEN** the POST body's `trigger.cron.fields.day` is the UTC-equivalent of the 31st, not `'1'` of the following month

#### Scenario: Daily repeat at a timezone-neutral moment is a no-op conversion

- **WHEN** the user's browser timezone is UTC and they select Repeat = Daily with local time `09:00`
- **THEN** the POST body includes `trigger.cron.fields.hour = '9'` and `trigger.cron.fields.minute = '0'`, unchanged from the entered local value

#### Scenario: Custom repeat sends the week step with UTC-converted day and time

- **WHEN** the user selects Repeat = Custom, Every = 2 weeks, Monday, local time `09:00` in a timezone at UTC+2, and submits
- **THEN** the POST body's `trigger.cron.fields` is `{ week: '*/2', day_of_week: <Monday's APScheduler value>, hour: '7', minute: '0' }` with no `startDate`/`endDate`/`day` keys

#### Scenario: Custom repeat shifts day_of_week when the UTC conversion crosses midnight

- **WHEN** the user selects Repeat = Custom with local time `23:30` on Monday in a timezone at UTC+2, so the UTC equivalent falls on Tuesday `21:30`
- **THEN** the POST body's `trigger.cron.fields.day_of_week` reflects Tuesday (the UTC calendar day), and `week` is unaffected by the conversion

#### Scenario: Custom every-1-week still emits the week field

- **WHEN** the user selects Repeat = Custom, Every = 1 week, and submits
- **THEN** the POST body's `trigger.cron.fields.week` is `'*/1'` — the `week` key is present, distinguishing the task from a Weekly-cadence task whose fields never include `week`

#### Scenario: Custom submit never carries stale boundary values

- **WHEN** the user sets a Start date while `values.repeat === 'weekly'`, then switches `repeat` to `'custom'` and submits
- **THEN** the POST body's `trigger.cron` contains no `startDate` and no `endDate`

### Requirement: ScheduledTaskCreateForm renders optional Start date / End date pickers for recurring schedules

`ScheduledTaskCreateFormValues` SHALL have two optional boundary fields:

```ts
/** `YYYY-MM-DD` for day-based repeats, `YYYY-MM-DDTHH:mm` for `'hourly'`. Ignored when `repeat` is `'oneTime'`. */
startDate?: string;
/** `YYYY-MM-DD` for day-based repeats, `YYYY-MM-DDTHH:mm` for `'hourly'`. Ignored when `repeat` is `'oneTime'`. */
endDate?: string;
```

`ScheduledTaskCreateFormErrors` SHALL have `startDate?: string` and `endDate?: string`. `ScheduledTaskCreateFormLabels` SHALL have `startDateLabel`, `endDateLabel`, `startDatePlaceholder` (default `"Pick start date"`), `endDatePlaceholder` (default `"Pick end date"`), and — for the hourly date-and-time pair — `startDateAndTimeLabel` and `endDateAndTimeLabel`. Both fields are optional, so no label renders a required marker.

`ScheduledTaskCreateForm` SHALL render both pickers whenever `values.repeat` is `'hourly'`, `'daily'`, `'weekly'`, or `'monthly'` (the activity window is not restricted to a subset of those cadences) — but SHALL NOT render either picker when `values.repeat` is `'oneTime'` or `'custom'`: a one-time task has no recurrence to bound, and a Custom schedule has no activity window by design (see the Custom repeat requirement in "ScheduledTaskCreateForm lib component matches the BFF create contract"). The pickers are positioned after the cadence's own fields — below **Time** and **Day of week**/**Day of month** when those render, and for `'hourly'` (which renders no Time/Day field) below the **Minute** field. Both pickers render through the internal `ScheduledTaskBoundaryField` component (`libs/scheduled-tasks/src/components/ScheduledTaskBoundaryField`, not re-exported from the package index), which wraps the `Calendar` component from `@epam/ai-dial-ui-kit` and carries the field's label, placeholder, `minDate`, `error`, `errorClassName`, and `disabled` handling.

The picker mode follows the cadence:

- **Day-based repeats** (`'daily'`, `'weekly'`, `'monthly'`) keep the date-only pair — `mode={CalendarMode.Date}`, `YYYY-MM-DD` values via the `dateValueToCalendarValue`/`calendarValueToDateValue` helpers — sharing one row (`flex flex-row gap-3`, each picker `flex-1`) at every breakpoint; the two fields never stack.
- **`'hourly'`** renders the pair as two full-width date-and-time pickers — `mode={CalendarMode.DateTime}`, labeled `labels.startDateAndTimeLabel`/`labels.endDateAndTimeLabel`, one per row (`flex flex-col`) — writing `YYYY-MM-DDTHH:mm` boundary values, so an hourly window is bounded at exact picked moments, not whole local days.

A repeat switch that changes the boundary shape — between `hourly` and a day-based cadence — clears both boundaries (via `keepWindowBoundaryOnRepeatSwitch` in `libs/scheduled-tasks/src/utils/window-boundary.ts`): the two shapes mean different things (an exact picked instant vs a whole local day), so a carried-over value would silently change meaning. A switch between day-based cadences keeps both boundaries unchanged. A switch into or out of `'custom'` also clears both boundaries: Custom renders no boundary pickers, so a carried-over value would be invisible yet remain live in form state (dirty-check noise, silently dropped by the submit mapping) — it is cleared rather than parked. Validation rejects a boundary whose shape does not match the cadence (`isValidWindowBoundary` parses either format, the shape check in `libs/scheduled-tasks/src/validation/scheduled-task-validation.ts` enforces the match), and the UTC-boundary mapping dispatches on the repeat — so the two shapes never mix anywhere in the stack.

Both pickers pin the earliest selectable day at the form's mount date — a `minDate` memoized once per form mount, mirroring the run-at field's pinned earliest moment — so days strictly before the mount date render unselectable and activating them fires no `onFieldChange('startDate'/'endDate', …)`; the mount date itself and future days remain selectable. Errors render with the same inline-error paragraph pattern already used for `runAt`/`time` (`errors.startDate`/`errors.endDate` shown in a `<p>` with `instructionsErrorClassName`).

`libs/scheduled-tasks/src/utils/calendar-value.ts` keeps the `dateValueToCalendarValue`/`calendarValueToDateValue` helpers producing/consuming the `YYYY-MM-DD` date-only string, and the date-and-time pickers reuse the run-at field's datetime adaptation for the `YYYY-MM-DDTHH:mm` shape. The pickers' `onChange` callbacks adapt the ui-kit's `CalendarValue` into `onFieldChange('startDate', ...)` / `onFieldChange('endDate', ...)` calls, following the same controlled-value pattern as `runAt`/`time`.

The lib remains presentational: it performs no timezone conversion, no i18n, and no cross-field ordering validation between `startDate` and `endDate` — it only renders whatever `errors.startDate`/`errors.endDate` the page supplies. The component continues to import nothing from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, notification context, deployments context, auth, env, or analytics.

#### Scenario: Pickers render only for the one-time repeat value

- **WHEN** `values.repeat === 'oneTime'`
- **THEN** neither the Start date nor End date picker renders

#### Scenario: Custom repeat renders no boundary pickers

- **WHEN** `values.repeat === 'custom'`
- **THEN** neither the Start date nor End date picker renders, even when `values.startDate`/`values.endDate` still hold values in form state

#### Scenario: Day-based repeats render the date-only pair in one shared row

- **WHEN** `values.repeat` is `'daily'`, `'weekly'`, or `'monthly'`
- **THEN** both the Start date and End date `Calendar` (`mode={CalendarMode.Date}`) pickers render, neither carrying a required-field marker, side by side in one row, each taking half its width, at both the `mobile` and `desktop` breakpoints

#### Scenario: Hourly renders two full-width date-and-time pickers

- **WHEN** `values.repeat === 'hourly'`
- **THEN** the pair renders as two `Calendar` (`mode={CalendarMode.DateTime}`) pickers labeled `labels.startDateAndTimeLabel` and `labels.endDateAndTimeLabel`, each full-width on its own row, placed after the Minute field

#### Scenario: Day-based picker onChange adapts CalendarValue to a date-only string

- **WHEN** the user selects a date in the Start date picker while `values.repeat` is a day-based cadence
- **THEN** `onFieldChange('startDate', <YYYY-MM-DD string>)` is called via `calendarValueToDateValue`, not a `datetime-local` string

#### Scenario: Hourly picker onChange writes an exact-moment boundary

- **WHEN** the user picks a date and time in the hourly Start date-and-time picker
- **THEN** `onFieldChange('startDate', <YYYY-MM-DDTHH:mm string>)` is called — the exact picked moment, not a local-day start

#### Scenario: A shape-changing repeat switch clears both boundaries

- **WHEN** the user sets `startDate` while `values.repeat === 'hourly'` (a `YYYY-MM-DDTHH:mm` value), then switches `repeat` to `'daily'`
- **THEN** `onFieldChange('startDate', '')` and `onFieldChange('endDate', '')` are called alongside `onFieldChange('repeat', 'daily')` — the boundary's meaning (an exact picked instant) does not survive into a whole-day cadence, so the value is cleared rather than reinterpreted
- **WHEN** the user switches `repeat` between two day-based cadences (e.g. `'daily'` to `'weekly'`) with boundaries set
- **THEN** no `onFieldChange('startDate'/'endDate', …)` call fires — same shape, same meaning, the boundaries stay

#### Scenario: A switch into or out of Custom clears both boundaries

- **WHEN** the user sets `startDate` while `values.repeat === 'weekly'`, then switches `repeat` to `'custom'`
- **THEN** `onFieldChange('startDate', '')` and `onFieldChange('endDate', '')` are called alongside `onFieldChange('repeat', 'custom')` — Custom renders no boundary pickers, so the value is cleared rather than parked invisibly in form state

#### Scenario: Past days are unselectable in the start/end date pickers

- **WHEN** the user opens either boundary picker's month grid
- **THEN** every day strictly before the form's mount date renders disabled, and activating such a day fires no `onFieldChange('startDate'/'endDate', …)` — the out-of-range click is a no-op — while the mount date itself and future days remain selectable

#### Scenario: The earliest selectable day stays pinned at the form's mount date

- **WHEN** the create or edit form re-renders repeatedly after mounting (e.g. the user edits other fields for several minutes)
- **THEN** both boundary pickers' earliest selectable day stays pinned at the form's mount date rather than advancing with each render, matching the run-at field's pinned `minDate` behavior

#### Scenario: Inline errors render for the boundary fields

- **WHEN** `errors.endDate` is a non-empty string and `values.repeat` is one of `'hourly'`, `'daily'`, `'weekly'`, or `'monthly'`
- **THEN** the End boundary field renders that message in the same inline-error paragraph style as `errors.time`

#### Scenario: Lib still has no host or integration imports

- **WHEN** `libs/scheduled-tasks` source (including `ScheduledTaskBoundaryField`) is statically analyzed
- **THEN** it contains no new imports of `apps/chat/*`, `@epam/chat-api-client`, `server-api`, routing, feature-flag, notification, deployments, auth, env, or analytics modules

### Requirement: Reverse trigger mapping is fail-closed for unsupported or incomplete tasks

`libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts` SHALL export a reverse mapping function that converts a `ScheduledTaskDto` into `ScheduledTaskCreateFormValues`, inverting `buildCronFields`/`buildCronWindowBoundary`'s UTC→local conversion using the same reference-`Date`-plus-getters technique (browser timezone/DST handling, not manual offset arithmetic). The function SHALL return a discriminated result — success with mapped `values`, or failure with a reason — rather than a value that may itself be invalid. `trigger.cron.fields` MUST be evaluated by presence of a non-`null` value per key, not by key presence alone — DIAL Scheduler always returns every cron field key, using `null` for ones that are not set.

Before applying the existing numeric-hour parsing, the mapper SHALL check for the Hourly shape: when `fields.hour === '*'`, `fields.minute` is present with a purely-numeric value, and neither `day` nor `day_of_week` is present, the mapper SHALL succeed with `values.repeat = 'hourly'` and `values.minute` set to the local minute-of-hour equivalent of the stored UTC minute (via a reference `Date` set with `setUTCHours(0, utcMinute)`, reading back `getMinutes()` — the inverse of the forward `setHours(0, minute)` → `getUTCMinutes()` conversion), with no `time`/`dayOfWeek`/`dayOfMonth` field set. Any other non-numeric `hour` value (cron range/list/step expressions, or `*` combined with a `day`/`day_of_week`) continues to fail closed, same as today.

The mapper SHALL also check for the Custom shape before the extra-key rejection: when `fields.week` is present with a non-`null` value matching exactly `*/N` where `N` is an integer 1–10, `fields.day_of_week` is present with a single plain numeric value, and `fields.hour`/`fields.minute` are present with plain numeric values (and no `day` is set), the mapper SHALL succeed with `values.repeat = 'custom'`, `values.everyWeeks` set to `N`, and `values.dayOfWeek`/`values.time` set to the local equivalents computed exactly as for a Weekly task (the `week` value is a count, not a wall-clock value, and passes through with no conversion). A `week` value in any other shape — a range, a list, a bare number, a step other than 1–10 — continues to fail closed as an unsupported cron shape, because the Custom editor cannot represent it losslessly. A Custom-shape trigger that also carries `startDate`/`endDate` also fails closed: the Custom editor has no boundary fields, so an activity window cannot round-trip losslessly.

For the remaining (non-Hourly, non-Custom) shapes, mapping SHALL fail when: the task's `trigger` shape (cron fields with a set, non-`null` value outside `hour`/`minute`/`day`/`day_of_week`/`week`-as-Custom, or both `day` and `day_of_week` set) falls outside what `ScheduledTaskCreateFormValues`'s `repeat`-driven fields can express; `triggerType` does not correspond to a `repeat` value the form supports; or `model` is missing/empty, `prompt` is not a string, or both trimmed `prompt` and `skillUrls` are empty on the DTO. On mapping failure, `ScheduledTaskEditPage` SHALL render a localized, non-destructive error message and SHALL NOT mount `ScheduledTaskCreateForm` in an editable/submittable state — the original task's trigger is never read, coerced, and re-submitted.

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

#### Scenario: Custom task round-trips through reverse mapping

- **WHEN** a task's `trigger.cron.fields` is `{ week: '*/2', day_of_week: '1', hour: '21', minute: '30' }` (UTC Tuesday) and the local UTC+2 equivalent falls back onto Monday `23:30`
- **THEN** the reverse mapper succeeds with `values.repeat = 'custom'`, `values.everyWeeks = '2'`, `values.dayOfWeek` corresponding to Monday, and `values.time = '23:30'` — the week step passes through unconverted

#### Scenario: A weekly task without a week value still hydrates as Weekly

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '7', minute: '0', day_of_week: '0' }` with `week` present but `null`
- **THEN** the reverse mapper succeeds with `values.repeat = 'weekly'` (not `'custom'`) — Custom requires a present, non-`null` `week` value

#### Scenario: An unsupported week expression fails closed

- **WHEN** a task's `trigger.cron.fields` includes `week: '2-40'`, `week: '1,3'`, or `week: '*/12'`
- **THEN** the reverse mapper returns a failure result with the unsupported-cron-shape reason, no `ScheduledTaskCreateFormValues` are produced, and the edit page shows the non-destructive "can't be edited here" message with Save unavailable

#### Scenario: A custom schedule with an activity window fails closed

- **WHEN** a task's `trigger.cron` carries the Custom field shape and also a `startDate` or `endDate`
- **THEN** the reverse mapper returns a failure result with the unsupported-cron-shape reason — the Custom editor has no boundary fields, so the window is never silently dropped and re-submitted

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

- **WHEN** a task's `model` is missing/empty, `prompt` is not a string, or both trimmed `prompt` and `skillUrls` are empty
- **THEN** the reverse mapper returns a failure result, and the edit page shows the same non-destructive error with Save unavailable, without submitting a partial update

#### Scenario: Skill-only task hydrates without catalog metadata

- **WHEN** an otherwise supported task has `prompt: ""` and a saved `skillUrls`
- **THEN** mapping succeeds with the same reference and empty prompt, independently of skill metadata resolution

### Requirement: Create-task strings flow through react-i18next

Every user-visible string on the create-task page (page title, repeat-field labels, model/instructions/description labels, validation messages, success/error notifications) MUST be resolved via `useTranslation().t()` in the app and passed into the lib as plain strings. The form's field labels and Repeat options are built by the shared `useScheduledTaskFormLabels(mode)` hook (`apps/chat/src/hooks/scheduled-tasks/useScheduledTaskFormLabels.ts`), which both the create (`'create'`) and edit (`'edit'`) pages call. Feature-specific keys live under `scheduledTasks.create.*` in `apps/chat/src/i18n/locales/en.json`, referenced through `ScheduledTasksI18nKeys`. The display name label/required message MUST reuse `EditorI18nKeys.NameLabel` and `EditorI18nKeys.NameRequired`. Length and control-character errors on the display name, description and instructions MUST reuse `EditorI18nKeys.FieldTooLong` (interpolating the exceeded limit as `count`) and `EditorI18nKeys.NameControlCharacters`; there is no scheduled-task-specific length key. Cancel MUST reuse `ButtonsI18nKeys.Cancel`; the submit action MUST reuse `ButtonsI18nKeys.Create` (labeled "Create" — the create page creates a task; the edit page keeps `ButtonsI18nKeys.Save`).

The Custom section's weekday names are NOT translation keys: `useScheduledTaskFormLabels` derives each day's short label and full accessible name from `Intl.DateTimeFormat` in the active locale (weekday `'narrow'` for the visible single letter, weekday `'long'` for the `aria-label`), so the seven-button day row is localized in every supported locale without per-day keys. The week-count option labels use one pluralized key.

#### Scenario: New keys exist for the Repeat control and model copy

- **WHEN** the change is applied
- **THEN** `en.json` contains at minimum `scheduledTasks.create.pageTitle`, `scheduledTasks.create.repeatLabel`, `scheduledTasks.create.repeatOneTime`, `scheduledTasks.create.repeatHourly`, `scheduledTasks.create.repeatDaily`, `scheduledTasks.create.repeatWeekly`, `scheduledTasks.create.repeatMonthly`, `scheduledTasks.create.repeatCustom`, `scheduledTasks.create.everyLabel`, `scheduledTasks.create.everyWeeksOption` (with i18next `one`/`other` plurals: "1 week"/"{{count}} weeks"), `scheduledTasks.create.minuteLabel`, `scheduledTasks.create.minuteInvalid`, `scheduledTasks.create.timeLabel`, `scheduledTasks.create.modelOrAgentLabel`, `scheduledTasks.create.modelPlaceholder`, `scheduledTasks.create.instructionsLabel`, `scheduledTasks.create.descriptionLabel`, `scheduledTasks.create.successNotification`, and `scheduledTasks.create.errorNotification`; it no longer needs `scheduleSectionLabel`, `scheduleTypeOnce`, `scheduleTypeRecurring`, `scheduleTypeAriaLabel`, `frequencyLabel`, `frequencyDaily`, `frequencyWeekly`, `frequencyMonthly`, or `streamLabel` keys

#### Scenario: Generic labels are reused, not duplicated

- **WHEN** `ScheduledTaskCreatePage` renders `<ScheduledTaskCreateForm />`
- **THEN** display name text props resolve from `EditorI18nKeys`, Cancel from `ButtonsI18nKeys.Cancel`, and the submit action from `ButtonsI18nKeys.Create` (via `useScheduledTaskFormLabels('create')`), not duplicated feature-scoped strings

#### Scenario: Custom weekday labels are locale-derived, not hardcoded English

- **WHEN** `useScheduledTaskFormLabels` builds `customDayOptions` for the day-of-week segmented control
- **THEN** each option's `shortLabel` and `fullName` come from `Intl.DateTimeFormat(<active locale>)` weekday formatting — no hardcoded English day strings and no per-day i18n keys exist for this control
