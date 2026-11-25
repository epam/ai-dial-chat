# Tasks

**Slicing strategy: risk-first, then vertical.**

1. Prove the concurrency primitive first (§2), since the handoff, timeout and abort races are the highest risk.
2. Wire it under every upstream call (§3). The old controller admission stays in place until §5, so each intermediate state is safe.
3. Make the cache's single-flight cancellable (§4).
4. Move fairness and telemetry into the request path and delete the controller admission (§5).
5. Finish with the documentation and integration checks (§6–§7).

All files are under `apps/chat-api/src/` unless stated otherwise. Tests follow this module's existing `content-sources/tests/` folder. Relative imports stay extensionless. Conventions follow `apps/chat-api/AGENTS.md` §6, §7, §10 and §11.

## 1. Configuration contract

- [x] 1.1 Add the three env vars:
  - In `config/env/integrations.env.ts`, add `CONTENT_SOURCES_UPSTREAM_CONCURRENCY` (default 8, `@Min(1) @Max(64)`), `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE` (default 64, `@Min(0) @Max(1024)`) and `CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY` (default 8, `@Min(1) @Max(64)`). Use `@Transform(parseInt)` and `@IsInt`, like `CONTENT_SOURCES_TIMEOUT_MS`, and give each a one-line comment.
  - Point the existing `CONTENT_SOURCES_CONFIG` comment at `openspec/changes/archive/2026-11-24-add-content-sources-proxy/design.md`, replacing the stale unarchived path.
  - Add the three names to `ENV_VAR_NAMES` in `config/tests/environment-composition.spec.ts`.
  - **Verification:** `npm run test:file -- apps/chat-api/src/config/tests/environment-composition.spec.ts` passes. Add one case asserting `CONTENT_SOURCES_UPSTREAM_CONCURRENCY=0` fails validation naming the variable.
- [x] 1.2 Expose the limits on the registry:
  - In `content-sources/content-sources-registry.service.ts`, export `CONTENT_SOURCES_DEFAULT_UPSTREAM_CONCURRENCY = 8`, `CONTENT_SOURCES_DEFAULT_UPSTREAM_QUEUE_SIZE = 64` and `CONTENT_SOURCES_DEFAULT_PRINCIPAL_MISS_CONCURRENCY = 8`.
  - Add the read-only `upstreamConcurrency`, `upstreamQueueSize` and `principalMissConcurrency`, read like `timeoutMs`.
  - Add the non-secret `credentialId?: string` to `ContentSource`, set from the validated `entry.credentialId`.
  - **Verification:** extend `content-sources/tests/content-sources-registry.service.spec.ts` "applies runtime defaults" and "honours configured TTL and timeout" with the three limits, and assert a parsed source carries `credentialId` but the id never appears in an error. Run `npm run test:file -- apps/chat-api/src/content-sources/tests/content-sources-registry.service.spec.ts`.

## 2. Upstream gate (risk-first)

- [x] 2.1 Create `content-sources/upstream-gate.ts`:
  - Export the `UpstreamGate` class (constructor `{ concurrency, queueSize }`, method `run(task, { waitMs, signal, onQueueOutcome })`) and the `ContentSourceQueueOutcome` string enum (`Admitted`, `QueueFull`, `TimedOut`, `Cancelled`), placed with the telemetry enums in `content-sources/content-sources-telemetry.ts`.
  - Port the FIFO handoff, wait timer and abort removal from `ConversationTitleCacheService.withReadSlot` / `waitForReadSlot` (`conversations/listing/conversation-title-cache.service.ts`), per design.md decision 1.
  - Add `UpstreamFailure.QueueFull` to `content-sources/content-provider.ts`, thrown on a full queue. A wait timeout throws `UpstreamError(Unavailable)`.
  - **Verification:** new `content-sources/tests/upstream-gate.spec.ts`, using fake timers where timing matters. It covers:
    - never more than `concurrency` tasks run at once;
    - FIFO order, and a newly arriving task does not overtake a queued one;
    - a full queue rejects with `QueueFull` without running the task;
    - `queueSize: 0` rejects at once when saturated;
    - a wait timeout rejects with `Unavailable` and frees its queue position;
    - an aborted waiter leaves the queue without running;
    - an aborted running task keeps its slot until it settles;
    - the slot is released after success, after a thrown error and after a task timeout;
    - one `onQueueOutcome` call per task with the right outcome and wait.

    Run `npm run test:file -- apps/chat-api/src/content-sources/tests/upstream-gate.spec.ts`.

## 3. Bound every upstream call (vertical slice: provider → fetch)

- [x] 3.1 Add the queue-wait histogram:
  - In `content-sources/content-sources-telemetry.ts`, add the histogram `dial.chat.content_sources.upstream.queue.duration` (unit `s`, `CONTENT_SOURCES_DURATION_BOUNDARIES`), the attribute `dial.chat.content_sources.queue_outcome` and `recordContentSourceQueueWait(sourceId, seconds, outcome)`.
  - **Verification:** extend `content-sources/tests/content-sources-telemetry.spec.ts` to assert the attributes are exactly the source id and the outcome, with no host, credential or path. Run `npm run test:file -- apps/chat-api/src/content-sources/tests/content-sources-telemetry.spec.ts`.
- [x] 3.2 Pass the caller's signal into `fetchUpstream`:
  - In `content-sources/upstream-fetch.ts`, `fetchUpstream` accepts an optional `signal`, combined with its deadline through `AbortSignal.any`.
  - Add `signal?: AbortSignal` to `ProviderContext` in `content-sources/content-provider.ts`.
  - **Verification:** extend `content-sources/tests/upstream-fetch.spec.ts` with "an aborted caller signal aborts the request". Run `npm run test:file -- apps/chat-api/src/content-sources/tests/upstream-fetch.spec.ts`.
- [x] 3.3 Create `content-sources/content-sources-upstream.service.ts` (`ContentSourcesUpstreamService`):
  - `fetch(source, { url, headers, maxBytes }, context)` keeps one lazily created `UpstreamGate` per `baseUrl` + `credentialId` pool, sized from the registry.
  - It waits at most `registry.timeoutMs`, runs `fetchUpstream` with `context.signal`, and records `recordContentSourceQueueWait`.
  - Register it in `content-sources/content-sources.module.ts`.
  - **Verification:** new `content-sources/tests/content-sources-upstream.service.spec.ts`, with global `fetch` stubbed. It covers:
    - two sources sharing a host and credential share one limit;
    - different credentials, or anonymous and credentialed sources, do not;
    - the queue-wait sample carries the source id.

    Run `npm run test:file -- apps/chat-api/src/content-sources/tests/content-sources-upstream.service.spec.ts`.
- [x] 3.4 Inject `ContentSourcesUpstreamService` into `GitHubProvider` and `GitLabProvider`:
  - In `content-sources/providers/github.provider.ts` and `content-sources/providers/gitlab.provider.ts`, each private `get()` delegates to `upstream.fetch(source, …, context)` instead of importing `fetchUpstream`.
  - Add a comment in `upstream-fetch.ts` that only the upstream service may call `fetchUpstream`.
  - **Verification:** update `content-sources/tests/github.provider.spec.ts` and `content-sources/tests/gitlab.provider.spec.ts` to build providers with a real `ContentSourcesUpstreamService` over a stub registry, and keep every existing assertion. Run both with `npm run test:file -- <path>`.
- [x] 3.5 Run `npm run verify:changed` for the completed slice (the gate under every provider call, with controller admission still in place).

## 4. Cancellable single-flight

- [x] 4.1 Make single-flight consumer-owned in `content-sources/content-sources-cache.service.ts`, per design.md decision 5:
  - `getOrLoad(key, loader: (signal) => Promise<T>, { …, signal })` follows `ConversationTitleCacheService.load` / `consume`.
  - The last consumer leaving aborts the flight, and an aborted flight leaves the map at once.
  - An aborted refresh is neither cached nor served stale nor counted in `stale_served`.
  - **Verification:** extend `content-sources/tests/content-sources-cache.service.spec.ts`. It covers:
    - one consumer aborting does not abort a shared load;
    - the last consumer aborting aborts the loader signal and is not cached;
    - a caller arriving after an abort starts a new load;
    - a loader failing with `QueueFull` or a queue timeout serves a retained stale value and counts `stale_served`;
    - existing single-flight and stale tests still pass.

    Run `npm run test:file -- apps/chat-api/src/content-sources/tests/content-sources-cache.service.spec.ts`.
- [x] 4.2 Thread the flight signal through `ContentSourcesService` (`content-sources/content-sources.service.ts`):
  - Loaders accept the flight signal and pass it as `ProviderContext.signal`, and the listing's nested `documentDate` / `listingTitle` calls use the listing flight's signal.
  - Rename `CONTENT_SOURCES_UPSTREAM_CONCURRENCY` to `CONTENT_SOURCES_LISTING_CONCURRENCY`.
  - Replace `isFatal` with an explicit degradable set (`NotFound`, `TooLarge`, `BadResponse`), per design.md decision 7.
  - **Verification:** extend `content-sources/tests/content-sources.service.spec.ts` with:
    - "a title read refused by a full queue fails the listing instead of degrading";
    - "aborting a listing cancels its pending reads";
    - keep "limits upstream date calls to 4 at a time" green under the new name.

    Run `npm run test:file -- apps/chat-api/src/content-sources/tests/content-sources.service.spec.ts`.

## 5. Per-user miss fairness and controller (vertical slice: HTTP → upstream)

- [x] 5.1 Rewrite `ContentSourcesAdmissionService` in `content-sources/content-sources-admission.service.ts` as the per-principal lease, per design.md decision 4:
  - `lease(principalKey)` returns idempotent `ensure()` and `release()`, the limit comes from `registry.principalMissConcurrency`, and `ensure()` after `release()` is a no-op.
  - Delete `CONTENT_SOURCES_MAX_TOTAL_IN_FLIGHT` and `CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT`.
  - Add `ContentSourcesMissLimitException` and `ContentSourcesQueueFullException` (both `HttpException` with 429 and the message `Too many concurrent content-source requests`), and map `UpstreamFailure.QueueFull` to the latter in `toHttpException`. As implemented: the miss-limit exception and the shared message live in `content-sources-admission.service.ts`, which throws it (the service imports the admission service, so the other direction would be circular). The queue-full exception sits next to `UpstreamCredentialsException` in `content-sources/content-sources.service.ts` and landed with §3, because `toHttpException` must stay exhaustive once `UpstreamFailure.QueueFull` exists.
  - **Verification:** rewrite the admission cases in `content-sources/tests/content-sources-telemetry.spec.ts`, or move them to a new `content-sources/tests/content-sources-admission.service.spec.ts`. They cover:
    - the 9th `ensure()` for one principal throws;
    - `ensure()` twice on one lease counts once;
    - `release()` frees the slot and drops the principal entry;
    - other principals are unaffected.

    Run `npm run test:file -- <path>`.
- [x] 5.2 Use the lease in `ContentSourcesService`:
  - `listSource`, `getDocument` and `getAsset` take a `{ principalKey, signal }` request context, open a lease, release it in `finally`, and every loader calls `lease.ensure()` before any upstream work.
  - **Verification:** extend `content-sources/tests/content-sources.service.spec.ts`. It covers:
    - with the limit reached, a cache miss answers 429 and makes no provider call;
    - a fresh hit from the same principal still succeeds;
    - a request joining an in-flight load does not count;
    - an expired entry whose refresh hits the miss limit is served stale and counts `stale_served`;
    - a listing's nested date loads count once.

    Run `npm run test:file -- apps/chat-api/src/content-sources/tests/content-sources.service.spec.ts`.
- [x] 5.3 Remove admission from `ContentSourcesController.run()` (`content-sources/content-sources.controller.ts`):
  - Each handler builds an `AbortController` aborted on `res.on('close')` when `!res.writableEnded`, following `CustomApiController`. List and document handlers use `@Res({ passthrough: true })`.
  - Pass `{ principalKey, signal }` to the service, and remove the listener when done.
  - `classifyFailure` maps an aborted signal to `ContentSourceResult.ClientClosed`, `ContentSourcesQueueFullException` to `ContentSourceResult.UpstreamQueueFull` and any other 429 to `AdmissionRejected`. Add both enum members in `content-sources/content-sources-telemetry.ts`, and update the `stale_served` description.
  - Keep every `@ApiResponse` text byte-identical.
  - **Verification:** replace the "throttling" block of `content-sources/tests/content-sources.controller.spec.ts` with supertest cases. They cover:
    - 20 concurrent requests answered by the service succeed (no request-level 429);
    - a `ContentSourcesQueueFullException` answers 429, recorded `upstream_queue_full`;
    - a miss-limit exception answers 429, recorded `admission_rejected`;
    - a client that disconnects mid-request aborts the signal passed to the service and is recorded `client_closed`.

    Run `npm run test:file -- apps/chat-api/src/content-sources/tests/content-sources.controller.spec.ts`.
- [x] 5.4 Add the end-to-end supertest suite `content-sources/tests/content-sources-admission.e2e.spec.ts`:
  - Use the real controller, service, cache, admission, upstream service and GitHub provider, with global `fetch` stubbed to count concurrent calls and hold them on demand.
  - It covers:
    - 20 concurrent cached asset requests from one principal all return 200 with zero `fetch` calls;
    - 20 cold distinct-asset requests from several principals with concurrency 8 never exceed 8 concurrent fetches and all return 200;
    - queue overflow (concurrency 1, queue 1, three distinct cold assets) answers 429;
    - a wait timeout answers 503 (with a short real `CONTENT_SOURCES_TIMEOUT_MS` of 300 ms, because fake timers would stall the supertest HTTP server; fake-timer coverage of the wait deadline is in `upstream-gate.spec.ts`);
    - an expired asset is served stale with 200 when the queue is full;
    - one principal's 9th concurrent cold request answers 429 with no extra fetch;
    - the slot is released after an upstream 500, a fetch timeout and a client abort (a following request starts at once);
    - an abandoned queued call leaves the queue without an upstream request;
    - a 200-document listing plus concurrent asset requests never exceed the pool limit, and the listing never runs more than 4 calls at once.
  - **Verification:** `npm run test:file -- apps/chat-api/src/content-sources/tests/content-sources-admission.e2e.spec.ts`.
- [x] 5.5 Run `npm run verify:changed` for the completed slice (no request-level admission, with fairness and telemetry in the request path).

## 6. Documentation and specs

- [x] 6.1 Update the chat-api README and `.env.template`:
  - In `apps/chat-api/README.md`, add the three variables to the env table, next to `CONTENT_SOURCES_TIMEOUT_MS`.
  - Rewrite "Behavior and limits" in the "Content sources" section. It covers:
    - fresh cache hits are never throttled;
    - 8 concurrent upstream calls per `baseUrl` + `credentialId`, with a FIFO queue of 64;
    - 429 only for a full queue or more than 8 concurrent cache misses per user;
    - 503 on a queue wait over `CONTENT_SOURCES_TIMEOUT_MS`;
    - stale served when a refresh cannot start;
    - disconnects cancel unneeded loads;
    - the pools × concurrency bound, and the note that two credential ids with one token form two pools.
  - In `apps/chat-api/.env.template`, add the three commented variables with defaults below `CONTENT_SOURCES_TIMEOUT_MS`.
  - **Verification:** `npm run validate:docs` passes, and the README states no 4/32 limit (`rg -n "4 concurrent requests|32 per process" apps/chat-api/README.md` prints nothing).
- [x] 6.2 Validate the change and specs:
  - Confirm the delta specs under `openspec/changes/content-sources-upstream-admission/specs/` match the implemented names (env vars, metric, attributes, result categories).
  - **Verification:** `openspec validate content-sources-upstream-admission --strict` and `npm run validate:specs` pass.

## 7. Integration checks

- [x] 7.1 Confirm the API contract is unchanged: `npm run openapi && npm run openapi:check` reports no diff in `libs/chat-api-client/openapi.json` and no client regeneration.
- [x] 7.2 Run `npm run verify:full` once and `npm run build:quiet` (Nest module wiring changed), and record which checks ran and what was not verified live (no real GitHub/GitLab traffic).

## Workflow follow-up

- Open a PR to `development` with `Closes #9993`, reviewed with `code-review-and-quality`.
- After merge and the "Deploy development" rebuild of `ghcr.io/epam/ai-dial-chat-bff:development`, record the commit in the Launchpad plan (step 1b.3).
- Archive with `/opsx:archive content-sources-upstream-admission`. This syncs the delta specs into `openspec/specs/content-sources-api/spec.md` and `openspec/specs/content-sources-config/spec.md`.
