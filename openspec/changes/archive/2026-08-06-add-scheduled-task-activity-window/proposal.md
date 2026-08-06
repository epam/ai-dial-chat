## Why

DIAL Scheduler's cron trigger supports an activity window (`trigger.cron.start_date` / `end_date`) that bounds when a recurring schedule fires, but the BFF's `ScheduleCronDto` only carries `fields`, so a recurring task starts firing immediately on creation and never stops. The create form design adds optional **Start date** / **End date** pickers under **Time** in the recurring branch so users can bound a recurring task's activity window without needing a separate edit flow.

## What Changes

- Extend `ScheduleCronDto` (BFF) with optional `startDate` / `endDate` (`@IsOptional() @IsISO8601()`), mapped to/from upstream `trigger.cron.start_date` / `end_date`.
- Add mapper-level cross-field validation: `endDate <= startDate` → `400`; `startDate`/`endDate` supplied on a one-shot (`trigger.date`) schedule → `400`.
- Regenerate OpenAPI + `@epam/chat-api-client`; add a Postman example with a bounded cron window.
- Add `startDate` / `endDate` to `ScheduledTaskCreateFormValues` / `ScheduledTaskCreateFormErrors` / `ScheduledTaskCreateFormLabels` in `@epam/ai-dial-scheduled-tasks`, and render two optional `Calendar` (`CalendarMode.Date`) pickers in the recurring branch of `ScheduledTaskCreateForm`, below **Time**.
- Add `startDate`/`endDate` calendar-value conversion helpers to `libs/scheduled-tasks/src/utils/calendar-value.ts`.
- Wire the new fields through `ScheduledTaskCreatePage` (defaults, i18n keys, pre-submit validation) and `mapFormValuesToCreateBody` (local-day → UTC ISO conversion, cron-only emission).
- Out of scope: one-shot trigger windows, an edit UI for existing tasks' windows, a timezone selector, showing the window on list cards, and server-side "window fully in the past" rejection.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scheduled-tasks-api`: `ScheduleCronDto` gains optional `startDate`/`endDate`; mapper gains cross-field validation (window ordering, one-shot rejection) and upstream `cron.start_date`/`cron.end_date` round-trip mapping.
- `scheduled-task-create-form`: create form and page gain optional Start date / End date pickers for recurring schedules, with local-day-to-UTC boundary conversion in `mapFormValuesToCreateBody` and pre-submit ordering validation.

## Impact

- **Backend:** `apps/chat-api/src/scheduled-tasks/dto/schedule-trigger.dto.ts`, `scheduled-tasks.mapper.ts` (+ specs), `libs/chat-api-client` regeneration, `postman/chat-api.postman_collection.json`.
- **Frontend lib:** `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/*`, `libs/scheduled-tasks/src/models/*`, `libs/scheduled-tasks/src/utils/calendar-value.ts` (+ tests).
- **Frontend app:** `apps/chat/src/pages/.../ScheduledTaskCreatePage` (or equivalent), `apps/chat/src/utils/scheduled-task-trigger.ts`, `apps/chat/src/i18n/locales/en.json`, `ScheduledTasksI18nKeys`.
- **No breaking changes** — both new DTO fields and form values are optional and additive.
