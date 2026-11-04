# Design

## Context

See `proposal.md` for the motivation and the team decision. Current state:

- **Custom today** (`ScheduledTaskRepeat.Custom`, `libs/scheduled-tasks/src/types/scheduled-task-schedule.ts`):
  - form values `everyWeeks`, `dayOfWeek` and `time`;
  - an Every `Select`, a Time `Calendar` and a single-select row of circular day `Button`s;
  - no activity window: `keepWindowBoundaryOnRepeatSwitch` in `libs/scheduled-tasks/src/utils/window-boundary.ts` clears both boundaries on any switch into or out of Custom.
- **Mapping:** `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts` maps Custom to `{ week: '*/N', day_of_week, hour, minute }` and back, converting local↔UTC with a reference `Date`. DIAL Scheduler runs cron in UTC with no per-schedule timezone.
- **Windows:** every recurring repeat now uses date-only Start/End pickers, including Hourly.
- **Labels:** `describeScheduledTaskTrigger` (`libs/chat-hooks/src/scheduled-task/scheduled-task-description.ts`) only understands a single numeric `day_of_week`, so a weekday list falls back to "Recurring schedule". `getNextCronOccurrence` (`libs/chat-hooks/src/scheduled-task/scheduled-task-next-occurrence.ts`) accepts only `/^[0-6]$/`.
- **Validator:** `apps/chat-api/src/scheduled-tasks/dto/cron-fields.validator.ts` already accepts comma lists in `day_of_week`.

## Goals / Non-Goals

**Goals:**
- Custom = several weekdays at one time with an optional window.
- An exact, single-cron encoding.
- No backend change.
- Every other repeat byte-for-byte unchanged.

**Non-Goals:**
- See `proposal.md` Non-goals.
- No change to Weekly's single-day picker.

## Decisions

### D1. Form value and labels

- **Form value:** `ScheduledTaskCreateFormValues` gains `daysOfWeek?: string[]` (APScheduler `'0'` Monday – `'6'` Sunday, kept sorted Monday first) and loses `everyWeeks`. `dayOfWeek` stays for Weekly only.
- **Errors:** `ScheduledTaskCreateFormErrors` gains `daysOfWeek`.
- **Labels:** `ScheduledTaskCreateFormLabels` gains `daysOfWeekLabel` and loses `everyLabel`/`everyWeekOptions`. `customDayOptions` stays.
- **Type:** the exported `ScheduledTaskEveryWeekOption` is removed.
- *Alternative:* reuse `dayOfWeek` as a comma-joined string. Rejected: it hides a list in a scalar and complicates validation and the dirty check.

### D2. UI stays the same controls

- **Field order:** the Time `Calendar`, then the existing circular kit `Button` day row, now multi-select with `aria-pressed`, then the existing internal `ScheduledTaskBoundaryField` pair (date-only). The Every `Select` is removed.
- **Selection rules:** activating the only selected day is a no-op, so the required field can never become empty. The row stays a `role="group"` named by its visible `Label` ("Days").
- **No new controls:** no new kit components are needed, and RTL and mobile behaviour are unchanged (seven 40px buttons with 2px gaps fit 320px).

### D3. Encoding: one cron, one shared day shift

- **Reference date:** one reference `Date` is built from the local time and rolled to the first selected weekday. Its UTC hour and minute are read back, along with its UTC calendar-day shift `s ∈ {−1, 0, +1}`.
- **Day list:** every selected day is shifted by `s` mod 7 and emitted as an ascending `day_of_week` list.
- **Why one shared shift:** the shift depends only on the time and the offset, so all days share it. A DST transition inside the coming week cannot split days into different UTC hours, because the offset is fixed once at save time. This is the same policy as Weekly.
- **Window:** `startDate`/`endDate` are converted with the existing day-based boundary conversion (`buildCronWindowBoundary`).
- **Fields:** no `week` field is emitted.
- **Exactness:** the encoding is exact. There are no approximation cases, because weekdays have no month-length or leap-year dependence.

### D4. Reverse mapping

- **Order of checks:** the predefined shapes are tried first. A single numeric weekday stays Weekly.
- **New Custom shape:** two or more distinct numeric weekdays, numeric `hour`/`minute`, no `day`/`week`. These map to Custom, with the days shifted back by the reference's calendar-day shift (sorted) and the window hydrated as for Weekly.
- **No compatibility path for the former every-N-weeks Custom option.** It was never released, so keeping clean code matters more than supporting development-only data: any non-null `week` value fails closed. The former `CUSTOM_WEEK_PATTERN` parsing in `scheduled-task-trigger.ts` is deleted.

### D5. Window-boundary switches

Every recurring repeat now renders the same date-only pickers, so `keepWindowBoundaryOnRepeatSwitch` loses its Custom special case. It becomes identity for recurring switches. Delete it if nothing else needs it; it is internal, not exported from `libs/scheduled-tasks/src/index.ts`. Switching to One time keeps today's behaviour: the window is simply not rendered or sent.

### D6. Labels and next occurrence

- **Weekly descriptor:** `describeScheduledTaskTrigger`'s Weekly kind gains an ordered weekday list.
- **Card and detail label:** `formatScheduledTaskScheduleLabel` (`libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts`) passes an `Intl.ListFormat` conjunction of the long weekday names to the existing `weeklyAt` callback, which the app maps to `scheduledTasks.card.scheduleWeeklyAt`. No new label key is needed.
- **Every-N-weeks label removed:** the `EveryNWeeks` description kind, `intervalWeeks`, the `everyNWeeks` callback and the `scheduledTasks.card.scheduleEveryNWeeks` key are deleted. A `week` field now falls to the generic "Recurring schedule" label.
- **Next occurrence:** `getNextCronOccurrence` accepts a weekday list.

### D7. Library isolation and API break

- **Isolation:** `libs/scheduled-tasks` receives only values, labels and callbacks. UTC conversion stays in `libs/chat-hooks`.
- **What breaks:** removing `everyWeeks`, `everyLabel`, `everyWeekOptions` and `ScheduledTaskEveryWeekOption` from `libs/scheduled-tasks`, and `ScheduledTaskTriggerDescriptionKind.EveryNWeeks`, `intervalWeeks` and `ScheduledTaskScheduleLabels.everyNWeeks` from `libs/chat-hooks`, is a public-API break.
- **Why it is acceptable:**
  - The fields exist only in `1.3.0-dev.*` prereleases; `release-1.2` and the `latest`/`release-1.1` dist-tags do not contain them.
  - Keeping them would violate the "every declared prop must be read" rule in `.claude/rules/libs.md`.
- **Follow-up in the same change:** both lib READMEs, `docs/scheduled-tasks-reuse.md` (migration row and release note) and `tools/scheduled-tasks-consumer-fixture/src/main.tsx` are updated.

## Risks / Trade-offs

- **Former every-N-weeks tasks become non-editable and lose their structured label.** → Accepted by the team: the option was never released and exists only in development builds since 27 Oct 2026. Such tasks keep running, show "Recurring schedule", and can be paused, deleted or recreated.
- **A one-day Custom reopens as Weekly.** → Same schedule on the wire; documented.
- **DST drift**, as for every other repeat. → Documented; the editor shows the real current local time.
- **Rollback** leaves weekday-list tasks non-editable in the old form, which fails closed on lists, but still running. → Acceptable for a revert.

## Migration Plan

No data migration and no backend deployment. Ship the UI change; existing tasks keep running unchanged.

## Open Questions

None.
