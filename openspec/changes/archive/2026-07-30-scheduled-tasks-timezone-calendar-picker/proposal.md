## Why

Recurring (cron) scheduled tasks are timezone-broken: the create form takes the user's local wall-clock hour/minute via a native `<input type="time">` and sends it to the BFF/DIAL Scheduler as raw `cron.fields.hour`/`minute` with no timezone information. The scheduler executes cron fields in its own (server/UTC) timezone, so "every day at 9:00" fires at 9:00 UTC, not 9:00 in the user's local time — and the list page echoes the same raw numbers back, giving the user a false impression that the schedule matches their local wall clock. "Once" tasks already do this correctly (local input converted to a UTC ISO string on submit, converted back to local for display), so the fix brings recurring tasks in line with that existing, correct pattern: **store/transmit in UTC, display in the user's local timezone**.

Separately, the create form's date/time inputs are native HTML `<input type="datetime-local">` / `<input type="time">`, which are inconsistent with the design system. `@epam/ai-dial-ui-kit` ships a `Calendar` component (`CalendarMode.Date | DateTime | Time | Weekday`) purpose-built for this. Migrating the form's date/time fields to `Calendar` is the natural place to land the timezone fix, since the new value-handling code path is being touched anyway.

## What Changes

- Fix recurring (cron) trigger timezone handling end-to-end:
  - Frontend: when the user picks a local hour/minute (and, for weekly, a local day-of-week) for a recurring schedule, convert to the equivalent UTC hour/minute/day-of-week before building `trigger.cron.fields`, using the browser's IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Handle the day-of-week/day-of-month rollover that can occur when the UTC conversion crosses midnight.
  - Backend: no upstream contract change is required for correctness (the DIAL Scheduler already accepts `cron.fields` as UTC hour/minute — only the frontend was sending local values unconverted); confirm this against a live upstream response before implementation and adjust the design if the Scheduler instead expects a `timezone` field.
  - List page: convert the stored UTC `cron.fields.hour`/`minute` (and `day_of_week`/`day`) back to the user's local time for display in `formatCronScheduleLabel`, mirroring the existing local-display behavior already used for "once" schedules.
- Replace native `<input type="datetime-local">` / `<input type="time">` in `ScheduledTaskCreateForm` with the `Calendar` component from `@epam/ai-dial-ui-kit`:
  - `CalendarMode.DateTime` for the "once" run-at field.
  - `CalendarMode.Time` for the recurring time-of-day field.
  - Underlying values passed up through `onFieldChange` stay the same shape the page already expects (`values.runAt`, `values.time`), so this is a UI-layer swap, not a form-contract change; the corrected UTC-conversion logic from the timezone fix consumes those same local values.
- **BREAKING**: none — this changes internal trigger-building/display logic and swaps an internal form control; the BFF request/response contract (`CreateScheduledTaskBodyDto`, `ScheduledTaskDto`) is unchanged unless the live-upstream check above finds otherwise.

## Capabilities

### New Capabilities

(none — this change modifies requirements of two existing capabilities)

### Modified Capabilities

- `scheduled-task-create-form`: adds UTC conversion of recurring `cron.fields` (hour/minute/day-of-week/day) at submit time, and replaces the native datetime/time inputs with `Calendar` from `@epam/ai-dial-ui-kit` for both once and recurring modes.
- `scheduled-tasks-page-ui`: adds local-timezone conversion of `formatCronScheduleLabel` so a recurring schedule's displayed time matches what will actually execute, consistent with the existing local-display behavior for "once" schedules.

## Impact

- `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx` — swap date/time inputs for `Calendar`.
- `apps/chat/src/utils/scheduled-task-trigger.ts` — add local→UTC conversion for cron `hour`/`minute`/`day_of_week`/`day` in `buildCronFields`.
- `apps/chat/src/utils/map-scheduled-task-dto.ts` — add UTC→local conversion in `formatCronScheduleLabel`.
- No new dependency: `@epam/ai-dial-ui-kit`'s `Calendar` is already published in the installed package version; no `package.json` change expected unless the installed version predates it.
- No database/infra impact; no BFF contract change expected (pending the live-upstream confirmation noted above).
