# Proposal

## Why

See #10049: the DIAL Scheduler backend now sets the chat-completion target URL itself, so the BFF must not send `properties.url`.

Today the BFF injects `properties.url = ${DIAL_CORE_URL}/openai` into every Scheduler create/update body. Neither the BFF's public contract nor the frontend uses this field: the BFF adds it on its own. This change reverses the decision recorded in `openspec/changes/archive/2026-08-05-fix-scheduler-chat-completion-payload/design.md`.

## Problem

`toUpstreamSchedulePayload` in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts` always builds `properties.url` from `DialClientService.baseUrl`. `ScheduledTasksService.createScheduledTask` (POST `.../route/v1/schedules/`) and `updateScheduledTask` (PUT `.../schedules/{scheduleId}`) both forward it to DIAL Scheduler. The mapper's `dialCoreUrl` parameter and the `buildScheduledTaskChatCompletionUrl` helper exist only to produce this field.

## Solution / What Changes

- Stop sending `properties.url` in the create (POST) and update (PUT) bodies sent to DIAL Scheduler.
- Remove `url` from the upstream payload type, delete `buildScheduledTaskChatCompletionUrl`, and drop the `dialCoreUrl` parameter from `toUpstreamSchedulePayload`. The new signature is `(body, dialApiVersion, serviceId)`.
- Update both service call sites. `DialClientService.baseUrl` is still used for the Scheduler route calls, and `DIAL_CORE_URL` stays.
- Leave every other upstream field as it is: `target_type`, `api_version`, `create_conversation`, `extra_headers`, `retry`, `timeout`, `payload`, `service_id`, `timezone`, `description`.
- Update the mapper, controller and service unit tests. Add explicit assertions that `properties` has no `url` in both the create and the update body.

This is not breaking for BFF clients: the public request and response DTOs, OpenAPI, the generated client and the UI do not change. For DIAL Scheduler, the upstream body changes (one field fewer).

## Non-goals

- No change to `api_version`, `target_type`, `service_id`, trigger/timezone/skills mapping or DTO validation.
- No change to list/get/runs/pause/resume/delete/start, the frontend, `libs/*`, env vars or OpenAPI.
- No fallback that adds `url` back if Scheduler rejects the body.

## Alternatives considered

Keep `url` but make it configurable (a new env var). Rejected: it adds config surface for a field the BFF should not own. It is also not in the scope requested.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `scheduled-tasks-api`: the create and update requirements no longer build or send `properties.url`. Both now state that `properties` SHALL NOT contain `url`.

## Impact

- Code: `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts` and `apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`. Tests in `apps/chat-api/src/scheduled-tasks/tests/` (`scheduled-tasks.mapper.spec.ts`, `scheduled-tasks.controller.spec.ts`, `scheduled-tasks.service.spec.ts`).
- Spec: `openspec/specs/scheduled-tasks-api/spec.md`, through the delta.
- Shared libs, global providers and frontend: none. No scope creep into `libs/*`.
- i18n: no new user-visible strings.
- Docs: `docs/` and `apps/chat-api/README.md` do not mention `properties.url`, so no doc update is needed.
- Upstream: existing schedules already store `properties.url` in DIAL Scheduler. Whether a PUT without `url` is accepted must be checked on a live Scheduler (see design.md).

## Acceptance criteria

- Create and update bodies sent to DIAL Scheduler have no `properties.url`, and unit tests assert this for both POST and PUT.
- All other `properties` fields and top-level fields are unchanged, and the existing tests still pass.
- `buildScheduledTaskChatCompletionUrl` no longer exists, and the main spec no longer references it.
- `npm exec nx test chat-api`, `npm exec nx lint chat-api` and `npm run validate:specs` pass. `npm run openapi && npm run openapi:check` shows no contract diff.

## Rollback

Revert the commit. The field is computed only from existing config (`DIAL_CORE_URL`), so no data migration is needed in either direction.
