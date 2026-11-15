# Spec Delta

## MODIFIED Requirements

### Requirement: Custom schedule label renders every-N-weeks copy

`describeScheduledTaskTrigger` (`libs/chat-hooks/src/scheduled-task/scheduled-task-description.ts`) SHALL describe a cron whose `day_of_week` is a comma-separated list of two or more plain numeric weekdays, with plain numeric `hour`/`minute` and no `day`/`week`, as the Weekly kind carrying the ordered list of display-timezone weekdays (each UTC weekday shifted by the same calendar-day offset as the time) and the display-timezone `time`. The former every-N-weeks description kind (`EveryNWeeks` with `intervalWeeks`) is removed together with the never-released every-N-weeks Custom option: any shape with a non-null `week` value now falls to the generic `Custom` kind. The generic `Custom` kind (rendered as the `scheduledTasks.card.scheduleRecurringFallback` "Recurring schedule" label) and `Invalid` remain unchanged, so display tolerance stays wider than editability.

`formatScheduledTaskScheduleLabel` (`libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts`) SHALL render a Weekly kind with several days through the existing `weeklyAt(day, time)` callback of `ScheduledTaskScheduleLabels`, passing as `day` the full weekday names joined with `Intl.ListFormat` (type `conjunction`) in the `locale` option, each name formatted through the same `Intl.DateTimeFormat`-on-a-fixed-UTC-date technique the single-day Weekly case uses. The `everyNWeeks` callback is removed from `ScheduledTaskScheduleLabels`; the app (`buildScheduleLabels` in `apps/chat/src/utils/map-scheduled-task-dto.ts`) keeps mapping `weeklyAt` to `scheduledTasks.card.scheduleWeeklyAt` ("Every {{day}} at {{time}}") and drops the former `scheduledTasks.card.scheduleEveryNWeeks` key. When additional locale files exist under `apps/chat/src/i18n/locales/`, they MUST stay in sync.

#### Scenario: Every-2-weeks task shows structured copy on the card

- **WHEN** a task's `trigger.cron.fields` is `{ week: '*/2', day_of_week: '1', hour: '7', minute: '0' }` (written by the former, never released every-N-weeks Custom option)
- **THEN** the card's schedule pill shows the "Recurring schedule" fallback label (the scenario name is historical: the every-N-weeks label was removed)

#### Scenario: Every-1-week custom task reads as weekly

- **WHEN** a task's `trigger.cron.fields` is `{ week: '*/1', day_of_week: '0', hour: '7', minute: '0' }`
- **THEN** the schedule pill shows the "Recurring schedule" fallback label (the scenario name is historical: a `week` field is no longer described structurally)

#### Scenario: Several weekdays are listed

- **WHEN** a task's `trigger.cron.fields` is `{ day_of_week: '0,2,4', hour: '7', minute: '0' }` and the browser's timezone is UTC+2
- **THEN** the schedule pill shows "Every Monday, Wednesday and Friday at 9:00 AM", with the list joined by the active locale's conjunction

#### Scenario: Weekday list shifts with the time across midnight

- **WHEN** a task's `trigger.cron.fields` is `{ day_of_week: '1,6', hour: '22', minute: '30' }` and the browser's timezone is UTC+2
- **THEN** the schedule pill shows "Every Monday and Wednesday at 12:30 AM", ordered Monday first

#### Scenario: Non-editor week expressions keep the generic fallback

- **WHEN** a task's `trigger.cron.fields` includes `week: '2-40'` or `week: '*/12'`, or a `day_of_week` range such as `'0-4'`
- **THEN** the schedule pill shows the existing "Recurring schedule" fallback label

#### Scenario: Week constraints are not lost in minute-step descriptions

- **WHEN** a task's `trigger.cron.fields` is `{ week: '*/2', hour: '*', minute: '*/5' }`, or the same shape with `hour` omitted
- **THEN** the descriptor keeps the full expression as `Custom` and the schedule pill shows "Recurring schedule", not "Every 5 minutes", because the schedule does not run in every week
