## ADDED Requirements

### Requirement: Scheduled task completed-state field

`ScheduledTaskDto` SHALL include an optional `isCompleted: boolean` field, computed by `ScheduledTasksService` (not by `fromUpstreamSchedule`, which cannot see run history) on both the list and get paths. `isCompleted: true` means the schedule can no longer produce a future run, via exactly two terminal shapes:

- **Expired recurring schedule:** `triggerType === 'cron'` AND `nextRunTime` is null AND `trigger.cron.endDate` is in the past. Unambiguous from the schedule fields alone — no runs call is issued. A cron schedule with no `endDate`, or with one still in the future, is merely paused, not terminal. When the response carries no `trigger.cron.endDate` (a list shape without the nested trigger), this shape is not detected and the task keeps today's Paused display.
- **Finished one-time schedule:** `triggerType === 'date'` AND (`nextRunTime` is null OR `trigger.date` is in the past) — the candidate gate, an OR so it is path-independent — AND the newest run (fetched via `GET schedules/{scheduleId}/runs?limit=1`, newest first per the endpoint's documented ordering) exists with status `Success` or `Error`. `InProgress`, `Missed`, and an empty run list all yield `isCompleted: false` for candidates.

Non-terminal schedules yield `isCompleted: false` with no runs call. Derivation SHALL use the BFF's server clock for the date comparisons. A failed runs call MUST NOT fail the parent list/get response: the affected item SHALL carry `isCompleted: undefined` (mapped by the frontend identically to `false`) and the failure SHALL be logged at warn. The field is a documented assumption alongside `isActive` (no authoritative upstream state field is confirmed); when one is confirmed, both derivations MUST be replaced in this same service/mapper location, not duplicated elsewhere.

#### Scenario: One-time task whose run finished maps to isCompleted true

- **WHEN** the upstream schedule has `trigger_type: "date"`, `next_run_time: null`, and its newest run has status `success` (or `error`)
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `true`

#### Scenario: One-time task currently running maps to isCompleted false

- **WHEN** the upstream schedule has `trigger_type: "date"`, `next_run_time: null`, and its newest run has status `in_progress`
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `false`

#### Scenario: Paused one-time task that never ran maps to isCompleted false

- **WHEN** the upstream schedule has `trigger_type: "date"`, `next_run_time: null` (paused before its date arrived, or the date passed while paused), and the runs list is empty (or the newest run has status `missed`)
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `false`, and no run-record-based completion is claimed

#### Scenario: Recurring schedule whose activity window has closed maps to isCompleted true without a runs call

- **WHEN** the upstream schedule has `trigger_type: "cron"`, `next_run_time: null`, and a `trigger.cron.end_date` in the past
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `true` and no runs check is issued for it

#### Scenario: Recurring schedule with an open or unbounded window never reports completed

- **WHEN** the upstream schedule has `trigger_type: "cron"` and either no `trigger.cron.end_date`, an `end_date` in the future, or a non-null `next_run_time`
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `false` and no runs check is issued for it

#### Scenario: Future one-time task is not a candidate

- **WHEN** the upstream schedule has `trigger_type: "date"` and a non-null `next_run_time` (or, on the get path, a `trigger.date` in the future)
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `false` and no runs check is issued for it

#### Scenario: Failed runs check degrades the list item, not the list

- **WHEN** the runs check for a candidate item fails upstream during a list request
- **THEN** the list response still succeeds, that item's `isCompleted` is `undefined`, and the failure is logged at warn

#### Scenario: Get path computes the same field

- **WHEN** `GET /api/v1/scheduled-tasks/{scheduleId}` is called for a one-time schedule whose date is past and whose newest run is terminal
- **THEN** the returned `ScheduledTaskDto.isCompleted` is `true`, computed with the same rule as the list path

### Requirement: Completed-state list enrichment is cached and bounded

The runs checks in `listScheduledTasks` SHALL execute inside the existing `withCachedDialRequest` wrapper (30s TTL, the existing `{limit, offset, search, sort}` cache-key family, existing invalidation on create/update/pause/resume/delete), issued in parallel only for the page's candidate items. No separate cache SHALL be introduced for the enrichment.

#### Scenario: Cache hit skips the runs checks

- **WHEN** `listScheduledTasks` is served from the 30s list cache
- **THEN** no upstream runs calls are issued and `isCompleted` values come from the cached response

#### Scenario: Candidate checks are parallel and limited to candidates

- **WHEN** a cache-missed list page contains 20 cron schedules and 2 date-trigger schedules with null `next_run_time`
- **THEN** exactly 2 upstream `runs?limit=1` calls are issued, in parallel, before the response is returned
