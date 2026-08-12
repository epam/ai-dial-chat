## MODIFIED Requirements

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

## ADDED Requirements

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
