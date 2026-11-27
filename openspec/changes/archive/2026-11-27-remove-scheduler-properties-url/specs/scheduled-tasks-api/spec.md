# Spec Delta

## REMOVED Requirements

### Requirement: Create scheduled task with validated chat_completion/dial-oauth body

**Reason**: The requirement made the BFF build `properties.url` (DIAL Core base URL + `/openai`) and send it to DIAL Scheduler, with two scenarios that pinned that URL. The BFF no longer sends `properties.url`. OpenSpec cannot drop scenarios from a MODIFIED block, so the requirement is replaced as a whole.
**Migration**: Replaced by "Create scheduled task with validated chat_completion body and no upstream url", which keeps all other create behaviour unchanged (validation, `service_id`, `target_type`, `api_version`, the fixed `properties` fields, `payload`, `description`, the 201 response and list-cache invalidation) and requires that `properties` has no `url`. No client-facing change: `CreateScheduledTaskBodyDto` and the response never carried `url`.

## ADDED Requirements

### Requirement: Create scheduled task with validated chat_completion body and no upstream url

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
- `api_version`: `DialClientService.dialApiVersion` (the same value `ChatService.sendCompletion` sends as `api-version`, backed by `DIAL_API_VERSION`, defaulting to `2024-10-21`)
- `create_conversation: true` — required for the Scheduler run to create a conversation under the reserved `.scheduler/{scheduleId}/{runId}/` path
- `extra_headers: {}` — fixed
- `retry: null` — fixed
- `timeout: null` — fixed
- `payload: { stream: true, messages: [{ role: "user", content: prompt, custom_content?: { skills: [{ url }] } }], model }` (the extension is present only with an effective skill) — `stream` is fixed (not client-controllable) and appears only inside `properties.payload`

and a top-level `description` field (mapped 1:1, never merged into `properties` or `properties.payload`) when provided. `properties` SHALL NOT contain a `url` field; the BFF does not choose the chat-completion target for DIAL Scheduler. On success it SHALL call `POST {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/`, return **201** with `CreatedScheduledTaskDto` (at least `id`, `displayName`, `trigger`), and invalidate that user's list cache.

#### Scenario: Valid create request succeeds

- **WHEN** a request with a valid `displayName`, one trigger variant, `model`, and `prompt` is submitted by an authenticated, feature-enabled user, and `SCHEDULER_SERVICE_ID` is configured with a given value
- **THEN** the response is `201 Created` with the created schedule's `id`, `displayName`, and `trigger`, and the upstream body sent included `service_id` equal to the configured `SCHEDULER_SERVICE_ID` value and `properties.target_type: "chat_completion"`

#### Scenario: Upstream properties include the fixed Scheduler call fields

- **WHEN** a valid create request is submitted
- **THEN** the upstream request body's `properties` includes `create_conversation: true`, `extra_headers: {}`, `retry: null`, and `timeout: null`, and `properties.payload` contains `stream: true`, `messages`, and `model`; `properties` itself has no `stream` key

#### Scenario: Upstream properties carry no url

- **WHEN** a valid create request is submitted with either a `date` or a `cron` trigger
- **THEN** the upstream `POST` request body's `properties` has no `url` key, while `target_type`, `api_version`, `create_conversation`, `extra_headers`, `retry`, `timeout`, and `payload` are still present

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

## MODIFIED Requirements

### Requirement: Update scheduled task

`PUT /api/v1/scheduled-tasks/:scheduleId` SHALL accept the same `UpdateScheduledTaskBodyDto` shape as create (`displayName`, `trigger`, `model`, `prompt`, optional array `skillUrls?: string[]`, optional `description` (≤500 chars); no client-supplied `service_id` or `stream`), apply the same server-side `service_id` (from `SCHEDULER_SERVICE_ID`)/`target_type`/`api_version`/`create_conversation`/`extra_headers`/`retry`/`timeout`/`payload` (including `properties.payload.stream: true`)/`description` construction as create, proxy `PUT {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/{scheduleId}` with the session bearer token, return `200 OK` with the updated `ScheduledTaskDto`, and invalidate that user's list cache on success.

#### Scenario: Valid update succeeds and invalidates list cache

- **WHEN** an authenticated, feature-enabled user submits a valid update body for an existing `scheduleId`
- **THEN** the response is `200 OK` with the updated schedule, and a subsequent `listScheduledTasks` call for that user does not return stale cached data

#### Scenario: Update carries the same fixed Scheduler call properties as create

- **WHEN** an authenticated, feature-enabled user submits a valid update body for an existing `scheduleId`
- **THEN** the upstream `PUT` request body's `properties` includes `create_conversation: true`, `extra_headers: {}`, `retry: null`, and `timeout: null`, with `stream: true` only inside `properties.payload`, matching the create request shape, and `service_id` equals the configured `SCHEDULER_SERVICE_ID` value

#### Scenario: Update body properties carry no url

- **WHEN** an authenticated, feature-enabled user submits a valid update body for an existing `scheduleId`, including one whose stored upstream schedule still has a `properties.url`
- **THEN** the upstream `PUT` request body's `properties` has no `url` key

#### Scenario: Update of unknown schedule id returns 404

- **WHEN** DIAL Core returns 404 for the given `scheduleId` on update
- **THEN** the response is `404 Not Found` and no cache invalidation occurs

#### Scenario: Invalid update body is rejected

- **WHEN** the update body fails the same validation as create (missing field, both/neither trigger variant, `description` over 500 characters, a client-supplied `service_id` and/or `stream` field, or a `target_type` other than `chat_completion` if present)
- **THEN** the response is `400 Bad Request`

Before validation the service SHALL resolve the effective skill from authoritative existing detail: omitted `skillUrls` preserves it; [] removes all skills; a nonempty array replaces the selection. Validate effective content and authoritative model support before any upstream mutation.

#### Scenario: Clearing the only content fails

- **WHEN** PUT removes a saved skill with `skillUrls: []` and leaves prompt empty/whitespace
- **THEN** the server returns typed 400 for missing instructions-or-skill and does not alter the saved task
