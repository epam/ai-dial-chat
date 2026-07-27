## Why

Scheduled Task cards already render an optional `descriptionPreview`, and the client-side search already matches it, but nothing in the BFF or create flow lets a user set one — `map-scheduled-task-dto.ts` has no `description` field to map from, and the create form is currently speced to explicitly not collect one. Users need a short human-readable summary on a task, distinct from the LLM `prompt` sent to the model.

## What Changes

- Add an optional `description` field (max 500 characters) to the BFF create/update request DTOs and the `ScheduledTaskDto` response, mapped to/from the upstream DIAL Scheduler `description` field.
- **Reverse** the current create-form requirement that explicitly forbids a description field: add an optional, max-500-character Description textarea to `ScheduledTaskCreateForm` and include it in the create submit body when non-empty.
- Map the BFF `description` onto `ScheduledTaskItem.descriptionPreview` in `map-scheduled-task-dto.ts` so cards display it and search matches it (both already speced/implemented on the card/search side, only the mapper input is missing).
- No new capability: all three deltas are MODIFIED requirements on existing specs.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `scheduled-tasks-api`: `CreateScheduledTaskBodyDto`, `UpdateScheduledTaskBodyDto`, and `ScheduledTaskDto` gain an optional `description` (≤500 chars), mapped to/from the upstream schedule's `description` field.
- `scheduled-task-create-form`: `ScheduledTaskCreateForm` gains an optional Description field (≤500 chars); the prior "MUST NOT render a description field" requirement is replaced.
- `scheduled-tasks-page-ui`: `map-scheduled-task-dto.ts` maps `ScheduledTaskDto.description` → `ScheduledTaskItem.descriptionPreview`.

## Impact

- **Backend:** `apps/chat-api/src/scheduled-tasks/dto/{create-scheduled-task,update-scheduled-task,scheduled-task}.dto.ts`, `apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts` (upstream request/response mapping), their `.spec.ts` files, regenerated OpenAPI + `@epam/chat-api-client`.
- **Frontend lib:** `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx` and its tests.
- **Frontend app:** `ScheduledTaskCreatePage` (validation, submit body), `apps/chat/src/utils/map-scheduled-task-dto.ts` and its tests, new i18n keys in `apps/chat/src/i18n/locales/en.json` + `ScheduledTasksI18nKeys`.
- **Prerequisite:** confirm the upstream DIAL Scheduler `description` field name and its presence on list/get responses (live request or scheduler `openapi.json`) before finalizing the service-layer mapping.
