## Why

`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts` is 988 lines. It grew by about 480 lines in the last 60 days and is item B3 (P1) of the 2026-10-26 refactoring audit. One class does seven jobs:

- reads the Scheduler config;
- builds every upstream URL;
- runs the raw `fetchCore` call and maps its errors;
- keeps the per-user list cache epoch;
- derives `isCompleted`;
- enriches runs with error text;
- checks consent and the model/skill combination;

and on top of that it serves the ten operations the controller calls. Its spec, `tests/scheduled-tasks.service.spec.ts`, is 2510 lines, the largest backend spec. It builds the service positionally about 75 times. Each new Scheduler feature grows both files, and both are merge-conflict hotspots.

The spec's own `describe` blocks already follow the seams: isCompleted derivation, DIAL_NATIVE consent, upstream error reason and code, and runs. The split follows them.

## What Changes

The class becomes a facade over five collaborators. All of them are injectable providers in `ScheduledTasksModule` and live in `apps/chat-api/src/scheduled-tasks/`:

- **`SchedulerUpstreamClient`** (`scheduler-upstream.client.ts`): reads `SCHEDULER_APP_ID`, `SCHEDULER_SERVICE_ID` and `SCHEDULER_SERVICE_TIMEOUT_MS` once at construction. Owns the URL builders (schedules, action, list with `SORT_ORDER_MAP`, runs, run) and the `fetchCore` request with its timeout, including the 429 → `ScheduledTaskRateLimitException` mapping and the `upstreamMessage`/`upstreamCode` enrichment. It follows the `core-responses.client.ts` pattern in `conversations/generation/`.
- **`ScheduledTasksListCacheService`** (`scheduled-tasks-list-cache.service.ts`): owns the epoch key, query normalization, list cache key and invalidation. Key names and TTLs do not change.
- **`ScheduledTaskCompletionService`** (`scheduled-task-completion.service.ts`): owns `isCompleted` resolution. Its pure predicates `isCompletionCandidate` and `isExpiredRecurring` are exported from the same file.
- **`ScheduledTaskRunsService`** (`scheduled-task-runs.service.ts`): owns listing runs, reading one run, and the bounded, cached error-text enrichment.
- **`ScheduledTaskPreconditionsService`** (`scheduled-task-preconditions.service.ts`): owns the consent check and the model/skill configuration check that run before a schedule mutation.

`extractListItems` and `extractListPagination` become the pure functions `extractScheduleListItems` and `extractScheduleListPagination` in `scheduled-tasks.mapper.ts`, which already holds the other upstream-shape helpers.

`ScheduledTasksService` keeps its ten public methods, their signatures and its module export. The controller and `ScheduledTasksModule` consumers do not change. The facade keeps CRUD, start, pause/resume/delete, and the order of consent, validation, upstream call and invalidation. Its target size is under 350 lines.

Tests:

- A new `tests/scheduled-tasks.fixtures.ts` holds the shared mocks and a `createScheduledTasksService` factory. The factory wires the real collaborators, so every constructor call in the spec changes in one place.
- The existing `describe` blocks move unchanged, assertions included, to a spec per collaborator: `scheduled-task-completion.service.spec.ts`, `scheduled-task-preconditions.service.spec.ts`, `scheduler-upstream.client.spec.ts` and `scheduled-task-runs.service.spec.ts`.

No behavior changes: same upstream URLs, headers, bodies, cache keys and TTLs, error bodies and status codes, and the same order of operations.

### Non-goals

- Changing any endpoint, DTO, OpenAPI operation, env var, cache key or error body.
- Replacing the raw `fetchCore` escape hatch with the SDK. The Scheduler route is still an SDK gap.
- Rewriting test assertions or adding behavior tests beyond what moves.
- Splitting `scheduled-tasks.controller.ts` (669 lines) or `scheduled-tasks.mapper.ts`.

### Acceptance criteria

- `scheduled-tasks.service.ts` is under 350 lines and holds no URL building, `fetchCore` call, cache key, completion predicate, run-error enrichment, consent lookup or deployment lookup.
- The controller, `scheduled-tasks.controller.spec.ts`, `app.module.ts` and `feature-guard-module.spec.ts` are byte-for-byte unchanged.
- Every moved test passes from its new file with identical assertions. `npm exec nx test chat-api`, `lint` and `build` pass.
- `npm run openapi:check` reports no diff.

### Alternatives considered

1. **Pure helpers only** (baseline): move URL builders, predicates and envelope parsing to modules and keep the class whole. Low risk, but it leaves the cache, the error enrichment, runs and preconditions in one class at about 700 lines. Rejected because it does not reach the audit target.
2. **Five injectable collaborators plus a facade** (chosen). Each seam already has its own `describe` block, so behavior is pinned before the move. Wiring stays local to the module.
3. **Split the public API across several services and the controller.** Rejected: it changes the controller, the controller spec and `ScheduledTasksModule`'s export for no reader benefit.

The plan named `ScheduledTasksUrlBuilder` as a pure module. It becomes part of `SchedulerUpstreamClient` instead, because every URL needs the configured `SCHEDULER_APP_ID` and its "not configured" 503. The plan named the consent check `SchedulerConsentGuard`. It becomes `ScheduledTaskPreconditionsService` instead, because a Nest guard is a `CanActivate` and this check runs inside the operation after DTO validation. design.md records both decisions.

### Rollback

The change is internal to `chat-api` and preserves behavior. Reverting the commit restores the old file. There is no data, cache or contract migration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `scheduled-tasks-api`: three requirements name `ScheduledTasksService` as the owner of behavior that moves to a collaborator, and they now name the new owner:
  - the `SCHEDULER_SERVICE_ID` read (now `SchedulerUpstreamClient`);
  - `isCompleted` computation and its single replacement location (now `ScheduledTaskCompletionService`);
  - model/skill validation (now `ScheduledTaskPreconditionsService`).

  A new structural requirement records the facade and its collaborators. The externally observable behavior does not change.
- `dial-core-client`: the Scheduler scenario of "Raw DIAL Core escape hatches use the shared transport" now names `SchedulerUpstreamClient`.

## Impact

- **Code:** `apps/chat-api/src/scheduled-tasks/` only.
  - One file is rewritten: `scheduled-tasks.service.ts`.
  - Two files are extended: `scheduled-tasks.mapper.ts` and `scheduled-tasks.module.ts` (providers).
  - Five files are new.
  - The references to `ScheduledTasksService` in `types/schedule-action.enum.ts` (`performScheduleAction` stays on the facade) and `dto/scheduled-task.dto.ts` (the facade still returns `isCompleted`, and the text is part of Swagger) stay true and are not edited.
- **Tests:** `tests/scheduled-tasks.service.spec.ts` shrinks. One fixtures file and four collaborator specs are added.
- **Unaffected:** endpoints, OpenAPI, the generated client, the frontend, libs, env vars, i18n (no new strings), RTL and a11y (no UI), feature gating (`scheduledTasksEnabled` is unchanged), and telemetry. Log lines keep their text, but the logger context changes to the owning class name.
- **Docs:** none. `docs/architecture.md` describes the endpoints and "the scheduled-tasks service" generically.
