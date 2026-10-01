## ADDED Requirements

### Requirement: Start a saved scheduled task immediately

The BFF SHALL expose `POST /api/v1/scheduled-tasks/:scheduleId/run` with OpenAPI operationId/generated method `startScheduledTask`, `GetScheduledTaskDto` path validation and no request-body DTO. It SHALL send a bodyless POST to `{DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}/run`, forwarding the session access token, and return HTTP **202** with `ScheduledTaskRunDto`. Any received body SHALL NOT be forwarded or override the stored definition. The operation SHALL NOT wait for completion, perform an external-service sign-in precheck, retry the POST automatically, or mutate/resume the schedule.

Concrete request: `POST /api/v1/scheduled-tasks/sched_123/run`, with the existing session cookie and CSRF header, and no body. Given the upstream response:

```json
{
  "id": "0b7548aa-7751-483f-84ad-a8392e55efbe",
  "status": "in_progress",
  "start_time": "2026-09-30T09:00:00Z",
  "end_time": null,
  "conversation_id": null
}
```

the BFF SHALL return HTTP 202:

```json
{
  "id": "0b7548aa-7751-483f-84ad-a8392e55efbe",
  "status": "InProgress",
  "startTime": "2026-09-30T09:00:00Z",
  "endTime": null
}
```

There SHALL be no fabricated conversation id or duration. Paused or completed schedules SHALL NOT be rejected on the basis of those UI states. Concurrent requests are supported by Scheduler; BFF SHALL NOT add a concurrency lock. `next_run_time`, `updated_at`, trigger and activation remain untouched. The schedules list SHALL NOT be invalidated/refetched by this operation.

Authorization SHALL use the existing SessionGuard, cookie-session CSRF and `FeatureGuard` with `FeatureKey.ScheduledTasksEnabled`; roles SHALL follow `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` for `scheduledTasksEnabled`, with no new role. Ownership SHALL be enforced upstream using caller credentials; foreign schedules SHALL return 404. Missing external-service sign-in SHALL NOT be interpreted as an HTTP rejection: acceptance remains 202 and the failure is reported on the run.

Swagger SHALL document 202, 400 (invalid id), 401 (session), 403 (BFF feature/CSRF/access enforcement), 404 (missing/foreign schedule), 409 (soft-deleted schedule), 429 (upstream rate limiting), 502 (upstream failure), and 503 (missing scheduler configuration, timeout/unreachable upstream). Existing structured error handling and trace fields SHALL be retained. A 409 SHALL remain a 409 rather than becoming a generic 502.

New endpoints SHALL use `Cache-Control: private, no-store`; cache TTL SHALL be zero with no cache key or invalidation. Existing HTTP metrics and service error logging SHALL cover the endpoints without logging task payloads, run results or credentials. Frontend wrappers SHALL consume the normal generated methods on the existing configured `scheduledTasksApi` singleton, not raw fetch or `base.ts` business helpers.

#### Scenario: Saved task is accepted immediately

- **WHEN** a valid owned schedule is started and upstream accepts it
- **THEN** BFF sends one bodyless upstream POST and returns the mapped run with HTTP 202 without awaiting execution or invalidating the list cache

#### Scenario: Body cannot override the definition

- **WHEN** a caller includes an override body with the start request
- **THEN** none of that body is forwarded upstream and only the saved definition can execute

#### Scenario: Missing foreign or deleted schedule

- **WHEN** upstream returns 404 for an unknown/foreign schedule or 409 for a soft-deleted schedule
- **THEN** BFF returns the matching status and does not produce an accepted-run response

#### Scenario: Access and identifier validation precede upstream access

- **WHEN** the session/CSRF/feature checks fail or `scheduleId` fails `^[A-Za-z0-9_-]{1,128}$`
- **THEN** the corresponding 401/403/400 response is returned without contacting Scheduler

#### Scenario: Credential absence is reported asynchronously

- **WHEN** the owner has no usable external-service sign-in and Scheduler accepts the run
- **THEN** BFF returns 202 and does not invoke the create/resume credential precheck

#### Scenario: Upstream fails or cannot be reached

- **WHEN** Scheduler rate-limits, returns an upstream failure, or cannot be reached within the configured timeout
- **THEN** BFF returns 429, 502, or 503 as appropriate and does not repeat the POST

### Requirement: Read one scheduled task run and preserve its failure stage

The BFF SHALL expose `GET /api/v1/scheduled-tasks/:scheduleId/runs/:runId` with operationId/generated method `getScheduledTaskRun`, returning HTTP 200 and `ScheduledTaskRunDto`. A new `GetScheduledTaskRunDto` SHALL validate both path ids against `^[A-Za-z0-9_-]{1,128}$`. It SHALL proxy the matching Scheduler GET through the existing routed deployment and caller access token. Session/feature authorization, no-store behavior, error mapping, logging and normal generated-method consumption SHALL match the start operation; Swagger SHALL document 200, 400, 401, 403, 404, 429, 502 and 503. A run SHALL be read only within the given owned schedule; an unknown run or foreign schedule SHALL return 404.

`ScheduledTaskRunDto` SHALL add optional `resultStage?: string`, preserving only the string `result.stage` when supplied. List/start/single-run mapping SHALL use the same `fromUpstreamRun` normalization; arbitrary result objects SHALL NOT be forwarded. Missing/null/non-string stage SHALL omit `resultStage`, preserving compatibility. Existing enum mapping, time/duration derivation and nullable conversation normalization SHALL remain unchanged.

For a rate-limited single-run read, BFF SHALL preserve a valid Scheduler `Retry-After` response header (delay seconds or an HTTP date), without changing the existing mapped error body or trace handling. Invalid header values SHALL be omitted.

Concrete request: `GET /api/v1/scheduled-tasks/sched_123/runs/0b7548aa-7751-483f-84ad-a8392e55efbe`.

Example HTTP 200 response for a credential-stage failure:

```json
{
  "id": "0b7548aa-7751-483f-84ad-a8392e55efbe",
  "status": "Error",
  "startTime": "2026-09-30T09:00:00Z",
  "endTime": "2026-09-30T09:00:01Z",
  "durationSeconds": 1,
  "resultStage": "credentials"
}
```

#### Scenario: A completed run has a conversation

- **WHEN** Scheduler returns a successful run with a conversation id and end time
- **THEN** the endpoint returns Success, camelCase timestamps, derived duration and the real conversation id

#### Scenario: Credential failure exposes only its stage

- **WHEN** Scheduler returns an error with `result.stage` equal to `credentials` and additional result data
- **THEN** the DTO includes `resultStage: "credentials"` and excludes the additional result data

#### Scenario: Older runs have no result stage

- **WHEN** a listed or individually retrieved run omits result or has a null/non-string stage
- **THEN** mapping succeeds without `resultStage` and all established run fields remain available

#### Scenario: Invalid or inaccessible run cannot be read

- **WHEN** either path id is malformed, or the valid run does not belong to the requested owned schedule
- **THEN** BFF returns 400 before upstream access for malformed ids, or the upstream 404 for inaccessible runs


## MODIFIED Requirements

### Requirement: Scheduled task completed-state field

`ScheduledTaskDto` SHALL include an optional `isCompleted: boolean` field, computed by `ScheduledTasksService` (not by `fromUpstreamSchedule`, which cannot see run history) on both the list and get paths. `isCompleted: true` means the schedule can no longer produce a future automatic run from its trigger, via exactly two terminal shapes:

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

The completed-state enrichment SHALL NOT be used to reject manual execution. Starting a manual run SHALL NOT mutate the schedule or invalidate the list cache; later ordinary list/get requests retain the established enrichment rules.

#### Scenario: Completion does not prohibit manual execution

- **WHEN** an owned non-deleted schedule has isCompleted true and the user requests a manual run
- **THEN** the start endpoint delegates to Scheduler without rejecting on completed-state grounds or resuming the trigger
