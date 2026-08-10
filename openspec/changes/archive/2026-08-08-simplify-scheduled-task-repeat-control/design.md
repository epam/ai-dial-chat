## Context

`ScheduledTaskCreateForm` (`libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx`) currently renders, inside a `<fieldset>` in the Details column (`:197-386`):

- a visible `<legend>{labels.scheduleSectionLabel}</legend>` ("Schedule")
- a `DialSelectField` for `values.scheduleType` (`Once` | `Recurring`)
- when `Once`: a `Calendar` "Run at" field
- when `Recurring`: a second `DialSelectField` for `values.frequency` (`Daily` | `Weekly` | `Monthly`), a `Calendar` "Time" field, a conditional "Day of week"/"Day of month" field, and the optional Start date/End date `Calendar` pickers

`ScheduledTaskCreatePage` (`apps/chat/src/pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage.tsx`) owns all state/labels/validation and calls `mapFormValuesToCreateBody` (`apps/chat/src/utils/scheduled-task-trigger.ts:104-141`) to turn `values` into the BFF's `CreateScheduledTaskBodyDto.trigger`. `mapScheduledTaskDtoToFormValues` (same file, `:252-328`) is the fail-closed reverse mapping the (already-implemented) `ScheduledTaskEditPage` uses to prefill the same form from an existing `ScheduledTaskDto`.

The BFF (`apps/chat-api/src/scheduled-tasks/dto/schedule-trigger.dto.ts`, `apps/chat-api/src/scheduled-tasks/dto/cron-fields.validator.ts`) already accepts `trigger.cron.fields = { hour: '*', minute: '0' }` — `IsCronFields`'s `isCronSegment` treats a bare `*` as valid for any field before applying range checks (`cron-fields.validator.ts:74-77`) — so an hourly cron trigger is already representable end-to-end at the wire level. The gap is entirely in the frontend form/mapping layer: there is no UI path to produce that shape, and if one existed today, `parseCronFields` (`scheduled-task-trigger.ts:182-242`) would reject it, since it requires `hour` to parse as `Number(...)` (`Number('*')` is `NaN`) and unconditionally emits `hour`/`minute` as UTC-converted numeric strings. The list card display layer (`apps/chat/src/utils/map-scheduled-task-dto.ts:14-35`, `formatSubHourlyScheduleLabel`) already renders a `hour`-less/`*` cron trigger as "Hourly at :NN" — it's a separate, independent mapping used only for the read-only list view, not touched by this change.

This design also has to interoperate with the already-implemented `redesign-scheduled-task-create-editor` change, which added the two-column Details/Configuration layout, the `onBack` prop, `ScheduledTaskEditPage`, and the Start date/End date pickers. None of that structure changes here — only the schedule sub-section's controls and the `values` fields backing them.

## Goals / Non-Goals

**Goals:**

- Remove the visible "Schedule" heading from the Details column.
- Replace `scheduleType` + `frequency` with one `repeat: ScheduledTaskRepeat` field and one `Repeat` dropdown, with `OneTime | Hourly | Daily | Weekly | Monthly` as the only values.
- Make `Repeat = Hourly` producible end-to-end: form → `mapFormValuesToCreateBody` → `POST`/`PUT` body → (round-trip) `mapScheduledTaskDtoToFormValues` → form, without a backend change.
- Keep Start date/End date activity-window pickers available for every recurring value (`Hourly`/`Daily`/`Weekly`/`Monthly`), matching the existing `ScheduleCronDto.startDate`/`endDate` fields, which are attached to the `cron` trigger as a whole and carry no cadence-specific constraint server-side.
- Preserve every other already-implemented behavior of `ScheduledTaskCreateForm`/`ScheduledTaskCreatePage`/`ScheduledTaskEditPage` (two-column layout, markdown editor, header actions, RTL, a11y, feature flag) unchanged.

**Non-Goals:**

- No `Weekdays` or `Custom` repeat options (need separate product definition).
- No backend/OpenAPI/DTO changes — `ScheduleCronDto`/`IsCronFields`/`CreateScheduledTaskBodyDto` are unchanged.
- No changes to the list page, list-card schedule-label formatting (`map-scheduled-task-dto.ts`), routing, or the feature flag.
- No changes to the Once/`runAt` one-shot path beyond renaming `scheduleType: 'once'` to `repeat: 'oneTime'` in the form's internal vocabulary.

## Decisions

**1. Single `repeat: ScheduledTaskRepeat` enum field replaces `scheduleType` + `frequency` — Alternative 1 from the brief, not Alternative 2 or 3.**

`ScheduledTaskCreateFormValues` gains one field:

```ts
export enum ScheduledTaskRepeat {
  OneTime = 'oneTime',
  Hourly = 'hourly',
  Daily = 'daily',
  Weekly = 'weekly',
  Monthly = 'monthly',
}
```

replacing the exported `ScheduledTaskScheduleType` and `ScheduledTaskFrequency` enums in `libs/scheduled-tasks/src/types/scheduled-task-schedule.ts` entirely (not added alongside them). `values.scheduleType` and `values.frequency` are removed from `ScheduledTaskCreateFormValues`/`ScheduledTaskCreateFormErrors`. This gives the form exactly one source of truth for cadence — the UI question "how often" now maps to exactly one enum value, and every consumer (`ScheduledTaskCreateForm`, `scheduled-task-trigger.ts`, `scheduled-task-form-validation.ts`, `ScheduledTaskCreatePage`, both `.spec.ts(x)` files) switches on `values.repeat` instead of a `(scheduleType, frequency)` pair.

_Alternative 2 (derive a combined value only for presentation, keep both internal fields):_ rejected — the brief explicitly warns against "both `repeat` and `frequency`" as conflicting sources of truth; keeping `scheduleType`/`frequency` as the real state and `repeat` as a derived view would still require translating `repeat` selections back into `(scheduleType, frequency)` on every `onChange`, with no benefit over just switching to one field. It also does not shrink the type surface the brief asks to simplify.

_Alternative 3 (temporary adapter between old and new state):_ rejected as unnecessary indirection — `libs/scheduled-tasks` has exactly one in-repo consumer (`apps/chat`, per `redesign-scheduled-task-create-editor`'s design.md decision 2, which made the identical call when renaming `promptLabel`), so there is no external caller to shim for and no migration window to bridge.

**2. `Hourly`'s `trigger.cron.fields` is `{ hour: '*', minute: <user-selected> }` — the `minute` value is user-editable via a new "Minute" field, converted local→UTC using the same reference-`Date` technique as the other cadences; `hour` itself never needs conversion.**

`buildCronFields` (`scheduled-task-trigger.ts:36-72`) currently converts a user-entered local `time` to UTC `hour`/`minute` via a reference `Date` + UTC getters, because Daily/Weekly/Monthly have a user-chosen wall-clock time that must execute at the right UTC instant. Hourly has no such full wall-clock time — "the start of every hour" is the same *hour boundary* in every whole-hour-offset timezone, so `hour` always stays the literal `'*'` and is never converted. The **minute-of-hour**, however, is a real user choice (revised from the original fixed `:00`) and does need local→UTC conversion for the sub-hour-offset timezones where it matters (e.g. UTC+5:30, UTC+5:45): a reference `Date` is set to local hour `0`, the user's local `minute`, then `getUTCMinutes()` is read back — the same "let `Date`'s own getters do the conversion" pattern `buildCronFields` already uses for `time`, just scoped to the minute component since the hour component is a wildcard. `parseCronFields`'s Hourly branch mirrors this in reverse (`setUTCHours(0, utcMinute)` → `getMinutes()`) to round-trip an existing task's stored UTC minute back to the local value the "Minute" field displays.

_Original decision (superseded):_ this design first fixed `minute: '0'` and rejected a minute picker as out of scope, matching the initiating brief's example JSON literally. Product later asked for the minute to be user-selectable, so the "Minute" field was added: a single `Input` (matching the existing `dayOfMonth` field's pattern — plain text input, required-field marker, `errors.minute` inline) shown only when `repeat === Hourly`, bound to `values.minute`.

**3. `parseCronFields`'s reverse mapping recognizes `hour === '*'` as `Hourly`, not as an unsupported shape.**

`parseCronFields` (`scheduled-task-trigger.ts:182-242`) is extended with an `Hourly` branch checked before the existing numeric-hour path: when `fields.hour === '*'` and `fields.minute` is a present, non-`null`, purely-numeric string with no `day`/`day_of_week` present, it returns `{ ok: true, repeat: ScheduledTaskRepeat.Hourly }` (no `time`/`dayOfWeek`/`dayOfMonth`) without constructing a reference `Date` at all — there is nothing to convert. Any other non-numeric `hour` value (e.g. a cron range/list/step expression like `9-17` or `*/2`, which `IsCronFields` also accepts) still falls through to `{ ok: false }`, preserving today's fail-closed guarantee for shapes the create form's controls cannot represent. This is required for internal consistency: without it, a task created as `Hourly` by this change could never be reopened on `ScheduledTaskEditPage` (added by `redesign-scheduled-task-create-editor`) — it would immediately hit the "can't be edited here" fail-closed message the very first time a user tried to edit their own hourly task, which would read as a regression introduced by this change, not a pre-existing limitation.

_Alternative considered:_ leave `parseCronFields` untouched and let Hourly tasks fail closed on edit, same as any other unsupported cron shape today. Rejected — unlike a genuinely unsupported shape (e.g. multiple `day_of_week` values), Hourly is a shape this very change teaches the create form to produce; shipping create-without-edit for the form's own newly-added output is an avoidable, self-inflicted gap, not a pre-existing constraint being carried forward.

**4. Start date/End date pickers key off "is this a recurring `repeat` value" (`repeat !== OneTime`), not off a specific frequency.**

The existing condition `values.scheduleType === ScheduledTaskScheduleType.Recurring` becomes `values.repeat !== ScheduledTaskRepeat.OneTime`. `ScheduleCronDto.startDate`/`endDate` (`schedule-trigger.dto.ts:25-41`) are optional siblings of `fields` on `ScheduleCronDto` — the DTO has no cadence-specific constraint on them (the "Cron trigger activity window" requirement in `openspec/specs/scheduled-tasks-api/spec.md:471-535` applies to "a `cron` (recurring) trigger" as a whole) — so extending the same optional window to `Hourly` needs zero backend change and is the more consistent reading of "recurring" than special-casing Hourly out of it, per the brief's explicit instruction to keep these controls for Hourly "unless repository investigation proves the upstream Scheduler does not support activity windows for hourly cron triggers" (it does not — the DTO makes no such distinction).

**5. The visible "Schedule" heading is deleted, not hidden/renamed; the `<fieldset>`/`legend` wrapper is replaced by a plain `<div>`.**

`labels.scheduleSectionLabel` and `ScheduledTasksI18nKeys.CreateScheduleSectionLabel` are removed from `ScheduledTaskCreateFormLabels` and `en.json`/`translation-keys.ts` respectively, rather than kept-but-unused (a lib rule violation — "every declared prop must be read", `.claude/rules/libs.md`) or set to an empty string (which would leave a dead `<legend>` element). The surrounding `<fieldset className="flex flex-col gap-3">` becomes a plain `<div className="flex flex-col gap-3">` since a `<fieldset>` with no `<legend>` loses its semantic grouping value and AAA accessibility expects a `role="group"`/`aria-label` alternative when a heading is intentionally not visible — the schedule sub-section already sits inside the Details column's own `role="group"` (`labels.detailsSectionTitle`, `ScheduledTaskCreateForm.tsx:139-145`), so no replacement `aria-label` is needed on the inner `<div>` itself.

**6. `Repeat` renders as one `DialSelectField`, following the exact pattern the removed `Schedule type`/`Frequency` fields already used — no new control primitive.**

`DialSelectField` is already the component used for both removed dropdowns (`ScheduledTaskCreateForm.tsx:202-218`, `:247-257`); `Repeat` is a straight swap to a single `DialSelectField` bound to `values.repeat`, with `label={labels.repeatLabel}` and options built from `labels.repeatOptions: { key: ScheduledTaskRepeat; label: string }[]` (mirroring the existing `frequencyOptions` shape exactly, just renamed and extended with an `OneTime` and `Hourly` entry).

## Risks / Trade-offs

- **[Risk]** Removing `ScheduledTaskScheduleType`/`ScheduledTaskFrequency` and `values.scheduleType`/`values.frequency` is a breaking change to `@epam/ai-dial-scheduled-tasks`'s public API (`index.ts` re-exports). → **Mitigation**: single in-repo consumer (`apps/chat`), migrated in the same change; `nx build`/`nx lint`/`nx test` on both `scheduled-tasks` and `chat` catch every call site (TypeScript's exhaustiveness makes stale references a compile error, not a silent runtime gap).
- **[Risk]** A schedule created as `Hourly` before this change ships cannot exist (Hourly is new), so there is no pre-existing-data migration concern for `Hourly` itself — but any `Daily`/`Weekly`/`Monthly`/`Once` task created under the old form must still round-trip through the new `repeat`-based reverse mapping unchanged. → **Mitigation**: `parseCronFields`'s existing Daily/Weekly/Monthly branches are preserved verbatim (only gains a new Hourly branch checked first); `mapScheduledTaskDtoToFormValues`'s `Once` branch is unchanged except for the enum rename. Existing `scheduled-task-trigger.spec.ts` cases for Daily/Weekly/Monthly/Once must keep passing verbatim (with the enum renamed), proving no regression.
- **[Risk]** Deleting the `<fieldset>`/`<legend>` removes the one native-HTML grouping signal for the schedule controls; a screen reader user could lose the "these controls are related" context. → **Mitigation**: the controls remain inside the Details column's own `role="group"` (`labels.detailsSectionTitle`), and each control (`Repeat` dropdown, `Run at`/`Time`/`Day of week`/`Day of month`/`Start date`/`End date`) keeps its own accessible label — no functional grouping information is lost, only the extra mid-level heading that the proposal explicitly asks to remove.
- **[Risk]** Converting a local minute-of-hour to UTC only matters for sub-hour-offset timezones (UTC+5:30, UTC+5:45, a few others); most viewers are on whole-hour offsets where local minute == UTC minute, so this path is thin on real-world exercise. → **Mitigation**: dedicated test cases stub `TZ=Asia/Kolkata` (UTC+5:30) to prove the conversion, alongside a UTC/whole-hour-offset case proving the no-op path.
- **[Trade-off]** No numeric spinner/stepper UI for minute — a plain text `Input` (0-59, validated) matches the existing `dayOfMonth` field's control choice rather than introducing a new control type for one field.

## Migration Plan

Single-PR change, no persisted-data migration (the wire-level `CreateScheduledTaskBodyDto`/`ScheduledTaskDto` shapes are untouched; only the frontend's internal `values` shape and the mapping functions around it change). Sequence, each independently verifiable:

1. `libs/scheduled-tasks`: replace `ScheduledTaskScheduleType`/`ScheduledTaskFrequency` with `ScheduledTaskRepeat` in `scheduled-task-schedule.ts`; update `ScheduledTaskCreateFormValues`/`Errors`/`Labels` in `scheduled-task-create-form-props.ts`; update `ScheduledTaskCreateForm.tsx` JSX (remove heading/fieldset→div, single `Repeat` dropdown, conditional fields keyed off `repeat`); update `ScheduledTaskCreateForm.spec.tsx`.
2. `apps/chat`: update `scheduled-task-trigger.ts` (`buildCronFields` Hourly branch, `parseCronFields` Hourly branch, both mapping functions' enum references) and its spec; update `scheduled-task-form-validation.ts` and its spec; update `ScheduledTaskCreatePage.tsx` (`DEFAULT_VALUES`, `labels`) — `ScheduledTaskEditPage` needs no direct edit since it only forwards `values`/`labels` built from the same shared mapping/label-building code paths (confirm during implementation that it has no local `scheduleType`/`frequency` reference of its own).
3. `apps/chat`: update `translation-keys.ts` and `en.json` — remove the retired schedule-type/frequency keys, add the `repeat*` keys.
4. Verify: `nx test scheduled-tasks`, `nx lint scheduled-tasks`, `nx build scheduled-tasks`, then `nx test chat`, `nx lint chat`, `nx build chat`, then one `nx affected` pass.

Rollback is a plain revert — no data migration, no OpenAPI regeneration, no BFF deploy involved.

## Open Questions

- Exact visual spacing of the single `Repeat` dropdown relative to the Model dropdown above it and the removed heading — the reference screenshot mentioned in the request was not available to this investigation (see proposal.md's closing note); implementation should match the existing `gap-3`/`gap-5` rhythm already used in the Details column and be confirmed visually against the actual design reference before merging.
- Whether "Hourly" needs its own `ScheduledTasksI18nKeys.CardScheduleHourlyAt`-style card-list wording change — out of scope for this change (`map-scheduled-task-dto.ts`'s hourly detection already works independently of the create form and is not modified here), but worth a quick manual check that a newly-created Hourly task renders sensibly on the existing list card.
