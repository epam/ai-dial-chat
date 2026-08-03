## MODIFIED Requirements

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
