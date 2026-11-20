## ADDED Requirements

### Requirement: Detail page date and time values name their time zone

Every date or time on the detail page's Details section and History panel header SHALL name the zone it is shown in, through the translated suffix `scheduledTasks.card.scheduleZoneSuffix` (`{{label}} ({{timezone}})`), so the same moment never appears as two unexplained clock times. Each value keeps the zone it is shown in:

- **Repeats** is the task's wall time in the task's zone and always names the task's zone (see `scheduled-task-timezone`, "Schedule labels name a non-browser zone").
- **Next run** is the server's absolute `nextRunTime` instant. It is formatted in the viewer's zone (the zone the History run rows below it use) and SHALL always name that zone. `buildNextRunLabel` (`apps/chat/src/utils/map-scheduled-task-dto.ts`) wraps the lib's `formatScheduledTaskNextRunTime` (see `chat-hooks-scheduled-task-display`) in `scheduledTasks.detail.nextRunLabel`.
- **Active window** (`scheduledTasks.detail.activeWindowValue`) is a task-zone wall time and SHALL always name the task's zone (`UTC` when the task has none). `buildActiveWindowLabel` (`apps/chat/src/utils/map-scheduled-task-dto.ts`) supplies the translated range and suffix to the lib's `formatScheduledTaskActiveWindow`, which returns `undefined` when the window has no `endDate`.

The page SHALL hold no formatting logic of its own for these values, and SHALL derive the Active switch's disabled state and its reason (`scheduledTasks.detail.activeDisabledReasonCompleted` / `activeDisabledReasonExpired`) from the lib's `getScheduledTaskActivationBlock` instead of re-deriving it from `triggerType`, `nextRunTime` and `trigger.cron.endDate`. It memoizes the helpers' results on the loaded task, `t` and the display language. History run rows are unchanged: they stay in the viewer's zone with no per-row suffix.

#### Scenario: Next run names the viewer's zone

- **WHEN** the browser zone is `Europe/Kyiv`, the locale is `en-US`, and the task (zone `Europe/Paris`) has `nextRunTime: '2026-11-19T15:45:00.000Z'`
- **THEN** the History panel shows `Next run: Nov 19, 2026, 5:45 PM (Europe/Kyiv)` and Repeats shows `Once on Nov 19, 2026, 4:45 PM (Europe/Paris)`

#### Scenario: Next run without a resolvable browser zone

- **WHEN** `getBrowserTimezone()` returns `undefined`
- **THEN** the Next run value is the instant formatted in the runtime's default zone, with no zone suffix

#### Scenario: Active window names the task's zone

- **WHEN** a daily task in `America/New_York` has `startDate: '2026-12-01T09:00'` and `endDate: '2026-12-31T18:00'`
- **THEN** the Active value is `Dec 1, 2026, 9:00 AM – Dec 31, 2026, 6:00 PM (America/New_York)` (en-US), whatever the browser zone

#### Scenario: Active window of a task in the browser's zone

- **WHEN** the task's zone equals the browser's zone
- **THEN** the Active value still ends with that zone in parentheses

#### Scenario: No activity window

- **WHEN** the task's cron trigger has no `endDate`
- **THEN** no Active value is rendered
