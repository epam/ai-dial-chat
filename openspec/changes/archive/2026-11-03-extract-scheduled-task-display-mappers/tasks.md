Slicing strategy: **risk-first, then vertical**. The risk is behaviour drift, so slice 1 proves the lib adapters reproduce today's output under the moved tests before any app file changes. Slice 2 rewires the app adapters, and slice 3 closes docs and specs.

## 1. Lib adapters with the moved characterization tests

- [x] 1.1 Create `libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts`. Port the logic from `apps/chat/src/utils/map-scheduled-task-dto.ts` and `apps/chat/src/utils/map-scheduled-task-run-dto.ts` into these exports:
  - `formatScheduledTaskScheduleLabel`, `toScheduledTaskItem` / `toScheduledTaskItems`;
  - `formatScheduledTaskRunDuration`, `formatScheduledTaskRunTimestamp`, `toScheduledTaskRunItem` / `toScheduledTaskRunItems`;
  - `classifyScheduledTaskDeleteError` with the `ScheduledTaskDeleteErrorKind` string enum, and `selectScheduledTaskErrorMessage`;
  - the `ScheduledTaskScheduleLabels`, `ScheduledTaskRunDurationLabels` and `ScheduledTaskRunTimestampLabels` interfaces.

  Implementation constraints:
  - Use const arrow functions, with a JSDoc on every export and every interface field that states its default.
  - Keep relative imports extensionless.
  - Build the upstream-status mapping inside `toScheduledTaskRunItem` as a `switch` (design D6), not a module-level `Record`.
  - Default `timeZone` to the browser's, `locale` to `undefined` and `now` to `new Date()` (design D2).
- [x] 1.2 Export the module from `libs/chat-hooks/src/index.ts` and from `libs/chat-hooks/src/entry-points/scheduled-tasks.ts`.
- [x] 1.3 Create `libs/chat-hooks/src/scheduled-task/tests/scheduled-task-display.spec.ts`.
  - Move the DTO-driven `describe` blocks from `apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts` and `apps/chat/src/utils/tests/map-scheduled-task-run-dto.spec.ts`: trigger kinds, the timezone conversion cases, field pass-through, status mapping, unread resolution, duration units, today/other-day, delete-status classification and error-message precedence.
  - Replace `fakeT` with a local fake formatter object that echoes its arguments.
  - Keep each `expect` asserting the same outcome.
  - Add the spec scenarios not covered today: an unknown run status maps to `Missed`; a test that mocks `@epam/ai-dial-scheduled-tasks` without `ScheduledTaskRunStatus` still imports the module.
- [x] 1.4 Architecture guard. Confirm `scheduled-task-display.ts` contains none of:
  - an `i18next` / `react-i18next` import, a `TFunction` type or a `scheduledTasks.` key string;
  - an `apps/` import, a `server-api` import or a route;
  - a storage, context, env or feature-flag read;
  - a generated-client instance.

  It imports only api-client DTO types and enums, `@epam/ai-dial-scheduled-tasks` items and `ScheduledTaskRunStatus`, `describeScheduledTaskTrigger` and `ApiErrorDetails`.

**Verification**
- `npm run test:file -- libs/chat-hooks/src/scheduled-task/tests/scheduled-task-display.spec.ts`
- `npm exec nx -- run-many -t lint typecheck -p @epam/ai-dial-chat-hooks`
- `npm run verify:changed`

## 2. App adapters delegate to the lib

- [x] 2.1 Rewrite `apps/chat/src/utils/map-scheduled-task-dto.ts` as an adapter.
  - Keep `buildScheduleLabel`, `mapScheduledTaskDtoToItem`, `mapScheduledTaskDtosToItems`, `getDeleteErrorMessageKey` and `resolveScheduledTaskErrorMessage` with their current signatures.
  - Add a local `buildScheduleLabels(t)` that builds `ScheduledTaskScheduleLabels` from the same `ScheduledTasksI18nKeys` and interpolation options used today.
  - Make `getDeleteErrorMessageKey` a `switch` over `ScheduledTaskDeleteErrorKind`.
  - Make `resolveScheduledTaskErrorMessage` pass `t(ToolsetSigninI18nKeys.AdminConsentRequired)` and `t(fallbackKey)`.
  - Merge the new names into the file's existing `@epam/ai-dial-chat-hooks/scheduled-tasks` import.
- [x] 2.2 Rewrite `apps/chat/src/utils/map-scheduled-task-run-dto.ts` as an adapter.
  - Keep `formatRunDuration`, `formatRunTimestamp`, `findMatchingConversation`, `mapScheduledTaskRunDtoToItem` and `mapScheduledTaskRunDtosToItems` with their current signatures.
  - Add local `buildRunDurationLabels(t)` / `buildRunTimestampLabels(t)` helpers.
  - Pass the app's `conversationIdsMatch` from `apps/chat/src/utils/conversation-id-match.ts`.
- [x] 2.3 Trim `apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts` and `apps/chat/src/utils/tests/map-scheduled-task-run-dto.spec.ts` to wiring cases. Use a recording `t` and cover:
  - one task per trigger kind;
  - one run per duration shape (`0`, `45`, `61`, `3605`);
  - today and another day;
  - each delete kind and each error-message branch.

  Each case asserts the exact keys, options and returned strings.
- [x] 2.4 Confirm no call site changed. Grep for `map-scheduled-task-dto` and `map-scheduled-task-run-dto` under `apps/chat/src`; the importers are `ScheduledTasksPage`, `ScheduledTaskDetailPage`, `TaskHistorySection`, `ScheduledTaskConversationBanner` and `useScheduledTaskSubmit`. Confirm `apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTaskSubmit.spec.tsx`'s module mock still matches the export names.

**Verification**
- `npm run test:file -- apps/chat/src/utils/tests/map-scheduled-task-dto.spec.ts`
- `npm run test:file -- apps/chat/src/utils/tests/map-scheduled-task-run-dto.spec.ts`
- `npm run test:file -- apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx`
- `npm run test:file -- apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTaskSubmit.spec.tsx`
- `npm exec nx -- run-many -t lint typecheck -p @epam/chat`
- `npm run verify:changed`

## 3. Docs, rules and specs

- [x] 3.1 Add a "Scheduled-task display adapters" section to `libs/chat-hooks/README.md`.
  - Cover each export's return value, availability from the root and `./scheduled-tasks`, and a compiling example that builds the three formatter objects.
  - State that formatter objects must be stable for memoized callers.
  - Map the lib names to the `apps/chat` adapter names.
- [x] 3.2 Update `.claude/rules/libs.md` "Narrow isolation exceptions". Add `scheduled-task-display.ts` as a second reference case of the DIAL-Core response-to-display exception, pointing to this change's `design.md` D7. Update the matching one-line summary in `AGENTS.md` ("the usage mappers" → "the usage and scheduled-task display mappers").
- [x] 3.3 Run `npm run validate:docs`, `npm run validate:specs` and `npm run validate:lib-duplicates`. Fix any README import/export or class-name mismatch they report.

**Verification**
- `npm run validate:docs`
- `npm run validate:specs`
- `npm run verify:full`
