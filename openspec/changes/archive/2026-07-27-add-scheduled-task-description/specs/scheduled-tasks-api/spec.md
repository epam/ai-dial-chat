## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Scheduled task description field

`ScheduledTaskDto` SHALL include an optional `description` string field, mapped from the upstream schedule's top-level `description` field (exact upstream key confirmed against a live DIAL Scheduler response or its OpenAPI spec before implementation) via `fromUpstreamSchedule` in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`. This field is additive to the existing `id`/`displayName`/`trigger`/etc. fields and MUST NOT be required — mapping MUST NOT throw when the upstream response omits it (e.g. on list responses, or for schedules created before this change).

#### Scenario: Upstream description is mapped

- **WHEN** an upstream schedule response includes a top-level `description` field
- **THEN** the mapped `ScheduledTaskDto.description` equals that value

#### Scenario: Missing upstream description does not throw

- **WHEN** an upstream schedule response omits `description`
- **THEN** the mapped `ScheduledTaskDto.description` is `undefined`, and mapping does not throw
