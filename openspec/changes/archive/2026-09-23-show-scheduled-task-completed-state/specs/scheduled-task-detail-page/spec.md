## ADDED Requirements

### Requirement: Details summary shows the completed state for terminal tasks

When the loaded task has `isCompleted: true` (a finished one-time schedule, or a recurring schedule whose activity window has closed), `ScheduledTaskDetailView` SHALL render a completed line in the details summary (label from a new `labels` entry with an English default, localized by the page via a new `ScheduledTasksI18nKeys` member). The completed line SHALL be informational text, not a control, and SHALL NOT replace or hide the existing summary fields (schedule, next run, timestamps).

#### Scenario: Completed task shows the completed line

- **WHEN** the detail page loads a task with `isCompleted: true`
- **THEN** the details summary renders the localized completed line alongside the existing fields

#### Scenario: Non-completed task shows no completed line

- **WHEN** the detail page loads a task with `isCompleted: false` or omitted
- **THEN** the details summary renders exactly as before this change, with no completed line

## MODIFIED Requirements

### Requirement: Active switch is disabled, not hidden, when a schedule can no longer produce a future run

`ScheduledTaskDetailPage` SHALL pass `isActiveDisabled={true}` to `ScheduledTaskDetailView` whenever the loaded task has permanently exhausted its ability to produce a future run — the switch still renders (since `isActive` is defined), but disabled, rather than offering a resume action DIAL Scheduler cannot fulfill. Two cases qualify:

- **Completed one-time schedule:** `triggerType` is `date` (one-time) and `nextRunTime` is `null` — the schedule has already run once and a `date` trigger cannot be rescheduled.
- **Expired recurring schedule:** `triggerType` is `cron` and `trigger.cron.endDate` is a past timestamp — the schedule's activity window has closed, so resuming it cannot produce a future run within that window either.

A recurring (`cron`) schedule with no upcoming run but an `endDate` that has not yet passed (or no `endDate` at all) is merely paused, not exhausted, and MUST remain togglable. When the switch is disabled, `ScheduledTaskDetailView` SHALL also render an explanatory reason label (new `labels` entry with an English default, localized by the page) so the disabled state is self-describing; for a completed one-time schedule the reason SHALL communicate that the task has already run and cannot be rescheduled.

#### Scenario: Completed one-time schedule shows a disabled, unchecked switch with a reason

- **WHEN** the loaded task has `triggerType: 'date'` and `nextRunTime: null`
- **THEN** the Active switch renders unchecked and disabled with the explanatory reason label visible, and toggling it (via pointer or keyboard) has no effect and calls neither `pauseScheduledTask` nor `resumeScheduledTask`

#### Scenario: Recurring schedule whose activity window has ended shows a disabled, unchecked switch with a reason

- **WHEN** the loaded task has `triggerType: 'cron'` and `trigger.cron.endDate` in the past
- **THEN** the Active switch renders unchecked and disabled with the explanatory reason label visible, and toggling it (via pointer or keyboard) has no effect and calls neither `pauseScheduledTask` nor `resumeScheduledTask`

#### Scenario: Recurring schedule with no upcoming run remains togglable

- **WHEN** the loaded task has `triggerType: 'cron'`, `nextRunTime: null` (paused, not completed), and `trigger.cron.endDate` is absent or in the future
- **THEN** the Active switch renders unchecked but NOT disabled, no reason label is shown, and toggling it on calls `resumeScheduledTask`
