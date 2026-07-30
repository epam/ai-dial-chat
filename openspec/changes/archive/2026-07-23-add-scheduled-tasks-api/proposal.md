## Why

The Scheduled Tasks UI shell (`scheduled-tasks-page-ui`) renders a header, toolbar, and a permanent empty state because there is no backend behind it — the frontend has no BFF endpoint that can list, create, fetch, or update DIAL Scheduler schedules. The Scheduler's routed-deployment API is upstream, snake_case, and requires a session bearer token the browser must never see directly; a NestJS BFF layer is needed before the UI can move past its shell.

## What Changes

- Add a new `scheduled-tasks` domain to `apps/chat-api` with four URI-versioned, feature-gated BFF endpoints that proxy the DIAL Scheduler routed-deployment API:
  - `GET /api/v1/scheduled-tasks` (list)
  - `POST /api/v1/scheduled-tasks` (create)
  - `GET /api/v1/scheduled-tasks/:scheduleId` (get)
  - `PUT /api/v1/scheduled-tasks/:scheduleId` (update)
- Add required env var `SCHEDULER_APP_ID` to `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`), used to build the upstream routed-deployment URL `${DIAL_CORE_URL}/v1/deployments/applications/${SCHEDULER_APP_ID}/route/v1/schedules[/{scheduleId}]`.
- Introduce camelCase BFF DTOs (`ScheduledTaskDto`, `CreateScheduledTaskBodyDto`, `UpdateScheduledTaskBodyDto`, `ListScheduledTasksResponseDto`) that map to/from the upstream snake_case `chat_completion` / `dial-oauth` schedule shape; the service fixes `service_id`, `properties.target_type`, `properties.url`, and `properties.api_version` server-side and rejects any other `target_type`/`service_id` with `400`.
- Add a short-TTL cache for the list endpoint (`scheduled-tasks:list:{userSub}`, ~30s), invalidated on create/update success, mirroring `ApplicationsService`.
- Use raw `fetch` against `DialClientService.baseUrl` for all four calls (documented SDK gap — `@epam/ai-dial-typescript-sdk` has no scheduler operations), with `AbortController`-based timeout and the shared `mapDialHttpStatus`/`handleDialFetchError` error mapping.
- Regenerate `@epam/chat-api-client` (`npm run openapi` + `npm run openapi:check`) and add app-edge wrappers: `apps/chat/src/server-api/scheduled-tasks.api.ts` plus a singleton entry in `apps/chat/src/server-api/api-client.ts`. No list-page or edit UI in this change — the companion change `add-scheduled-task-create-form` consumes `POST /api/v1/scheduled-tasks` for create-form submit.

## Capabilities

### New Capabilities

- `scheduled-tasks-api`: BFF REST endpoints (list/create/get/update) that proxy the DIAL Scheduler routed-deployment API, including request/response DTO mapping, feature gating, caching, error handling, and the generated-client + `server-api` wrapper contract consumed by the frontend.

### Modified Capabilities

(none — the existing `scheduled-tasks-page-ui` capability's requirements are unchanged; it already tolerates an empty backend, and this change adds a backend without altering that spec's UI-shell requirements)

## Impact

- **Affected code**: new `apps/chat-api/src/scheduled-tasks/` domain (controller, service, module, DTOs, tests); `apps/chat-api/src/config/environment.config.ts` (new `SCHEDULER_APP_ID` var); `libs/chat-api-client` generated sources (regenerated); `apps/chat/src/server-api/api-client.ts` and new `apps/chat/src/server-api/scheduled-tasks.api.ts`.
- **APIs**: 4 new versioned business endpoints under `/api/v1/scheduled-tasks*`; no changes to existing endpoints.
- **Dependencies**: none new — uses existing `@nestjs/cache-manager`, `class-validator`, `@nestjs/swagger`, `@nestjs/throttler`, and raw `fetch`.
- **Config/ops**: deployments must set `SCHEDULER_APP_ID` before enabling `features.scheduledTasksEnabled` in any environment that wants working (non-empty) Scheduled Tasks data.
- **Out of scope**: pause/resume/runs endpoints, delete, credentials sign-in/OBO flow, `rest`/`responses` target types, `dial-api-key` service id, list cards, and edit UI — tracked as follow-up changes. **In scope for consumers:** `add-scheduled-task-create-form` depends on this change's `POST` endpoint + `scheduled-tasks.api.ts` wrapper only.
