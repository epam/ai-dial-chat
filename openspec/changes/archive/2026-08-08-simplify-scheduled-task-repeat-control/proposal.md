## Why

`ScheduledTaskCreateForm` (`libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx:197-386`) currently asks the user to make two separate decisions — a **Schedule type** dropdown (Once / Recurring) plus, only when Recurring is picked, a **Frequency** dropdown (Daily / Weekly / Monthly) — behind a visible "Schedule" `<fieldset>`/`<legend>` heading (`labels.scheduleSectionLabel`, `ScheduledTasksI18nKeys.CreateScheduleSectionLabel` at `apps/chat/src/constants/translation-keys.ts:270`). This is one more click and one more concept than the cadence actually needs, and it currently has no way to express "every hour" at all, even though the scheduled-tasks list card already knows how to *display* an hourly cron trigger (`formatSubHourlyScheduleLabel` in `apps/chat/src/utils/map-scheduled-task-dto.ts:19-35`, backed by `ScheduledTasksI18nKeys.CardScheduleHourlyAt`/`CardScheduleEveryNMinutes`). Collapsing schedule-type + frequency into one **Repeat** dropdown and adding the missing Hourly option removes the extra decision and closes that display/create gap.

## What Changes

- Remove the visible "Schedule" section heading (`labels.scheduleSectionLabel` / `<legend>`) from `ScheduledTaskCreateForm`.
- **BREAKING** (single in-repo consumer, migrated in this change): replace the `Schedule type` (`values.scheduleType`) + `Frequency` (`values.frequency`) two-dropdown combination with one **Repeat** dropdown bound to a new `values.repeat: ScheduledTaskRepeat` field (`OneTime | Hourly | Daily | Weekly | Monthly`). `scheduleType` and `frequency` are removed from `ScheduledTaskCreateFormValues` — there is exactly one source of truth for cadence, not two fields kept in sync.
- Add an **Hourly** repeat option: no time/weekday/month-day fields shown; maps to `trigger.cron.fields = { hour: '*', minute: '0' }` (fires at the top of every hour, UTC — the field is timezone-neutral so no local→UTC conversion applies to it, unlike Daily/Weekly/Monthly).
- Keep the existing optional Start date / End date activity-window pickers for every recurring value including Hourly (see Design for why the upstream `ScheduleCronDto.startDate`/`endDate` fields are cadence-agnostic).
- One-time (`OneTime`) keeps today's `Run at` `Calendar` field and shows no activity-window pickers, unchanged from today's `Once` behavior.
- Update `mapFormValuesToCreateBody`/`mapFormValuesToUpdateBody` (`apps/chat/src/utils/scheduled-task-trigger.ts`) to branch on `repeat` instead of `scheduleType`/`frequency`, and extend the reverse mapper (`mapScheduledTaskDtoToFormValues`, same file) to recognize the `{ hour: '*', minute-only }` cron shape as `Repeat.Hourly` instead of failing closed — otherwise a task created as Hourly by this change could never be reopened on the edit route added by `redesign-scheduled-task-create-editor`.
- Update `validateScheduledTaskForm` (`apps/chat/src/utils/scheduled-task-form-validation.ts`) to branch on `repeat`, dropping the now-nonexistent `time`/`dayOfWeek`/`dayOfMonth` requirement checks for `Hourly`.
- Update i18n keys, labels, and both `ScheduledTaskCreateForm.spec.tsx` and `scheduled-task-trigger.spec.ts`/`scheduled-task-form-validation.spec.ts` for the new `repeat` field and the `Hourly` cron shape.
- Do NOT add `Weekdays` or `Custom` repeat options — out of scope, no product definition exists for them yet.
- No change to `POST`/`PUT /api/v1/scheduled-tasks`, `ScheduleCronDto`, or `IsCronFields` validation — `hour: '*'` and `minute: '0'` are already accepted by the existing cron-field validator (`apps/chat-api/src/scheduled-tasks/dto/cron-fields.validator.ts:16-23`, which treats a bare `*` segment as valid for any field before applying the field's numeric range), so Hourly requires no backend change.

## Capabilities

### New Capabilities

_None._ This reshapes an existing UI surface; no new domain capability is introduced.

### Modified Capabilities

- `scheduled-task-create-form`: the "ScheduledTaskCreateForm lib component matches the BFF create contract" requirement's schedule-type/frequency control description, the "Page maps form values to BFF trigger shape" requirement's trigger-building rules, the "Reverse trigger mapping is fail-closed" requirement's supported-shape list, and the "Create-task strings flow through react-i18next" requirement's key list all change to reflect the single `Repeat` control and the new `Hourly` option. The "Start date / End date pickers" and "activity window UTC conversion" requirements are extended to explicitly include `Hourly`, not restricted.

## Impact

- **Frontend lib** (`libs/scheduled-tasks`): `ScheduledTaskCreateForm.tsx`, `scheduled-task-create-form-props.ts` (`ScheduledTaskCreateFormValues`/`Errors`/`Labels`), `scheduled-task-schedule.ts` (new `ScheduledTaskRepeat` enum replacing the exported `ScheduledTaskScheduleType`/`ScheduledTaskFrequency` enums), and `ScheduledTaskCreateForm.spec.tsx`.
- **Frontend app** (`apps/chat`): `ScheduledTaskCreatePage.tsx` (labels/`DEFAULT_VALUES`), `scheduled-task-trigger.ts` (forward + reverse mapping), `scheduled-task-form-validation.ts`, `translation-keys.ts`, `en.json`, and the `tests/` specs for the two utils files. `ScheduledTaskEditPage` (from `redesign-scheduled-task-create-editor`) is affected only through the shared `ScheduledTaskCreateForm`/mapping contract — no edit-page-specific logic changes.
- **Backend** (`apps/chat-api`): none — `hour: '*'` is already valid under the existing `ScheduleCronDto`/`IsCronFields` contract.
- **No OpenAPI/generated-client changes** — the wire shape of `CreateScheduledTaskBodyDto`/`ScheduledTaskDto` is unchanged; only the frontend's internal form-values shape and its mapping to/from that unchanged wire shape change.
- **i18n**: `scheduledTasks.create.scheduleSectionLabel`, `scheduleTypeOnce`, `scheduleTypeRecurring`, `scheduleTypeAriaLabel`, `frequencyLabel`, `frequencyDaily`, `frequencyWeekly`, `frequencyMonthly` are replaced by a smaller `repeatLabel` + `repeatOneTime`/`repeatHourly`/`repeatDaily`/`repeatWeekly`/`repeatMonthly` set; `runAtRequired`, `timeInvalid`, `dayOfWeekRequired`, `dayOfMonthRequired`, `endDateBeforeStartError` keys are reused unchanged.
- **Rollback**: plain revert — no persisted data migration; the BFF/DTO contract and any already-created schedules (recurring or one-shot) are untouched, since only the frontend form's internal field names and mapping logic change, not the wire payload shapes they produce.

## Note on the reference screenshot

The prompt referenced an attached screenshot of the target Repeat control and its placement in the Details column. No image was actually delivered to this investigation — design.md's layout guidance is therefore based on the existing `ScheduledTaskCreateForm` structure (the schedule `<fieldset>` stays in the same Details-column position, immediately after the Model dropdown, per `ScheduledTaskCreateForm.tsx:184-386`) rather than pixel-level reference to the screenshot. Confirm visually against the actual design reference before merging.
