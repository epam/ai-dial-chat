## ADDED Requirements

### Requirement: Scheduled tasks service is a facade over single-purpose collaborators

`ScheduledTasksService` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`) SHALL remain the only provider the controller and other modules use. It keeps its ten public methods and their signatures: `listScheduledTasks`, `createScheduledTask`, `getScheduledTask`, `listScheduledTaskRuns`, `getScheduledTaskRun`, `startScheduledTask`, `updateScheduledTask`, `pauseScheduledTask`, `resumeScheduledTask` and `deleteScheduledTask`. It SHALL own the order of each operation: consent check, configuration check, upstream call, then list cache invalidation. It SHALL delegate everything else to five injectable providers in the same folder, all registered in `ScheduledTasksModule`:

- `SchedulerUpstreamClient` (`scheduler-upstream.client.ts`) owns the Scheduler configuration (`SCHEDULER_APP_ID`, `SCHEDULER_SERVICE_ID`, `SCHEDULER_SERVICE_TIMEOUT_MS`, read once at construction). It also owns every upstream URL and the `dialClient.fetchCore` request: the timeout, the status mapping, the 429 → `ScheduledTaskRateLimitException` conversion and the `upstreamMessage`/`upstreamCode` enrichment.
- `ScheduledTasksListCacheService` (`scheduled-tasks-list-cache.service.ts`) owns the per-user epoch key `scheduled-tasks:list-epoch:<sub>`, its 24h TTL, and the list cache key `scheduled-tasks:list:<sub>:<epoch>:<limit>:<offset>:<search>:<sort>[:<model>]` with its 30s TTL. Every create, update, pause, resume and delete SHALL invalidate the list cache by bumping the epoch.
- `ScheduledTaskCompletionService` (`scheduled-task-completion.service.ts`) owns the `isCompleted` derivation, including the newest-run lookup.
- `ScheduledTaskRunsService` (`scheduled-task-runs.service.ts`) owns run listing, single-run reads, and the run error-text enrichment. That enrichment is capped at 10 detail reads per list call and cached per run under `scheduled-tasks:run-error-text:<scheduleId>:<runId>` for 24h.
- `ScheduledTaskPreconditionsService` (`scheduled-task-preconditions.service.ts`) owns the DIAL_NATIVE consent check and the model/skill configuration check.

The upstream response envelope helpers (`extractScheduleListItems`, `extractScheduleListPagination`) SHALL be pure functions in `scheduled-tasks.mapper.ts`.

This structure SHALL change no observable behavior: endpoints, OpenAPI operations, DTOs, upstream URLs, headers and bodies, cache keys and TTLs, error bodies and status codes, log text, and the `scheduledTasksEnabled` feature gate all stay as specified by the other requirements of this capability. It introduces no user-visible strings, no UI (so no RTL or accessibility impact), and no telemetry.

#### Scenario: The facade contains no upstream, cache or derivation logic

- **WHEN** `scheduled-tasks.service.ts` is inspected
- **THEN** it has fewer than 350 lines and calls no `fetchCore`, builds no Scheduler URL or cache key, and contains no completion predicate, run error-text lookup, consent lookup or deployment lookup

#### Scenario: Consumers of the service are untouched

- **WHEN** `scheduled-tasks.controller.ts`, `apps/chat-api/src/app/app.module.ts` and the controller spec are compared before and after the change
- **THEN** they are identical, and `ScheduledTasksModule` still exports `ScheduledTasksService`

#### Scenario: Behavior tests survive the move unchanged

- **WHEN** the existing service tests run from their new files, `scheduled-task-completion.service.spec.ts`, `scheduled-task-preconditions.service.spec.ts`, `scheduler-upstream.client.spec.ts`, `scheduled-task-runs.service.spec.ts` and the remaining `scheduled-tasks.service.spec.ts`, through a service built by the shared `createScheduledTasksService` fixture
- **THEN** every test passes with the assertions it had before the move

#### Scenario: Mutations still invalidate the list cache through the facade

- **WHEN** a schedule is created, updated, paused, resumed or deleted successfully
- **THEN** `ScheduledTasksService` calls `ScheduledTasksListCacheService.invalidate` with the caller's `sub` before returning, so a following `listScheduledTasks` misses the old cache entries

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

or with `"trigger": { "cron": { "fields": { "minute": "0", "hour": "*" } } }` in place of `date`. `displayName`, `trigger` (exactly one of `date` or `cron.fields`), `model`, and a string `prompt` are required; `displayName` is `@MaxLength(256)` and rejects control characters (`@Matches(/^[^\p{Cc}]*$/u)`), and `prompt` is `@MaxLength(50000)` (bounds from `apps/chat-api/src/common/validators/entity-field-limits.ts`, see `entity-field-limits`); `skillUrls` is an optional string array and rejects null, and empty/whitespace-only prompt is allowed only with an effective skill; `description` is optional (`@IsOptional() @IsString() @MaxLength(500)`) and, when omitted or empty, MUST NOT be sent to DIAL Scheduler. The DTO SHALL NOT accept a client-supplied `service_id` or `stream` field — both are fixed/derived server-side (see below) and are not client-controllable.

The service SHALL build the upstream body server-side with `service_id` set from `SCHEDULER_SERVICE_ID` (read once at `SchedulerUpstreamClient` construction; see the "SCHEDULER_APP_ID and SCHEDULER_SERVICE_ID environment configuration" requirement) and `properties`:

- `target_type: "chat_completion"`
- `url`: built by `buildScheduledTaskChatCompletionUrl(DialClientService.baseUrl)` — the base URL (backed by `DIAL_CORE_URL`) with any trailing slash stripped, followed by `/openai` (no double slashes)
- `api_version`: `DialClientService.dialApiVersion` (the same value `ChatService.sendCompletion` sends as `api-version`, backed by `DIAL_API_VERSION`, defaulting to `2024-10-21`)
- `create_conversation: true` — required for the Scheduler run to create a conversation under the reserved `.scheduler/{scheduleId}/{runId}/` path
- `extra_headers: {}` — fixed
- `retry: null` — fixed
- `timeout: null` — fixed
- `payload: { stream: true, messages: [{ role: "user", content: prompt, custom_content?: { skills: [{ url }] } }], model }` (the extension is present only with an effective skill) — `stream` is fixed (not client-controllable) and appears only inside `properties.payload`

and a top-level `description` field (mapped 1:1, never merged into `properties` or `properties.payload`) when provided. On success it SHALL call `POST {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/`, return **201** with `CreatedScheduledTaskDto` (at least `id`, `displayName`, `trigger`), and invalidate that user's list cache.

#### Scenario: Valid create request succeeds

- **WHEN** a request with a valid `displayName`, one trigger variant, `model`, and `prompt` is submitted by an authenticated, feature-enabled user, and `SCHEDULER_SERVICE_ID` is configured with a given value
- **THEN** the response is `201 Created` with the created schedule's `id`, `displayName`, and `trigger`, and the upstream body sent included `service_id` equal to the configured `SCHEDULER_SERVICE_ID` value and `properties.target_type: "chat_completion"`

#### Scenario: Upstream properties include the fixed Scheduler call fields

- **WHEN** a valid create request is submitted
- **THEN** the upstream request body's `properties` includes `create_conversation: true`, `extra_headers: {}`, `retry: null`, and `timeout: null`, and `properties.payload` contains `stream: true`, `messages`, and `model`; `properties` itself has no `stream` key

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

#### Scenario: Over-limit display name or instructions is rejected

- **WHEN** `displayName` is longer than 256 characters or contains a control character such as a line break, or `prompt` is longer than 50000 characters
- **THEN** the response is `400 Bad Request` and DIAL Core is never called; a printable `displayName` (including letters such as `p` or `C` and braces) is accepted

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

### Requirement: Scheduled task completed-state field

`ScheduledTaskDto` SHALL include an optional `isCompleted: boolean` field, computed by `ScheduledTaskCompletionService` and returned by `ScheduledTasksService` (not by `fromUpstreamSchedule`, which cannot see run history) on both the list and get paths. `isCompleted: true` means the schedule can no longer produce a future automatic run from its trigger, via exactly two terminal shapes:

- **Expired recurring schedule:** `triggerType === 'cron'` AND `nextRunTime` is null AND `trigger.cron.endDate` is in the past. Unambiguous from the schedule fields alone — no runs call is issued. A cron schedule with no `endDate`, or with one still in the future, is merely paused, not terminal. When the response carries no `trigger.cron.endDate` (a list shape without the nested trigger), this shape is not detected and the task keeps today's Paused display.
- **Finished one-time schedule:** `triggerType === 'date'` AND (`nextRunTime` is null OR `trigger.date` is in the past) — the candidate gate, an OR so it is path-independent — AND the newest run (fetched via `GET schedules/{scheduleId}/runs?limit=1`, newest first per the endpoint's documented ordering) exists with status `Success` or `Error`. `InProgress`, `Missed`, and an empty run list all yield `isCompleted: false` for candidates.

Non-terminal schedules yield `isCompleted: false` with no runs call. Derivation SHALL use the BFF's server clock for the date comparisons. A failed runs call MUST NOT fail the parent list/get response: the affected item SHALL carry `isCompleted: undefined` (mapped by the frontend identically to `false`) and the failure SHALL be logged at warn. The field is a documented assumption alongside `isActive` (no authoritative upstream state field is confirmed); when one is confirmed, both derivations MUST be replaced where they live today — `isCompleted` in `ScheduledTaskCompletionService`, `isActive` in `scheduled-tasks.mapper.ts` — not duplicated elsewhere.

#### Scenario: One-time task whose run finished maps to isCompleted true

- **WHEN** the upstream schedule has `trigger_type: "date"`, `next_run_time: null`, and its newest run has status `success` (or `error`)
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `true`

#### Scenario: One-time task currently running maps to isCompleted false

- **WHEN** the upstream schedule has `trigger_type: "date"`, `next_run_time: null`, and its newest run has status `in_progress`
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `false`

#### Scenario: Paused one-time task that never ran maps to isCompleted false

- **WHEN** the upstream schedule has `trigger_type: "date"`, `next_run_time: null` (paused before its date arrived, or the date passed while paused), and the runs list is empty (or the newest run has status `missed`)
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `false`, and no run-record-based completion is claimed

#### Scenario: Recurring schedule whose activity window has closed maps to isCompleted true without a runs call

- **WHEN** the upstream schedule has `trigger_type: "cron"`, `next_run_time: null`, and a `trigger.cron.end_date` in the past
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `true` and no runs check is issued for it

#### Scenario: Recurring schedule with an open or unbounded window never reports completed

- **WHEN** the upstream schedule has `trigger_type: "cron"` and either no `trigger.cron.end_date`, an `end_date` in the future, or a non-null `next_run_time`
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `false` and no runs check is issued for it

#### Scenario: Future one-time task is not a candidate

- **WHEN** the upstream schedule has `trigger_type: "date"` and a non-null `next_run_time` (or, on the get path, a `trigger.date` in the future)
- **THEN** the mapped `ScheduledTaskDto.isCompleted` is `false` and no runs check is issued for it

#### Scenario: Failed runs check degrades the list item, not the list

- **WHEN** the runs check for a candidate item fails upstream during a list request
- **THEN** the list response still succeeds, that item's `isCompleted` is `undefined`, and the failure is logged at warn

#### Scenario: Get path computes the same field

- **WHEN** `GET /api/v1/scheduled-tasks/{scheduleId}` is called for a one-time schedule whose date is past and whose newest run is terminal
- **THEN** the returned `ScheduledTaskDto.isCompleted` is `true`, computed with the same rule as the list path

The completed-state enrichment SHALL NOT be used to reject manual execution. Starting a manual run SHALL NOT mutate the schedule or invalidate the list cache; later ordinary list/get requests retain the established enrichment rules.

#### Scenario: Completion does not prohibit manual execution

- **WHEN** an owned non-deleted schedule has isCompleted true and the user requests a manual run
- **THEN** the start endpoint delegates to Scheduler without rejecting on completed-state grounds or resuming the trigger

### Requirement: Server validates the effective model and skill before persistence

For each skill-bearing create/update, including a skill preserved by PUT omission, `ScheduledTaskPreconditionsService` SHALL resolve model/agent capability using session-scoped authoritative deployment data and require `features.skillsSupported === true`. A client capability claim or feature-hidden field SHALL NOT bypass validation. A false/missing support flag SHALL raise `BadRequestException` with typed code `scheduledTaskSkillUnsupported` and field `skillUrls`. Empty effective content SHALL use `scheduledTaskInstructionsOrSkillRequired` and field `prompt`. Unknown/inaccessible deployments SHALL retain typed 404/403 semantics, with `scheduledTaskDeploymentUnavailable` distinguishing a deployment from a missing schedule. Lookup upstream failure/timeout SHALL produce 502/503; no writes occur in any failure case.

Concrete unsupported response:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "scheduledTaskSkillUnsupported",
  "field": "skillUrls",
  "message": "Selected model does not support skills. Remove the skill or select different model to proceed."
}
```

Swagger SHALL describe these typed bodies and status codes; generation via `npm run openapi` / `npm run openapi:check` SHALL update the client without hand edits. Client adapters SHALL translate stable codes rather than compare English message text, preserve draft values, and show model-lookup errors without replacing the edit page with task-not-found content.

#### Scenario: Backend rejects unsupported combinations independently of UI

- **WHEN** create/update directly submits a skill for a model or agent with false/absent support
- **THEN** the endpoint returns typed 400, sends no Scheduler mutation, and does not invalidate the list cache

#### Scenario: Omitted skill still participates in validation

- **WHEN** PUT changes a saved skill-bearing task to an unsupported model while omitting `skillUrls`
- **THEN** the server rejects the effective combination rather than dropping or overlooking the saved skill

#### Scenario: Capability changed after the client loaded

- **WHEN** the form considered the deployment supported but the server now rejects it
- **THEN** create/edit remain open with every draft field preserved and display the shared unsupported message

#### Scenario: Deployment lookup failure does not destroy an edit

- **WHEN** deployment resolution returns 404 or fails with 502/503 during save
- **THEN** no task mutation occurs and the client retains the form, distinguishes deployment-unavailable from task-not-found, and allows retry/correction
