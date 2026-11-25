# Design

## Context

See proposal.md (Why, Problem) for motivation. Current flow in `apps/chat-api/src/content-sources/`:

```
controller.run()  ── tryAcquire(principal) ──► 429 at once
   └─ service.listSource / getDocument / getAsset
        └─ cache.getOrLoad(key, loader)        fresh hit → return
             └─ single-flight Map<key, Promise> (joiners share)
                  └─ loader → provider.listDocuments / readFile / fileDate
                       └─ fetchUpstream()      no bound, AbortSignal.timeout only
```

Constraints that shape the approach:

- Providers reach the network only through their private `get()` helpers. Each helper calls `fetchUpstream`, so every upstream call already passes through one function.
- `ContentSourcesCacheService.refresh()` serves a stale value on any loader failure except an upstream 404. An admission failure thrown from inside the loader therefore falls back to stale with no new branch.
- Listing assembly (`assembleListing`) treats `Credentials`/`Unavailable` failures as fatal and degrades on everything else (`isFatal`).
- The repository already has a bounded FIFO gate with a wait timeout, consumer-owned abort and a queue-outcome histogram: `ConversationTitleCacheService.withReadSlot` / `waitForReadSlot` / `consume` in `apps/chat-api/src/conversations/listing/conversation-title-cache.service.ts`. Its metrics live in `apps/chat-api/src/telemetry/conversation-title-metrics.ts`. This design follows that pattern rather than adding a dependency.
- Client-disconnect wiring follows `CustomApiController` (`res.on('close')` with `!res.writableEnded`).
- NestJS conventions (env validation, typed exceptions, Logger, tests) follow `apps/chat-api/AGENTS.md` §6, §7, §10 and §11.

## Goals / Non-Goals

**Goals:**

- Admission sits where upstream work starts, so code that never reaches the network can never be refused.
- Every upstream call is bounded by construction: a provider cannot reach `fetch` without a slot.
- Abandoned requests stop holding queue positions.

**Non-Goals:**

- A general-purpose shared limiter in `common/`. There is one second user today (`ConversationTitleCacheService`), and merging the two is a separate refactor.
- Fairness between sources on one host and credential. FIFO within a pool is enough.
- Retry-After headers. Neither `<img>` nor the generated client reads them today.

## Decisions

### 1. Two layers: a per-pool FIFO gate and an injectable upstream service

- **`upstream-gate.ts`** (new, pure, no Nest): `UpstreamGate` with `concurrency` and `queueSize`, and `run<T>(task: (signal) => Promise<T>, { waitMs, signal, onQueueOutcome })`.
  - It ports the logic of `withReadSlot` / `waitForReadSlot`. A released slot is **handed to the next waiter** (`waiting.shift()()`) instead of being decremented, so a newly arriving call cannot overtake the queue.
  - A waiter whose `waitMs` timer fires or whose signal aborts removes itself.
  - An aborted running task keeps its slot until its promise settles, so cancellation never pushes concurrency above the cap.
  - It throws `UpstreamError(QueueFull)` when the queue is full, and `UpstreamError(Unavailable, 'Timed out waiting for upstream capacity')` on a wait timeout. An abort rejects with the signal's `AbortError`.
- **`content-sources-upstream.service.ts`** (new, `@Injectable`): `ContentSourcesUpstreamService.fetch(source, { url, headers, maxBytes }, context)`.
  - It derives `origin`, `timeoutMs` and `sourceId` from the source and context, picks the pool's gate, runs `fetchUpstream` inside the gate, and records the queue-wait sample (decision 8).
  - Gates are created lazily in a `Map` keyed by pool. Keys come only from validated configuration, so there are at most as many gates as configured sources (≤ 64).
- **Providers** (`GitHubProvider`, `GitLabProvider`) get `ContentSourcesUpstreamService` injected. Their `get()` helpers call it instead of importing `fetchUpstream`. `fetchUpstream` stays exported only for its unit tests and the upstream service, and a module comment says so.

*Alternatives:*

- Wrap `fetchUpstream` with a module-level singleton semaphore. Rejected: limits come from `ConfigService`, and a singleton leaks state between tests.
- Gate inside each provider. Rejected: it duplicates the code, and a third provider could forget it.
- Gate the cache loader instead of each call. Rejected: a listing is one loader that makes hundreds of calls, so the limit would bound listings, not upstream calls.

### 2. Pool key is `baseUrl` + `credentialId`

`ContentSource` gains `credentialId?: string`, the already-validated id that `CREDENTIAL_ID_PATTERN` allows. It is not a secret, but it is still never logged or used as a metric label. The pool key is `` `${baseUrl}\n${credentialId ?? ''}` ``: an anonymous source shares its host's anonymous pool.

*Alternative:* key by a token hash. Rejected: there is no reason to derive keys from secrets when the id exists. Two ids configured with the same token get two pools, and the README notes this.

### 3. Wait deadline equals `CONTENT_SOURCES_TIMEOUT_MS`, separate from the call deadline

A queued call waits at most `registry.timeoutMs`. Once admitted, `fetchUpstream` keeps its own `AbortSignal.timeout(timeoutMs)`, now combined through `AbortSignal.any` with the caller's signal (decision 5). A single call can therefore take up to 2 × timeout.

*Alternative:* one budget covering wait and call. Rejected: a call admitted late would get a short budget and fail spuriously, turning queueing into 503s. The issue fixes the wait at `CONTENT_SOURCES_TIMEOUT_MS`.

### 4. Per-principal fairness is a per-request lease, taken by the load leader

`ContentSourcesAdmissionService` (same file and class, new API) drops the process ceiling and the request counting.

- `lease(principalKey)` returns `{ ensure(), release() }`, both idempotent.
  - `ensure()` takes one slot the first time it is called. When the principal already holds `principalMissConcurrency` slots it throws `ContentSourcesMissLimitException` (an `HttpException` with 429 and the existing message `Too many concurrent content-source requests`).
  - `ensure()` after `release()` is a no-op, so a shared load that outlives its leader is not blocked.
- `ContentSourcesService` methods take a request context `{ principalKey, signal }`. Each method opens a lease and releases it in `finally`. Every loader passed to `cache.getOrLoad` starts with `lease.ensure()`.
- Loaders run only in the single-flight leader, so:
  - a fresh hit never calls `ensure()`;
  - a joiner never calls `ensure()`;
  - a listing's nested date loads reuse the lease the listing already holds, so one request counts once however many keys it loads;
  - the check happens before the gate, so a principal over its limit never takes a queue position.
- An expired entry whose refresh hits the miss limit is served stale through the existing `refresh()` catch. This is the same rule as queue-full and wait timeout, and the spec scenario "Stale when no slot is available" covers all three.

*Alternatives:*

- A slot per load (per cache key). Rejected: a listing with concurrency 4 would take five slots and two cold listings would exhaust a limit of 8.
- Counting inside `ContentSourcesCacheService`. Rejected: the cache would need to know principals.

### 5. Consumer-owned single-flight with abort

`ContentSourcesCacheService.getOrLoad(key, loader: (signal) => Promise<T>, { …, signal })` ports `ConversationTitleCacheService.load` / `consume`.

- A flight is `{ promise, controller, consumers }`. Each caller is a consumer.
- When a consumer's signal aborts, that caller's promise rejects. Only when `consumers` reaches 0 does `controller.abort()` run, which makes the gate drop a queued call or `fetch` abort a running one.
- An aborted flight is removed from the map at once, so a later caller starts a new flight. The `finally` deletes the map entry only if it is still the same flight.
- `refresh()` checks `controller.signal.aborted` before caching or falling back. An aborted load is never stored, never served stale and never counted in `stale_served`.
- A listing passes the flight's signal to its nested `getOrLoad` calls and provider reads through `ProviderContext.signal`. An abandoned listing therefore cancels its pending title and date reads.
- The controller creates one `AbortController` per request and aborts it on `res.on('close')` when `!res.writableEnded`, as `CustomApiController` does. List and document handlers take `@Res({ passthrough: true })`, which does not affect OpenAPI.

*Alternative:* do not propagate disconnects and let abandoned loads finish and fill the cache. Rejected: a feed page of lazy images that the user leaves would keep up to 64 queue positions per pool, and the next page would get 429. That is the failure this change exists to remove.

### 6. The per-process ceiling is removed

The old ceiling of 32 counted requests, including cache hits, and never bounded upstream calls (up to about 128). With per-pool gates:

- concurrent upstream calls ≤ pools × `CONTENT_SOURCES_UPSTREAM_CONCURRENCY`;
- waiting calls ≤ pools × `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE`;
- buffered body bytes ≤ pools × concurrency × per-call cap (10 MiB per asset, 16 MiB per GitHub tree).

Pools are operator-configured. A typical deployment has 1–3, so the default bound is 8–24 concurrent calls, already tighter than before. A second, process-wide gate would need nested acquisition (ordering, two timeouts, two queues) to protect only a configuration the operator chose. The README states the formula so an operator with many distinct credentials lowers `CONTENT_SOURCES_UPSTREAM_CONCURRENCY`.

*Alternative:* keep a process-wide gate as well. Rejected for that complexity. It can be added later if telemetry shows many pools.

### 7. Failure types and mapping

- `UpstreamFailure.QueueFull = 'queue_full'` is added. `toHttpException` maps it to `ContentSourcesQueueFullException` (`HttpException` with 429 and the same message). A wait timeout uses `UpstreamFailure.Unavailable`, so it maps to the existing 503 `Content source is unavailable`.
- Listing fan-out (tree, title and date reads inside a listing load) is exempt from the queue-size rejection: `ProviderContext.isQueueLimitExempt` reaches `UpstreamGate.run`, so those calls wait (FIFO, wait deadline) but are never refused by a full queue. They are already bounded (4 per listing, single-flight per source), and a refusal would discard the listing's completed reads. Added after review.
- `ProviderContext` carries no deadline: `ContentSourcesUpstreamService` reads `CONTENT_SOURCES_TIMEOUT_MS` from the registry for both the wait and the call. Added after review.
- A client disconnect surfaces as `ClientClosedRequestException` (499, `apps/chat-api/src/common/exceptions/client-closed-request.exception.ts`, shared with `custom-api`), so the global `TraceparentErrorFilter` does not log it as an unexpected error. Added after review.
- The listing's `isFatal` is inverted into an explicit list of **degradable** failures (`NotFound`, `TooLarge`, `BadResponse`). Every other failure, including `QueueFull`, `Unavailable`, `Credentials` and non-upstream errors such as the miss-limit exception and `AbortError`, aborts the listing. A listing therefore never degrades into file-name titles under load, which the spec scenario "Admission failure is not a degraded listing" requires.
- The OpenAPI `@ApiResponse` texts for 429 and 503 stay byte-identical, so `npm run openapi:check` stays clean. The existing 503 text ("unreachable or timed out") does not mention queue waits, and changing it would force a client regeneration that this change avoids.

### 8. Configuration

Three optional fields in `IntegrationsEnv` (`apps/chat-api/src/config/env/integrations.env.ts`), following `CONTENT_SOURCES_TIMEOUT_MS`: `@Transform(parseInt)`, `@IsInt`, `@Min`, `@Max`, with a default.

| Variable                                     | Default | Range  |
| -------------------------------------------- | ------- | ------ |
| `CONTENT_SOURCES_UPSTREAM_CONCURRENCY`       | 8       | 1–64   |
| `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE`        | 64      | 0–1024 |
| `CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY` | 8       | 1–64   |

`ContentSourcesRegistryService` reads them next to `cacheTtlMs` and `timeoutMs` (`upstreamConcurrency`, `upstreamQueueSize`, `principalMissConcurrency`), falling back to exported `CONTENT_SOURCES_DEFAULT_*` constants as it already does for TTL and timeout. All three names are added to `ENV_VAR_NAMES` in `config/tests/environment-composition.spec.ts`.

The listing fan-out constant `CONTENT_SOURCES_UPSTREAM_CONCURRENCY = 4` in `content-sources.service.ts` is renamed `CONTENT_SOURCES_LISTING_CONCURRENCY` so the code and the env var no longer share a name with different meanings.

### 9. Telemetry

Added in `content-sources-telemetry.ts`:

- `ContentSourceResult.UpstreamQueueFull = 'upstream_queue_full'` and `ContentSourceResult.ClientClosed = 'client_closed'`. `classifyFailure` checks `signal.aborted` first (→ `client_closed`), then `ContentSourcesQueueFullException` (→ `upstream_queue_full`), and any other 429 → `admission_rejected`, which now means the per-principal miss limit.
- Histogram `dial.chat.content_sources.upstream.queue.duration` (unit `s`, `CONTENT_SOURCES_DURATION_BOUNDARIES`), attributes `dial.chat.content_sources.source` (configured id; upstream calls exist only for configured sources) and `dial.chat.content_sources.queue_outcome` ∈ `ContentSourceQueueOutcome` {`admitted`, `queue_full`, `timed_out`, `cancelled`}. There is one sample per upstream call: an immediate admission records about 0 s, a queue-full rejection records 0 s.
- The `stale_served` description becomes "…because its refresh failed or could not start".

No host, pool key, credential id, path or user goes into any attribute. Cardinality is ≤ 64 sources × 4 outcomes.

### 10. Scope checklist

- **Authorization:** unchanged. The global `SessionGuard` applies, and any authenticated user may read any source.
- **Endpoints and client:** no new endpoint, no DTO change, OpenAPI unchanged, no api-client regeneration.
- **Feature gating:** none beyond the existing rule that the module is inert while `CONTENT_SOURCES_CONFIG` is unset.
- **Cache:** keys (`content-sources:{sourceId}:{ref}:{kind}:{normalizedPath}`), stores, TTL and event-free invalidation are unchanged.
- **i18n, RTL, a11y, UI, libs:** none. There is no frontend change and nothing under `libs/*`.

## Risks / Trade-offs

- [A call can take 2 × `CONTENT_SOURCES_TIMEOUT_MS` (wait + fetch); a cold listing with many sequential GitLab pages waits per page] → Waits happen only under saturation, and the queue histogram shows them. Operators can raise concurrency.
- [A large cold listing (200 documents × up to 3 calls) holds 4 of 8 slots for its duration] → The other 4 slots and the queue stay available, and single-flight makes it happen once per TTL.
- [`admission_rejected` now means "per-user miss limit", not "request limit"] → Dashboards keyed on it see fewer, more meaningful samples. The new `upstream_queue_full` category carries the overload signal. Both are documented in the spec.
- [The leader disconnects while joiners keep a load alive, so the load continues without a principal slot] → It is bounded by the pool gate, and the principal limit is a fairness aid, not a resource bound.
- [Two credential ids with the same token double the effective concurrency against one upstream quota] → Documented in the README. This is operator configuration.
- [Limits are per process; N replicas allow N × 8 calls per pool] → The same holds for single-flight today. GitHub's documented secondary limit is far above (100 concurrent requests).
- [Hand-rolled gate logic is subtle (handoff, timeout and abort races)] → It is ported from a gate that is already tested, and the slot-release paths get their own unit tests with fake timers (tasks.md §2).

## Migration Plan

1. Deploy with defaults; no env change is required. Existing deployments see fewer 429s and no API change.
2. Watch `dial.chat.content_sources.upstream.queue.duration` and the `upstream_queue_full` / `admission_rejected` results, and tune the three variables if needed.
3. Rollback: revert the commit. There is no persisted state or data migration. To approximate the old strictness without a deploy, set `CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY=4` and `CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE=0`.
