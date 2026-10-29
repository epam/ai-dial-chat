Slicing: vertical, one collaborator per slice. Each slice moves one responsibility group verbatim into its own injectable provider, rewires the facade to it, registers it in `ScheduledTasksModule`, and moves that group's existing tests. Each slice must leave `chat-api` green before the next one starts. All paths are in `apps/chat-api/src/scheduled-tasks/`. Relative imports are extensionless. No file outside this folder changes, except this change's OpenSpec folder.

Deviation recorded at apply time: slices 2–6 were written together and verified as one step. Then the five spec files ran green together, with 86 `it`/`it.each` cases, the same as before the split (110 tests once `it.each` expands). A normalized diff confirmed that the test bodies are unchanged; only the fixture helpers and the per-file `let fetchMock` declarations differ.

## 1. Shared test fixture

- [x] 1.1 Create `tests/scheduled-tasks.fixtures.ts`.
  - Move `makeConfigService`, `makeExternalServices`, `makeSchedulerConsent` and `makeCacheManager` there from `tests/scheduled-tasks.service.spec.ts`, unchanged.
  - Add `makeDialClient(fetchCore)`, which takes the mock as an argument.
  - Add `createScheduledTasksService(dialClient, configService, cacheManager, deploymentsService, schedulerConsentService)`. For now it returns `new ScheduledTasksService(...)` with the same five arguments.
  - In the spec, replace every `new ScheduledTasksService(` with `createScheduledTasksService(` and every `makeDialClient()` with `makeDialClient(fetchMock)`. Change nothing else.

Verification: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts`

## 2. `SchedulerUpstreamClient`

- [x] 2.1 Create `scheduler-upstream.client.ts` with `@Injectable() SchedulerUpstreamClient(dialClient, configService)`.
  - Move unchanged: the config fields and `getSchedulerAppId`/`getSchedulerServiceId` (the latter now public), `SORT_ORDER_MAP`, the URL builders (public, renamed to `schedulesUrl`, `scheduleActionUrl`, `schedulesListUrl`, `runsUrl`, `runUrl`), `fetchUpstream` (renamed to `request`), `throwUpstreamError`, `extractUpstreamErrorFields` and the `UPSTREAM_*` constants.
  - Add the JSDoc class summary.
- [x] 2.2 Inject the client into `ScheduledTasksService` and replace every call to a moved member. Register the client in `scheduled-tasks.module.ts` `providers`. Wire it in `createScheduledTasksService`.
- [x] 2.3 Move `describe('ScheduledTasksService — upstream error reason and code')` unchanged, with any fixtures it alone uses, to `tests/scheduler-upstream.client.spec.ts`.

Verification: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduler-upstream.client.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts`

## 3. `ScheduledTasksListCacheService` and envelope helpers

- [x] 3.1 Create `scheduled-tasks-list-cache.service.ts` with `@Injectable() ScheduledTasksListCacheService(cacheManager)`.
  - Move the epoch key, `getListCacheEpoch`, `normalizeListQuery`, `buildListCacheKey` (renamed to `buildKey`) and `invalidateListCache` (renamed to `invalidate`, keeping its swallow-and-log behavior).
  - Move `LIST_CACHE_EPOCH_TTL_MS`.
  - Export `LIST_CACHE_TTL_MS`.
- [x] 3.2 Move `extractListItems`/`extractListPagination` into `scheduled-tasks.mapper.ts` as exported pure functions `extractScheduleListItems`/`extractScheduleListPagination`, with their comments.
- [x] 3.3 Rewire the facade: list, create, update, `performScheduleAction` and delete. Register the provider and wire it in the fixture factory.

Verification: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.mapper.spec.ts`

## 4. `ScheduledTaskCompletionService`

- [x] 4.1 Create `scheduled-task-completion.service.ts`.
  - Export the module-level arrow functions `isPastDate`, `isCompletionCandidate` and `isExpiredRecurring`.
  - Add `@Injectable() ScheduledTaskCompletionService(upstream)`, with `resolveIsCompleted(task, accessToken)` and a private `fetchNewestRun`. Both bodies are moved unchanged.
- [x] 4.2 Rewire `listScheduledTasks` and `getScheduledTask` to `completion.resolveIsCompleted`. Register the provider and wire it in the fixture factory.
- [x] 4.3 Move `describe('ScheduledTasksService — isCompleted derivation')` unchanged to `tests/scheduled-task-completion.service.spec.ts`.

Verification: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-task-completion.service.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts`

## 5. `ScheduledTaskRunsService`

- [x] 5.1 Create `scheduled-task-runs.service.ts` with `@Injectable() ScheduledTaskRunsService(upstream, cacheManager)`.
  - Add `listRuns` and `getRun`, the former bodies of `listScheduledTaskRuns` and `getScheduledTaskRun`.
  - Move `runErrorTextCacheKey`, `withRunErrorDetails` (now calling `this.getRun`), `RUN_ERROR_DETAIL_MAX_READS` and `RUN_ERROR_TEXT_CACHE_TTL_MS`.
- [x] 5.2 Make the facade's `listScheduledTaskRuns` and `getScheduledTaskRun` one-line delegations, keeping their signatures and JSDoc. Register the provider and wire it in the fixture factory.
- [x] 5.3 Move `describe('listScheduledTaskRuns')` and `describe('getScheduledTaskRun')` unchanged to `tests/scheduled-task-runs.service.spec.ts`.

Verification: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-task-runs.service.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts`

## 6. `ScheduledTaskPreconditionsService`

- [x] 6.1 Create `scheduled-task-preconditions.service.ts` with `@Injectable() ScheduledTaskPreconditionsService(schedulerConsentService, deploymentsService, upstream)`. Move `assertSchedulerConsent` and `validateConfiguration` there unchanged, both public.
- [x] 6.2 Rewire create, update, start and resume, keeping today's call order (design D3). Remove `DeploymentsService`, `SchedulerConsentService` and `ConfigService` from the facade constructor. Register the provider and wire it in the fixture factory.
  - Deviation: `CACHE_MANAGER` stays on the facade, because `listScheduledTasks` passes it to `withCachedDialRequest` (design D1 and D6, corrected).
- [x] 6.3 Move `describe('ScheduledTasksService — DIAL_NATIVE application consent')` unchanged to `tests/scheduled-task-preconditions.service.spec.ts`.

Verification: `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-task-preconditions.service.spec.ts apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts`

## 7. Close

- [x] 7.1 Remove imports left unused in `scheduled-tasks.service.ts`. Confirm it is under 350 lines and that it contains none of the following: `fetchCore`, Scheduler URL strings, cache key strings, completion predicates, `withRunErrorDetails`, `getSchedulerServiceConsent` or `resolveDeploymentItem`.
- [x] 7.2 Confirm `git diff --stat` touches only `apps/chat-api/src/scheduled-tasks/` and this change's folder. Confirm `scheduled-tasks.controller.ts`, `tests/scheduled-tasks.controller.spec.ts`, `app.module.ts` and `feature-guard-module.spec.ts` are unchanged.
- [x] 7.3 `npm exec nx run-many -- -t test lint build -p chat-api --parallel=1` passes.
  - Result: lint and build pass. In the full test run, 6093 of 6094 tests passed. The one failure was `files-upload.service.spec.ts` "throws ServiceUnavailableException when the final entry upload times out", a timing-flaky test outside this change; it passes when rerun alone.
- [x] 7.4 `npm run openapi:check` reports no diff, and `npm run validate:specs` passes.
- [ ] 7.5 Run `npm run verify:full` once.

## 8. Follow-up (out of scope)

- [ ] 8.1 Add direct unit specs for `isCompletionCandidate`/`isExpiredRecurring` and `ScheduledTasksListCacheService.buildKey` once a change touches them.
- [ ] 8.2 Propose `dedupe-files-batch-transfer` (refactoring plan B4, next backend item).
