## Context

`ScheduledTasksService` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`, 988 lines) proxies DIAL Scheduler through a DIAL Core application route. The SDK has no operation for that route, so the service calls `dialClient.fetchCore` directly, an exception `dial-core-client` already records. The controller calls ten public methods. `ScheduledTasksModule` exports the service and `app.module.ts` imports the module. Nothing else in `chat-api` imports the service.

The file holds these responsibility groups:

| Group                                                                                                                                              | Members today                                                                                                                                                            | Approx. lines |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------: |
| Config                                                                                                                                             | `schedulerAppId`, `schedulerServiceId`, `timeoutMs`, `getSchedulerAppId`, `getSchedulerServiceId`                                                                         |            40 |
| URLs                                                                                                                                               | `SORT_ORDER_MAP`, `buildSchedulesUrl`, `buildScheduleActionUrl`, `buildSchedulesListUrl`, `buildRunsUrl`, `buildRunUrl`                                                   |            80 |
| Transport and errors                                                                                                                               | `fetchUpstream`, `throwUpstreamError`, `extractUpstreamErrorFields`, `UPSTREAM_*` constants                                                                              |           135 |
| List envelope                                                                                                                                      | `extractListItems`, `extractListPagination`                                                                                                                              |            50 |
| List cache                                                                                                                                         | `listCacheEpochKey`, `getListCacheEpoch`, `normalizeListQuery`, `buildListCacheKey`, `invalidateListCache`, `LIST_CACHE_*`                                                |            70 |
| Completion                                                                                                                                         | `isPastDate`, `isCompletionCandidate`, `isExpiredRecurring`, `fetchNewestRun`, `resolveIsCompleted`                                                                      |           105 |
| Runs                                                                                                                                               | `listScheduledTaskRuns`, `runErrorTextCacheKey`, `withRunErrorDetails`, `getScheduledTaskRun`, `RUN_ERROR_*`                                                             |           135 |
| Preconditions                                                                                                                                      | `assertSchedulerConsent`, `validateConfiguration`                                                                                                                        |            85 |
| Operations                                                                                                                                         | list, create, get, start, update, `performScheduleAction`, pause, resume, delete                                                                                         |           240 |

The spec (`tests/scheduled-tasks.service.spec.ts`, 2510 lines) builds the service with `new ScheduledTasksService(dialClient, config, cache, deployments, consent)` about 75 times. It spies on `Logger.prototype`, never on a private member. Its top-level and nested `describe` blocks already split along these groups: `listScheduledTaskRuns`, `getScheduledTaskRun`, `isCompleted derivation`, `DIAL_NATIVE application consent`, and `upstream error reason and code`.

## Goals / Non-Goals

**Goals:**

- Keep the facade under 350 lines, holding only operation order and DTO assembly.
- Give each responsibility group one owner that is injected, can be unit-tested, and is named in the spec.
- Change no behavior: URLs, headers, bodies, cache keys and TTLs, error bodies and statuses, log text, and call order all stay the same.
- Move the existing tests without editing their assertions.

**Non-Goals:**

- Changes to any endpoint, OpenAPI, DTO or env var, and therefore no client regeneration.
- Replacing `fetchCore` with an SDK call.
- Splitting the controller or the mapper.
- New behavior tests. The moved tests already pin every group.

## Decisions

### D1. A facade with five injected collaborators

`ScheduledTasksService` keeps its name, file, public methods and module export. Its constructor becomes:

```ts
constructor(
  private readonly dialClient: DialClientService,
  private readonly upstream: SchedulerUpstreamClient,
  private readonly listCache: ScheduledTasksListCacheService,
  private readonly completion: ScheduledTaskCompletionService,
  private readonly runs: ScheduledTaskRunsService,
  private readonly preconditions: ScheduledTaskPreconditionsService,
  @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
)
```

`dialClient` stays because `toUpstreamSchedulePayload` needs `baseUrl` and `dialApiVersion`. `CACHE_MANAGER` stays because `listScheduledTasks` passes it to `withCachedDialRequest` (D6). An earlier draft of this design removed it from the facade, which contradicted D6. `ConfigService`, `DeploymentsService` and `SchedulerConsentService` leave the facade and move to the collaborators that use them. `ScheduledTasksModule.providers` lists all six classes. `exports` stays `[ScheduledTasksService]`, because no other module needs a collaborator. `AppConfigModule`, `DeploymentsModule` and `ExternalServicesModule` remain imported. Nest resolves `CACHE_MANAGER` and `ConfigService` globally, as it does today.

The audit's alternative, "pure helpers only", keeps about 700 lines in the class and was rejected, as the proposal records.

### D2. URL builders belong to `SchedulerUpstreamClient`, not a pure module

Every Scheduler URL starts with `${dialClient.baseUrl}/v1/deployments/applications/${encodeURIComponent(appId)}/route/v1/schedules`. `getSchedulerAppId()` throws the "not configured" `ServiceUnavailableException` on first use. A pure module would need the base URL and the app id passed on every call, and would move the 503 into every caller.

The client therefore exposes `schedulesUrl(scheduleId?)`, `scheduleActionUrl(scheduleId, action)`, `schedulesListUrl(query)`, `runsUrl(scheduleId, query)` and `runUrl(scheduleId, runId)`. The bodies are moved unchanged, and `SORT_ORDER_MAP` stays module-level in the client file. `request<T>(url, method, accessToken, context, body?, parseJson?)` is the former `fetchUpstream`, together with its private `throwUpstreamError` and the module-level `extractUpstreamErrorFields`. `getSchedulerServiceId()` is public because the facade (`toUpstreamSchedulePayload`) and `ScheduledTaskPreconditionsService` (the consent warn log) both read it.

The precedent is `conversations/generation/core-responses.client.ts`, an injectable `*.client.ts` that wraps raw `fetchCore` calls for one DIAL Core route family.

### D3. Preconditions are a service, not a Nest guard

The plan called this piece `SchedulerConsentGuard`. A Nest guard runs before pipes and DTO validation and sees only the execution context. The consent check runs inside the operation, after validation, and must precede model/skill validation in a fixed order. Moving it into a guard would change error precedence for invalid bodies, which is observable.

`ScheduledTaskPreconditionsService` therefore exposes `assertSchedulerConsent(accessToken)` and `validateConfiguration(body, accessToken, bucket)`. Both are moved unchanged, and they depend on `SchedulerConsentService`, `DeploymentsService` and `SchedulerUpstreamClient`.

The facade calls them in exactly today's order:

- create: consent, validate, payload;
- update: serviceId, consent, get, validate;
- start and resume: consent first.

### D4. `ScheduledTaskRunsService` owns reading runs

`listRuns(accessToken, scheduleId, query)` and `getRun(accessToken, scheduleId, runId)` are the former bodies of `listScheduledTaskRuns` and `getScheduledTaskRun`. The private `withRunErrorDetails` calls `this.getRun`, as it called `this.getScheduledTaskRun` before. `RUN_ERROR_DETAIL_MAX_READS`, `RUN_ERROR_TEXT_CACHE_TTL_MS` and the `scheduled-tasks:run-error-text:` key move with it. The facade's two run methods become one-line delegations, so the controller still calls `scheduledTasksService.listScheduledTaskRuns` and `scheduledTasksService.getScheduledTaskRun`.

`startScheduledTask` stays on the facade. It is a schedule action that needs the consent check, and its response mapping is one `fromUpstreamRun` call.

### D5. `ScheduledTaskCompletionService` holds the derivation, with pure predicates

`isPastDate`, `isCompletionCandidate(task)` and `isExpiredRecurring(task)` become exported module-level arrow functions in `scheduled-task-completion.service.ts`. They need no instance state, and exporting them lets a later unit spec test them directly. The class exposes `resolveIsCompleted(task, accessToken)`. Its private `fetchNewestRun` uses `upstream.runsUrl(id, { limit: 1, offset: 0 })` and `upstream.request`.

The class does not depend on `ScheduledTaskRunsService`, because the newest-run lookup needs the raw upstream run, not the enriched DTO.

The list path still runs the enrichment inside `withCachedDialRequest` in the facade. The "Completed-state list enrichment is cached and bounded" requirement therefore still holds in the one location it names.

### D6. `ScheduledTasksListCacheService` owns keys and invalidation, the facade owns the wrap

The service exposes `buildKey(userSub, query)` and `invalidate(userSub)`. `invalidate` keeps the swallow-and-log `handleDialFetchError(..., { swallow: true })` behavior. `LIST_CACHE_TTL_MS` is exported from its file.

`listScheduledTasks` stays on the facade and calls `withCachedDialRequest({ cacheKey: await this.listCache.buildKey(...), ttlMs: LIST_CACHE_TTL_MS, ... })`. That keeps the list fetch, the envelope parsing and the completion fan-out readable in one method.

### D7. Envelope parsing moves to the mapper

`extractListItems` and `extractListPagination` become `extractScheduleListItems(result)` and `extractScheduleListPagination(result)` in `scheduled-tasks.mapper.ts`, next to `fromUpstreamSchedule`. They are pure and describe the upstream shape, which is what the mapper is for. The mapper already has its own spec. No new mapper tests are needed, because the list tests in the service spec cover both helpers.

### D8. Logging

Each class keeps `private readonly logger = new Logger(<Class>.name)`. Message text is moved unchanged, but the context field changes, for example from `ScheduledTasksService` to `SchedulerUpstreamClient` for the "Calling DIAL Scheduler" debug line. The spec spies on `Logger.prototype`, so the change does not affect it. No dashboard or alert filters on this context; observability needs no other change.

### D9. Test layout: a shared fixture, then move blocks unchanged

`tests/scheduled-tasks.fixtures.ts` exports:

- `makeConfigService`, `makeExternalServices`, `makeSchedulerConsent` and `makeCacheManager`, moved unchanged;
- `makeDialClient(fetchCore)`, which now takes the mock as an argument instead of reading the spec's module-level `fetchMock`;
- `createScheduledTasksService(dialClient, configService, cacheManager, deploymentsService, schedulerConsentService)`.

The factory keeps the old constructor's positional order and builds the real collaborators from those five inputs. Every `new ScheduledTasksService(` therefore becomes `createScheduledTasksService(`, and every `makeDialClient()` becomes `makeDialClient(fetchMock)`. Both are mechanical edits.

The moved blocks still drive the facade, because their assertions are about observable results such as URLs, cache calls, `isCompleted`, error bodies and log calls. They are filed by the collaborator that owns the behavior:

| Block                                                               | New file                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------- |
| `describe('listScheduledTaskRuns')`, `describe('getScheduledTaskRun')` | `scheduled-task-runs.service.spec.ts`                 |
| `describe('ScheduledTasksService — isCompleted derivation')`         | `scheduled-task-completion.service.spec.ts`           |
| `describe('ScheduledTasksService — DIAL_NATIVE application consent')` | `scheduled-task-preconditions.service.spec.ts`        |
| `describe('ScheduledTasksService — upstream error reason and code')` | `scheduler-upstream.client.spec.ts`                   |

Everything else stays in `scheduled-tasks.service.spec.ts`. That includes the skill persistence block, CRUD, start, pause/resume, delete, and the config and timeout cases.

Tests sit in `tests/`, where the folder keeps its specs today. No `.tsx` is involved.

## Risks / Trade-offs

- **Constructor-order bugs in the factory.** A swapped collaborator would compile under `as never` casts. Mitigation: the factory takes typed arguments and casts once. All five moved blocks plus the remaining spec exercise every collaborator.
- **Behavior drift during the move.** Mitigation: each slice moves one group verbatim, and the spec runs before the next slice starts. `npm run openapi:check` confirms the contract.
- **Facade becomes a pass-through for runs.** Accepted: two one-line delegations keep the controller and its spec untouched (D4).
- **Logger context change** (D8). Accepted and recorded.

## Migration Plan

This is an internal refactor and needs no deploy step. Rollback is reverting the commit.

## Open Questions

None.
