# Design: Scheduled task "Custom" repeat option

## Context

The create/edit form (`libs/scheduled-tasks` `ScheduledTaskCreateForm`) renders one of five fixed cadence sections keyed by `ScheduledTaskRepeat`; the host app supplies option labels; `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts` converts form values to `cron.fields` (local→UTC) on submit and inverts the mapping for the edit page, failing closed (`UnsupportedCronShape`) on shapes the editor cannot represent. The BFF (`apps/chat-api/src/scheduled-tasks/dto/cron-fields.validator.ts`) already validates `week` (1–53, steps, lists) and passes fields through to DIAL Scheduler verbatim — no backend work. Display goes through `describeScheduledTaskTrigger` (chat-hooks) → `buildScheduleLabel` (`apps/chat/src/utils/map-scheduled-task-dto.ts`), which already has a `Custom` fallback kind carrying the raw expression.

Stakeholder decisions already made (see proposal): structured editor (no raw expression), single day selection, "Every" 1–10 weeks, no activity window, week-of-year semantics accepted, Weekly option stays.

## Goals / Non-Goals

**Goals:** a Custom repeat option that stores `{ week: '*/N', day_of_week, hour, minute }`; lossless edit round-trip for that shape; localized card/detail copy; currently-uneditable tasks with a `week` key become editable.

**Non-Goals:** anchored N-week intervals, multi-day selection, an activity window for Custom, raw cron input, any backend change.

## Decisions

### D1: Form-value shape reuses existing fields; one new field

`ScheduledTaskCreateFormValues` gains `everyWeeks?: string` (`'1'`–`'10'`). Everything else is reused: `dayOfWeek` (`'0'`–`'6'`, same field Weekly uses — both mean "one selected weekday") and `time` (`HH:mm`). Custom is a day-based repeat with a time-of-day, so the existing masked time field, its blur validation, and `isTimeFieldShown` logic apply unchanged (Custom joins the daily/weekly/monthly group for the time field). Rationale: fewer new fields → `buildCronFields`, validation, and `hasScheduledTaskFormChanges` (which must gain `everyWeeks`) stay minimal; no parallel "customDay" field to keep in sync with Weekly's.

### D2: Stored shape and forward mapping

`buildCronFields` gets a Custom branch producing:

```json
{ "week": "*/N", "day_of_week": "<APScheduler day mon=0>", "hour": "<UTC hour>", "minute": "<UTC minute>" }
```

The day/time conversion reuses the Weekly path verbatim (reference `Date` rolled to the target weekday, local→UTC via getters — `libs/chat-hooks/src/scheduled-task/scheduled-task-trigger.ts:59`); `week` is the literal `'*/' + everyWeeks`. Custom **always** emits `week`, including `N=1` — that is the round-trip discriminator from Weekly (which never emits `week`). No `startDate`/`endDate` are sent for Custom even if stale values linger in form state (mapping ignores them for `repeat === 'custom'`).

### D3: Reverse mapping — `week` presence selects Custom; out-of-editor shapes still fail closed

`parseCronFields` currently rejects any `week` value (extra-key check) and day lists. New behavior: a **present, non-null `week`** value that matches `*/N` with `N` in 1–10, together with a single plain `day_of_week` and plain `hour`/`minute`, maps to Custom (`everyWeeks`, `dayOfWeek`, `time`). Anything else involving `week` (ranges, lists, `N` outside 1–10) still returns `{ ok: false, UnsupportedCronShape }` — the editor cannot represent it losslessly, and the existing fail-closed contract (spec: "Reverse trigger mapping is fail-closed for unsupported or incomplete tasks") is preserved. The stored `{day_of_week, hour, minute}` shape with no `week` keeps hydrating as Weekly, so existing tasks are unaffected.

### D4: Day-of-week row is a rounded kit `Button` row (Neutral Solid / Primary Solid)

The kit has no day-of-week picker control (`Calendar` weekday mode is a popover list, not buttons). The agreed design is a row of rounded toggle buttons — **Neutral · Solid** when unselected, **Primary · Solid** when selected — which is exactly the kit's 2.0 `Button` with `variant={ButtonVariant.Neutral|Primary}`, `appearance={ButtonAppearance.Solid}` and a `w-10 rounded-full` class pair (the kit's Standard size already renders a 40px height, so the fixed width completes the 40×40px circle). The row renders below the Time field under a visible required "Day" label whose host-generated id the row's `role="group"` references via `aria-labelledby`. Seven buttons at a 2px gap, each labeled with the localized single letter (M T W T F S S) and an `aria-label` carrying the full localized day name, `aria-pressed` marking the selection. Single-select: activating an unselected button calls `onFieldChange('dayOfWeek', <APScheduler day string>)`; activating the already-selected button is a no-op (the field is required, so exactly one day stays selected). `errors.dayOfWeek` renders below the row in the inline-error pattern. Alternatives rejected: `SegmentedControl` (kit single-select primitive, considered first — but it renders a joined track of segments, not the design's discrete rounded buttons); a hand-built `<button>` row (duplicates the kit `Button` for no gain). The labels (7 short + 7 full names) arrive through the existing `labels` prop; no i18n in the lib.

### D5: Window-boundary handling — Custom clears boundaries

`keepWindowBoundaryOnRepeatSwitch` (`libs/scheduled-tasks/src/utils/window-boundary.ts:16`) keeps boundary values when both cadences pick whole days. Custom renders **no** boundary pickers, so a value carried into it would be invisible but live in form state (dirty-check noise, then silently dropped by mapping). Decision: Custom joins the "clears" side — boundaries are cleared on any switch into or out of Custom. OneTime's existing keep-behavior is untouched.

### D6: Display — a structured `EveryNWeeks` description kind, not the raw-expression Custom kind

`describeScheduledTaskTrigger` gains recognition for the D2 shape: new kind `EveryNWeeks` carrying `intervalWeeks`, `dayOfWeek`, `time` (localized to the display timezone like the other kinds). `buildScheduleLabel` adds a case with a new i18n key — `scheduledTasks.card.scheduleEveryNWeeks`, English "Every {{count}} weeks on {{day}} at {{time}}" with i18next `one`/`other` plurals so `count=1` reads "Every week on Monday at 9:00 AM". The weekday name is formatted with the same `Intl.DateTimeFormat`-on-a-fixed-UTC-date trick the Weekly case uses (`apps/chat/src/utils/map-scheduled-task-dto.ts:108`). Shapes that don't match D2 keep falling back to the existing `Custom`/`Invalid` kinds — display tolerance is wider than editability, unchanged.

### D7: Next-run computation is NOT extended (correction to the exploration)

`getNextCronOccurrence` is used in exactly one place — the detail page's active-window label, which only computes when `cron.endDate` exists without `startDate` (`apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx:382`). Custom never has an end date, so the helper is never invoked for Custom tasks; the "Next run" field reads the server's `nextRunTime` directly. No change to `getNextCronOccurrence`. (If the server reports no `nextRunTime` for a custom task, the existing "no next run" display path applies — covered by the verification task.)

### D8: Validation

No new free-text input exists: `everyWeeks` comes from a dropdown (always 1–10), `dayOfWeek` from the segmented control, `time` from the masked picker. Validation therefore reuses existing rules: day-of-week required (error under the control, same as Weekly's), time required + `TIME_OF_DAY_PATTERN` blur pass, Save disabled while required Custom fields are empty (extends `isCreateDisabled`). The BFF remains the syntax authority; the client never constructs free-form cron text.

## Risks / Trade-offs

- [Week-of-year phase reset each January (N≥3 gaps can be shorter than N weeks)] → accepted product decision; implementation includes a verification task against a staging DIAL Scheduler, and the label says "Every N weeks" which stays honest for the overwhelming majority of intervals. If a live Scheduler later rejects `week` or fires off-pattern, the fallback is dropping the `week` field emission for N=1 and re-scoping the option — reversible before any task is created through the UI.
- [DST drift: fixed UTC `hour`/`minute` drifts an hour off local wall-clock after a DST transition] → identical to the existing Daily/Weekly/Monthly cadences; not a regression, noted for support awareness.
- [Custom N=1 + no bounds stores the same schedule meaning as bound-less Weekly, under a different option] → intentional; round-trip keeps each task on the option that created it (discriminator: `week` key), so no visible churn on existing tasks.
- [`aria-pressed` semantics on a pick-one control] → the day row is a `role="group"` of kit `Button`s carrying `aria-pressed` (the documented toggle pattern), each with a full-name `aria-label` so screen readers announce "Monday", not "M".

## Migration Plan

Single additive frontend change; deploy and rollback are one commit. No data migration: no existing stored shape changes, and tasks created with Custom are ordinary cron triggers the current display already tolerates. No data migration and no deploy coordination beyond the single commit.

## Open Questions

None blocking. Firing-time verification against a live DIAL Scheduler is owned outside this change; a `week`-interpretation surprise there would trigger the fallback described above.
