## ADDED Requirements

### Requirement: Detail-view time values and the activation block are lib adapters

`libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts` SHALL export the following from both the root `@epam/ai-dial-chat-hooks` and `@epam/ai-dial-chat-hooks/scheduled-tasks`, so every host renders a task's detail view the same way, with its own copy. The lib takes no i18n: every word comes from host callbacks.

- `formatScheduledTaskNextRunTime(nextRunTime, labels, { locale?, browserTimezone? })` formats the absolute `nextRunTime` instant in `browserTimezone` (default: `getBrowserTimezone()` from `libs/chat-hooks/src/shared/browser-timezone.ts`) through `formatScheduledTaskInstant` (`libs/chat-hooks/src/scheduled-task/scheduled-task-time-format.ts`, whose new optional third parameter is that zone). It then wraps the result in `labels.withTimezone(value, browserTimezone)`, so the clock time and the named zone cannot disagree. With no resolvable zone it returns the instant in the runtime's default zone with no suffix.
- `formatScheduledTaskActiveWindow(task, labels, locale?)` returns `undefined` when `trigger.cron.endDate` is absent. Otherwise its start is `trigger.cron.startDate`, else `nextRunTime`, else `getNextCronOccurrence` in the task's zone. Both bounds are formatted with `formatScheduledTaskTriggerTime` in the task's zone (`UTC` when it has none), joined by `labels.range(startDate, endDate)` and wrapped in `labels.withTimezone(range, timezone)`.
- `getScheduledTaskActivationBlock(task, now = Date.now())` returns `ScheduledTaskActivationBlock.OneTimeFired` for a `date` trigger with no `nextRunTime`, `ScheduledTaskActivationBlock.WindowEnded` for a `cron` trigger whose `endDate` is at or before `now` (`hasScheduledTaskWindowEnded`), and `undefined` otherwise.
- The `ScheduledTaskZoneLabels` (`withTimezone`), `ScheduledTaskActiveWindowLabels` (adds `range`) and `ScheduledTaskNextRunOptions` interfaces, and the `ScheduledTaskActivationBlock` string enum.

`apps/chat` reaches these only through the `buildNextRunLabel` and `buildActiveWindowLabel` adapters in `apps/chat/src/utils/map-scheduled-task-dto.ts`, and through `getScheduledTaskActivationBlock` in `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`.

#### Scenario: Next run in an explicit viewer zone

- **WHEN** `formatScheduledTaskNextRunTime('2026-11-19T15:45:00.000Z', labels, { locale: 'en-US', browserTimezone: 'Europe/Kyiv' })` is called with `withTimezone: (label, tz) => label + ' (' + tz + ')'`
- **THEN** it returns `Nov 19, 2026, 5:45 PM (Europe/Kyiv)`

#### Scenario: Next run without a resolvable zone

- **WHEN** no `browserTimezone` is given and the browser reports no zone
- **THEN** the instant is formatted in the runtime's default zone and `withTimezone` is not called

#### Scenario: Active window starts at the server's next run

- **WHEN** a task in `Europe/Paris` has no `startDate`, `nextRunTime: '2026-11-19T15:45:00.000Z'` and `endDate: '2026-11-30T18:00'`
- **THEN** `formatScheduledTaskActiveWindow(task, labels, 'en-US')` returns `Nov 19, 2026, 4:45 PM – Nov 30, 2026, 6:00 PM (Europe/Paris)` with `range: (s, e) => s + ' – ' + e`

#### Scenario: Activation block for a fired one-time task

- **WHEN** a task has `triggerType: 'date'` and `nextRunTime: null`
- **THEN** `getScheduledTaskActivationBlock` returns `ScheduledTaskActivationBlock.OneTimeFired`

#### Scenario: Activation block for an ended window

- **WHEN** a task has `triggerType: 'cron'` and `trigger.cron.endDate` earlier than `now`
- **THEN** `getScheduledTaskActivationBlock` returns `ScheduledTaskActivationBlock.WindowEnded`, and returns `undefined` for an open or unbounded window
