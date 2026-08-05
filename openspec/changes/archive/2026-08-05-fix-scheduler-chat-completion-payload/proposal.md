## Why

Scheduled task runs invoke DIAL Core chat completion through the upstream DIAL Scheduler `properties` object built by `toUpstreamSchedulePayload` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`). That object is missing fields the Scheduler team requires for a background run to succeed and persist correctly: `create_conversation: true` (needed to create the conversation under the reserved `.scheduler/{scheduleId}/{runId}/` path), and the fixed `extra_headers`/`retry`/`timeout` properties. It also nests `stream` inside `properties.payload` and lets the client default it to `true`, when Scheduler expects a top-level `properties.stream: false` for every background run. Without this fix, scheduled runs likely fail to create a conversation, or the Scheduler rejects/mishandles the call shape.

## What Changes

- `toUpstreamSchedulePayload` now emits the full `properties` object the Scheduler API expects: `target_type`, `url`, `api_version`, `create_conversation: true`, `stream: false`, `extra_headers: {}`, `retry: null`, `timeout: null`, and `payload: { messages, model }` (no `stream` inside `payload`).
- URL construction is extracted into a small pure helper that normalizes `DialClientService.baseUrl` (strips trailing slashes, appends `/openai`) instead of naive string concatenation, with unit tests for bare/trailing-slash inputs.
- `api_version` continues to come from `DialClientService.dialApiVersion` (`DIAL_API_VERSION` env, default `2024-10-21`) — the same source `ChatService.sendCompletion` uses. Mapper tests stop using a stale hardcoded preview version string unrelated to that default.
- **BREAKING (internal contract)**: `stream` is removed from `CreateScheduledTaskBodyDto` / `UpdateScheduledTaskBodyDto` (public BFF request body) and from the OpenAPI schema / regenerated `@epam/chat-api-client`. The server always sends `properties.stream: false` upstream; clients can no longer override it.
- The scheduled task create form (`libs/scheduled-tasks`, `ScheduledTaskCreatePage`) drops the `stream` form field/value and its submit mapping. No visible toggle currently renders `stream` in the UI, so this is a values/props/mapping cleanup, not a rendered-control removal.
- `openspec/specs/scheduled-tasks-api/spec.md` and `openspec/specs/scheduled-task-create-form/spec.md` are updated to drop client-controlled `stream` and document the fixed server-side call properties.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scheduled-tasks-api`: the "Create scheduled task" and "Update scheduled task" requirements change — upstream `properties` gains `create_conversation`, `stream` (moved out of `payload`, fixed to `false`), `extra_headers`, `retry`, `timeout`; `stream` is removed from the request DTOs.
- `scheduled-task-create-form`: the submit-body requirement and the Configuration section's field list drop `stream` — the create form no longer sends or displays a stream option.

## Impact

- `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts` (+ new URL-building helper), `scheduled-tasks.mapper.spec.ts`
- `apps/chat-api/src/scheduled-tasks/dto/create-scheduled-task.dto.ts`, `update-scheduled-task.dto.ts`, `scheduled-tasks.service.spec.ts`, `scheduled-tasks.controller.spec.ts`
- OpenAPI spec + regenerated `@epam/chat-api-client`
- `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts`, `ScheduledTaskCreateForm.tsx` (+ spec), `apps/chat/src/pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage.tsx` (+ spec), `apps/chat/src/utils/scheduled-task-trigger.ts` (+ spec)
- `openspec/specs/scheduled-tasks-api/spec.md`, `openspec/specs/scheduled-task-create-form/spec.md`
