# Delta: scheduled-tasks-page-ui

## ADDED Requirements

### Requirement: Custom schedule label renders every-N-weeks copy

`describeScheduledTaskTrigger` (`libs/chat-hooks/src/scheduled-task/scheduled-task-description.ts`) SHALL recognize the Custom repeat shape — `cron.fields` with `week: '*/N'` (N an integer 1–10), a single plain numeric `day_of_week`, and plain numeric `hour`/`minute` — and return a dedicated description kind carrying `intervalWeeks` (N), `dayOfWeek`, and the display-timezone `time`, instead of the generic `Custom` kind with the raw JSON expression. Shapes outside that pattern keep their existing behavior: the generic `Custom` kind (rendered by `buildScheduleLabel` as the `scheduledTasks.card.scheduleRecurringFallback` "Recurring schedule" label) and `Invalid` remain unchanged, so display tolerance stays wider than editability.

`buildScheduleLabel` in `apps/chat/src/utils/map-scheduled-task-dto.ts` SHALL render the new kind with a new i18n key `scheduledTasks.card.scheduleEveryNWeeks` (referenced through `ScheduledTasksI18nKeys` in `apps/chat/src/constants/translation-keys.ts`), using i18next `one`/`other` plurals — English `one`: "Every week on {{day}} at {{time}}", `other`: "Every {{count}} weeks on {{day}} at {{time}}" — with the weekday name formatted through the same `Intl.DateTimeFormat`-on-a-fixed-UTC-date technique the Weekly case uses, and the time already localized to the browser's timezone by the descriptor. When additional locale files exist under `apps/chat/src/i18n/locales/`, the key MUST be added there too.

#### Scenario: Every-2-weeks task shows structured copy on the card

- **WHEN** a task's `trigger.cron.fields` is `{ week: '*/2', day_of_week: '1', hour: '7', minute: '0' }` and the browser's timezone is UTC+2
- **THEN** the card's schedule pill shows "Every 2 weeks on Tuesday at 9:00 AM" (weekday and wall-clock localized), not the raw expression and not the "Recurring schedule" fallback

#### Scenario: Every-1-week custom task reads as weekly

- **WHEN** a task's `trigger.cron.fields` is `{ week: '*/1', day_of_week: '0', hour: '7', minute: '0' }`
- **THEN** the schedule pill shows the `one` plural ("Every week on Monday at …"), not "Every 1 weeks on Monday at …"

#### Scenario: Non-editor week expressions keep the generic fallback

- **WHEN** a task's `trigger.cron.fields` includes `week: '2-40'` or `week: '*/12'`
- **THEN** the schedule pill shows the existing "Recurring schedule" fallback label, unchanged by this requirement
