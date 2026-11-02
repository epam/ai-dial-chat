# Delta: scheduled-task-detail-page

## ADDED Requirements

### Requirement: Repeats field renders the every-N-weeks custom schedule label

The detail page's Details section "Repeats" value SHALL render the every-N-weeks label produced by the same shared formatter the list page uses — `describeScheduledTaskTrigger` (extended per `scheduled-tasks-page-ui`'s "Custom schedule label renders every-N-weeks copy") consumed through `buildScheduleLabel` in `apps/chat/src/utils/map-scheduled-task-dto.ts` — with no formatter duplication inside the detail page or `libs/scheduled-tasks`. A custom task's "Next run" value continues to come from the server's `nextRunTime` with no client-side cron evaluation: `getNextCronOccurrence` is only invoked for the active-window label when `trigger.cron.endDate` exists without a `startDate`, and a Custom trigger never carries window boundaries, so no week-step-aware occurrence computation is added.

#### Scenario: Custom task's Repeats value shows the structured label

- **WHEN** the detail page loads a task whose `trigger.cron.fields` is `{ week: '*/2', day_of_week: '1', hour: '7', minute: '0' }`
- **THEN** the Details section's "Repeats" value shows the same "Every 2 weeks on <localized day> at <localized time>" label the card shows, produced by the shared `buildScheduleLabel` formatter

#### Scenario: Custom task's next run comes from the server

- **WHEN** the detail page loads an active custom task whose `nextRunTime` is set by the BFF
- **THEN** the "Next run" value renders that server-provided instant formatted with `Intl.DateTimeFormat`, with no client-side computation of the next week-step occurrence

#### Scenario: No active-window label renders for a custom task

- **WHEN** the detail page loads a custom task whose `trigger.cron` has no `endDate`
- **THEN** no active-window label renders — `getNextCronOccurrence` is never called for the task
