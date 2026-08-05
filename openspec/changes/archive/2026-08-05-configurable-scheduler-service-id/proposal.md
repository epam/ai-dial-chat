## Why

`toUpstreamSchedulePayload` in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts` always sends `service_id: 'dial-oauth'` to the DIAL Scheduler on create/update. Deployments may register the scheduler's OAuth integration under a different external-service id, so this value must become environment-configurable — following the same pattern as `SCHEDULER_APP_ID` — instead of being hardcoded.

## What Changes

- Add a new optional environment variable `SCHEDULER_SERVICE_ID` to `EnvironmentVariables`.
- `ScheduledTasksService` reads `SCHEDULER_SERVICE_ID` at construction (alongside `SCHEDULER_APP_ID`) and validates it is present before any create/update upstream call, failing fast with `503 Service Unavailable` when missing (mirroring the existing `SCHEDULER_APP_ID` guard).
- `toUpstreamSchedulePayload` gains a 4th parameter (`serviceId: string`) and no longer hardcodes `'dial-oauth'`; `UpstreamSchedulePayload.service_id` becomes `string` instead of the `'dial-oauth'` literal type.
- Document `SCHEDULER_SERVICE_ID` in `apps/chat-api/README.md` and `apps/chat-api/.env.template` next to `SCHEDULER_APP_ID`.
- Update `scheduled-tasks-api` spec requirements and controller/OpenAPI descriptions that currently state a fixed `dial-oauth` value.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scheduled-tasks-api`: create/update requirements no longer state a fixed `service_id: "dial-oauth"`; the service instead sets `service_id` from `SCHEDULER_SERVICE_ID` read once at construction. Adds a new configuration requirement (`SCHEDULER_SERVICE_ID`) alongside the existing `SCHEDULER_APP_ID` one, including the same fail-fast-with-503 behavior when either is missing.

## Impact

- `apps/chat-api/src/config/environment.config.ts` — new `SCHEDULER_SERVICE_ID` field.
- `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts` — drop hardcoded `service_id`, accept it as a parameter.
- `apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts` — read/guard `SCHEDULER_SERVICE_ID`, pass it into the mapper on create and update.
- `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts` — update OpenAPI descriptions mentioning hardcoded `dial-oauth`.
- `apps/chat-api/README.md`, `apps/chat-api/.env.template` — document the new variable.
- Tests: `scheduled-tasks.mapper.spec.ts`, `scheduled-tasks.service.spec.ts`, and any integration/controller tests asserting `service_id: 'dial-oauth'`.
- No frontend changes; no changes to `SCHEDULER_APP_ID` semantics or `target_type`.
