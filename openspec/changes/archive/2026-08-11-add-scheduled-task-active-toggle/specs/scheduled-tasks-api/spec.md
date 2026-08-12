## MODIFIED Requirements

### Requirement: Scheduled Tasks endpoints are versioned, feature-gated, and session-authenticated

The application SHALL expose six business endpoints under `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`, all tagged `@ApiTags('scheduled-tasks')` on `@Controller({ path: 'scheduled-tasks', version: '1' })`:

- `GET /api/v1/scheduled-tasks` — `operationId: listScheduledTasks`
- `POST /api/v1/scheduled-tasks` — `operationId: createScheduledTask`
- `GET /api/v1/scheduled-tasks/:scheduleId` — `operationId: getScheduledTask`
- `PUT /api/v1/scheduled-tasks/:scheduleId` — `operationId: updateScheduledTask`
- `POST /api/v1/scheduled-tasks/:scheduleId/pause` — `operationId: pauseScheduledTask`
- `POST /api/v1/scheduled-tasks/:scheduleId/resume` — `operationId: resumeScheduledTask`

Every route MUST be `@UseGuards(FeatureGuard)` + `@RequireFeature(FeatureKey.ScheduledTasksEnabled)`, and MUST read the session `sub`/`at` from `req.user as SessionUser` — never accept a caller-supplied user id or token. Each route MUST carry `@Throttle` and full `@ApiResponse` coverage for every status it can return (200/201 as applicable, 400, 401, 403, 404 for get/update/pause/resume, 429, 502, 503; 409 additionally for pause/resume, see below).

Frontend impact: all six operations are exposed on the regenerated `@epam/chat-api-client` (`ScheduledTasksApi`), consumed through `apps/chat/src/server-api/scheduled-tasks.api.ts` thin wrappers and the existing `scheduledTasksApi` singleton in `apps/chat/src/server-api/api-client.ts`, using normal (non-`Raw`) generated methods since no response requires header/status inspection beyond what the client library exposes. The create form calls `createScheduledTask` on submit; the list page calls `listScheduledTasks` on mount and refetch. `getScheduledTask` and `updateScheduledTask` are available for follow-up edit/detail flows. `pauseScheduledTask`/`resumeScheduledTask` are wired to the detail-page header's Active switch.

#### Scenario: Feature disabled rejects every route

- **WHEN** `features.scheduledTasksEnabled` resolves to `false` for the session user and any of the six routes is called
- **THEN** the response is `403 Forbidden` and the DIAL Scheduler is never contacted

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to any of the six routes has no valid session cookie
- **THEN** the response is `401 Unauthorized`

## ADDED Requirements

### Requirement: Scheduled task active state field

`ScheduledTaskDto` SHALL include an optional `isActive: boolean` field, computed in `fromUpstreamSchedule` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`) as `upstream.next_run_time != null` whenever the upstream response carries a `trigger` or `trigger_type` (i.e., there is a basis to decide); `isActive` SHALL be `undefined` when the upstream response gives no such basis. This derivation is a documented assumption pending confirmation of an authoritative upstream active/paused field (see design.md "Decision 1" and "Open Questions") — it MUST NOT be silently replaced with a different, undocumented heuristic, and mapping MUST NOT throw regardless of which optional upstream fields are present or absent.

#### Scenario: Schedule with a future next run maps to isActive true

- **WHEN** an upstream schedule response includes a non-null `next_run_time` and a `trigger`/`trigger_type`
- **THEN** the mapped `ScheduledTaskDto.isActive` is `true`

#### Scenario: Paused recurring schedule maps to isActive false

- **WHEN** an upstream schedule response has `trigger_type: "cron"` (or a `trigger.cron` object) and `next_run_time: null`
- **THEN** the mapped `ScheduledTaskDto.isActive` is `false`

#### Scenario: Missing trigger information leaves isActive undefined

- **WHEN** an upstream schedule response omits both `trigger` and `trigger_type`
- **THEN** the mapped `ScheduledTaskDto.isActive` is `undefined`, and mapping does not throw

### Requirement: Pause a scheduled task

`POST /api/v1/scheduled-tasks/:scheduleId/pause` SHALL validate `scheduleId` against the existing allowlist `^[A-Za-z0-9_-]{1,128}$` (reusing `GetScheduledTaskDto`) before use, take no request body, and proxy `POST {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}/pause` using the session bearer token. On a successful upstream response, the service SHALL follow up with a `GET` to the same schedule (the existing `getScheduledTask` upstream call) and return `200 OK` with the resulting `ScheduledTaskDto` (`isActive: false`), then invalidate the caller's scheduled-tasks list cache using the existing `invalidateListCache(userSub)` epoch-bump helper. If the follow-up `GET` fails after the pause action itself succeeded, the endpoint SHALL still return `200 OK` with the best-available `ScheduledTaskDto` (`isActive: false`, prior known field values), and the list cache invalidation SHALL still occur — a refresh failure after a confirmed mutation MUST NOT be reported as an overall failure or trigger a rollback.

#### Scenario: Valid pause request succeeds

- **WHEN** an authenticated, feature-enabled user calls pause for an existing, syntactically valid `scheduleId`
- **THEN** the upstream request is `POST {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}/pause`, and the response is `200 OK` with a `ScheduledTaskDto` whose `isActive` is `false`

#### Scenario: Invalid scheduleId is rejected before any upstream call

- **WHEN** `scheduleId` contains characters outside `[A-Za-z0-9_-]`
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: Unauthenticated request is rejected

- **WHEN** a pause request has no valid session cookie
- **THEN** the response is `401 Unauthorized`

#### Scenario: Feature disabled rejects the request

- **WHEN** `features.scheduledTasksEnabled` resolves to `false` for the session user
- **THEN** the response is `403 Forbidden` and DIAL Core is never contacted

#### Scenario: Unknown schedule id returns 404

- **WHEN** DIAL Core returns 404 for the given `scheduleId`
- **THEN** the response is `404 Not Found` and no cache invalidation occurs

#### Scenario: Successful pause invalidates the list cache

- **WHEN** pause succeeds for a user with one or more cached `listScheduledTasks` variants
- **THEN** every cached list variant for that user is invalidated, so a subsequent `listScheduledTasks` call reflects the paused state

#### Scenario: Failed pause does not invalidate the list cache

- **WHEN** the upstream pause action itself fails (4xx/5xx from DIAL Core, or DIAL Core is unreachable)
- **THEN** the caller's list cache is not invalidated

#### Scenario: Post-mutation refresh failure does not roll back a confirmed pause

- **WHEN** the upstream pause action succeeds but the BFF's follow-up `GET` for the same schedule fails
- **THEN** the endpoint still returns `200 OK` with `isActive: false` and still invalidates the list cache, rather than returning an error or `isActive: true`

#### Scenario: Rate limit exceeded

- **WHEN** a user exceeds the configured pause/resume rate limit
- **THEN** the response is `429 Too Many Requests`

#### Scenario: Upstream error maps to 502/503

- **WHEN** DIAL Core returns a 5xx or is unreachable while pausing
- **THEN** the endpoint returns `502 Bad Gateway` or `503 Service Unavailable`, never a raw upstream body

### Requirement: Resume a scheduled task

`POST /api/v1/scheduled-tasks/:scheduleId/resume` SHALL validate `scheduleId` against the same allowlist as pause, take no request body, and proxy `POST {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}/resume` using the session bearer token. It SHALL follow the same follow-up-`GET`, response, and cache-invalidation contract as the pause requirement above, returning `ScheduledTaskDto` with `isActive: true` and the recalculated `nextRunTime` on success (sourced from the follow-up `GET`, not fabricated by the BFF). If DIAL Scheduler documents that resuming a schedule in an invalid state (e.g. an already-active schedule, or a completed one-time schedule) is rejected, that case SHALL map to `409 Conflict`; absent such documentation, the BFF SHALL NOT invent a 409 case and instead lets the upstream's actual response map through the existing 4xx/5xx handling.

#### Scenario: Valid resume request succeeds

- **WHEN** an authenticated, feature-enabled user calls resume for an existing, syntactically valid `scheduleId`
- **THEN** the upstream request is `POST {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}/resume`, and the response is `200 OK` with a `ScheduledTaskDto` whose `isActive` is `true` and whose `nextRunTime` reflects the follow-up `GET`

#### Scenario: Invalid scheduleId is rejected before any upstream call

- **WHEN** `scheduleId` contains characters outside `[A-Za-z0-9_-]`
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: Unauthenticated request is rejected

- **WHEN** a resume request has no valid session cookie
- **THEN** the response is `401 Unauthorized`

#### Scenario: Feature disabled rejects the request

- **WHEN** `features.scheduledTasksEnabled` resolves to `false` for the session user
- **THEN** the response is `403 Forbidden` and DIAL Core is never contacted

#### Scenario: Unknown schedule id returns 404

- **WHEN** DIAL Core returns 404 for the given `scheduleId`
- **THEN** the response is `404 Not Found` and no cache invalidation occurs

#### Scenario: Successful resume invalidates the list cache and reflects the recalculated next run

- **WHEN** resume succeeds for a user with one or more cached `listScheduledTasks` variants
- **THEN** every cached list variant for that user is invalidated, so a subsequent `listScheduledTasks` call reflects the resumed state and its recalculated `nextRunTime`

#### Scenario: Failed resume does not invalidate the list cache

- **WHEN** the upstream resume action itself fails (4xx/5xx from DIAL Core, or DIAL Core is unreachable)
- **THEN** the caller's list cache is not invalidated

#### Scenario: Post-mutation refresh failure does not roll back a confirmed resume

- **WHEN** the upstream resume action succeeds but the BFF's follow-up `GET` for the same schedule fails
- **THEN** the endpoint still returns `200 OK` with `isActive: true` and still invalidates the list cache, rather than returning an error or `isActive: false`

#### Scenario: Rate limit exceeded

- **WHEN** a user exceeds the configured pause/resume rate limit
- **THEN** the response is `429 Too Many Requests`

#### Scenario: Upstream error maps to 502/503

- **WHEN** DIAL Core returns a 5xx or is unreachable while resuming
- **THEN** the endpoint returns `502 Bad Gateway` or `503 Service Unavailable`, never a raw upstream body
