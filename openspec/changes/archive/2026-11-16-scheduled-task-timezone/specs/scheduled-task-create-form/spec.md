# Spec Delta

## REMOVED Requirements

### Requirement: Page maps form values to BFF trigger shape

**Reason**: It defines a browser-side local→UTC conversion of cron fields, which causes the DST drift this change fixes. DIAL Scheduler now evaluates cron fields in the task's `timezone`.
**Migration**: Replaced by "Page sends zone-local cron fields and datetimes with the task time zone".

### Requirement: Create-task page validates and converts the activity window to UTC boundaries

**Reason**: Its boundaries are UTC instants derived from the browser offset and its past-date checks use the browser clock.
**Migration**: Replaced by "Activity window is sent as zone-local boundaries", "Activity window is validated against today in the task zone" and "Activity-window strings flow through react-i18next".

### Requirement: Reverse trigger mapping is fail-closed for unsupported or incomplete tasks

**Reason**: Its reverse mapping inverts the browser-offset UTC conversion.
**Migration**: Replaced by "Reverse mapping reads zone-local fields as stored" and "Reverse mapping is fail-closed for unsupported or incomplete tasks".

## ADDED Requirements

### Requirement: Page sends zone-local cron fields and datetimes with the task time zone

`ScheduledTaskCreatePage` SHALL convert form values with `@epam/ai-dial-chat-hooks/scheduled-tasks` into the BFF `trigger` and a top-level `timezone` equal to `values.timezone`. Cron fields and datetimes SHALL be the wall time the user entered, unshifted. The mapping MUST stay in `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts` and MUST NOT use the browser's offset or `Date` UTC getters.

#### Scenario: One-time repeat sends a zone-local date

- **WHEN** the user selects One-time with run at `2026-07-24T09:00`, zone `Europe/Berlin`, and submits
- **THEN** the POST body has `trigger.date = '2026-07-24T09:00:00'`, `timezone = 'Europe/Berlin'` and no `trigger.cron`

#### Scenario: Hourly repeat sends the entered minute

- **WHEN** the user selects Hourly, enters `minute = '15'`, zone `Asia/Kolkata`, and submits
- **THEN** `trigger.cron.fields` equals exactly `{ hour: '*', minute: '15' }` and `timezone = 'Asia/Kolkata'`

#### Scenario: Daily repeat is not converted to UTC

- **WHEN** the user selects Daily with time `09:00`, zone `Europe/Berlin`, in a browser whose zone is `America/New_York`
- **THEN** `trigger.cron.fields` is `{ hour: '9', minute: '0' }` and `timezone = 'Europe/Berlin'`

#### Scenario: Weekly keeps the selected weekday

- **WHEN** the user selects Weekly, Monday, time `23:30`, zone `Asia/Tokyo`
- **THEN** `trigger.cron.fields` is `{ hour: '23', minute: '30', day_of_week: '0' }` with no weekday shift

#### Scenario: Monthly keeps the selected day

- **WHEN** the user selects Monthly, day `31`, time `00:30`
- **THEN** `trigger.cron.fields.day` is `'31'`, never `'last'` or `'1'`

#### Scenario: Custom sends the weekday list unshifted

- **WHEN** the user selects Custom, Monday, Wednesday and Friday, time `09:00`, zone `Europe/Berlin`
- **THEN** `trigger.cron.fields` is `{ day_of_week: '0,2,4', hour: '9', minute: '0' }` with no `week` or `day` key

#### Scenario: Result does not depend on the browser zone

- **WHEN** the same form values are mapped with the process zone set to `UTC` and to `Pacific/Auckland`
- **THEN** both bodies are identical

### Requirement: Activity window is sent as zone-local boundaries

For any non-`'oneTime'` repeat, including `'hourly'`, `trigger.cron` SHALL be `{ fields, startDate?, endDate? }`. `startDate` SHALL be `<YYYY-MM-DD>T00:00:00.000` and `endDate` `<YYYY-MM-DD>T23:59:59.999`, both offset-less and so local to `values.timezone`. `startDate`/`endDate` MUST NOT be sent for `'oneTime'`.

#### Scenario: No dates set is a valid submit

- **WHEN** `values.repeat !== 'oneTime'` and both `startDate` and `endDate` are empty
- **THEN** submit proceeds and the POST body's `trigger.cron` has no `startDate`/`endDate` keys

#### Scenario: Both dates set sends zone-local boundaries

- **WHEN** `values.repeat` is a day-based cadence, `startDate = '2026-08-01'`, `endDate = '2026-08-31'`, zone `Europe/Berlin`, in a browser at any zone
- **THEN** `trigger.cron.startDate` is `'2026-08-01T00:00:00.000'` and `trigger.cron.endDate` is `'2026-08-31T23:59:59.999'`, with `timezone = 'Europe/Berlin'`

#### Scenario: Hourly uses the same boundaries

- **WHEN** `values.repeat === 'hourly'`, `startDate = '2026-08-01'`, `endDate = '2026-08-31'`
- **THEN** `trigger.cron` carries `fields: { hour: '*', minute: '0' }` and the same local boundaries as the day-based repeats

#### Scenario: Custom submit never carries stale boundary values

- **WHEN** the user sets a Start date while `values.repeat === 'weekly'`, switches to `'custom'`, and submits
- **THEN** the Start date stays visible and is sent as `trigger.cron.startDate`; after switching to `'oneTime'` instead, no boundary is sent

#### Scenario: Switching back to One-time never sends the window

- **WHEN** the user set `startDate`/`endDate` on a recurring repeat, then switches to `'oneTime'` and submits
- **THEN** the POST body's `trigger` is `{ date }` only — no `cron`, `startDate`, or `endDate`

### Requirement: Activity window is validated against today in the task zone

Create and edit SHALL block submit with `errors.endDate` when `endDate` is earlier than `startDate`; equal dates form a valid single-day window and an empty field skips the check. `validateScheduledTaskFormValues` SHALL reject a boundary earlier than today in `values.timezone` (`StartDateInPast`/`EndDateInPast`, after the ordering check), exempt a boundary equal to `originalStartDate`/`originalEndDate`, and reject non-`YYYY-MM-DD` boundaries (`StartDateInvalid`/`EndDateInvalid`).

#### Scenario: endDate earlier than startDate blocks submit with an inline error

- **WHEN** the user sets `endDate` earlier than `startDate` and activates Create
- **THEN** `errors.endDate` is set to the `endDateBeforeStartError` message, no `createScheduledTask` call is made, and the form remains open

#### Scenario: endDate equal to startDate is a valid single-day window

- **WHEN** `startDate` and `endDate` are the same day, not earlier than today in the selected zone
- **THEN** no ordering error is set and the window covers that day from `00:00:00.000` to `23:59:59.999` local

#### Scenario: A past startDate blocks submit with an inline error

- **WHEN** `startDate` is earlier than today in the selected zone and the user activates Create/Save
- **THEN** `errors.startDate` is `startDateInPast` and no create/update call is made

#### Scenario: A past endDate blocks submit with an inline error

- **WHEN** `endDate` is earlier than today in the selected zone (with `startDate` unset or valid)
- **THEN** `errors.endDate` is `endDateInPast` and no create/update call is made

#### Scenario: An unchanged prefilled past boundary still saves on the edit page

- **WHEN** an older task's past boundary is prefilled, left unchanged, and the user activates Save
- **THEN** no past-date error is set and `updateScheduledTask` proceeds with the boundary preserved

#### Scenario: A boundary changed to a different past date blocks save on the edit page

- **WHEN** an older task's past `startDate` is changed to another earlier-than-today date
- **THEN** `errors.startDate` is `startDateInPast` and no update call is made

#### Scenario: A window starting on today is accepted

- **WHEN** `startDate` equals today in the selected zone and `endDate` is a later day
- **THEN** no past-date error is set

#### Scenario: Today depends on the selected zone

- **WHEN** it is `2026-03-10` in the browser zone and already `2026-03-11` in the selected `Asia/Tokyo`, and `startDate = '2026-03-10'`
- **THEN** `errors.startDate` is `startDateInPast`

### Requirement: Activity-window strings flow through react-i18next

The i18n keys `scheduledTasks.create.startDateLabel`, `scheduledTasks.create.endDateLabel`, `scheduledTasks.create.startDatePlaceholder`, `scheduledTasks.create.endDatePlaceholder`, `scheduledTasks.create.endDateBeforeStartError`, `scheduledTasks.create.startDateInPast` and `scheduledTasks.create.endDateInPast` SHALL stay in `apps/chat/src/i18n/locales/en.json` with matching `ScheduledTasksI18nKeys` entries, resolved in `useScheduledTaskFormLabels` and passed to the lib as plain strings.

#### Scenario: Labels are resolved by the app

- **WHEN** the create page renders
- **THEN** the lib receives the translated window labels and errors as strings and imports no i18n

### Requirement: Reverse mapping reads zone-local fields as stored

`libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts` SHALL map a `ScheduledTaskDto` to form values by reading `hour`, `minute`, `day_of_week` and `day` exactly as stored, with no offset shift, and setting `values.timezone` from the DTO (`'UTC'` when absent). A one-time `date` with an offset or `Z` SHALL be converted into the task's zone to produce `values.runAt`; an offset-less one is used as stored. Boundaries hydrate as `YYYY-MM-DD` the same way.

#### Scenario: One-time instant is shown in the task zone

- **WHEN** a task's `trigger.date` is `'2026-07-24T07:00:00.000Z'` with zone `Europe/Berlin`
- **THEN** `values.runAt = '2026-07-24T09:00'` and `values.timezone = 'Europe/Berlin'`

#### Scenario: Offset-less one-time date is used as stored

- **WHEN** a task's `trigger.date` is `'2026-07-24T09:00:00'` with zone `Asia/Tokyo`
- **THEN** `values.runAt = '2026-07-24T09:00'` in any browser zone

#### Scenario: Hourly task round-trips

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '*', minute: '15' }`
- **THEN** `values.repeat = 'hourly'`, `values.minute = '15'` in any browser zone, and no `time`, `dayOfWeek` or `dayOfMonth`

#### Scenario: Daily task is read without an offset shift

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '7', minute: '0' }` with zone `UTC`, viewed in a `Europe/Berlin` browser
- **THEN** `values.repeat = 'daily'`, `values.time = '07:00'` and `values.timezone = 'UTC'`

#### Scenario: Weekly task keeps its weekday

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '23', minute: '30', day_of_week: '0' }` with zone `Asia/Tokyo`
- **THEN** `values.repeat = 'weekly'`, `values.dayOfWeek` is Monday and `values.time = '23:30'`

#### Scenario: Monthly task keeps its day

- **WHEN** a task's `trigger.cron.fields` is `{ hour: '9', minute: '0', day: '31' }`
- **THEN** `values.repeat = 'monthly'` and `values.dayOfMonth = '31'`

#### Scenario: Custom task round-trips

- **WHEN** a task's `trigger.cron.fields` is `{ day_of_week: '0,2,4', hour: '9', minute: '0' }`
- **THEN** `values.repeat = 'custom'`, `values.daysOfWeek = ['0', '2', '4']`, `values.time = '09:00'`, and mapping forward reproduces the same fields

#### Scenario: Older UTC-instant boundaries hydrate in the task zone

- **WHEN** a task with zone `Europe/Berlin` has `startDate = '2026-07-31T22:00:00.000Z'` and `endDate = '2026-08-31T21:59:59.999Z'`
- **THEN** `values.startDate = '2026-08-01'` and `values.endDate = '2026-08-31'`

#### Scenario: Hourly task with a time-of-day boundary opens with its date

- **WHEN** an hourly task was saved with a time-carrying boundary
- **THEN** the form shows just the boundary's calendar day in the task zone

#### Scenario: Task without a stored zone opens as UTC

- **WHEN** the DTO has no `timezone`
- **THEN** `values.timezone = 'UTC'` and the stored fields are shown unchanged

#### Scenario: DST-day task keeps its wall time

- **WHEN** a `Europe/Berlin` task `{ hour: '9', minute: '0' }` is opened in July and in January
- **THEN** `values.time = '09:00'` both times

### Requirement: Reverse mapping is fail-closed for unsupported or incomplete tasks

The mapper SHALL return a discriminated result (values, or a failure reason), reading cron fields by non-`null` value because DIAL Scheduler returns every key with `null` for unset ones. A set field outside `hour`/`minute`/`day`/`day_of_week`, a non-null `week`, an unsupported `triggerType`, or a missing model or prompt/skill SHALL fail, and the edit page SHALL then show a non-destructive error without an editable form.

#### Scenario: A weekly task without a week value still hydrates as Weekly

- **WHEN** a task's fields are `{ hour: '7', minute: '0', day_of_week: '0' }` with `week` present but `null`
- **THEN** `values.repeat = 'weekly'`, not `'custom'`

#### Scenario: An unsupported week expression fails closed

- **WHEN** a task's `trigger.cron.fields` includes `week: '*/1'`, `'*/2'`, `'2-40'`, `'1,3'` or `'*/12'`
- **THEN** the mapper returns the unsupported-cron-shape failure and the edit page shows the "can't be edited here" message with Save unavailable, while the task stays listed, pausable and deletable

#### Scenario: A custom schedule with an activity window hydrates its boundaries

- **WHEN** a task's `trigger.cron` carries the Custom shape and also a `startDate` and `endDate`
- **THEN** the mapper succeeds and hydrates both boundaries

#### Scenario: A custom schedule with extra cron constraints fails closed

- **WHEN** a task has `{ day_of_week: '0,2', hour: '9', minute: '0' }` plus a non-null `month`, `year`, `second` or `day`
- **THEN** the mapper returns the unsupported-cron-shape failure

#### Scenario: Null-valued extra fields do not prevent Custom editing

- **WHEN** the Custom shape is accompanied only by null-valued `month`, `year`, `day`, `week` and `second`
- **THEN** the mapper succeeds with `values.repeat = 'custom'`

#### Scenario: Unsupported cron shape fails closed

- **WHEN** a task's fields encode a shape the form cannot represent (a `day_of_week` range or step such as `'0-4'` or `'*/2'`, an unsupported field, or `hour: '*'` with a set `day`/`day_of_week`)
- **THEN** the mapper returns a failure result and the edit page shows the non-destructive message with Save unavailable

#### Scenario: Null-valued cron fields are treated as absent

- **WHEN** a task's fields are `{ hour: '9', minute: '0', day: null, week: null, year: null, month: null, second: null, day_of_week: null }`
- **THEN** the mapper succeeds as a plain daily schedule

#### Scenario: Missing required fields fails closed

- **WHEN** a task's `model` is missing/empty, `prompt` is not a string, or both trimmed `prompt` and `skillUrls` are empty
- **THEN** the mapper returns a failure result and the edit page shows the same error without submitting a partial update

#### Scenario: Skill-only task hydrates without catalog metadata

- **WHEN** an otherwise supported task has `prompt: ""` and a saved `skillUrls`
- **THEN** mapping succeeds with the same reference and an empty prompt

### Requirement: Create form exposes the time zone field

`ScheduledTaskCreateFormValues` SHALL include a required `timezone` (IANA id). `ScheduledTaskCreateForm` SHALL render the picker from the `scheduled-task-timezone` capability, fed by host-supplied options and labels, and report changes through `onFieldChange('timezone', id)`. The lib SHALL receive these only through props. Validation SHALL reject an empty or `Intl`-rejected `timezone` with `TimezoneInvalid`.

#### Scenario: Picker is shown for time-based repeats

- **WHEN** `values.repeat` is daily, weekly, monthly, custom or one-time
- **THEN** the "Change timezone" link is rendered under the matching Time or Run-at field

#### Scenario: Hourly shows the link under the Minute field

- **WHEN** `values.repeat` is hourly
- **THEN** the "Change timezone" link is rendered under the Minute field, and the selected zone is sent with the task

#### Scenario: Unknown zone fails validation

- **WHEN** `values.timezone` is empty or an identifier `Intl` rejects (for example `Mars/Olympus`)
- **THEN** the shared validation returns `TimezoneInvalid` and submit is blocked
