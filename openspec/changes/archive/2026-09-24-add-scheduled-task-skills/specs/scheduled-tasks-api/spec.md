## ADDED Requirements

### Requirement: Scheduled execution uses the ordinary completion skill contract

The scheduled completion SHALL carry one selected skill in `properties.payload.messages[0].custom_content.skills`. Scheduler SHALL preserve this message-level extension in storage and detail responses and forward it to DIAL Core during execution. A skill-only task SHALL use empty-string message content. Execution SHALL use the existing offline-credentials identity to access the skill resource, without a separate skill execution API or local worker.

#### Scenario: Execute a skill-only task

- **WHEN** a scheduled task with a skill and empty instructions runs
- **THEN** the ordinary completion includes the saved user-message skill reference and empty-string content
- **AND** the worker uses the existing offline-credentials identity to access the skill resource

### Requirement: Skill reference round-trips through existing scheduled task operations

`CreateScheduledTaskBodyDto` and `UpdateScheduledTaskBodyDto` SHALL add optional nullable `skillUrl`; `ScheduledTaskDto`, `CreatedScheduledTaskDto`, `UpdatedScheduledTaskDto`, and list items SHALL expose optional string `skillUrl`. At most one skill is authored. POST absent/null means no skill; PUT absent preserves the authoritative saved skill, while PUT null explicitly removes it. `prompt` SHALL remain a required string and MAY be empty only when an effective skill exists. Whitespace-only instructions without a skill SHALL fail. Resource references SHALL use existing DIAL skill-path validation and reject invalid types, empty values, traversal, controls, and external HTTP URLs while supporting valid Unicode/space/encoded path segments.

The BFF SHALL serialize the effective reference to `properties.payload.messages[0].custom_content.skills: [{ url }]`, with `encodeDialResourcePath` parity to chat, and map it back on reads. It SHALL NOT put skills at completion-root `custom_content`, add hidden prompt text, or send UI metadata. Clearing a skill SHALL remove the extension in the replaced upstream payload. Sparse list summaries SHALL stay sparse; omission SHALL NOT clear a saved detail/draft. Detail/edit SHALL fetch authoritative detail before editing.

Existing operations and normal generated methods SHALL be retained:

| HTTP endpoint | operationId / SDK method | Request DTO | Response DTO |
| --- | --- | --- | --- |
| POST `/api/v1/scheduled-tasks` | `createScheduledTask` | `CreateScheduledTaskBodyDto` | `CreatedScheduledTaskDto`, 201 |
| PUT `/api/v1/scheduled-tasks/{scheduleId}` | `updateScheduledTask` | `UpdateScheduledTaskBodyDto` | `UpdatedScheduledTaskDto`, 200 |
| GET `/api/v1/scheduled-tasks/{scheduleId}` | `getScheduledTask` | `GetScheduledTaskDto` path | `ScheduledTaskDto`, 200 |
| GET `/api/v1/scheduled-tasks` | `listScheduledTasks` | `ListScheduledTasksQueryDto` query | `ListScheduledTasksResponseDto`, 200 |

Concrete POST/PUT request for a skill-only task:

```json
{
  "displayName": "Daily summary",
  "trigger": { "cron": { "fields": { "hour": "9", "minute": "0" } } },
  "model": "skills-capable-model",
  "prompt": "",
  "skillUrl": "skills/public/daily-summary"
}
```

Concrete success/detail response (other optional metadata can also be present):

```json
{
  "id": "sched_123",
  "displayName": "Daily summary",
  "trigger": { "cron": { "fields": { "hour": "9", "minute": "0" } } },
  "model": "skills-capable-model",
  "prompt": "",
  "skillUrl": "skills/public/daily-summary"
}
```

A populated list response SHALL wrap such records in `{"items":[...],"count":1,"limit":20,"offset":0,"next":null,"previous":null}`; upstream summaries without payload SHALL not invent a `skillUrl`. Removal uses the same full PUT body with nonblank `prompt` and `"skillUrl": null`.

No new endpoint, role, telemetry, or cache SHALL be introduced. Existing session/CSRF and `scheduledTasksEnabled` authorization SHALL apply. The host-only selection flag SHALL not remove saved data. Existing 400/401/403/404/502/503 behavior SHALL remain; successful writes SHALL invalidate the per-user list epoch, rejected writes SHALL not. List cache remains `scheduled-tasks:list:{userSub}:{epoch}:{normalizedQuery}`, 30s TTL; its epoch has 24h TTL, and detail is uncached. Frontend calls SHALL continue through configured `scheduledTasksApi`, `createScheduledTasksApiClient`, and app `server-api` wrappers using normal methods, not `Raw` or direct fetch.

#### Scenario: Full skill lifecycle

- **WHEN** a supported task is created with a skill, reached through the list, read, and edited
- **THEN** create/detail/update return the saved reference, edit hydrates it even with empty prompt, and the scheduler's executed completion includes the same skill extension as chat

#### Scenario: Legacy update preserves and explicit removal clears

- **WHEN** an older client omits `skillUrl` on PUT
- **THEN** the BFF merges the saved skill before validation and does not erase it
- **AND WHEN** a subsequent valid PUT sends `skillUrl: null`
- **THEN** the saved extension and subsequent detail skill are absent

#### Scenario: Sparse list cannot erase a skill

- **WHEN** the upstream list omits payload but detail contains a skill
- **THEN** opening detail/edit loads that skill and does not treat the list omission as a removal

#### Scenario: Encoded reference matches chat

- **WHEN** a selected resource has spaces, Unicode, or already-encoded segments
- **THEN** the Scheduler completion reference matches chat's encoding without double encoding and resolves to the same resource after read/edit
- **AND** the 1024-character path limit is measured on the decoded path, so encoding expansion does not prevent later updates

### Requirement: Server validates the effective model and skill before persistence

For each skill-bearing create/update, including a skill preserved by PUT omission, `ScheduledTasksService` SHALL resolve model/agent capability using session-scoped authoritative deployment data and require `features.skillsSupported === true`. A client capability claim or feature-hidden field SHALL NOT bypass validation. A false/missing support flag SHALL raise `BadRequestException` with typed code `scheduledTaskSkillUnsupported` and field `skillUrl`. Empty effective content SHALL use `scheduledTaskInstructionsOrSkillRequired` and field `prompt`. Unknown/inaccessible deployments SHALL retain typed 404/403 semantics, with `scheduledTaskDeploymentUnavailable` distinguishing a deployment from a missing schedule. Lookup upstream failure/timeout SHALL produce 502/503; no writes occur in any failure case.

Concrete unsupported response:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "scheduledTaskSkillUnsupported",
  "field": "skillUrl",
  "message": "Selected model does not support skills. Remove the skill or select different model to proceed."
}
```

Swagger SHALL describe these typed bodies and status codes; generation via `npm run openapi` / `npm run openapi:check` SHALL update the client without hand edits. Client adapters SHALL translate stable codes rather than compare English message text, preserve draft values, and show model-lookup errors without replacing the edit page with task-not-found content.

#### Scenario: Backend rejects unsupported combinations independently of UI

- **WHEN** create/update directly submits a skill for a model or agent with false/absent support
- **THEN** the endpoint returns typed 400, sends no Scheduler mutation, and does not invalidate the list cache

#### Scenario: Omitted skill still participates in validation

- **WHEN** PUT changes a saved skill-bearing task to an unsupported model while omitting `skillUrl`
- **THEN** the server rejects the effective combination rather than dropping or overlooking the saved skill

#### Scenario: Capability changed after the client loaded

- **WHEN** the form considered the deployment supported but the server now rejects it
- **THEN** create/edit remain open with every draft field preserved and display the shared unsupported message

#### Scenario: Deployment lookup failure does not destroy an edit

- **WHEN** deployment resolution returns 404 or fails with 502/503 during save
- **THEN** no task mutation occurs and the client retains the form, distinguishes deployment-unavailable from task-not-found, and allows retry/correction

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

or with `"trigger": { "cron": { "fields": { "minute": "0", "hour": "*" } } }` in place of `date`. `displayName`, `trigger` (exactly one of `date` or `cron.fields`), `model`, and a string `prompt` are required; `skillUrl` is optional and nullable, and empty/whitespace-only prompt is allowed only with an effective skill; `description` is optional (`@IsOptional() @IsString() @MaxLength(500)`) and, when omitted or empty, MUST NOT be sent to DIAL Scheduler. The DTO SHALL NOT accept a client-supplied `service_id` or `stream` field — both are fixed/derived server-side (see below) and are not client-controllable.

The service SHALL build the upstream body server-side with `service_id` set from `SCHEDULER_SERVICE_ID` (read once at `ScheduledTasksService` construction; see the "SCHEDULER_APP_ID and SCHEDULER_SERVICE_ID environment configuration" requirement) and `properties`:

- `target_type: "chat_completion"`
- `url`: built by `buildScheduledTaskChatCompletionUrl(DialClientService.baseUrl)` — the base URL (backed by `DIAL_CORE_URL`) with any trailing slash stripped, followed by `/openai` (no double slashes)
- `api_version`: `DialClientService.dialApiVersion` (the same value `ChatService.sendCompletion` sends as `api-version`, backed by `DIAL_API_VERSION`, defaulting to `2024-10-21`)
- `create_conversation: true` — required for the Scheduler run to create a conversation under the reserved `.scheduler/{scheduleId}/{runId}/` path
- `stream: false` — fixed; background scheduled runs are always non-streaming, and this field is NOT nested inside `payload`
- `extra_headers: {}` — fixed
- `retry: null` — fixed
- `timeout: null` — fixed
- `payload: { messages: [{ role: "user", content: prompt, custom_content?: { skills: [{ url }] } }], model }` (the extension is present only with an effective skill) — no `stream` field inside `payload`

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

- **WHEN** `displayName`, `trigger`, or `model` is missing/empty, `prompt` is missing or not a string, or both trimmed `prompt` and the effective skill are empty
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

Skill-bearing requests SHALL additionally meet the server capability-validation and Scheduler forwarding requirements in this capability.

#### Scenario: Skill-only create is accepted

- **WHEN** a valid request includes `prompt: ""` and one valid skill reference with an explicitly supporting model/agent
- **THEN** it succeeds with 201 and persists the message-level skill extension

### Requirement: Update scheduled task

`PUT /api/v1/scheduled-tasks/:scheduleId` SHALL accept the same `UpdateScheduledTaskBodyDto` shape as create (`displayName`, `trigger`, `model`, `prompt`, optional nullable `skillUrl`, optional `description` (≤500 chars); no client-supplied `service_id` or `stream`), apply the same server-side `service_id` (from `SCHEDULER_SERVICE_ID`)/`target_type`/`url`/`api_version`/`create_conversation`/`stream`/`extra_headers`/`retry`/`timeout`/`payload`/`description` construction as create, proxy `PUT {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}` with the session bearer token, return `200 OK` with the updated `ScheduledTaskDto`, and invalidate that user's list cache on success.

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

Before validation the service SHALL resolve the effective skill from authoritative existing detail: omitted `skillUrl` preserves it; null removes it; a string replaces it. Validate effective content and authoritative model support before any upstream mutation.

#### Scenario: Clearing the only content fails

- **WHEN** PUT removes a saved skill with `skillUrl: null` and leaves prompt empty/whitespace
- **THEN** the server returns typed 400 for missing instructions-or-skill and does not alter the saved task
