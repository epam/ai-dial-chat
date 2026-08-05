## 1. Env + domain scaffold

- [x] 1.1 Add `SCHEDULER_APP_ID` (`@IsOptional() @IsString()`) and `SCHEDULER_SERVICE_TIMEOUT_MS` (`@IsOptional() @IsInt() @Min(1000)`, default `10_000`) to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`; document both in `apps/chat-api/.env.template` and `apps/chat-api/README.md`.
- [x] 1.2 Create `apps/chat-api/src/scheduled-tasks/scheduled-tasks.module.ts` registering a `ScheduledTasksController` + `ScheduledTasksService`, and wire it into `AppModule`.
- [x] 1.3 Implement a private URL builder in `ScheduledTasksService` producing `` `${dialClient.baseUrl}/v1/deployments/applications/${encodeURIComponent(schedulerAppId)}/route/v1/schedules` `` (list/create) and the same with `/${scheduleId}` appended (get/update), reading `SCHEDULER_APP_ID` via `ConfigService<EnvironmentVariables>`.
- [x] 1.4 Add a guard clause that throws `ServiceUnavailableException` (with a message naming `SCHEDULER_APP_ID`) when the URL builder is invoked but the env var is unset; unit test both the configured and unconfigured paths.
- [x] 1.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 2. DTOs + snake_case mapper

- [x] 2.1 Create `apps/chat-api/src/scheduled-tasks/dto/scheduled-task.dto.ts` with `ScheduledTaskDto` (`id`, `displayName`, `trigger`), each field `@ApiProperty`-annotated.
- [x] 2.2 Create `apps/chat-api/src/scheduled-tasks/dto/create-scheduled-task.dto.ts` with `CreateScheduledTaskBodyDto` (`displayName: string`, `trigger: ScheduleTriggerDto`, `model: string`, `prompt: string`, `stream?: boolean`) and `ScheduleTriggerDto`/`ScheduleCronDto` nested classes with `class-validator` decorators enforcing exactly one of `date` (ISO 8601 string) or `cron.fields` (object of string fields), plus `CreatedScheduledTaskDto` for the 201 response.
- [x] 2.3 Create `apps/chat-api/src/scheduled-tasks/dto/update-scheduled-task.dto.ts` reusing the same body shape as create (`UpdateScheduledTaskBodyDto`) plus `UpdatedScheduledTaskDto`.
- [x] 2.4 Create `apps/chat-api/src/scheduled-tasks/dto/get-scheduled-task.dto.ts` with a `scheduleId` path param DTO validated by `@Matches(/^[A-Za-z0-9_-]{1,128}$/)`.
- [x] 2.5 Create `apps/chat-api/src/scheduled-tasks/dto/list-scheduled-tasks.dto.ts` with `ListScheduledTasksResponseDto` (`{ items: ScheduledTaskDto[] }`).
- [x] 2.6 Implement the camelCase→snake_case request mapper (`toUpstreamSchedulePayload`) and snake_case→camelCase response mapper (`fromUpstreamSchedule`) as pure functions in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`, fixing `service_id: 'dial-oauth'`, `properties.target_type: 'chat_completion'`, `properties.url` (from `DIAL_CORE_URL` + `/openai`), `properties.api_version` (from `DialClientService.dialApiVersion`), and `properties.payload.{messages,model,stream}`.
- [x] 2.7 Unit test the mappers: valid date-trigger and cron-trigger inputs produce the exact expected upstream body; a response missing optional fields still maps to a valid `ScheduledTaskDto`.
- [x] 2.8 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 3. Create endpoint

- [x] 3.1 Implement `ScheduledTasksService.createScheduledTask(userSub, accessToken, body)`: build the upstream payload via the mapper, raw-`fetch` `POST` with `AbortController`/`SCHEDULER_SERVICE_TIMEOUT_MS`, map non-2xx via `mapDialHttpStatus`/`handleDialFetchError`, invalidate `` `scheduled-tasks:list:${userSub}` `` on success, return `CreatedScheduledTaskDto`.
- [x] 3.2 Implement `ScheduledTasksController.createScheduledTask` (`@Post()`, `@HttpCode(201)`, `@Throttle`, full `@ApiOperation`/`@ApiBody`/`@ApiResponse` set per `apps/chat-api/AGENTS.md` conventions), gated by `@UseGuards(FeatureGuard)` + `@RequireFeature(FeatureKey.ScheduledTasksEnabled)`.
- [x] 3.3 Integration test (supertest) covering: 201 happy path (assert upstream fetch body matches the fixed `service_id`/`target_type` shape), 400 for missing field / both-or-neither trigger, 401 unauthenticated, 403 feature-disabled, 502 upstream 5xx, 503 upstream unreachable.
- [x] 3.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 4. Get endpoint

- [x] 4.1 Implement `ScheduledTasksService.getScheduledTask(userSub, accessToken, scheduleId)`: raw-`fetch` `GET` by id, map errors, return `ScheduledTaskDto` — no caching.
- [x] 4.2 Implement `ScheduledTasksController.getScheduledTask` (`@Get(':scheduleId')`, `@Throttle`, full Swagger annotations including 404).
- [x] 4.3 Integration test covering: 200 happy path, 400 for an invalid `scheduleId` (path-traversal-shaped input, asserting no upstream fetch occurs), 401, 403, 404 for unknown id, 502/503.
- [x] 4.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 5. Update endpoint

- [x] 5.1 Implement `ScheduledTasksService.updateScheduledTask(userSub, accessToken, scheduleId, body)`: same mapper/fetch/error-mapping discipline as create, `PUT` by id, invalidate the user's list cache only after a successful upstream response, return `UpdatedScheduledTaskDto`.
- [x] 5.2 Implement `ScheduledTasksController.updateScheduledTask` (`@Put(':scheduleId')`, `@HttpCode(200)`, `@Throttle`, full Swagger annotations).
- [x] 5.3 Integration test covering: 200 happy path + cache invalidation assertion, 400 invalid body, 400 invalid `scheduleId`, 401, 403, 404 unknown id (assert cache is NOT invalidated), 502/503.
- [x] 5.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 6. List endpoint

- [x] 6.1 Implement `ScheduledTasksService.listScheduledTasks(userSub, accessToken)` using `withCachedDialRequest` (key `` `scheduled-tasks:list:${userSub}` ``, 30s TTL), mapping each upstream item through `fromUpstreamSchedule` into `ListScheduledTasksResponseDto`.
- [x] 6.2 Implement `ScheduledTasksController.listScheduledTasks` (`@Get()`, `@Header('Cache-Control', 'private, max-age=30')`, `@Throttle`, full Swagger annotations).
- [x] 6.3 Integration test covering: 200 happy path, cache-hit-on-second-call assertion, cache invalidated after a create/update for the same user, 401, 403, 502/503.
- [x] 6.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 7. OpenAPI + frontend client contract

- [x] 7.1 Run `npm run openapi` to regenerate `@epam/chat-api-client`, confirm the four `scheduled-tasks` operations appear with the expected `operationId`s and typed (non-`void`/`any`) request/response models; run `npm run openapi:check`.
- [x] 7.2 Build and lint `chat-api-client` (per `openspec/config.yaml` task rules).
- [x] 7.3 Add a `scheduledTasksApi` singleton (using generated `ScheduledTasksApi`) to `apps/chat/src/server-api/api-client.ts`, following the existing `ApplicationsApi`/`ClientChannelApi` wiring pattern.
- [x] 7.4 Create `apps/chat/src/server-api/scheduled-tasks.api.ts` with thin wrapper functions (`listScheduledTasks`, `createScheduledTask`, `getScheduledTask`, `updateScheduledTask`) that call the singleton — no `fetch` calls, no business logic.
- [x] 7.5 Add a smoke test/typecheck confirming `scheduled-tasks.api.ts` compiles against the regenerated client (e.g. a `.spec.ts` that imports and type-checks the wrapper signatures).
- [x] 7.6 Run `npm exec nx build chat-api`, `npm exec nx test chat-api`, `npm exec nx lint chat-api`, and the frontend equivalents (`npm exec nx lint chat`, `npm exec nx test chat` if the smoke test lives there).
