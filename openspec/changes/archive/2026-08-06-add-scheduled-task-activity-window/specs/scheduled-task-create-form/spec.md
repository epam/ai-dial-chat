## ADDED Requirements

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
