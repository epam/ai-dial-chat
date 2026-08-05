## MODIFIED Requirements

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
