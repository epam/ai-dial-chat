## Context

DIAL Scheduler's cron trigger accepts an optional activity window (`trigger.cron.start_date` / `trigger.cron.end_date`) alongside `fields`. The BFF (`ScheduleCronDto` in `apps/chat-api/src/scheduled-tasks/dto/schedule-trigger.dto.ts`) currently maps only `fields`; `scheduled-tasks.mapper.ts` builds/parses `UpstreamScheduleTrigger` with a single `cron: { fields }` shape and enforces "exactly one of `date`/`cron`" via `assertExactlyOneTriggerVariant`. On the frontend, `@epam/ai-dial-scheduled-tasks`'s `ScheduledTaskCreateForm` already renders `Calendar` controls (`CalendarMode.DateTime` for `runAt`, `CalendarMode.Time` for `time`, `CalendarMode.Weekday` for `dayOfWeek`) with controlled-value conversion helpers in `libs/scheduled-tasks/src/utils/calendar-value.ts`, and `apps/chat/src/utils/scheduled-task-trigger.ts` converts the form's local wall-clock `time`/`dayOfWeek`/`dayOfMonth` into UTC `cron.fields` via a reference `Date` and UTC getters.

This design extends both layers additively: two new optional DTO fields, two new mapper-level cross-field checks, two new optional form fields with `CalendarMode.Date` pickers, and a boundary-conversion addition next to `buildCronFields`.

## Goals / Non-Goals

**Goals:**

- Let a recurring schedule carry an optional `[startDate, endDate]` activity window, round-tripped through create, update, and get.
- Reject the window on one-shot (`trigger.date`) schedules and reject an inverted/equal window (`endDate <= startDate`) at the BFF boundary, since class-validator cannot express either check declaratively across two optional sibling DTO fields.
- Keep the lib (`@epam/ai-dial-scheduled-tasks`) presentational and host-agnostic: no timezone math, no i18n, no validation logic beyond rendering `errors.startDate`/`errors.endDate`.
- Convert the form's local calendar-day bounds to UTC ISO instants consistently with how `buildCronFields` already converts local wall-clock time to UTC `cron.fields`, so the two don't drift into different timezone-handling conventions.

**Non-Goals:**

- Windows on one-shot schedules (upstream doesn't support this).
- An edit UI for changing an existing task's window (the update endpoint accepts the fields once `UpdateScheduledTaskBodyDto` reuses the create body shape; no edit form exists to wire it into yet).
- A timezone selector — schedules stay in the browser's local timezone, unchanged from today.
- Detail-page display of the window (only in scope if that page is already merged; otherwise the mapper support alone lands).
- Upstream rejecting a window that lies entirely in the past — that's Scheduler's own validation, not the BFF's.

## Decisions

### 1. DTO shape: `startDate`/`endDate` live on `ScheduleCronDto`, not `ScheduleTriggerDto`

They nest under `cron` to mirror the upstream `trigger.cron.start_date`/`end_date` shape exactly (siblings of `fields`), rather than living on `ScheduleTriggerDto` next to `date`/`cron`. This keeps the "only meaningful for cron" invariant visible in the type shape itself — a `ScheduleTriggerDto` with `date` set structurally cannot also carry `startDate`/`endDate`, since those fields don't exist outside `cron`. Both use `@IsOptional() @IsISO8601()`, same validator already used for `ScheduleTriggerDto.date`.

**Alternative considered:** put `startDate`/`endDate` on `ScheduleTriggerDto` as top-level optional fields, closer to how a naive reading of "trigger window" might suggest. Rejected: it would let a `date` trigger carry them at the type level, pushing the entire one-shot-rejection burden onto runtime validation with no structural help, and it wouldn't match the nested upstream shape 1:1 (more mapper translation, not less).

### 2. Cross-field validation stays in the mapper, alongside `assertExactlyOneTriggerVariant`

The existing comment in `scheduled-tasks.mapper.ts` already explains why the "exactly one trigger variant" rule can't be a class-validator decorator (it spans two optional sibling fields). The same reasoning applies to "window only valid for cron" and "end after start" — both span sibling/optional fields that class-validator's per-property decorators can't cross-reference without a custom class-level validator. Rather than introducing one, extend the same hand-rolled assertion function used today, run before `toUpstreamTrigger` builds the cron payload, so both checks live in one reviewable place with one existing test suite to extend.

**Alternative considered:** a custom class-validator `@ValidatorConstraint` on `ScheduleCronDto`/`ScheduleTriggerDto` for cross-field rules. Rejected: heavier than the codebase's existing pattern for this exact class of problem, and inconsistent with the trigger-variant check already living in the mapper.

### 3. Upstream key omission: only emit `start_date`/`end_date` when the camelCase value is present and non-empty

Matches the existing `description` pattern in `toUpstreamSchedulePayload` (`...(body.description ? { description: body.description } : {})`) — omit the key entirely rather than sending `null`, since a live Scheduler check hasn't confirmed `null` is accepted identically to an absent key. This is the conservative default and costs nothing to change later if Scheduler is confirmed to treat them the same.

### 4. Frontend: `CalendarMode.Date`, not `CalendarMode.DateTime`

The design calls for date-only pickers ("Pick start date" / "Pick end date"), and the boundary semantics (start of day / end of day) are computed by the app, not entered by the user — so the picker itself only needs a date, matching the existing `runAtToCalendarValue`/`calendarValueToRunAt` pattern but for the `Date` mode instead of `DateTime`. New helpers `dateValueToCalendarValue`/`calendarValueToDateValue` in `calendar-value.ts` produce/consume a plain `YYYY-MM-DD` string (not a `datetime-local` string), kept as a separate pair from `calendarValueToRunAt` specifically because the two functions target different string shapes for different consumers.

### 5. Local-day → UTC boundary conversion sits next to `buildCronFields`, using the same reference-`Date` technique

`buildCronFields` already documents why it uses a single reference `Date` + UTC getters instead of manual offset arithmetic: the browser's own timezone/DST handling does the conversion. The new boundary conversion (`startDate` → local `00:00:00.000` → ISO; `endDate` → local `23:59:59.999` → ISO) reuses that exact technique so both conversions in the same file rely on one documented mental model instead of two. The "end of local day" choice (not midnight of the next day) is deliberate: it keeps the last calendar day the user picked fully inside the window without off-by-one surprises when DST shifts the UTC offset between the two ends of a multi-month window.

**Alternative considered:** convert bounds to midnight-UTC-of-that-calendar-date without going through local time first (i.e. treat the date string as already UTC). Rejected: it would silently exclude/include an extra local day near DST boundaries and would use a different conversion model than the sibling `cron.fields` conversion in the same file — the whole point of this decision is to keep exactly one timezone-handling story in this module.

### 6. Lib stays presentational; the app owns "clear stale values on schedule-type switch"

Per the proposal, switching `scheduleType` back to `'once'` must not leak stale `startDate`/`endDate` into the submit body. The lib does not mutate its own `values` (it never has — `onFieldChange` is the only mutation path, owned by the page). `mapFormValuesToCreateBody` already branches on `scheduleType` to decide which trigger shape to build; the `once` branch simply never reads `startDate`/`endDate`, so no explicit "clear on switch" logic is needed anywhere — omission-by-branching is sufficient and matches how `frequency`-specific fields (`dayOfWeek`/`dayOfMonth`) already work today.

## Risks / Trade-offs

- **[Risk]** Sending `null` instead of omitting the key, if a future Scheduler behavior check shows they differ (e.g. `null` explicitly clears a previously-set bound on update, while omission leaves it untouched) → **Mitigation:** the omission-only decision (§3) is documented as provisional; when `UpdateScheduledTaskBodyDto`-driven editing ships, verify update semantics against a live Scheduler instance before assuming omission == "no change" or == "clear".
- **[Risk]** DST transitions inside a multi-month window could make "23:59:59.999 local → UTC" resolve to a UTC instant that, once compared against `next_run_time` values also computed by `buildCronFields`, looks inconsistent at the exact boundary date → **Mitigation:** decision §5 uses the same reference-`Date`/UTC-getter technique as `buildCronFields` specifically so both are wrong (or right) in the same way; add a unit test crossing a non-zero-offset DST boundary as called out in the proposal's verification list.
- **[Risk]** `class-validator`'s `@IsISO8601()` on `startDate`/`endDate` accepts date-only or datetime strings; if a client sends a bare `YYYY-MM-DD` instead of a full instant, `new Date(...)` comparisons in the mapper's ordering check still work (JS parses date-only ISO strings as UTC midnight) → **Mitigation:** no code change needed, but the mapper's ordering-check unit tests should cover a date-only string input, not just full ISO instants, since the app always sends full instants but the DTO-level contract doesn't force that.
- **[Trade-off]** Keeping validation in the mapper (not a class-validator constraint) means the check only runs on the code path that calls `toUpstreamTrigger`/`toUpstreamSchedulePayload` — acceptable because that's the only production code path today, and it's consistent with the pre-existing `assertExactlyOneTriggerVariant` trade-off already accepted in this codebase.

## Migration Plan

No data migration — both DTO fields and form values are optional and additive; existing recurring schedules with no window continue to round-trip with `startDate`/`endDate` as `undefined`. Rollout is a single deploy: BFF change + OpenAPI regeneration + `@epam/chat-api-client` regeneration + frontend lib/app changes ship together (the client regeneration is what the create page's new fields depend on). No feature flag is introduced — this rides the existing `scheduledTasksEnabled` gate already covering all four endpoints and both create-form/page capabilities.

## Open Questions

- Whether upstream Scheduler treats an explicit `start_date`/`end_date: null` on `PUT` identically to omitting the key (relevant once an edit UI exists) — deferred per §3/Risks, not blocking this change since no edit UI ships here.
