# Spec Delta

## MODIFIED Requirements

### Requirement: Repeats field renders the every-N-weeks custom schedule label

The detail page's Details section "Repeats" value SHALL render the label produced by the same shared formatter the list page uses — `describeScheduledTaskTrigger` (extended per `scheduled-tasks-page-ui`'s "Custom schedule label renders every-N-weeks copy") consumed through `formatScheduledTaskScheduleLabel` (`libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts`) via `buildScheduleLabel` in `apps/chat/src/utils/map-scheduled-task-dto.ts` — with no formatter duplication inside the detail page or `libs/scheduled-tasks`: the weekday-list label for Custom tasks with several days, and the generic "Recurring schedule" label for tasks written by the former, never released every-N-weeks Custom option. A custom task's "Next run" value continues to come from the server's `nextRunTime` with no client-side cron evaluation. A Custom task may now carry an activity window: the active-window label and the active-switch disabling read `trigger.cron.startDate`/`endDate` exactly as for Weekly, and `getNextCronOccurrence` (`libs/chat-hooks/src/scheduled-task/scheduled-task-next-occurrence.ts`) — invoked only when the window has an `endDate`, no `startDate`, and the server has no `nextRunTime` — SHALL accept a comma-separated `day_of_week` list and return the earliest matching day.

#### Scenario: Custom task's Repeats value shows the structured label

- **WHEN** the detail page loads a task whose `trigger.cron.fields` is `{ week: '*/2', day_of_week: '1', hour: '7', minute: '0' }`
- **THEN** the Details section's "Repeats" value shows the same "Recurring schedule" fallback label the card shows (the scenario name is historical: the every-N-weeks label was removed)

#### Scenario: Multi-day Custom task's Repeats value

- **WHEN** the detail page loads a task whose `trigger.cron.fields` is `{ day_of_week: '0,2,4', hour: '7', minute: '0' }` in a UTC+2 browser
- **THEN** the "Repeats" value shows "Every Monday, Wednesday and Friday at 9:00 AM", the same label the card shows

#### Scenario: Custom task's next run comes from the server

- **WHEN** the detail page loads an active custom task whose `nextRunTime` is set by the BFF
- **THEN** the "Next run" value renders that server-provided instant formatted with `Intl.DateTimeFormat`, with no client-side computation of the next occurrence

#### Scenario: No active-window label renders for a custom task

- **WHEN** the detail page loads a custom task whose `trigger.cron` has no `endDate`
- **THEN** no active-window label renders — `getNextCronOccurrence` is never called for the task

#### Scenario: A Custom task's window drives the label and the switch

- **WHEN** the detail page loads an inactive Custom task with `day_of_week: '0,2'`, an `endDate`, no `startDate` and no `nextRunTime`
- **THEN** the active-window label starts at the earliest upcoming Monday or Wednesday occurrence returned by `getNextCronOccurrence`, and a past `endDate` disables the active switch exactly as for Weekly
