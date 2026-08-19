## MODIFIED Requirements

### Requirement: Scheduled Tasks endpoints are versioned, feature-gated, and session-authenticated

The application SHALL expose five business endpoints under `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`, all tagged `@ApiTags('scheduled-tasks')` on `@Controller({ path: 'scheduled-tasks', version: '1' })`:

- `GET /api/v1/scheduled-tasks` — `operationId: listScheduledTasks`
- `POST /api/v1/scheduled-tasks` — `operationId: createScheduledTask`
- `GET /api/v1/scheduled-tasks/:scheduleId` — `operationId: getScheduledTask`
- `PUT /api/v1/scheduled-tasks/:scheduleId` — `operationId: updateScheduledTask`
- `DELETE /api/v1/scheduled-tasks/:scheduleId` — `operationId: deleteScheduledTask`

Every route MUST be `@UseGuards(FeatureGuard)` + `@RequireFeature(FeatureKey.ScheduledTasksEnabled)`, and MUST read the session `sub`/`at` from `req.user as SessionUser` — never accept a caller-supplied user id or token. Each route MUST carry `@Throttle` and full `@ApiResponse` coverage for every status it can return (200/201/204 as applicable, 400, 401, 403, 404 for get/update/delete, 409 for delete, 429, 502, 503).

Frontend impact: all five operations are exposed on the regenerated `@epam/chat-api-client` (`ScheduledTasksApi`), consumed through `apps/chat/src/server-api/scheduled-tasks.api.ts` thin wrappers and the `scheduledTasksApi` singleton in `apps/chat/src/server-api/api-client.ts`, using normal (non-`Raw`) generated methods since no response requires header/status inspection beyond what the client library exposes. The create form calls `createScheduledTask` on submit; the list page calls `listScheduledTasks` on mount and refetch; the detail page calls `getScheduledTask`, `updateScheduledTask` (edit flow), and `deleteScheduledTask` (delete flow).

#### Scenario: Feature disabled rejects every route

- **WHEN** `features.scheduledTasksEnabled` resolves to `false` for the session user and any of the five routes is called
- **THEN** the response is `403 Forbidden` and the DIAL Scheduler is never contacted

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to any of the five routes has no valid session cookie
- **THEN** the response is `401 Unauthorized`

## ADDED Requirements

### Requirement: Scheduled task deleted state field

`ScheduledTaskDto` SHALL include an optional `isDeleted: boolean` field, computed in `fromUpstreamSchedule` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`) as `upstream.is_deleted ?? false`, where `is_deleted` is an explicit boolean field on the upstream schedule response (list, create, update, and get) per the DIAL Scheduler contract — this field MUST be read directly, never derived from `next_run_time`, `trigger`, or any other field that already carries a distinct meaning (a `null` `next_run_time` means paused/exhausted, not deleted). `isDeleted` is additive to the existing `id`/`displayName`/`trigger`/`isActive`/etc. fields and MUST NOT be required, mapping MUST NOT throw when `is_deleted` is absent from an upstream response, and mapping MUST default to `false` in that case (never `undefined`, since deletion is a definite yes/no once modeled, unlike `isActive`'s documented "no basis to decide" case).

#### Scenario: Upstream is_deleted true maps to isDeleted true

- **WHEN** an upstream schedule response includes `is_deleted: true`
- **THEN** the mapped `ScheduledTaskDto.isDeleted` is `true`

#### Scenario: Upstream is_deleted false maps to isDeleted false

- **WHEN** an upstream schedule response includes `is_deleted: false`
- **THEN** the mapped `ScheduledTaskDto.isDeleted` is `false`

#### Scenario: Missing is_deleted defaults to false without throwing

- **WHEN** an upstream schedule response omits `is_deleted` entirely
- **THEN** the mapped `ScheduledTaskDto.isDeleted` is `false`, and mapping does not throw

#### Scenario: Soft-deleted schedule remains readable with null next_run_time

- **WHEN** `GET /api/v1/scheduled-tasks/:scheduleId` proxies an upstream response with `is_deleted: true` and `next_run_time: null`
- **THEN** the endpoint returns `200 OK` with `ScheduledTaskDto.isDeleted: true` and `nextRunTime: undefined`, not a `404`

### Requirement: Delete a scheduled task

`DELETE /api/v1/scheduled-tasks/:scheduleId` SHALL validate `scheduleId` against the existing allowlist `^[A-Za-z0-9_-]{1,128}$` (reusing `GetScheduledTaskDto`) before use, take no request body and no query parameters, and proxy `DELETE {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}` using the session bearer token via a dedicated `deleteScheduledTask` method on `ScheduledTasksService` (not the `performScheduleAction`/`ScheduleAction` helper used by pause/resume, since delete uses a different HTTP verb and returns no body to re-fetch). Creator isolation SHALL be delegated entirely to the upstream endpoint's own `created_by` scoping — the BFF SHALL NOT perform its own ownership check beyond what upstream already enforces via the session's access token. The BFF SHALL NOT attempt to predict or request a hard vs. soft deletion outcome; it SHALL treat both outcomes identically as a successful deletion.

On a successful upstream `204 No Content`, the endpoint SHALL respond `204 No Content` with an empty body (`@HttpCode(HttpStatus.NO_CONTENT)`), SHALL NOT attempt to parse a JSON body from the upstream response, and SHALL invalidate the caller's scheduled-tasks list cache using the existing `invalidateListCache(userSub)` epoch-bump helper before responding. The response SHALL carry cache-preventing headers consistent with the controller's other mutation endpoints (no caching of a delete response). Upstream errors SHALL map through the existing `mapDialHttpStatus`/`handleDialFetchError` mechanism without exposing the upstream's bare-JSON-string error body: a `404` (unknown schedule, another user's schedule, or an already hard-deleted schedule) maps to `404 Not Found`; a `409` (already soft-deleted) maps to `409 Conflict`; a `502` (scheduler could not unregister the job; no DB change occurred, the task remains live, and retrying is safe) maps to `502 Bad Gateway`; upstream timeout or unavailability maps to `503 Service Unavailable`. The route SHALL carry the same mutation `@Throttle({ default: { limit: 10, ttl: 60000 } })` limit used by `createScheduledTask`/`updateScheduledTask`/pause/resume, since no stricter per-route limit is justified for a single-shot, user-confirmed action.

#### Scenario: Valid delete request succeeds with an empty 204 body

- **WHEN** an authenticated request deletes a schedule the caller owns and DIAL Scheduler responds successfully (hard or soft delete)
- **THEN** the upstream request is `DELETE {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}`, no request body is sent, and the endpoint responds `204 No Content` with an empty body

#### Scenario: Invalid scheduleId is rejected before any upstream call

- **WHEN** `scheduleId` contains characters outside `[A-Za-z0-9_-]` (e.g. a path-traversal payload)
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: Unauthenticated request is rejected

- **WHEN** a delete request has no valid session cookie
- **THEN** the response is `401 Unauthorized`

#### Scenario: Feature disabled rejects the request

- **WHEN** `features.scheduledTasksEnabled` resolves to `false` for the session user
- **THEN** the response is `403 Forbidden` and DIAL Scheduler is never contacted

#### Scenario: Unknown, foreign, or already hard-deleted schedule returns 404

- **WHEN** DIAL Scheduler returns 404 for the given `scheduleId` (unknown id, another user's schedule, or already hard-deleted)
- **THEN** the response is `404 Not Found` and the upstream's bare-string error body is not echoed to the client

#### Scenario: Already soft-deleted schedule returns 409

- **WHEN** DIAL Scheduler returns 409 because the schedule is already soft-deleted
- **THEN** the response is `409 Conflict` and the upstream's bare-string error body is not echoed to the client

#### Scenario: Scheduler unregistration failure returns 502 and does not invalidate the cache

- **WHEN** DIAL Scheduler returns 502 because it could not unregister the job
- **THEN** the response is `502 Bad Gateway`, the list cache is NOT invalidated, and no partial deletion state is created

#### Scenario: Upstream timeout or unavailability returns 503

- **WHEN** the upstream call times out or DIAL Core is unavailable
- **THEN** the response is `503 Service Unavailable`

#### Scenario: Successful delete invalidates the list cache

- **WHEN** a delete request succeeds with `204`
- **THEN** `invalidateListCache(userSub)` is called before the response is sent, so a subsequent `listScheduledTasks` call does not return the deleted schedule from a stale cache entry

#### Scenario: Rate limit exceeded

- **WHEN** the caller exceeds 10 requests per 60 seconds to this route
- **THEN** the response is `429 Too Many Requests`

#### Scenario: Delete response is never cached

- **WHEN** any delete request completes, successfully or not
- **THEN** the response carries the same no-store cache-prevention treatment as the controller's other mutation endpoints, and no cache entry is created for the delete response itself
