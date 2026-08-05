## 1. Backend mapper

- [x] 1.1 Add `buildScheduledTaskChatCompletionUrl(baseUrl: string): string` helper in `scheduled-tasks.mapper.ts` that strips a trailing slash from `baseUrl` and appends `/openai`
- [x] 1.2 Update the `UpstreamSchedulePayload` interface: move `stream` out of `properties.payload` into `properties` (fixed `false`), add `create_conversation: true`, `extra_headers: {}`, `retry: null`, `timeout: null` to `properties`
- [x] 1.3 Update `toUpstreamSchedulePayload` to use the new URL helper and emit the full fixed `properties` shape; remove `body.stream` usage entirely

## 2. Backend DTOs and validation

- [x] 2.1 Remove the `stream` field (and its `@ApiPropertyOptional`/`@IsOptional`/`@IsBoolean` decorators) from `CreateScheduledTaskBodyDto`
- [x] 2.2 Confirm `UpdateScheduledTaskBodyDto` (extends create DTO) has no leftover `stream` reference
- [x] 2.3 Verify the global `ValidationPipe`'s `forbidNonWhitelisted: true` rejects a request body that still includes `stream` (covered by a controller/e2e test, not new pipe config)

## 3. Backend tests

- [x] 3.1 Update `scheduled-tasks.mapper.spec.ts`: replace the hardcoded `'2025-01-01-preview'` fixture with a value matching `DialClientService`'s `DIAL_API_VERSION` default (`2024-10-21`) or a clearly-labeled placeholder; assert the full `properties` object (`create_conversation`, `stream: false`, `extra_headers: {}`, `retry: null`, `timeout: null`, `payload` without `stream`)
- [x] 3.2 Add mapper unit tests for `buildScheduledTaskChatCompletionUrl` with `http://core`, `http://core/`, and `http://core/openai` inputs
- [x] 3.3 Update `scheduled-tasks.service.spec.ts` / `scheduled-tasks.controller.spec.ts` to assert the upstream `POST`/`PUT` fetch body includes the fixed properties and that a client-supplied `stream` field is rejected with `400`

## 4. OpenAPI and generated client

- [x] 4.1 Run `npm run openapi` to regenerate the OpenAPI spec from the updated DTOs
- [x] 4.2 Run `npm run openapi:check` to confirm no drift
- [x] 4.3 Rebuild/lint `@epam/chat-api-client` (`libs/chat-api-client`) so the generated `CreateScheduledTaskBodyDto`/`UpdateScheduledTaskBodyDto` types drop `stream`

## 5. Frontend form and page cleanup

- [x] 5.1 Remove `stream` from `ScheduledTaskCreateFormValues` in `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts`
- [x] 5.2 Remove the `stream` doc-comment reference in `ScheduledTaskCreateForm.tsx`'s component-level comment (Configuration section no longer mentions a stream toggle)
- [x] 5.3 Remove `stream: true` from `DEFAULT_VALUES` in `apps/chat/src/pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage.tsx`
- [x] 5.4 Remove `stream: values.stream` from `mapFormValuesToCreateBody` in `apps/chat/src/utils/scheduled-task-trigger.ts`
- [x] 5.5 Update `ScheduledTaskCreateForm.spec.tsx`, `ScheduledTaskCreatePage.spec.tsx`, and `scheduled-task-trigger.spec.ts` to drop `stream` from test fixtures and assertions (`ScheduledTaskCreatePage.spec.tsx` had no `stream` fixture to begin with)

## 6. Spec docs

- [x] 6.1 Apply the `scheduled-tasks-api` delta from this change onto `openspec/specs/scheduled-tasks-api/spec.md` (Create/Update requirements)
- [x] 6.2 Apply the `scheduled-task-create-form` delta from this change onto `openspec/specs/scheduled-task-create-form/spec.md`

## 7. Verification

- [x] 7.1 `npm exec nx test chat-api` (1718 tests pass)
- [x] 7.2 `npm exec nx test @epam/ai-dial-scheduled-tasks` (65 tests pass)
- [x] 7.3 `npm exec nx test chat` (2065 tests pass)
- [x] 7.4 `npx nx run-many -t lint -p @epam/chat-api @epam/ai-dial-scheduled-tasks chat` (0 errors, 2 pre-existing unrelated warnings)
- [ ] 7.5 Manual: create a scheduled task locally, inspect the debug-logged upstream POST body, confirm `properties.url` = `DIAL_CORE_URL` + `/openai`, `properties.api_version` matches the interactive chat completion call, `create_conversation: true`, `stream: false`, `extra_headers: {}`, `retry: null`, `timeout: null`
- [ ] 7.6 Manual: trigger a scheduled run and confirm it creates a conversation under `conversations/{bucket}/.scheduler/{scheduleId}/{runId}/...`
- [ ] 7.7 Manual: update an existing task and confirm the `PUT` body carries the same fixed `properties` fields
- [ ] 7.8 Manual: confirm the create form no longer references a stream toggle in the UI
