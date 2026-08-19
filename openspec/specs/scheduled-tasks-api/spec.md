# scheduled-tasks-api Specification

## Purpose

Defines the BFF layer for DIAL Scheduler scheduled tasks: versioned, feature-gated, session-authenticated endpoints that proxy the routed deployment API, map snake_case upstream responses to camelCase DTOs, cache the list per user for 30 seconds, and expose the contract through the regenerated `@epam/chat-api-client` for app-level adapters.
## Requirements
### Requirement: Scheduled Tasks endpoints are versioned, feature-gated, and session-authenticated

The application SHALL expose seven business endpoints under `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`, all tagged `@ApiTags('scheduled-tasks')` on `@Controller({ path: 'scheduled-tasks', version: '1' })`:

- `GET /api/v1/scheduled-tasks` — `operationId: listScheduledTasks`
- `POST /api/v1/scheduled-tasks` — `operationId: createScheduledTask`
- `GET /api/v1/scheduled-tasks/:scheduleId` — `operationId: getScheduledTask`
- `PUT /api/v1/scheduled-tasks/:scheduleId` — `operationId: updateScheduledTask`
- `DELETE /api/v1/scheduled-tasks/:scheduleId` — `operationId: deleteScheduledTask`
- `POST /api/v1/scheduled-tasks/:scheduleId/pause` — `operationId: pauseScheduledTask`
- `POST /api/v1/scheduled-tasks/:scheduleId/resume` — `operationId: resumeScheduledTask`

Every route MUST be `@UseGuards(FeatureGuard)` + `@RequireFeature(FeatureKey.ScheduledTasksEnabled)`, and MUST read the session `sub`/`at` from `req.user as SessionUser` — never accept a caller-supplied user id or token. Each route MUST carry `@Throttle` and full `@ApiResponse` coverage for every status it can return (200/201/204 as applicable, 400, 401, 403, 404 for get/update/delete/pause/resume, 429, 502, 503; 409 additionally for delete/pause/resume, see below).

Frontend impact: all seven operations are exposed on the regenerated `@epam/chat-api-client` (`ScheduledTasksApi`), consumed through `apps/chat/src/server-api/scheduled-tasks.api.ts` thin wrappers and the existing `scheduledTasksApi` singleton in `apps/chat/src/server-api/api-client.ts`, using normal (non-`Raw`) generated methods since no response requires header/status inspection beyond what the client library exposes. The create form calls `createScheduledTask` on submit; the list page calls `listScheduledTasks` on mount and refetch. `getScheduledTask` and `updateScheduledTask` are available for follow-up edit/detail flows. `pauseScheduledTask`/`resumeScheduledTask` are wired to the detail-page header's Active switch. `deleteScheduledTask` is wired to the detail-page header's Delete action and its confirmation dialog.

#### Scenario: Feature disabled rejects every route

- **WHEN** `features.scheduledTasksEnabled` resolves to `false` for the session user and any of the seven routes is called
- **THEN** the response is `403 Forbidden` and the DIAL Scheduler is never contacted

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to any of the seven routes has no valid session cookie
- **THEN** the response is `401 Unauthorized`

### Requirement: List scheduled tasks

`GET /api/v1/scheduled-tasks` SHALL proxy `GET {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/` using the session bearer token, and return `ListScheduledTasksResponseDto` (`{ items: ScheduledTaskDto[] }`) with camelCase fields mapped from the upstream snake_case response. The upstream response is a paginated envelope (`{ count, limit, offset, results, next, previous }`); the service SHALL read schedules from the `results` field, falling back to an `items` field or a bare array only if a future Scheduler response uses one of those shapes instead.

The endpoint SHALL accept optional query parameters, validated via `ListScheduledTasksQueryDto` under the global `ValidationPipe` (`whitelist:true, forbidNonWhitelisted:true, transform:true`):

- `limit` — `@IsOptional() @IsInt() @Min(1) @Max(100)`. Forwarded to upstream as `limit` unchanged (the upstream `Pagination` dependency accepts `limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1)` with no upper bound of its own; 100 is a BFF-chosen sanity bound, not an upstream limit). Omitted → current single-page default behavior is preserved.
- `offset` — `@IsOptional() @IsInt() @Min(0)`. Forwarded to upstream as `offset` unchanged (upstream: `offset: int = Query(default=0, ge=0)`). Omitted → `0`.
- `search` — `@IsOptional() @IsString() @MaxLength(200)`, trimmed before use. Forwarded to upstream as the `name` query parameter (upstream performs a case-insensitive substring match against `display_name`). Omitted or empty after trimming → not sent upstream at all (no `name` parameter, not sent as an empty string).
- `sort` — `@IsOptional() @IsEnum(ScheduledTasksSortKey)`, where `ScheduledTasksSortKey` is `firstToRun` | `lastToRun` | `newest` | `nameAZ` (mirroring the frontend's existing sort-option enum values exactly). Mapped to the upstream `order_by`/`order_dir` query parameters:

  | `sort` | upstream `order_by` | upstream `order_dir` |
  |---|---|---|
  | `firstToRun` | `next_run_time` | `asc` |
  | `lastToRun` | `next_run_time` | `desc` |
  | `newest` | `created_at` | `desc` |
  | `nameAZ` | `name` | `asc` |

  Omitted → the service SHALL still send an explicit `order_by=next_run_time&order_dir=asc` upstream, as if `sort=firstToRun` had been supplied — the BFF never relies on upstream's own default (`created_at desc`) so the endpoint's documented default is always the one actually observed. When ordering by `next_run_time`, schedules with no next run time (paused/inactive schedules) SHALL sort last — this is upstream behavior, not something the BFF or its callers implement.

Results MUST be cached per user and per normalized `{limit, offset, search, sort}` combination for 30 seconds under a key that includes the normalized query params (e.g. `` `scheduled-tasks:list:{userSub}:{normalizedParams}` ``), with defaults applied before serialization (an omitted `sort` and an explicit `sort=firstToRun` MUST normalize to the same cache key). Every cached variant for that user MUST be invalidated immediately after a successful `createScheduledTask` or `updateScheduledTask` call for that same user.

The endpoint MUST respond with `Cache-Control: private, no-store` (not a `max-age` directive). Freshness is owned entirely by the server-side cache-manager invalidation above; a `max-age` response header would let the browser's own HTTP cache serve a stale list for up to that many seconds after a create/update, bypassing server-side invalidation entirely and making a just-created task invisible until a hard reload — this was an observed bug, not a hypothetical.

Example response (with `?limit=20&offset=0&search=daily&sort=firstToRun`):

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

- **WHEN** `listScheduledTasks` is called twice within 30 seconds for the same user with the same `limit`/`offset`/`search`/`sort` combination
- **THEN** the second call returns the cached response without a second upstream request

#### Scenario: Different query params bypass the cached variant for another combination

- **WHEN** `listScheduledTasks` is called for a user with `search=daily`, and then again within 30 seconds with `search=weekly` (or a different `limit`/`offset`/`sort`)
- **THEN** the second call performs a fresh upstream request rather than returning the first call's cached response

#### Scenario: List reflects a just-created schedule across all cached query variants

- **WHEN** `createScheduledTask` succeeds for a user who has multiple cached list variants (e.g. different `search`/`limit`/`offset`/`sort` combinations), and `listScheduledTasks` is called immediately after with any of those combinations for that same user
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

#### Scenario: Each sort value maps to its upstream order_by/order_dir pair

- **WHEN** a request is made with each of `sort=firstToRun`, `sort=lastToRun`, `sort=newest`, `sort=nameAZ` in turn
- **THEN** the upstream request is made with, respectively, `order_by=next_run_time&order_dir=asc`, `order_by=next_run_time&order_dir=desc`, `order_by=created_at&order_dir=desc`, and `order_by=name&order_dir=asc`

#### Scenario: Omitted sort defaults to firstToRun's upstream mapping

- **WHEN** a request is made with no `sort` query parameter
- **THEN** the upstream request is made with `order_by=next_run_time&order_dir=asc`

#### Scenario: Invalid query params are rejected before any upstream call

- **WHEN** `limit` or `offset` is negative, non-integer, `limit` exceeds 100, `search` exceeds 200 characters, or `sort` is a value other than `firstToRun`/`lastToRun`/`newest`/`nameAZ`
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

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
  "description": "Summarizes unread inbox items every morning"
}
```

or with `"trigger": { "cron": { "fields": { "minute": "0", "hour": "*" } } }` in place of `date`. `displayName`, `trigger` (exactly one of `date` or `cron.fields`), `model`, and `prompt` are required; `description` is optional (`@IsOptional() @IsString() @MaxLength(500)`) and, when omitted or empty, MUST NOT be sent to DIAL Scheduler. The DTO SHALL NOT accept a client-supplied `service_id` or `stream` field — both are fixed/derived server-side (see below) and are not client-controllable.

The service SHALL build the upstream body server-side with `service_id` set from `SCHEDULER_SERVICE_ID` (read once at `ScheduledTasksService` construction; see the "SCHEDULER_APP_ID and SCHEDULER_SERVICE_ID environment configuration" requirement) and `properties`:

- `target_type: "chat_completion"`
- `url`: built by `buildScheduledTaskChatCompletionUrl(DialClientService.baseUrl)` — the base URL (backed by `DIAL_CORE_URL`) with any trailing slash stripped, followed by `/openai` (no double slashes)
- `api_version`: `DialClientService.dialApiVersion` (the same value `ChatService.sendCompletion` sends as `api-version`, backed by `DIAL_API_VERSION`, defaulting to `2024-10-21`)
- `create_conversation: true` — required for the Scheduler run to create a conversation under the reserved `.scheduler/{scheduleId}/{runId}/` path
- `stream: false` — fixed; background scheduled runs are always non-streaming, and this field is NOT nested inside `payload`
- `extra_headers: {}` — fixed
- `retry: null` — fixed
- `timeout: null` — fixed
- `payload: { messages: [{ role: "user", content: prompt }], model }` — no `stream` field inside `payload`

and a top-level `description` field (mapped 1:1, never merged into `properties` or `properties.payload`) when provided. On success it SHALL call `POST {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/`, return **201** with `CreatedScheduledTaskDto` (at least `id`, `displayName`, `trigger`), and invalidate that user's list cache.

#### Scenario: Valid create request succeeds

- **WHEN** a request with a valid `displayName`, one trigger variant, `model`, and `prompt` is submitted by an authenticated, feature-enabled user, and `SCHEDULER_SERVICE_ID` is configured with a given value
- **THEN** the response is `201 Created` with the created schedule's `id`, `displayName`, and `trigger`, and the upstream body sent included `service_id` equal to the configured `SCHEDULER_SERVICE_ID` value and `properties.target_type: "chat_completion"`

#### Scenario: Upstream properties include the fixed Scheduler call fields

- **WHEN** a valid create request is submitted
- **THEN** the upstream request body's `properties` includes `create_conversation: true`, `stream: false`, `extra_headers: {}`, `retry: null`, and `timeout: null`, and `properties.payload` contains only `messages` and `model` (no `stream` key)

#### Scenario: Upstream url is built from the normalized DIAL Core base URL

- **WHEN** `DialClientService.baseUrl` is `http://dial-core` (no trailing slash)
- **THEN** the upstream request body's `properties.url` is `http://dial-core/openai`

#### Scenario: Upstream url normalizes a trailing slash on the base URL

- **WHEN** `DialClientService.baseUrl` is `http://dial-core/` (trailing slash)
- **THEN** the upstream request body's `properties.url` is `http://dial-core/openai`, not `http://dial-core//openai`

#### Scenario: Upstream api_version matches the interactive chat completion API version

- **WHEN** a valid create request is submitted and `DialClientService.dialApiVersion` resolves to a given value (from `DIAL_API_VERSION`, defaulting to `2024-10-21`)
- **THEN** the upstream request body's `properties.api_version` equals that same value

#### Scenario: A client-supplied service_id or stream field is rejected

- **WHEN** a create request body includes a `service_id` and/or `stream` field
- **THEN** the response is `400 Bad Request` (the global `ValidationPipe`'s `forbidNonWhitelisted: true` rejects the unknown property) and DIAL Core is never contacted

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
- **THEN** the upstream request body includes a top-level `description` field with that exact value, and it is absent from `properties` and `properties.payload`

#### Scenario: Description exceeding 500 characters is rejected

- **WHEN** `description` is present and longer than 500 characters
- **THEN** the response is `400 Bad Request` and DIAL Core is never called

#### Scenario: Omitted description is not sent upstream

- **WHEN** a valid create request omits `description`
- **THEN** the upstream request body has no `description` field

### Requirement: Get scheduled task by id

`GET /api/v1/scheduled-tasks/:scheduleId` SHALL validate `scheduleId` against the allowlist `^[A-Za-z0-9_-]{1,128}$` via `@Matches` before use, proxy `GET {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}` with the session bearer token, and return `ScheduledTaskDto` (`id`, `displayName`, `trigger`, `description`, and any additional narrowly-typed fields confirmed against a live upstream response). This endpoint is NOT cached.

`ScheduledTaskDto` SHALL additionally include optional `model` and `prompt` string fields, mapped from the upstream schedule's `properties.payload.model` and `properties.payload.messages[0].content` (the user message) respectively via `fromUpstreamSchedule` in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`. Both fields are additive and MUST NOT be required — mapping MUST NOT throw when `properties`, `properties.payload`, `properties.payload.model`, or `properties.payload.messages` is absent or empty (e.g. on a schedule created with a `target_type` other than `chat_completion`, or on list-endpoint responses that omit `properties.payload` entirely).

#### Scenario: Invalid scheduleId is rejected before any upstream call

- **WHEN** `scheduleId` contains characters outside `[A-Za-z0-9_-]` (e.g. `../etc/passwd` or a path-traversal payload)
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: Unknown schedule id returns 404

- **WHEN** DIAL Core returns 404 for a syntactically valid `scheduleId`
- **THEN** the response is `404 Not Found`

#### Scenario: model and prompt are mapped from properties.payload

- **WHEN** an upstream schedule response includes `properties.payload.model: "gpt-4.1-mini-2025-04-14"` and `properties.payload.messages: [{ role: "user", content: "Summarize my inbox" }]`
- **THEN** the mapped `ScheduledTaskDto` includes `model: "gpt-4.1-mini-2025-04-14"` and `prompt: "Summarize my inbox"`

#### Scenario: Missing properties.payload does not throw

- **WHEN** an upstream schedule response omits `properties`, `properties.payload`, `properties.payload.model`, and/or `properties.payload.messages`
- **THEN** the mapped `ScheduledTaskDto`'s `model`/`prompt` fields are `undefined`, and mapping does not throw

### Requirement: List scheduled task runs

`GET /api/v1/scheduled-tasks/:scheduleId/runs` SHALL be added to `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts` under `@Controller({ path: 'scheduled-tasks', version: '1' })`, with `operationId: listScheduledTaskRuns`. It SHALL validate `scheduleId` against the same allowlist `^[A-Za-z0-9_-]{1,128}$` via `@Matches` before use, be `@UseGuards(FeatureGuard)` + `@RequireFeature(FeatureKey.ScheduledTasksEnabled)`, read the session `sub`/`at` from `req.user as SessionUser`, carry `@Throttle`, and provide full `@ApiResponse` coverage for 200, 400, 401, 403, 404, 429, 502, and 503.

The endpoint SHALL accept `limit` (`@IsOptional() @IsInt() @Min(1) @Max(100)`, default `20`) and `offset` (`@IsOptional() @IsInt() @Min(0)`, default `0`) query parameters, validated via a `ListScheduledTaskRunsQueryDto` under the global `ValidationPipe`. It SHALL proxy `GET {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}/runs`, forwarding `limit`/`offset`, and SHALL always additionally send explicit `order_by=created_at&order_dir=desc` query parameters upstream — the BFF never relies on upstream's own default ordering, mirroring the same "always-explicit-default" decision already made for `listScheduledTasks`. This endpoint is NOT cached, since run status transitions (`in_progress` → `success`/`error`) must be observable immediately.

The upstream response is a paginated envelope (`{ count, limit, offset, results, next, previous }`); the service SHALL read runs from the `results` field, using the same envelope-unwrapping helper pattern already used by `listScheduledTasks`. Each upstream run (`{ id, status, start_time, end_time }`) SHALL be mapped to camelCase `ScheduledTaskRunDto`:

```ts
interface ScheduledTaskRunDto {
  id: string;
  status: ScheduledTaskRunStatus; // 'Success' | 'Error' | 'InProgress' | 'Missed'
  startTime: string; // ISO-8601, from upstream start_time
  endTime?: string | null; // from upstream end_time; null/omitted while in_progress
  durationSeconds?: number; // derived from startTime/endTime when both are present
}
```

with upstream `status` values mapped `success → Success`, `error → Error`, `in_progress → InProgress`, `missed → Missed`. The response DTO `ListScheduledTaskRunsResponseDto` SHALL be:

```ts
interface ListScheduledTaskRunsResponseDto {
  items: ScheduledTaskRunDto[];
  count?: number;
  limit?: number;
  offset?: number;
  next?: string | null;
  previous?: string | null;
}
```

Example request: `GET /api/v1/scheduled-tasks/sched_123/runs?limit=20&offset=40`. Example response:

```json
{
  "items": [
    {
      "id": "run_9f2a",
      "status": "Success",
      "startTime": "2026-07-24T09:00:00.000Z",
      "endTime": "2026-07-24T09:01:39.000Z",
      "durationSeconds": 99
    }
  ],
  "count": 242,
  "limit": 20,
  "offset": 40,
  "next": "/schedules/sched_123/runs?limit=20&offset=60",
  "previous": "/schedules/sched_123/runs?limit=20&offset=20"
}
```

`GET .../runs/{runId}` single-run detail is out of scope for this endpoint.

**Frontend impact:** exposed on the regenerated `@epam/chat-api-client` as `listScheduledTaskRuns`, consumed through a thin wrapper in `apps/chat/src/server-api/scheduled-tasks.api.ts`, using the normal (non-`Raw`) generated method. Consumed by `useScheduledTaskRuns` for the detail page's History panel.

#### Scenario: Feature disabled rejects the route

- **WHEN** `features.scheduledTasksEnabled` resolves to `false` for the session user
- **THEN** the response is `403 Forbidden` and DIAL Core is never contacted

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request has no valid session cookie
- **THEN** the response is `401 Unauthorized`

#### Scenario: Invalid scheduleId is rejected before any upstream call

- **WHEN** `scheduleId` contains characters outside `[A-Za-z0-9_-]`
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: Unknown schedule id returns 404

- **WHEN** DIAL Core returns 404 for a syntactically valid `scheduleId`
- **THEN** the response is `404 Not Found`

#### Scenario: Valid limit/offset are forwarded with explicit ordering

- **WHEN** a request is made with `limit=20&offset=40`
- **THEN** the upstream request is made with `limit=20&offset=40&order_by=created_at&order_dir=desc`

#### Scenario: Omitted limit/offset default to 20/0 with explicit ordering

- **WHEN** a request is made with no `limit`/`offset` query parameters
- **THEN** the upstream request is made with `limit=20&offset=0&order_by=created_at&order_dir=desc`

#### Scenario: Invalid limit/offset are rejected before any upstream call

- **WHEN** `limit` or `offset` is negative, non-integer, or `limit` exceeds 100
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: Upstream statuses are mapped to the BFF enum

- **WHEN** the upstream `results` include runs with `status` values `success`, `error`, `in_progress`, and `missed`
- **THEN** the mapped `items` include `status` values `Success`, `Error`, `InProgress`, and `Missed` respectively

#### Scenario: Paginated envelope resolves runs from results

- **WHEN** the upstream response is `{ count, limit, offset, results: [...], next, previous }`
- **THEN** `listScheduledTaskRuns` resolves the runs from `results` and returns them as `items`, along with `count`/`limit`/`offset`/`next`/`previous`

#### Scenario: Duration is derived when both timestamps are present

- **WHEN** an upstream run has `start_time` and `end_time` 99 seconds apart
- **THEN** the mapped `ScheduledTaskRunDto.durationSeconds` is `99`

#### Scenario: In-progress run has no end time or duration

- **WHEN** an upstream run has `status: "in_progress"` and `end_time: null`
- **THEN** the mapped `ScheduledTaskRunDto.endTime` is `null`/`undefined` and `durationSeconds` is `undefined`, and mapping does not throw

#### Scenario: Response is never cached

- **WHEN** `GET /api/v1/scheduled-tasks/:scheduleId/runs` returns a response
- **THEN** the `Cache-Control` response header is `private, no-store`, and no server-side cache entry is written for this endpoint

#### Scenario: Upstream error maps to 502/503

- **WHEN** DIAL Core returns a 5xx or is unreachable while listing runs
- **THEN** the endpoint returns `502 Bad Gateway` or `503 Service Unavailable`, never a raw upstream body

### Requirement: Update scheduled task

`PUT /api/v1/scheduled-tasks/:scheduleId` SHALL accept the same `UpdateScheduledTaskBodyDto` shape as create (`displayName`, `trigger`, `model`, `prompt`, optional `description` (≤500 chars); no client-supplied `service_id` or `stream`), apply the same server-side `service_id` (from `SCHEDULER_SERVICE_ID`)/`target_type`/`url`/`api_version`/`create_conversation`/`stream`/`extra_headers`/`retry`/`timeout`/`payload`/`description` construction as create, proxy `PUT {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}` with the session bearer token, return `200 OK` with the updated `ScheduledTaskDto`, and invalidate that user's list cache on success.

#### Scenario: Valid update succeeds and invalidates list cache

- **WHEN** an authenticated, feature-enabled user submits a valid update body for an existing `scheduleId`
- **THEN** the response is `200 OK` with the updated schedule, and a subsequent `listScheduledTasks` call for that user does not return stale cached data

#### Scenario: Update carries the same fixed Scheduler call properties as create

- **WHEN** an authenticated, feature-enabled user submits a valid update body for an existing `scheduleId`
- **THEN** the upstream `PUT` request body's `properties` includes `create_conversation: true`, `stream: false`, `extra_headers: {}`, `retry: null`, and `timeout: null`, matching the create request shape, and `service_id` equals the configured `SCHEDULER_SERVICE_ID` value

#### Scenario: Update of unknown schedule id returns 404

- **WHEN** DIAL Core returns 404 for the given `scheduleId` on update
- **THEN** the response is `404 Not Found` and no cache invalidation occurs

#### Scenario: Invalid update body is rejected

- **WHEN** the update body fails the same validation as create (missing field, both/neither trigger variant, `description` over 500 characters, a client-supplied `service_id` and/or `stream` field, or a `target_type` other than `chat_completion` if present)
- **THEN** the response is `400 Bad Request`

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

### Requirement: Scheduled task description field

`ScheduledTaskDto` SHALL include an optional `description` string field, mapped from the upstream schedule's top-level `description` field (exact upstream key confirmed against a live DIAL Scheduler response or its OpenAPI spec before implementation) via `fromUpstreamSchedule` in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`. This field is additive to the existing `id`/`displayName`/`trigger`/etc. fields and MUST NOT be required — mapping MUST NOT throw when the upstream response omits it (e.g. on list responses, or for schedules created before this change).

#### Scenario: Upstream description is mapped

- **WHEN** an upstream schedule response includes a top-level `description` field
- **THEN** the mapped `ScheduledTaskDto.description` equals that value

#### Scenario: Missing upstream description does not throw

- **WHEN** an upstream schedule response omits `description`
- **THEN** the mapped `ScheduledTaskDto.description` is `undefined`, and mapping does not throw

### Requirement: SCHEDULER_APP_ID and SCHEDULER_SERVICE_ID environment configuration

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) SHALL declare both `SCHEDULER_APP_ID` and `SCHEDULER_SERVICE_ID` as optional strings (`@IsOptional() @IsString()`), consistent with other optional-but-feature-required config such as `THEMES_CONFIG_URL`. `ScheduledTasksService` SHALL throw a `ServiceUnavailableException` with a message identifying the missing configuration on the first request that needs it if either `SCHEDULER_APP_ID` or `SCHEDULER_SERVICE_ID` is unset, rather than silently proceeding with an invalid upstream URL or an incorrect `service_id`. `SCHEDULER_SERVICE_ID` is only required by the create and update endpoints (the value it gates, `service_id`, is only sent on those two upstream calls); `SCHEDULER_APP_ID` remains required by all four endpoints, unchanged.

#### Scenario: Missing SCHEDULER_APP_ID fails fast on first use

- **WHEN** `features.scheduledTasksEnabled` is `true` for a user but `SCHEDULER_APP_ID` is not set in the environment, and any of the four endpoints is called
- **THEN** the response is `503 Service Unavailable` with a message indicating the scheduler application id is not configured, and no upstream request is attempted

#### Scenario: Missing SCHEDULER_SERVICE_ID fails fast on create or update

- **WHEN** `features.scheduledTasksEnabled` is `true` for a user, `SCHEDULER_APP_ID` is set, but `SCHEDULER_SERVICE_ID` is not set in the environment, and the create or update endpoint is called
- **THEN** the response is `503 Service Unavailable` with a message indicating the scheduler service id is not configured, and no upstream request is attempted

#### Scenario: Missing SCHEDULER_SERVICE_ID does not affect list or get

- **WHEN** `features.scheduledTasksEnabled` is `true` for a user, `SCHEDULER_APP_ID` is set, but `SCHEDULER_SERVICE_ID` is not set, and the list or get endpoint is called
- **THEN** the request proceeds normally, since `service_id` is only sent on create/update

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

### Requirement: Cron trigger activity window (startDate/endDate)

`ScheduleCronDto` (`apps/chat-api/src/scheduled-tasks/dto/schedule-trigger.dto.ts`) SHALL gain two optional fields, siblings of the existing `fields`:

```json
{
  "trigger": {
    "cron": {
      "fields": { "hour": "9", "minute": "0" },
      "startDate": "2026-08-01T00:00:00.000Z",
      "endDate": "2026-12-31T23:59:59.999Z"
    }
  }
}
```

- `startDate?: string` — `@IsOptional() @IsISO8601()`
- `endDate?: string` — `@IsOptional() @IsISO8601()`

Both fields apply only to a `cron` (recurring) trigger and are optional; when unset, the create/update behavior for `POST /api/v1/scheduled-tasks` and `PUT /api/v1/scheduled-tasks/:scheduleId` is unchanged from today.

`scheduled-tasks.mapper.ts` SHALL enforce, alongside the existing `assertExactlyOneTriggerVariant` check (same function, extended — not a new class-validator decorator, since these are cross-field checks over optional sibling fields that class-validator's per-property decorators cannot express):

- **Ordering**: when both `startDate` and `endDate` are present and `endDate` is not strictly after `startDate` → `400 Bad Request`.
- **One-shot rejection**: when `startDate` and/or `endDate` is present on a request whose `trigger` is `date` (one-shot) rather than `cron` → `400 Bad Request`. `startDate`/`endDate` only exist on `ScheduleCronDto`, so this case only arises if a caller sends both `trigger.date` and `trigger.cron.startDate`/`endDate` in the same malformed request — which the existing "exactly one trigger variant" check independently also rejects, but this check gives a body-mentions-cron-fields-with-a-date-trigger request the same clear rejection even before that check would otherwise run.

`toUpstreamSchedulePayload` SHALL extend the upstream `cron` shape (`UpstreamScheduleTrigger.cron: { fields: Record<string, string>; start_date?: string; end_date?: string }`) and include `start_date`/`end_date` **only when** the corresponding camelCase value is present and non-empty — omitted entirely otherwise, matching the existing `description` omission pattern (`...(body.description ? { description: body.description } : {})`), never sent as `null`. This applies identically to create and update, since `UpdateScheduledTaskBodyDto` reuses the create body shape.

`fromUpstreamSchedule` SHALL map upstream `trigger.cron.start_date` / `trigger.cron.end_date` back to `startDate` / `endDate` on the `cron` object of the response `ScheduleTriggerDto`, defaulting to `undefined` when absent, and MUST NOT throw when the upstream `trigger` object is missing entirely (list items carry only `trigger_type`).

#### Scenario: Recurring create with a bounded window sends both upstream keys

- **WHEN** a create request has `trigger.cron.fields`, `trigger.cron.startDate: "2026-08-01T00:00:00.000Z"`, and `trigger.cron.endDate: "2026-12-31T23:59:59.999Z"`
- **THEN** the upstream request body's `trigger.cron` includes `start_date: "2026-08-01T00:00:00.000Z"` and `end_date: "2026-12-31T23:59:59.999Z"` alongside `fields`

#### Scenario: Recurring create with no window omits both upstream keys

- **WHEN** a create request has `trigger.cron.fields` and no `startDate`/`endDate`
- **THEN** the upstream request body's `trigger.cron` contains only `fields` — no `start_date` or `end_date` key, and neither is sent as `null`

#### Scenario: endDate not after startDate is rejected

- **WHEN** a create or update request has `trigger.cron.startDate` and `trigger.cron.endDate` where `endDate` is equal to or earlier than `startDate`
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: startDate/endDate on a one-shot trigger is rejected

- **WHEN** a create or update request includes `trigger.cron.startDate` and/or `trigger.cron.endDate` together with `trigger.date` set
- **THEN** the response is `400 Bad Request` and DIAL Core is never contacted

#### Scenario: Update accepts the same window fields as create

- **WHEN** an authenticated, feature-enabled user submits a valid update body with `trigger.cron.startDate`/`endDate` for an existing `scheduleId`
- **THEN** the upstream `PUT` request body's `trigger.cron` includes `start_date`/`end_date` under the same omission rule as create, and the response is `200 OK`

#### Scenario: Get response round-trips the activity window

- **WHEN** `GET /api/v1/scheduled-tasks/:scheduleId` is called for a schedule whose upstream `trigger.cron` includes `start_date`/`end_date`
- **THEN** the response `ScheduledTaskDto.trigger.cron` includes `startDate`/`endDate` mapped from those upstream values

#### Scenario: List response mapping does not throw when trigger is absent

- **WHEN** `fromUpstreamSchedule` is called with an upstream object that has no `trigger` field (as returned by the list endpoint for individual items)
- **THEN** it returns a `ScheduledTaskDto` with `trigger.cron` `undefined`, without throwing
