## 1. Confirm upstream field

- [x] 1.1 Inspect a live `GET/POST {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/` response, or the scheduler's `openapi.json`, and confirm the upstream schedule object's description field name/casing (expected: top-level `description`). Record the confirmed name in the mapper code comment if it differs from the assumption in design.md. **No live scheduler/openapi.json access in this environment — proceeding with the documented top-level `description` assumption; flagged with a code comment for follow-up verification.**

## 2. BFF DTOs and validation

- [x] 2.1 Add optional `description?: string` to `CreateScheduledTaskBodyDto` (`apps/chat-api/src/scheduled-tasks/dto/create-scheduled-task.dto.ts`) with `@ApiPropertyOptional`, `@IsOptional()`, `@IsString()`, `@MaxLength(500)`.
- [x] 2.2 Add the same optional `description` field to `UpdateScheduledTaskBodyDto` (`apps/chat-api/src/scheduled-tasks/dto/update-scheduled-task.dto.ts`). (Inherited via `extends CreateScheduledTaskBodyDto`.)
- [x] 2.3 Add optional `description?: string` to `ScheduledTaskDto` (`apps/chat-api/src/scheduled-tasks/dto/scheduled-task.dto.ts`) with `@ApiPropertyOptional`, `@IsOptional()`, `@IsString()`.

## 3. BFF mapper and service

- [x] 3.1 In `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`, extend `UpstreamSchedulePayload` and `UpstreamScheduleResponse` with the confirmed upstream `description` field.
- [x] 3.2 Update `toUpstreamSchedulePayload` to include `description` at the top level (not inside `properties`) only when `body.description` is present and non-empty.
- [x] 3.3 Update `fromUpstreamSchedule` to map the upstream description field to `ScheduledTaskDto.description`, defaulting to `undefined` when absent.
- [x] 3.4 Add/extend unit tests in `apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.mapper.spec.ts`: description round-trips through create/update payload building; missing description does not throw and maps to `undefined`; description is never present under `properties`.
- [x] 3.5 Add/extend controller or service tests covering: 400 when `description` exceeds 500 characters on create and on update; 201/200 success with description present and with description omitted.

## 4. OpenAPI regeneration

- [x] 4.1 Run `npm run openapi` to regenerate the OpenAPI spec and `@epam/chat-api-client`.
- [x] 4.2 Run `npm run openapi:check` and fix any drift.
- [x] 4.3 Build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`) to confirm the regenerated client compiles cleanly.

## 5. i18n keys

- [x] 5.1 Add `scheduledTasks.create.descriptionLabel` and `scheduledTasks.create.descriptionMaxLengthError` (or equivalent) to `apps/chat/src/i18n/locales/en.json` under the existing `scheduledTasks.create` namespace.
- [x] 5.2 Add the corresponding members to `ScheduledTasksI18nKeys` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 5.3 Mirror the new keys into any other locale files already present under `apps/chat/src/i18n/locales/`. (`en.json` is the only locale file present — nothing to mirror.)

## 6. Create form (libs/scheduled-tasks)

- [x] 6.1 Add an optional **Description** textarea to `ScheduledTaskCreateForm` (`libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx`), reading `values.description`/`errors.description`, positioned between Display name and Schedule type.
- [x] 6.2 Set `maxLength={500}` on the textarea and render accessible feedback (character count or validation message) when the field is non-empty, following an existing textarea/counter pattern in the repo if one exists.
- [x] 6.3 Confirm `description` is excluded from the Create-button required-field guard (only `displayName`/`modelId`/`prompt` gate it).
- [x] 6.4 Update/extend `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskCreateForm.spec.tsx`: renders description field; empty description does not block submit; description respects `maxLength`; no host/integration imports introduced (library isolation check).

## 7. Create page wiring

- [x] 7.1 In `ScheduledTaskCreatePage`, add `description` to form `values`/`errors` state and wire `onFieldChange`.
- [x] 7.2 Add client-side validation: reject `description` longer than 500 characters, surfacing `scheduledTasks.create.descriptionMaxLengthError` and blocking submit.
- [x] 7.3 On submit, trim `description` and include it in the `POST` body only when non-empty; omit the key entirely otherwise (never send an empty string).
- [x] 7.4 Update `ScheduledTaskCreatePage` tests: description included when non-empty; omitted when empty; over-limit input blocks submit with no network call; input preserved (including description) after a failed submit (existing failure test already asserts `displayName` preservation; description flows through the same `values` state, no separate assertion needed).

## 8. List mapping and cards

- [x] 8.1 In `apps/chat/src/utils/map-scheduled-task-dto.ts`, add `descriptionPreview: task.description` to the object returned by `mapScheduledTaskDtoToItem`.
- [x] 8.2 Update `apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts`: description maps to `descriptionPreview` unmodified; missing description maps to `undefined` without throwing.
- [x] 8.3 Manually verify `ScheduledTaskCard` still renders `descriptionPreview` correctly (existing line-clamp/ellipsis behavior) with a longer (close to 500-char) description. (Verified by reading `ScheduledTaskCard.tsx`: `descriptionPreview` rendering is unchanged by this task, and its existing tests in `ScheduledTaskCard.spec.tsx` already cover the render path — no code change touches that component.)

## 9. Verification

- [x] 9.1 Run `npm exec nx test chat-api chat @epam/ai-dial-scheduled-tasks`. (53 + 1753 + 28 tests pass.)
- [x] 9.2 Run `npm exec nx lint chat-api chat @epam/ai-dial-scheduled-tasks`. (0 errors; pre-existing warnings only, all in unrelated files.)
- [x] 9.3 Manual check: create a task with a description ≤500 chars → card shows the description on the list; search by a description substring matches it; submitting 501+ chars is blocked client-side, and (if forced via direct API call) rejected with 400 server-side. **Not run in this session — no way to launch/browse the app here.** Covered instead by automated tests: client-side block (`ScheduledTaskCreatePage.spec.tsx`), server-side 400 (`scheduled-tasks.controller.spec.ts`), and mapper→card wiring (`map-scheduled-task-dto.spec.ts`, existing `ScheduledTaskCard.spec.tsx`/search tests unaffected). Recommend a manual pass before merge.
