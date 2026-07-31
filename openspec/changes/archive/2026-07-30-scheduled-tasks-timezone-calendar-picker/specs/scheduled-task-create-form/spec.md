## MODIFIED Requirements

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
- **Stream** — toggle (`values.stream`, default `true`)
- **Cancel / Create** actions

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
