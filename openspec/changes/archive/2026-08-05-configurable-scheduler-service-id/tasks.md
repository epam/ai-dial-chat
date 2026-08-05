## 1. Configuration

- [x] 1.1 Add `SCHEDULER_SERVICE_ID?: string` (`@IsOptional() @IsString()`) to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`, next to `SCHEDULER_APP_ID`.
- [x] 1.2 Document `SCHEDULER_SERVICE_ID` in `apps/chat-api/README.md` and `apps/chat-api/.env.template`, alongside `SCHEDULER_APP_ID`.

## 2. Mapper

- [x] 2.1 In `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`, change `UpstreamSchedulePayload.service_id` from the literal type `'dial-oauth'` to `string`.
- [x] 2.2 Add a 4th parameter `serviceId: string` to `toUpstreamSchedulePayload` and use it in place of the hardcoded `'dial-oauth'` literal.

## 3. Service

- [x] 3.1 In `ScheduledTasksService`, read `SCHEDULER_SERVICE_ID` via `configService.get('SCHEDULER_SERVICE_ID', { infer: true })` in the constructor and store it alongside `schedulerAppId`.
- [x] 3.2 Add a private `getSchedulerServiceId(): string` guard mirroring `getSchedulerAppId()` — logs and throws `ServiceUnavailableException` with a message identifying `SCHEDULER_SERVICE_ID` as missing when unset.
- [x] 3.3 Update `createScheduledTask` to call `this.getSchedulerServiceId()` and pass the result as the 4th argument to `toUpstreamSchedulePayload`.
- [x] 3.4 Update `updateScheduledTask` to do the same.
- [x] 3.5 Confirm `listScheduledTasks` and `getScheduledTask` are unaffected (no call to `getSchedulerServiceId()` needed there).

## 4. Controller / OpenAPI

- [x] 4.1 Update `@ApiOperation`/`@ApiResponse` descriptions in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts` that mention hardcoded `dial-oauth` credentials to instead describe the configured OAuth external-service id (`SCHEDULER_SERVICE_ID`).

## 5. Tests

- [x] 5.1 Update `scheduled-tasks.mapper.spec.ts`: pass a test `serviceId` (e.g. `'my-oauth-service'`) into `toUpstreamSchedulePayload` and assert the upstream payload's `service_id` equals it, replacing any assertion hardcoded to `'dial-oauth'`.
- [x] 5.2 Update `scheduled-tasks.service.spec.ts`: assert `createScheduledTask`/`updateScheduledTask` upstream request bodies use the configured `SCHEDULER_SERVICE_ID`; add a test asserting `503 Service Unavailable` on create/update when `SCHEDULER_SERVICE_ID` is unset (mirroring the existing `SCHEDULER_APP_ID` missing-config test); add a test asserting list/get are unaffected by a missing `SCHEDULER_SERVICE_ID`.
- [x] 5.3 Update any controller/integration tests asserting `service_id: 'dial-oauth'` in upstream request bodies to use the configured test value instead.

## 6. Spec sync

- [x] 6.1 After implementation, verify the `scheduled-tasks-api` spec delta in this change accurately reflects final behavior (no drift between code and spec) before archiving.

## 7. Verification

- [x] 7.1 Run `npm exec nx test chat-api` and confirm all scheduled-tasks tests pass.
- [x] 7.2 Run `npm exec nx lint chat-api`.
- [x] 7.3 Manually verify: set `SCHEDULER_SERVICE_ID=my-oauth-service`, create a task, confirm upstream POST body has `"service_id": "my-oauth-service"`.
- [x] 7.4 Manually verify: unset `SCHEDULER_SERVICE_ID` with the feature enabled, confirm `503` on create/update scheduled-tasks endpoints.
- [x] 7.5 Manually verify: update an existing task, confirm the upstream PUT body uses the same configured `service_id`.
