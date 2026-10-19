# Delta: scheduled-task-create-form

## ADDED Requirements

### Requirement: Section subtitles render only in the Details column

The Details column SHALL render its section heading (`labels.detailsSectionTitle`) with its subtitle (`labels.detailsSectionSubtitle`) below it. The Configuration column SHALL render its section heading (`labels.configurationSectionTitle`) with **no subtitle** — no paragraph renders below the Configuration heading. `configurationSectionSubtitle` no longer exists on `ScheduledTaskCreateFormLabels`, `scheduledTasks.create.configurationSectionSubtitle` no longer exists in `apps/chat/src/i18n/locales/en.json`, and `CreateConfigurationSectionSubtitle` no longer exists in `ScheduledTasksI18nKeys`. The shared subtitle style overrides (`styles.typography.sectionSubtitleClassName`, `styles.colors.sectionSubtitleText`) remain on the form's public API, consumed by the Details subtitle.

No new state, routing, feature gating, observability, or i18n keys are introduced; the only i18n change is the removed key. RTL/direction impact: none beyond the existing logical-property layout (a removed text block mirrors nothing).

#### Scenario: Configuration heading renders with no subtitle

- **WHEN** the create or edit form renders
- **THEN** the Configuration column shows its section heading and no subtitle paragraph, while the Details column shows its heading followed by its subtitle

#### Scenario: The removed label and key are gone

- **WHEN** the form's labels contract and the app's i18n files are inspected
- **THEN** `ScheduledTaskCreateFormLabels` has `detailsSectionSubtitle` and no longer has `configurationSectionSubtitle`, and `en.json` contains `scheduledTasks.create.detailsSectionSubtitle` while `scheduledTasks.create.configurationSectionSubtitle` no longer exists

## MODIFIED Requirements

### Requirement: ScheduledTaskCreateForm renders optional Start date / End date pickers for recurring schedules

`ScheduledTaskCreateFormValues` SHALL have two optional boundary fields:

```ts
/** `YYYY-MM-DD` for day-based repeats, `YYYY-MM-DDTHH:mm` for `'hourly'`. Ignored when `repeat` is `'oneTime'`. */
startDate?: string;
/** `YYYY-MM-DD` for day-based repeats, `YYYY-MM-DDTHH:mm` for `'hourly'`. Ignored when `repeat` is `'oneTime'`. */
endDate?: string;
```

`ScheduledTaskCreateFormErrors` SHALL have `startDate?: string` and `endDate?: string`. `ScheduledTaskCreateFormLabels` SHALL have `startDateLabel`, `endDateLabel`, `startDatePlaceholder` (default `"Pick start date"`), `endDatePlaceholder` (default `"Pick end date"`), and — for the hourly date-and-time pair — `startDateAndTimeLabel` and `endDateAndTimeLabel`. Both fields are optional, so no label renders a required marker.

`ScheduledTaskCreateForm` SHALL render both pickers whenever `values.repeat !== 'oneTime'` (i.e. for `'hourly'`, `'daily'`, `'weekly'`, and `'monthly'` alike — the activity window is not restricted to a subset of recurring cadences), positioned after the cadence's own fields — below **Time** and **Day of week**/**Day of month** when those render, and for `'hourly'` (which renders no Time/Day field) below the **Minute** field. Both pickers render through the internal `ScheduledTaskBoundaryField` component (`libs/scheduled-tasks/src/components/ScheduledTaskBoundaryField`, not re-exported from the package index), which wraps the `Calendar` component from `@epam/ai-dial-ui-kit` and carries the field's label, placeholder, `minDate`, `error`, `errorClassName`, and `disabled` handling.

The picker mode follows the cadence:

- **Day-based repeats** (`'daily'`, `'weekly'`, `'monthly'`) keep the date-only pair — `mode={CalendarMode.Date}`, `YYYY-MM-DD` values via the `dateValueToCalendarValue`/`calendarValueToDateValue` helpers — sharing one row (`flex flex-row gap-3`, each picker `flex-1`) at every breakpoint; the two fields never stack.
- **`'hourly'`** renders the pair as two full-width date-and-time pickers — `mode={CalendarMode.DateTime}`, labeled `labels.startDateAndTimeLabel`/`labels.endDateAndTimeLabel`, one per row (`flex flex-col`) — writing `YYYY-MM-DDTHH:mm` boundary values, so an hourly window is bounded at exact picked moments, not whole local days.

A boundary set under one cadence keeps its shape after a repeat switch — every consumer (validation, the UTC-boundary mapping, and the pickers themselves) tolerates both the `YYYY-MM-DD` and `YYYY-MM-DDTHH:mm` shapes, so switching between `hourly` and a day-based cadence neither clears nor reshapes a set boundary.

Both pickers pin the earliest selectable day at the form's mount date — a `minDate` memoized once per form mount, mirroring the run-at field's pinned earliest moment — so days strictly before the mount date render unselectable and activating them fires no `onFieldChange('startDate'/'endDate', …)`; the mount date itself and future days remain selectable. Errors render with the same inline-error paragraph pattern already used for `runAt`/`time` (`errors.startDate`/`errors.endDate` shown in a `<p>` with `instructionsErrorClassName`).

`libs/scheduled-tasks/src/utils/calendar-value.ts` keeps the `dateValueToCalendarValue`/`calendarValueToDateValue` helpers producing/consuming the `YYYY-MM-DD` date-only string, and the date-and-time pickers reuse the run-at field's datetime adaptation for the `YYYY-MM-DDTHH:mm` shape. The pickers' `onChange` callbacks adapt the ui-kit's `CalendarValue` into `onFieldChange('startDate', ...)` / `onFieldChange('endDate', ...)` calls, following the same controlled-value pattern as `runAt`/`time`.

The lib remains presentational: it performs no timezone conversion, no i18n, and no cross-field ordering validation between `startDate` and `endDate` — it only renders whatever `errors.startDate`/`errors.endDate` the page supplies. The component continues to import nothing from `apps/chat`, `server-api`, any generated API client, routing, feature-flag context, notification context, deployments context, auth, env, or analytics.

#### Scenario: Pickers render only for the one-time repeat value

- **WHEN** `values.repeat === 'oneTime'`
- **THEN** neither the Start date nor End date picker renders

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

#### Scenario: A boundary keeps its shape across a repeat switch

- **WHEN** the user sets `startDate` while `values.repeat === 'hourly'` (a `YYYY-MM-DDTHH:mm` value), then switches `repeat` to `'daily'`
- **THEN** the boundary value is preserved unchanged, the date-only picker and the validation and UTC-boundary mapping tolerate the `YYYY-MM-DDTHH:mm` shape, and no error or cleared value results from the switch alone

#### Scenario: Past days are unselectable in the start/end date pickers

- **WHEN** the user opens either boundary picker's month grid
- **THEN** every day strictly before the form's mount date renders disabled, and activating such a day fires no `onFieldChange('startDate'/'endDate', …)` — the out-of-range click is a no-op — while the mount date itself and future days remain selectable

#### Scenario: The earliest selectable day stays pinned at the form's mount date

- **WHEN** the create or edit form re-renders repeatedly after mounting (e.g. the user edits other fields for several minutes)
- **THEN** both boundary pickers' earliest selectable day stays pinned at the form's mount date rather than advancing with each render, matching the run-at field's pinned `minDate` behavior

#### Scenario: Inline errors render for the boundary fields

- **WHEN** `errors.endDate` is a non-empty string and `values.repeat !== 'oneTime'`
- **THEN** the End boundary field renders that message in the same inline-error paragraph style as `errors.time`

#### Scenario: Lib still has no host or integration imports

- **WHEN** `libs/scheduled-tasks` source (including `ScheduledTaskBoundaryField`) is statically analyzed
- **THEN** it contains no new imports of `apps/chat/*`, `@epam/chat-api-client`, `server-api`, routing, feature-flag, notification, deployments, auth, env, or analytics modules

### Requirement: Create-task page validates and converts the activity window to UTC boundaries

`ScheduledTaskCreatePage`'s `DEFAULT_VALUES` SHALL include `startDate: undefined` and `endDate: undefined`. Before calling `createScheduledTask`, when both `values.startDate` and `values.endDate` are set and `endDate` is earlier than `startDate`, the page SHALL set `errors.endDate` to a validation message and block submit; `endDate` equal to `startDate` is a valid single-day window for day-based repeats (the start boundary resolves to that day's `00:00:00.000` local and the end boundary to its `23:59:59.999`), so it MUST NOT be rejected. When either or both fields are empty, this check is skipped (both empty is valid — an unbounded recurring schedule). This check applies whenever `values.repeat !== 'oneTime'`, including `'hourly'`.

The shared `validateScheduledTaskFormValues` (`libs/scheduled-tasks/src/validation`) SHALL additionally reject a recurring activity-window boundary earlier than the validating clock's local today, returning the `StartDateInPast`/`EndDateInPast` error codes — a boundary that is both past and mis-ordered reports the past-date code, which runs after the ordering check so the more actionable message wins. A boundary equal to the option's `originalStartDate`/`originalEndDate` SHALL be exempt: `ScheduledTaskEditPage` passes the hydrated boundaries in those options, so an older task's prefilled past window does not block saving unrelated edits, while a boundary changed into the past is still rejected. The create page passes no originals, so the rule applies to every boundary there. The past-date comparison SHALL tolerate both boundary shapes — a `YYYY-MM-DDTHH:mm` value is compared at its picked moment, a `YYYY-MM-DD` value at its local calendar day.

`mapFormValuesToCreateBody` (`libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts`, using its `buildCronWindowBoundary` helper) SHALL build the `trigger.cron` object for any non-`'oneTime'` `repeat` value as `{ fields, ...(startDate ? { startDate: <iso> } : {}), ...(endDate ? { endDate: <iso> } : {}) }`, and MUST NOT include `startDate`/`endDate` when `repeat === 'oneTime'` (the one-time branch is unaffected by this change). `buildCronWindowBoundary` SHALL branch on the value's own shape:

- An hourly `YYYY-MM-DDTHH:mm` value is the picked instant itself — converted to its UTC ISO equivalent directly, with no local-day widening, so an hourly window is bounded at the exact moments the user picked.
- A date-only `YYYY-MM-DD` value (day-based repeats, or a boundary left over from a repeat switch) converts by the reference-`Date`-plus-UTC-getters technique `buildCronFields` already uses and documents in its own code comment, extended to cover this case: `startDate` converts to that local calendar day's `00:00:00.000` local time, then to its UTC ISO equivalent; `endDate` converts to that local calendar day's `23:59:59.999` local time, then to its UTC ISO equivalent, so the last local day the user selected is not cut off by the UTC conversion.

The reverse mapping `mapScheduledTaskDtoToFormValues` SHALL hydrate an hourly task's boundaries as `YYYY-MM-DDTHH:mm` values (via `isoToLocalDateTime`) — the hourly editor picks exact moments — while day-based cadences keep the date-only hydration (via `isoToLocalDateOnly`).

Feature-specific i18n keys `scheduledTasks.create.startDateLabel`, `scheduledTasks.create.endDateLabel`, `scheduledTasks.create.startDateAndTimeLabel`, `scheduledTasks.create.endDateAndTimeLabel`, `scheduledTasks.create.startDatePlaceholder`, `scheduledTasks.create.endDatePlaceholder`, `scheduledTasks.create.endDateBeforeStartError`, `scheduledTasks.create.startDateInPast`, and `scheduledTasks.create.endDateInPast` SHALL exist in `apps/chat/src/i18n/locales/en.json` with matching `ScheduledTasksI18nKeys` enum entries, resolved via `useTranslation().t()` in `useScheduledTaskFormLabels` and passed into the lib as plain strings, per the existing i18n requirement for this page.

#### Scenario: No dates set is a valid submit

- **WHEN** `values.repeat !== 'oneTime'` and both `startDate` and `endDate` are empty
- **THEN** submit proceeds and the POST body's `trigger.cron` has no `startDate`/`endDate` keys

#### Scenario: Both dates set sends a UTC-converted window

- **WHEN** `values.repeat` is a day-based cadence, `startDate = '2026-08-01'`, `endDate = '2026-08-31'`, and the browser's local timezone is UTC+2
- **THEN** the POST body's `trigger.cron.startDate` is `'2026-07-31T22:00:00.000Z'` (local midnight Aug 1 in UTC+2) and `trigger.cron.endDate` is `'2026-08-31T21:59:59.999Z'` (local 23:59:59.999 Aug 31 in UTC+2)

#### Scenario: Hourly boundary values convert at the exact picked moments

- **WHEN** `values.repeat === 'hourly'`, `startDate = '2026-08-01T09:00'`, `endDate = '2026-08-31T18:30'`, and the browser's local timezone is UTC+2
- **THEN** the POST body's `trigger.cron.startDate` is `'2026-08-01T07:00:00.000Z'` and `trigger.cron.endDate` is `'2026-08-31T16:30:00.000Z'` — the picked instants themselves, with no local-day widening

#### Scenario: An hourly task's boundaries hydrate as datetime-local values

- **WHEN** an hourly task with `trigger.cron.startDate = '2026-08-01T07:00:00.000Z'` is loaded on the edit page in a UTC+2 browser
- **THEN** `values.startDate` hydrates as `'2026-08-01T09:00'` (via `isoToLocalDateTime`), and the date-and-time pickers render the exact moment

#### Scenario: endDate earlier than startDate blocks submit with an inline error

- **WHEN** the user sets `endDate` earlier than `startDate` and activates Create
- **THEN** `errors.endDate` is set to the `endDateBeforeStartError` message, no `createScheduledTask` call is made, and the form remains open

#### Scenario: endDate equal to startDate is a valid single-day window

- **WHEN** the user sets `startDate` and `endDate` to the same calendar day (not earlier than the validating clock's local today) on a day-based repeat and activates Create/Save
- **THEN** no ordering error is set and submit proceeds — the window covers that full local day, from `00:00:00.000` to `23:59:59.999`

#### Scenario: A past startDate blocks submit with an inline error

- **WHEN** the user sets `startDate` earlier than the validating clock's local today and activates Create/Save
- **THEN** `errors.startDate` is set to the `startDateInPast` message, no `createScheduledTask`/`updateScheduledTask` call is made, and the form remains open

#### Scenario: A past endDate blocks submit with an inline error

- **WHEN** the user sets `endDate` earlier than the validating clock's local today (with `startDate` unset or valid) and activates Create/Save
- **THEN** `errors.endDate` is set to the `endDateInPast` message, no `createScheduledTask`/`updateScheduledTask` call is made, and the form remains open

#### Scenario: An unchanged prefilled past boundary still saves on the edit page

- **WHEN** an older task's past `startDate` (or ended `endDate`) is prefilled on the edit form, the user leaves the boundary unchanged, and activates Save
- **THEN** no past-date error is set and the `updateScheduledTask` call proceeds with the boundary preserved in `trigger.cron`

#### Scenario: A boundary changed to a different past date blocks save on the edit page

- **WHEN** an older task's past `startDate` is prefilled on the edit form and the user changes it to another date earlier than the validating clock's local today
- **THEN** `errors.startDate` is set to the `startDateInPast` message and no `updateScheduledTask` call is made

#### Scenario: A window starting on today is accepted

- **WHEN** `startDate` equals the validating clock's local today and `endDate` is a later day
- **THEN** no past-date error is set and submit proceeds — today is not a past date

#### Scenario: Switching back to One-time never sends the window

- **WHEN** the user set `startDate`/`endDate` while `values.repeat` was a recurring value, then switches `repeat` to `'oneTime'` and submits
- **THEN** the POST body's `trigger` is `{ date: <ISO> }` only — no `cron`, `startDate`, or `endDate` field is present

#### Scenario: Boundary conversion is correct across a DST transition

- **WHEN** date-only `startDate`/`endDate` span a date range that crosses a daylight-saving-time transition in the browser's local timezone
- **THEN** both converted UTC instants still represent local `00:00:00.000` and local `23:59:59.999` respectively on their calendar days, using the timezone offset in effect on each specific day, not a single offset applied to both

#### Scenario: Activity window applies unchanged to Hourly

- **WHEN** `values.repeat === 'hourly'`, `startDate = '2026-08-01T09:00'`, and `endDate = '2026-08-31T18:30'`
- **THEN** the POST body's `trigger.cron` includes `fields: { hour: '*', minute: '0' }` alongside the exact-moment UTC-converted `startDate`/`endDate` boundaries
