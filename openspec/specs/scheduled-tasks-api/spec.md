# scheduled-tasks-api Specification

## Purpose

Defines the BFF layer for DIAL Scheduler scheduled tasks: four versioned, feature-gated, session-authenticated endpoints that proxy the routed deployment API, map snake_case upstream responses to camelCase DTOs, cache the list per user for 30 seconds, and expose the contract through the regenerated `@epam/chat-api-client` for app-level adapters.
## Requirements
### Requirement: Scheduled Tasks endpoints are versioned, feature-gated, and session-authenticated

The application SHALL expose four business endpoints under `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`, all tagged `@ApiTags('scheduled-tasks')` on `@Controller({ path: 'scheduled-tasks', version: '1' })`:

- `GET /api/v1/scheduled-tasks` — `operationId: listScheduledTasks`
- `POST /api/v1/scheduled-tasks` — `operationId: createScheduledTask`
- `GET /api/v1/scheduled-tasks/:scheduleId` — `operationId: getScheduledTask`
- `PUT /api/v1/scheduled-tasks/:scheduleId` — `operationId: updateScheduledTask`

Every route MUST be `@UseGuards(FeatureGuard)` + `@RequireFeature(FeatureKey.ScheduledTasksEnabled)`, and MUST read the session `sub`/`at` from `req.user as SessionUser` — never accept a caller-supplied user id or token. Each route MUST carry `@Throttle` and full `@ApiResponse` coverage for every status it can return (200/201 as applicable, 400, 401, 403, 404 for get/update, 429, 502, 503).

Frontend impact: all four operations are exposed on the regenerated `@epam/chat-api-client` (`ScheduledTasksApi`), consumed through `apps/chat/src/server-api/scheduled-tasks.api.ts` thin wrappers and a `scheduledTasksApi` singleton added to `apps/chat/src/server-api/api-client.ts`, using normal (non-`Raw`) generated methods since no response requires header/status inspection beyond what the client library exposes. The create form calls `createScheduledTask` on submit; the list page calls `listScheduledTasks` on mount and refetch. `getScheduledTask` and `updateScheduledTask` are available for follow-up edit/detail flows but are not wired to UI in the current iteration.

#### Scenario: Feature disabled rejects every route

- **WHEN** `features.scheduledTasksEnabled` resolves to `false` for the session user and any of the four routes is called
- **THEN** the response is `403 Forbidden` and the DIAL Scheduler is never contacted

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to any of the four routes has no valid session cookie
- **THEN** the response is `401 Unauthorized`

### Requirement: List scheduled tasks

`GET /api/v1/scheduled-tasks` SHALL proxy `GET {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/` using the session bearer token, and return `ListScheduledTasksResponseDto` (`{ items: ScheduledTaskDto[] }`) with camelCase fields mapped from the upstream snake_case response. The upstream response is a paginated envelope (`{ count, limit, offset, results, next, previous }`); the service SHALL read schedules from the `results` field, falling back to an `items` field or a bare array only if a future Scheduler response uses one of those shapes instead.

The endpoint SHALL accept optional query parameters, validated via `ListScheduledTasksQueryDto` under the global `ValidationPipe` (`whitelist:true, forbidNonWhitelisted:true, transform:true`):

- `limit` — `@IsOptional() @IsInt() @Min(1) @Max(100)`. Forwarded to upstream as `limit` unchanged (the upstream `Pagination` dependency accepts `limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1)` with no upper bound of its own; 100 is a BFF-chosen sanity bound, not an upstream limit). Omitted → current single-page default behavior is preserved.
- `offset` — `@IsOptional() @IsInt() @Min(0)`. Forwarded to upstream as `offset` unchanged (upstream: `offset: int = Query(default=0, ge=0)`). Omitted → `0`.
- `search` — `@IsOptional() @IsString() @MaxLength(200)`, trimmed before use. Forwarded to upstream as the `name` query parameter (upstream performs a case-insensitive substring match against `display_name`). Omitted or empty after trimming → not sent upstream at all (no `name` parameter, not sent as an empty string).

No `sort` parameter is accepted — the upstream list endpoint has no sort/order capability (confirmed from its FastAPI route signature, which only depends on pagination, a metadata filter, and the name filter). Sorting of `ScheduledTaskDto[]` for display remains an app/frontend concern applied to whatever has been fetched, not a BFF or upstream concern.

Results MUST be cached per user and per normalized `{limit, offset, search}` combination for 30 seconds under a key that includes the normalized query params (e.g. `` `scheduled-tasks:list:{userSub}:{normalizedParams}` ``), and every cached variant for that user MUST be invalidated immediately after a successful `createScheduledTask` or `updateScheduledTask` call for that same user.

The endpoint MUST respond with `Cache-Control: private, no-store` (not a `max-age` directive). Freshness is owned entirely by the server-side cache-manager invalidation above; a `max-age` response header would let the browser's own HTTP cache serve a stale list for up to that many seconds after a create/update, bypassing server-side invalidation entirely and making a just-created task invisible until a hard reload — this was an observed bug, not a hypothetical.

Example response (with `?limit=20&offset=0&search=daily`):

```json
{
  "items": [
    {
      "id": "sched_123",
      "displayName": "Daily summary",
      "trigger": { "date": "2026-07-24T09:00:00.000Z" },
      "nextRunTime": "2026-07-28T12:00:00.000Z",
      "createdAt": "2026-07-23T21:27:07.000Z"
    }
  ],
  "count": 4,
  "limit": 20,
  "offset": 0,
  "next": null,
  "previous": null
}
```

#### Scenario: List returns cached data within TTL for the same query params

- **WHEN** `listScheduledTasks` is called twice within 30 seconds for the same user with the same `limit`/`offset`/`search` combination
- **THEN** the second call returns the cached response without a second upstream request

#### Scenario: Different query params bypass the cached variant for another combination

- **WHEN** `listScheduledTasks` is called for a user with `search=daily`, and then again within 30 seconds with `search=weekly` (or a different `limit`/`offset`)
- **THEN** the second call performs a fresh upstream request rather than returning the first call's cached response

#### Scenario: List reflects a just-created schedule across all cached query variants

- **WHEN** `createScheduledTask` succeeds for a user who has multiple cached list variants (e.g. different `search`/`limit`/`offset` combinations), and `listScheduledTasks` is called immediately after with any of those combinations for that same user
- **THEN** every cached variant for that user was invalidated on create, so each response reflects a fresh upstream fetch that includes the new schedule

#### Scenario: Response is never cached by the browser or an intermediate cache

- **WHEN** `GET /api/v1/scheduled-tasks` returns a response
- **THEN** the `Cache-Control` response header is `private, no-store`, not a `max-age` directive, so a client-side or intermediate HTTP cache cannot serve a stale list after a create/update within any time window

#### Scenario: Upstream error maps to 502/503

- **WHEN** DIAL Core returns a 5xx or is unreachable while listing schedules
- **THEN** the endpoint returns `502 Bad Gateway` (DIAL Core error response) or `503 Service Unavailable` (unreachable/timeout), never a raw upstream body

#### Scenario: Paginated envelope resolves schedules from `results`

- **WHEN** the upstream response is `{ count, limit, offset, results: [...], next, previous }` (the shape confirmed against a live DIAL Scheduler)
- **THEN** `listScheduledTasks` resolves the schedules from `results` and returns them as `items` in the response DTO, instead of resolving zero items

#### Scenario: Valid limit/offset/search are forwarded upstream, search mapped to name

- **WHEN** a request is made with `limit=12&offset=24&search=inbox`
- **THEN** the upstream request is made with `limit=12&offset=24&name=inbox`

#### Scenario: Invalid query params are rejected before any upstream call

- **WHEN** `limit` or `offset` is negative, non-integer, `limit` exceeds 100, or `search` exceeds 200 characters
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: Unknown sort query parameter is rejected

- **WHEN** a request includes a `sort` query parameter
- **THEN** the response is `400 Bad Request` (the global `ValidationPipe`'s `forbidNonWhitelisted` rejects the unrecognized field), since the endpoint has no sort capability to accept

#### Scenario: Empty search is not sent upstream

- **WHEN** `search` is omitted, an empty string, or a string that trims to empty
- **THEN** the upstream request is made without a `name` parameter, equivalent to an unfiltered list request

### Requirement: Create scheduled task with validated chat_completion/dial-oauth body

`POST /api/v1/scheduled-tasks` SHALL accept `CreateScheduledTaskBodyDto`:

```json
{
  "displayName": "Daily summary",
  "trigger": { "date": "2026-07-24T09:00:00.000Z" },
  "model": "gpt-4.1-mini-2025-04-14",
  "prompt": "Summarize my inbox",
  "description": "Summarizes unread inbox items every morning",
  "stream": true
}
```

or with `"trigger": { "cron": { "fields": { "minute": "0", "hour": "*" } } }` in place of `date`. `displayName`, `trigger` (exactly one of `date` or `cron.fields`), `model`, and `prompt` are required; `description` is optional (`@IsOptional() @IsString() @MaxLength(500)`) and, when omitted or empty, MUST NOT be sent to DIAL Scheduler; `stream` defaults to `true`. `cron.fields` SHALL be a non-empty object whose values are strings and whose keys are limited to the Scheduler fields `year`, `month`, `day`, `week`, `day_of_week`, `hour`, `minute`, and `second`; numeric values, ranges, lists, and steps SHALL stay within the field's valid range. The service SHALL build the upstream body server-side with fixed `service_id: "dial-oauth"`, `properties.target_type: "chat_completion"`, `properties.url` built from `DIAL_CORE_URL` + `/openai`, `properties.api_version` from `DialClientService.dialApiVersion`, `properties.payload` = `{ messages: [{ role: "user", content: prompt }], model, stream }`, and a top-level `description` field (mapped 1:1, never merged into `properties.payload`) when provided — confirmed against a live upstream response or scheduler OpenAPI before implementation; `description` MUST NOT be nested inside `properties`. On success it SHALL call `POST {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/`, return **201** with `CreatedScheduledTaskDto` (at least `id`, `displayName`, `trigger`), and invalidate that user's list cache.

#### Scenario: Valid create request succeeds

- **WHEN** a request with a valid `displayName`, one trigger variant, `model`, and `prompt` is submitted by an authenticated, feature-enabled user
- **THEN** the response is `201 Created` with the created schedule's `id`, `displayName`, and `trigger`, and the upstream body sent included `service_id: "dial-oauth"` and `properties.target_type: "chat_completion"`

#### Scenario: Missing required field is rejected

- **WHEN** `displayName`, `trigger`, `model`, or `prompt` is missing or empty
- **THEN** the response is `400 Bad Request` and DIAL Core is never called

#### Scenario: Both trigger variants or neither is rejected

- **WHEN** `trigger` contains both `date` and `cron`, or neither
- **THEN** the response is `400 Bad Request`

#### Scenario: Invalid cron fields are rejected

- **WHEN** `cron.fields` is empty, contains an unsupported key or non-string value, or contains a value outside that field's valid range
- **THEN** the response is `400 Bad Request` and DIAL Core is never called

#### Scenario: Description is included in the upstream request when provided

- **WHEN** a valid create request includes `description: "Summarizes unread inbox items every morning"`
- **THEN** the upstream request body includes a top-level `description` field with that exact value, and it is absent from `properties.payload`

#### Scenario: Description exceeding 500 characters is rejected

- **WHEN** `description` is present and longer than 500 characters
- **THEN** the response is `400 Bad Request` and DIAL Core is never called

#### Scenario: Omitted description is not sent upstream

- **WHEN** a valid create request omits `description`
- **THEN** the upstream request body has no `description` field

### Requirement: Get scheduled task by id

`GET /api/v1/scheduled-tasks/:scheduleId` SHALL validate `scheduleId` against the allowlist `^[A-Za-z0-9_-]{1,128}$` via `@Matches` before use, proxy `GET {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}` with the session bearer token, and return `ScheduledTaskDto` (`id`, `displayName`, `trigger`, and any additional narrowly-typed fields confirmed against a live upstream response). This endpoint is NOT cached.

#### Scenario: Invalid scheduleId is rejected before any upstream call

- **WHEN** `scheduleId` contains characters outside `[A-Za-z0-9_-]` (e.g. `../etc/passwd` or a path-traversal payload)
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: Unknown schedule id returns 404

- **WHEN** DIAL Core returns 404 for a syntactically valid `scheduleId`
- **THEN** the response is `404 Not Found`

### Requirement: Update scheduled task

`PUT /api/v1/scheduled-tasks/:scheduleId` SHALL accept the same `UpdateScheduledTaskBodyDto` shape as create (`displayName`, `trigger`, `model`, `prompt`, optional `description` (≤500 chars), optional `stream`), apply the same server-side `service_id`/`target_type`/`url`/`api_version`/`payload`/`description` construction as create, proxy `PUT {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}` with the session bearer token, return `200 OK` with the updated `ScheduledTaskDto`, and invalidate that user's list cache on success.

#### Scenario: Valid update succeeds and invalidates list cache

- **WHEN** an authenticated, feature-enabled user submits a valid update body for an existing `scheduleId`
- **THEN** the response is `200 OK` with the updated schedule, and a subsequent `listScheduledTasks` call for that user does not return stale cached data

#### Scenario: Update of unknown schedule id returns 404

- **WHEN** DIAL Core returns 404 for the given `scheduleId` on update
- **THEN** the response is `404 Not Found` and no cache invalidation occurs

#### Scenario: Invalid update body is rejected

- **WHEN** the update body fails the same validation as create (missing field, both/neither trigger variant, `description` over 500 characters, or a `service_id`/`target_type` other than `dial-oauth`/`chat_completion` if present)
- **THEN** the response is `400 Bad Request`

### Requirement: Scheduled task description field

`ScheduledTaskDto` SHALL include an optional `description` string field, mapped from the upstream schedule's top-level `description` field (exact upstream key confirmed against a live DIAL Scheduler response or its OpenAPI spec before implementation) via `fromUpstreamSchedule` in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`. This field is additive to the existing `id`/`displayName`/`trigger`/etc. fields and MUST NOT be required — mapping MUST NOT throw when the upstream response omits it (e.g. on list responses, or for schedules created before this change).

#### Scenario: Upstream description is mapped

- **WHEN** an upstream schedule response includes a top-level `description` field
- **THEN** the mapped `ScheduledTaskDto.description` equals that value

#### Scenario: Missing upstream description does not throw

- **WHEN** an upstream schedule response omits `description`
- **THEN** the mapped `ScheduledTaskDto.description` is `undefined`, and mapping does not throw

### Requirement: SCHEDULER_APP_ID environment configuration

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) SHALL declare `SCHEDULER_APP_ID` as an optional string (`@IsOptional() @IsString()`), consistent with other optional-but-feature-required config such as `THEMES_CONFIG_URL`. `ScheduledTasksService` SHALL throw a `ServiceUnavailableException` with a message identifying the missing configuration on the first request that needs it if `SCHEDULER_APP_ID` is unset, rather than silently proceeding with an invalid upstream URL.

#### Scenario: Missing SCHEDULER_APP_ID fails fast on first use

- **WHEN** `features.scheduledTasksEnabled` is `true` for a user but `SCHEDULER_APP_ID` is not set in the environment, and any of the four endpoints is called
- **THEN** the response is `503 Service Unavailable` with a message indicating the scheduler application id is not configured, and no upstream request is attempted

### Requirement: Scheduled task next-run and creation timestamps

`ScheduledTaskDto` SHALL include optional `nextRunTime` and `createdAt` ISO-8601 string fields, mapped from the upstream `next_run_time` and `created_at` fields when present. These fields are additive to the existing `id`/`displayName`/`trigger` fields and MUST NOT be required, since older upstream responses or mapper test fixtures may omit them.

#### Scenario: Upstream next_run_time and created_at are mapped

- **WHEN** an upstream schedule response includes `next_run_time` and `created_at`
- **THEN** the mapped `ScheduledTaskDto` includes `nextRunTime` and `createdAt` with the same ISO-8601 values

#### Scenario: Missing next_run_time/created_at does not throw

- **WHEN** an upstream schedule response omits `next_run_time` and/or `created_at`
- **THEN** the mapped `ScheduledTaskDto` has `nextRunTime`/`createdAt` as `undefined`, and mapping does not throw

### Requirement: Scheduled task ownership and trigger-kind metadata

`ScheduledTaskDto` SHALL include optional `serviceId` (upstream `service_id`), `triggerType` (upstream `trigger_type`, one of `cron`/`date`), `updatedAt` (upstream `updated_at`, ISO-8601), and `createdBy` (upstream `created_by`, the owning user's sub) fields, confirmed present on a live DIAL Scheduler list response. These are additive optional fields; mapping MUST NOT throw when any of them is absent. `triggerType` reflects which trigger variant the schedule uses even when the list endpoint's `trigger` object itself is absent (see the "List scheduled tasks" requirement above).

#### Scenario: Upstream ownership/trigger-kind fields are mapped

- **WHEN** an upstream schedule includes `service_id`, `trigger_type`, `updated_at`, and `created_by`
- **THEN** the mapped `ScheduledTaskDto` includes `serviceId`, `triggerType`, `updatedAt`, and `createdBy` with the same values

#### Scenario: Missing ownership/trigger-kind fields does not throw

- **WHEN** an upstream schedule omits `service_id`, `trigger_type`, `updated_at`, and/or `created_by`
- **THEN** the corresponding `ScheduledTaskDto` fields are `undefined`, and mapping does not throw

### Requirement: List response surfaces upstream pagination metadata

`ListScheduledTasksResponseDto` SHALL include optional `count`, `limit`, `offset`, `next`, and `previous` fields mirroring the upstream paginated envelope (`{ count, limit, offset, results, next, previous }`), so a caller can detect that more schedules exist beyond the current page. The endpoint accepts client-supplied `limit`/`offset`/`search` query parameters (see the "List scheduled tasks" requirement above) and forwards them upstream, so a caller can page through the full result set using these fields — `next != null` indicates more pages remain.

#### Scenario: Pagination fields are surfaced from the upstream envelope

- **WHEN** the upstream response is `{ count: 4, limit: 20, offset: 0, results: [...], next: null, previous: null }`
- **THEN** `listScheduledTasks` returns `{ items: [...], count: 4, limit: 20, offset: 0, next: null, previous: null }`

#### Scenario: Missing pagination envelope leaves fields undefined

- **WHEN** the upstream response is a bare array or an `{ items }` shape without `count`/`limit`/`offset`/`next`/`previous`
- **THEN** `listScheduledTasks` returns those fields as `undefined` rather than throwing or fabricating values

#### Scenario: `next` indicates more pages are available

- **WHEN** the upstream response includes a non-null `next` value
- **THEN** `listScheduledTasks` returns that non-null `next`, signaling to callers that requesting the next `offset` will return additional items
