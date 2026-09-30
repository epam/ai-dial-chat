## ADDED Requirements

### Requirement: Schedule-activating operations check the DIAL_NATIVE scheduler application consent

`createScheduledTask` (`POST /api/v1/scheduled-tasks`, operationId `createScheduledTask`), `updateScheduledTask` (`PUT /api/v1/scheduled-tasks/:scheduleId`, operationId `updateScheduledTask`) and `resumeScheduledTask` (`POST /api/v1/scheduled-tasks/:scheduleId/resume`, operationId `resumeScheduledTask`) SHALL, before any request to DIAL Scheduler and before model/skill validation, read the scheduler's external service `SCHEDULER_SERVICE_ID` of application `SCHEDULER_APP_ID` through `ExternalServicesService.getExternalService` (DIAL Core `GET /v1/applications/{appId}/external-services/{serviceId}`, with the application-resource fallback that method already performs) using the session bearer token. The result SHALL NOT be cached: every call re-reads it, so an administrator's revocation takes effect on the user's next operation.

When the service's `authenticationType` is `DIAL_NATIVE` and its `appLevelAuthStatus` is exactly `SIGNED_OUT`, the endpoint SHALL throw `ForbiddenException` with the typed body below, SHALL NOT contact DIAL Scheduler, and SHALL NOT invalidate the list cache:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "code": "scheduledTaskAdminConsentRequired",
  "message": "A DIAL administrator must approve this application's access before you can continue."
}
```

`ScheduledTaskErrorCode` SHALL gain the member `AdminConsentRequired = 'scheduledTaskAdminConsentRequired'`, published through the existing `ScheduledTaskValidationErrorDto.code` OpenAPI enum (`enumName: 'ScheduledTaskErrorCode'`) so the generated client exposes `ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired`. No new endpoint, request DTO, or response DTO is introduced; frontend callers keep using the normal (non-`Raw`) generated methods. The `403` `@ApiResponse` of create, update and resume SHALL document this case with `type: ScheduledTaskValidationErrorDto`.

The check SHALL fail open: when the lookup throws (any HTTP or network error), or the service is not `DIAL_NATIVE`, or `appLevelAuthStatus` is absent or any value other than `SIGNED_OUT`, the BFF SHALL log a warning (lookup failure only) and continue with the operation, leaving the decision to DIAL Scheduler. `pauseScheduledTask`, `deleteScheduledTask`, and the read endpoints SHALL NOT perform the check, so a user can always stop or remove a schedule after consent is revoked. The existing `scheduledTasksEnabled` feature gate and session authentication continue to apply unchanged; no telemetry is added. A Scheduler error that still occurs after the check passes follows the "Scheduler error responses carry the upstream reason and code" requirement below.

#### Scenario: Revoked consent blocks create without contacting DIAL Scheduler

- **GIVEN** DIAL Core reports the scheduler service as `authentication_type: DIAL_NATIVE`, `app_level_auth_status: SIGNED_OUT`
- **WHEN** an authenticated, feature-enabled user calls `POST /api/v1/scheduled-tasks` with a valid body
- **THEN** the response is `403` with `code: "scheduledTaskAdminConsentRequired"`, DIAL Scheduler is never called, and the list cache is not invalidated

#### Scenario: Revoked consent blocks update and resume

- **GIVEN** the scheduler service consent is `SIGNED_OUT`
- **WHEN** the user calls `PUT /api/v1/scheduled-tasks/sched_123` or `POST /api/v1/scheduled-tasks/sched_123/resume`
- **THEN** each response is `403` with `code: "scheduledTaskAdminConsentRequired"` and no DIAL Scheduler request is made

#### Scenario: Consent is re-read on every operation

- **WHEN** a create succeeds while consent is `SIGNED_IN`, and the administrator then revokes consent before the user's next create
- **THEN** the second create reads the service again and is rejected with `scheduledTaskAdminConsentRequired`

#### Scenario: Pause and delete are not blocked

- **GIVEN** the scheduler service consent is `SIGNED_OUT`
- **WHEN** the user pauses or deletes `sched_123`
- **THEN** no consent lookup is made and the request proceeds to DIAL Scheduler as before

#### Scenario: Non-DIAL_NATIVE service or unreported status does not block

- **WHEN** the scheduler service is `OAUTH`, or is `DIAL_NATIVE` without an `app_level_auth_status`
- **THEN** create/update/resume proceed to DIAL Scheduler unchanged

#### Scenario: Failed consent lookup defers to DIAL Scheduler

- **WHEN** the consent lookup fails with a DIAL Core error or is unreachable
- **THEN** a warning is logged and the operation proceeds to DIAL Scheduler; its own response determines the result

### Requirement: Scheduler error responses carry the upstream reason and code

Every endpoint that proxies DIAL Scheduler (`listScheduledTasks`, `getScheduledTask`, `listScheduledTaskRuns`, `createScheduledTask`, `updateScheduledTask`, `pauseScheduledTask`, `resumeScheduledTask`, `deleteScheduledTask`) SHALL, when DIAL Scheduler answers with a non-2xx status, keep mapping the status through `mapDialHttpStatus` exactly as today (same exception type, same status, same generic `message`, `error` and `statusCode`) and SHALL additionally add two optional string fields to the JSON error body:

- `upstreamMessage` — the reason DIAL Scheduler returned, extracted with `extractDialErrorMessage` (a bare string body, else `error.display_message`, else `error.message`, else top-level `message`), trimmed; omitted when empty; truncated to its first 1000 characters when longer.
- `upstreamCode` — `error.code`, else top-level `code`, of the upstream body when it is a string matching `^[A-Za-z0-9_.:-]{1,128}$`; omitted otherwise.

Both fields SHALL follow the shared exposure rule of `mapDialHttpStatus`: they are added for 400, 405, 409, 412, 413, 422, 429 and any status ≥ 500 (and any other unmapped status), and SHALL NEVER be added for 401, 403 or 404, so auth and resource details stay private. That rule SHALL be defined once in `apps/chat-api/src/common/dial/dial-error.mapper.ts` and reused, not re-listed in the scheduled-tasks domain. The raw upstream body object SHALL still never be forwarded — only these two extracted fields. `message` SHALL keep the BFF's own generic text (for example `DIAL Core returned a server error`), and the BFF's own typed `code` (`ScheduledTaskErrorCode`) SHALL never be taken from or overwritten by the upstream code; errors the BFF raises itself (validation, consent, configuration, timeouts, network failures) carry neither field. The full upstream body continues to be logged server-side by `mapDialHttpStatus`.

`ScheduledTaskValidationErrorDto` SHALL gain `upstreamMessage?: string` and `upstreamCode?: string` (`@ApiPropertyOptional`), and the 400, 409 and 502 `@ApiResponse` entries of the endpoints above SHALL reference `type: ScheduledTaskValidationErrorDto`, so the regenerated `@epam/ai-dial-chat-api-client` describes both fields. No endpoint, operationId, request DTO or success response DTO changes; frontend callers keep the normal (non-`Raw`) generated methods. No cache is introduced; failed mutations still do not invalidate the list cache.

Example — DIAL Scheduler answers create with `500 {"error":{"message":"Application consent revoked","code":"consent_revoked"}}`; the BFF responds:

```json
{
  "statusCode": 502,
  "error": "Bad Gateway",
  "message": "DIAL Core returned a server error",
  "upstreamMessage": "Application consent revoked",
  "upstreamCode": "consent_revoked",
  "traceparent": "00-ea5fa30918c91040b8a0837a22810c17-e2be692f315e8855-01"
}
```

#### Scenario: Scheduler 5xx carries its reason and code

- **WHEN** DIAL Scheduler answers create with `500` and body `{ "error": { "message": "Application consent revoked", "code": "consent_revoked" } }`
- **THEN** the response is `502` with `message: "DIAL Core returned a server error"`, `upstreamMessage: "Application consent revoked"`, and `upstreamCode: "consent_revoked"`

#### Scenario: Bare-string upstream body becomes upstreamMessage

- **WHEN** DIAL Scheduler answers delete with `409` and the JSON string body `"Schedule is already deleted"`
- **THEN** the response is `409 Conflict` with `upstreamMessage: "Schedule is already deleted"` and no `upstreamCode`

#### Scenario: 401, 403 and 404 never carry upstream fields

- **WHEN** DIAL Scheduler answers with `404` (or `401`/`403`) and a body containing text and a code
- **THEN** the mapped response has neither `upstreamMessage` nor `upstreamCode`

#### Scenario: Unsafe or oversized upstream values are sanitized

- **WHEN** the upstream `error.code` contains characters outside `[A-Za-z0-9_.:-]` or exceeds 128 characters, and the upstream message is 5000 characters long
- **THEN** `upstreamCode` is omitted and `upstreamMessage` holds the first 1000 characters

#### Scenario: Upstream code never overrides the BFF's typed code

- **WHEN** the consent pre-check rejects with `code: "scheduledTaskAdminConsentRequired"`
- **THEN** the body has no `upstreamCode`/`upstreamMessage`, and for upstream errors the top-level `code` is never set from the upstream body

#### Scenario: Timeouts and network failures carry no upstream fields

- **WHEN** the Scheduler request times out or DIAL Core is unreachable
- **THEN** the response is `503` with the existing generic message and neither upstream field

## MODIFIED Requirements

### Requirement: Delete a scheduled task

`DELETE /api/v1/scheduled-tasks/:scheduleId` SHALL validate `scheduleId` against the existing allowlist `^[A-Za-z0-9_-]{1,128}$` (reusing `GetScheduledTaskDto`) before use, take no request body and no query parameters, and proxy `DELETE {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}` using the session bearer token via a dedicated `deleteScheduledTask` method on `ScheduledTasksService` (not the `performScheduleAction`/`ScheduleAction` helper used by pause/resume, since delete uses a different HTTP verb and returns no body to re-fetch). Creator isolation SHALL be delegated entirely to the upstream endpoint's own `created_by` scoping — the BFF SHALL NOT perform its own ownership check beyond what upstream already enforces via the session's access token. The BFF SHALL NOT attempt to predict or request a hard vs. soft deletion outcome; it SHALL treat both outcomes identically as a successful deletion.

On a successful upstream `204 No Content`, the endpoint SHALL respond `204 No Content` with an empty body (`@HttpCode(HttpStatus.NO_CONTENT)`), SHALL NOT attempt to parse a JSON body from the upstream response, and SHALL invalidate the caller's scheduled-tasks list cache using the existing `invalidateListCache(userSub)` epoch-bump helper before responding. The response SHALL carry cache-preventing headers consistent with the controller's other mutation endpoints (no caching of a delete response). Upstream errors SHALL map through the existing `mapDialHttpStatus`/`handleDialFetchError` mechanism, never forwarding the raw upstream body object; the upstream reason and code SHALL be exposed only through the `upstreamMessage`/`upstreamCode` fields defined by the "Scheduler error responses carry the upstream reason and code" requirement: a `404` (unknown schedule, another user's schedule, or an already hard-deleted schedule) maps to `404 Not Found` without upstream fields; a `409` (already soft-deleted) maps to `409 Conflict`; a `502` (scheduler could not unregister the job; no DB change occurred, the task remains live, and retrying is safe) maps to `502 Bad Gateway`; upstream timeout or unavailability maps to `503 Service Unavailable`.

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
- **THEN** the response is `404 Not Found`, and neither the upstream's bare-string error body nor `upstreamMessage`/`upstreamCode` is returned to the client

#### Scenario: Already soft-deleted schedule returns 409

- **WHEN** DIAL Scheduler returns 409 because the schedule is already soft-deleted
- **THEN** the response is `409 Conflict` with the generic `message`, and the upstream's text, when present, only as `upstreamMessage`

#### Scenario: Scheduler unregistration failure returns 502 and does not invalidate the cache

- **WHEN** DIAL Scheduler returns 502 because it could not unregister the job
- **THEN** the response is `502 Bad Gateway` (with `upstreamMessage`/`upstreamCode` when Scheduler supplied them), the list cache is NOT invalidated, and no partial deletion state is created

#### Scenario: Upstream timeout or unavailability returns 503

- **WHEN** the upstream call times out or DIAL Core is unavailable
- **THEN** the response is `503 Service Unavailable`

#### Scenario: Successful delete invalidates the list cache

- **WHEN** a delete request succeeds with `204`
- **THEN** `invalidateListCache(userSub)` is called before the response is sent, so a subsequent `listScheduledTasks` call does not return the deleted schedule from a stale cache entry

#### Scenario: Delete response is never cached

- **WHEN** any delete request completes, successfully or not
- **THEN** the response carries the same no-store cache-prevention treatment as the controller's other mutation endpoints, and no cache entry is created for the delete response itself
