## Context

Scheduled Tasks lets a user create a one-shot or recurring task that DIAL Scheduler executes later. "Once" tasks build `trigger.date` from a native `<input type="datetime-local">` and correctly convert it with `new Date(values.runAt).toISOString()` (`apps/chat/src/utils/scheduled-task-trigger.ts:45`), then display it back with `Intl.DateTimeFormat(undefined, ...)` (`apps/chat/src/utils/map-scheduled-task-dto.ts:63-74`), which resolves to the browser's local timezone on both ends.

Recurring tasks build `trigger.cron.fields = { hour, minute, day_of_week?, day? }` from a native `<input type="time">` via `buildCronFields` (`apps/chat/src/utils/scheduled-task-trigger.ts:11-31`). The raw local `hour`/`minute` (and `day_of_week`) are sent as-is — no timezone conversion, no `timezone` field in the payload. `ScheduledTaskDto`/`UpstreamScheduleTrigger` (`apps/chat-api/src/scheduled-tasks/dto/scheduled-task.dto.ts`, `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts:9-12,72-101`) have no timezone field either. The list page's `formatCronScheduleLabel` (`apps/chat/src/utils/map-scheduled-task-dto.ts:36-61`) prints those raw numbers verbatim. DIAL Scheduler (`apps.py`-style cron backends, and APScheduler-based schedulers generally) execute `cron.fields` in a server-configured timezone, defaulting to UTC when none is supplied — so a schedule the user set for "9:00 daily" in, say, `Europe/Warsaw` actually fires at 9:00 UTC (11:00 local in summer).

Separately, the create form's date/time inputs are native HTML controls, inconsistent with the rest of the form (which already uses `@epam/ai-dial-ui-kit` inputs/selects). The installed `@epam/ai-dial-ui-kit@0.13.0-dev.17` exports a `Calendar` component (confirmed via `node_modules/@epam/ai-dial-ui-kit/dist/src/index.d.ts:141-143` and `dist/src/components/New/Calendar/Calendar.d.ts`) with `CalendarMode.Date | DateTime | Time | Weekday`, a controlled `value: Date | string | null`, `onChange`, `label`, `placeholder`, `minDate`/`maxDate`, and `locale`. This is not yet visible through the `ai-dial-ui-kit` MCP tool's `searchEntity`/`getEntityDetails` (likely an indexing gap for the `New/` component subtree) — the design below relies on the real `.d.ts`, not the MCP index.

## Goals / Non-Goals

**Goals:**
- Recurring schedules execute at the wall-clock time the user actually picked, regardless of their (or the server's) timezone — verified by converting local hour/minute/day-of-week to UTC before building `cron.fields`, and back to local for display.
- The list page's displayed recurring schedule time always matches what will actually execute.
- The create form's date/time entry uses `Calendar` from `@epam/ai-dial-ui-kit` for both once (`CalendarMode.DateTime`) and recurring (`CalendarMode.Time`) modes, replacing native `<input type="datetime-local">`/`<input type="time">`.
- No change to `libs/scheduled-tasks`'s host-isolation boundary: the lib still receives/returns plain local-time-shaped values (`values.runAt: Date | string`, `values.time: string 'HH:mm'`); all timezone resolution and UTC conversion stays in `apps/chat`.

**Non-Goals:**
- Adding a user-facing timezone selector (schedules always use the browser's current IANA timezone, matching how "once" schedules already behave).
- Changing the BFF/upstream request or response shape (`CreateScheduledTaskBodyDto`, `ScheduledTaskDto`, `UpstreamScheduleTrigger`) — the fix is confined to what the frontend computes and sends into the existing `cron.fields`, unless the live-upstream check in the Risks section below finds the Scheduler actually needs an explicit `timezone` field.
- Monthly (`day`) rollover across month boundaries (e.g. day 31 in a UTC-shifted month with fewer days) — out of scope; only same-day, next-day, and previous-day shifts within a week are handled for `day_of_week`. Monthly `day` conversion follows the same shift logic but does not attempt to clamp into a shorter month.
- Editing the DST-transition-week behavior of already-created schedules (schedules are computed once at create/update time using the current UTC offset; DST changes after creation are a known, accepted limitation shared with how `cron` semantics generally work).
- Publishing `Calendar` to the MCP `ai-dial-ui-kit` index — that's an ui-kit-repo-side indexing gap, not something this change can fix from `ai-dial-chat`.

## Decisions

### 1. Timezone source: browser IANA timezone, computed at the app edge

`Intl.DateTimeFormat().resolvedOptions().timeZone` (already implicitly relied upon by `toISOString()`/`Intl.DateTimeFormat(undefined, ...)` for "once" tasks) is the single source of truth for "the user's timezone." No new prop or config value is introduced. This keeps recurring and once schedules using the same timezone semantics and requires no server-side timezone storage.

Alternative considered: ask the user to pick a timezone explicitly. Rejected — "once" schedules don't do this today, and introducing an explicit picker for only the recurring path would create an inconsistent UX and expand scope beyond the reported bug.

### 2. UTC conversion strategy for cron fields: compute via a reference `Date`, not manual offset arithmetic

To convert a local `HH:mm` (+ optional weekday/day-of-month) into the equivalent UTC `HH:mm` (+ shifted weekday/day-of-month), construct a concrete `Date` for "the next occurrence" using the local values, then read back its UTC hour/minute/day via `date.getUTCHours()`/`getUTCMinutes()`/`getUTCDay()`/`getUTCDate()`. This correctly accounts for the current DST offset without manual UTC-offset math (`Date` objects encapsulate offset by construction). Concretely, in `apps/chat/src/utils/scheduled-task-trigger.ts`:

```ts
const localDate = new Date();
localDate.setHours(hour, minute, 0, 0);
if (dayOfWeek != null) {
  // roll localDate forward to the next matching weekday before reading UTC fields
}
const utcHour = localDate.getUTCHours();
const utcMinute = localDate.getUTCMinutes();
const utcDayOfWeek = localDate.getUTCDay(); // shift applied if the UTC conversion crosses midnight
```

Alternative considered: pure integer offset math (`totalMinutes = hour*60+minute - tzOffsetMinutes`, then `mod 1440`). Rejected — reimplementing day/weekday rollover and DST offset lookup by hand duplicates what `Date` already does correctly and is more error-prone to test.

### 3. Weekday rollover: shift `day_of_week` by ±1 (mod 7) only when the UTC hour crosses midnight relative to local

When `utcHour !== hour` in a way that indicates the date rolled forward (local time is enough ahead of UTC that the UTC wall-clock moment falls on the previous UTC calendar day) or backward (local time is enough behind UTC that the UTC moment falls on the next UTC calendar day), shift the stored `day_of_week` accordingly, derived directly from the reference `Date`'s `getUTCDay()` rather than a separate manual shift calculation — the reference `Date` already encodes the correct calendar day, so `getUTCDay()` is read once and used as-is (no separate "did it roll" branch needed for the day field itself; the mitigation is really "trust `getUTCDay()`", listed as a Decision for clarity to implementers who might otherwise reach for offset arithmetic).

### 4. Monthly `day` conversion: same reference-`Date` approach, explicitly not clamped

`day` (day-of-month, 1–31) for monthly recurrence uses `getUTCDate()` off the same reference `Date`. Because the reference `Date` is constructed from "today" (or any fixed anchor date with the right day-of-month), a day-31 local schedule converting to UTC day 1 of the "next" month is expected and matches actual cron semantics — the BFF/Scheduler already treats `day` as a literal day-of-month field with no special end-of-month handling, so this change does not add any.

### 5. Display conversion mirrors submit conversion, symmetric implementation

`formatCronScheduleLabel` (`apps/chat/src/utils/map-scheduled-task-dto.ts:36-61`) gets a companion UTC→local conversion using the same reference-`Date` technique but reading local getters (`getHours()`, `getDay()`, `getDate()`) off a `Date` constructed from the *stored* UTC fields via `Date.UTC(...)`. This guarantees the list always shows exactly what will execute, by construction (same conversion primitive, inverse direction), rather than an independently-derived formula that could drift from the submit-side logic.

### 6. `Calendar` integration: `CalendarMode.DateTime` for once, `CalendarMode.Time` for recurring

`ScheduledTaskCreateForm` (`libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx:211-243`) replaces:
- the "once" `<input type="datetime-local">` with `<Calendar mode={CalendarMode.DateTime} value={values.runAt ? new Date(values.runAt) : null} onChange={...} />`
- the recurring `<input type="time">` with `<Calendar mode={CalendarMode.Time} value={values.time} onChange={...} />` (per the `.d.ts`, `Time` mode's controlled value is an `"HH:mm"` string, matching `values.time`'s existing shape exactly — no reshaping needed at the call site)

`onChange` adapts `Calendar`'s `CalendarValue` (`Date | string | null`) back into the existing `onFieldChange('runAt' | 'time', ...)` contract the page already expects, so `ScheduledTaskCreatePage`'s mapping to `trigger` (Decision 2 above) needs no interface change. This keeps the lib boundary intact: `Calendar` is a generic ui-kit control with no host knowledge, so importing it into `libs/scheduled-tasks` does not violate library isolation.

**Update:** `CalendarMode.Weekday` was also adopted for `values.dayOfWeek` (per explicit user request during apply). `Calendar`'s `weekday` mode value is an **ISO** weekday number string (`"1"`=Monday..`"7"`=Sunday), while `values.dayOfWeek` (and the upstream `cron.fields.day_of_week`) uses the **APScheduler** convention (`"0"`=Monday..`"6"`=Sunday, confirmed in Decision 3 / `cron-fields.validator.ts`). These are a fixed +1/-1 offset apart (no modulo needed, since both ranges start at Monday) — `libs/scheduled-tasks/src/utils/calendar-value.ts` adds `dayOfWeekToCalendarValue`/`calendarValueToDayOfWeek` to convert between them, keeping this ISO↔APScheduler detail as a pure UI-value-mapping concern local to the lib (it does not require any host/app-specific knowledge, unlike the UTC timezone conversion in Decisions 2–5, which stays in `apps/chat`).

Day-of-month (`values.dayOfMonth`) is still a plain `Input` in this change — `CalendarMode.Date`/`DateTime` don't offer a "day-of-month only, no year/month" mode, so there's no ui-kit `Calendar` mode that fits it without also picking an arbitrary month, and this wasn't part of the user's request.

### 7. Confirm upstream contract before implementation

Before writing the mapper/DTO code, `apply` MUST confirm against a live DIAL Scheduler response (or its OpenAPI spec, same standard already used elsewhere in `scheduled-tasks-api`'s spec) whether `cron.fields` is interpreted as UTC unconditionally, or whether the Scheduler instead accepts/expects an explicit `timezone` key alongside `fields`. If the latter, the design shifts to: send `hour`/`minute`/`day_of_week` unconverted (as entered, local) plus a new `trigger.cron.timezone` (IANA string) field, and skip the UTC-conversion math in Decisions 2–5 entirely in favor of passing the timezone through. This is flagged as the primary open risk below, not assumed away.

**Confirmed (2026-07-30)** against the official "DIAL Scheduler For Sharing" Postman collection: every `Create Schedule`/`Update Schedule` request body's `trigger.cron.fields` (e.g. `{"minute": "*"}`, `{"day": "*"}`) contains only bare APScheduler-style field keys — no `timezone` key appears anywhere in the collection's schedule-creation or -update requests, nor in `Get Schedule Details`. This confirms the Scheduler does not accept or expect an explicit `timezone` field on `cron`; `cron.fields` are interpreted by the Scheduler process's own clock (server-side, effectively UTC) with no per-schedule override. The UTC-conversion approach in Decisions 2–5 is therefore the correct and only client-side fix — no design pivot needed.

## Risks / Trade-offs

- **[Risk] The live DIAL Scheduler might already support a `timezone` field on `cron`, making the UTC-conversion approach here unnecessary rework** → Mitigation: Decision 7 makes this the first implementation task; if confirmed, the design pivots to passing `timezone` through unconverted rather than computing UTC fields, and this design doc must be amended before the rest of `tasks.md` proceeds.
- **[Risk] DST transitions between create-time and each future execution can silently shift the effective local execution time by an hour** → Mitigation: explicitly called out as a Non-Goal; matches standard cron/timezone-conversion limitations and is not something a one-time UTC conversion at creation time can fully solve without re-deriving on every run (which the Scheduler, not this app, would need to do).
- **[Risk] `Calendar`'s `Time` mode masked `"HH:mm"` text field may have different validation/empty-state behavior than the native `<input type="time">` it replaces** → Mitigation: verify manually in the browser (per this repo's UI-change testing expectation) that empty state, invalid partial input, and keyboard entry behave acceptably before considering the form-swap task done.
- **[Risk] The `ai-dial-ui-kit` MCP tool doesn't index `Calendar`, so future contributors following "always check MCP first" may incorrectly conclude it doesn't exist** → Mitigation: out of scope for this repo to fix (it's an indexing gap in the separate ui-kit MCP server); note in the PR description that `Calendar`'s real source is `node_modules/@epam/ai-dial-ui-kit/dist/src/components/New/Calendar/Calendar.d.ts` for anyone who hits the same gap.
