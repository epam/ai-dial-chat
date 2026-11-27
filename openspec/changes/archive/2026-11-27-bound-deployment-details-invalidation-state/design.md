# Design

## Context

See `proposal.md` (Why) for the observed growth and the evidence. This section adds only the facts the design depends on.

- `DeploymentsDetailsService` (`apps/chat-api/src/deployments/details/deployments-details.service.ts`) holds two pieces of per-key state:
  - `pendingDetailsRequests: Map<string, Promise<DeploymentDetailsDto>>`, which coalesces callers;
  - `cacheGenerations: Map<string, number>`, which fences stale writes.
- The composition stays as it is: `DialClientService` from `DialCoreModule` supplies the SDK client, `CACHE_MANAGER` supplies the shared cache, and `DeploymentsModule` provides the service. There is no inheritance base class and none is introduced.
- The cache is `cache-manager` 7.2.9 over one Keyv in-memory LRU store (`apps/chat-api/src/app/cache.config.ts`, `lruSize: 100`). The store's LRU can evict a cached details value at any time. That only causes a miss. It does not touch fencing metadata, which is why the metadata needs its own policy.
- `get`, `set` and `del` are async. `set`/`del` run `Promise.all(stores.map(...))`, and each Keyv op is itself a chain of hook `await`s. **The cache-manager API does not guarantee that a `set(k)` issued before a `del(k)` takes effect before it when both are in flight.** The current code silently assumes it does.
- Upstream detail calls go through `globalThis.fetch` (undici). `DialClientService` passes no `AbortSignal`. When a proxy is configured, `apps/chat-api/src/net/proxy-agent.setup.ts` installs `new EnvHttpProxyAgent()` with default options. The undici 6.29.1 defaults are `headersTimeout` = `bodyTimeout` = 300 000 ms (`node_modules/undici/lib/dispatcher/client.js`). `bodyTimeout` measures idle time between chunks, so a body that keeps trickling is never timed out.
- Callers of `invalidateDetailsCache` (the full list is in proposal.md):
  - `ToolsetsListingService.invalidateCaches`, used by toolset update/delete/login/logout;
  - `ApplicationsService.updateApplication`;
  - `ApplicationsService.invalidateAfterWrite`.

  The facade re-binding in `DeploymentsService` has no production caller. Every caller `await`s invalidation before it responds to the write, and both application callers swallow cache errors.

## Goals / Non-Goals

**Goals:**

- Idle and historical invalidation state is **zero** per key.
- Live state is **≤ 1 record per key with a current-epoch fetch**. It is proportional to live requests, never to invalidation history.
- The stale-write guarantee also holds when an invalidation overlaps the `del` and the `set`.

**Non-Goals:**

- No hard cap that evicts a current record. Evicting it would let a new caller start a second upstream call, and the evicted fetch could still write.
- No new upstream deadline or `AbortSignal`, and no cancellation of invalidated upstream calls.
- No change to `withCachedDialRequest`, `getDeploymentConfiguration` or `getDeploymentInterfaces` caching beyond the existing companion `del`.
- No cross-replica coherence.

## Decisions

### D1. Fence on the pending record's identity; delete `cacheGenerations` (option b)

`pendingDetailsRequests` becomes `Map<string, PendingDetailsRequest>`. Each value is a record `{ fence, promise }`. `fence` is a fresh empty object created for each fetch and passed into `fetchDeploymentDetails`, so the fetch can check its own fence. It is a separate object because the promise does not exist yet when the fetch starts, and building the record before the promise would need a cast. The field name stays, so `openspec/specs/deployments-toolsets-service-decomposition/spec.md` remains accurate. The interface lives in the service file, or in `apps/chat-api/src/deployments/details/` next to it if lint requires that. It is private and not exported from the module.

- **Fence:** `isCurrent(key, fence) := pendingDetailsRequests.get(key)?.fence === fence`.
- **Join:** a caller joins only `pendingDetailsRequests.get(key)?.promise`.
- **Write:** after mapping, `if (isCurrent) await set(key, data, 60_000)`. Then, if `!isCurrent`, run `await del(key)` (see D3).
- **Cleanup (`finally` in `getDeploymentDetails`):** `if (isCurrent) delete(key)`. This is the existing identity guard, now comparing records instead of promises.
- **Invalidate:** `pendingDetailsRequests.delete(detailsKey)` runs **synchronously first**, then `await del(detailsKey)`, then `await del(interfacesKey)`.

Why it is correct: a record is created once and can never become current again after it has been removed. Nothing is "reset to zero", so the eviction hazard of the numeric scheme cannot occur. Within one epoch at most one fetch exists per key: a new fetch starts only when the slot is empty, and the slot empties only on settle or invalidation. That gives the ≤ 1 record bound without a refcount.

Alternatives:

- **(a) Generation plus in-flight refcount, deleting at 0.** It reaches the same bound. But it keeps two maps and a counter, and a counter must be decremented exactly once on every success, rejection and invalidation path. That is the class of bug which brings the leak back, or resets a key too early and lets the stale write through again. Rejected.
- **(c) Keep the lifetime Map and add a gauge.** Correct but unbounded. It is the rollback state, not a fix. Rejected.
- **(d) Numeric TTL/LRU on generations.** A missing key reads as `0`, so eviction re-admits an older generation-0 fetch (timeline T4). Stale-result safety cannot be shown without also tracking in-flight fetches, and at that point it is (a). Rejected.
- **A separate token map (`Map<key, object>`).** Equivalent to D1, but it duplicates state the pending map already carries. Rejected in favour of reusing the record.

### D2. Fence before the first `await` in `invalidateDetailsCache`

Today the generation bump and the slot delete run after `await del(details)`. Moving the fence first closes timelines T2 and T3. The `del` calls keep their order: details first, then interfaces. Error semantics do not change: a `del` rejection still propagates to the caller, which swallows it in the application paths and propagates it in the toolset path, as today. The fence is already raised by then, so a failed `del` can at worst leave an old value, which the invalidation was trying to remove. It can never leave a value written by a fenced fetch.

### D3. Compensating `del` after a fenced `set`

Because `set`/`del` ordering is not guaranteed (see Context), a fetch that passed the fence and then lost it while its `set` was in flight issues one `del(key)` once that `set` settles (T5). The compensation cannot create staleness. In the worst case it removes a newer fetch's value that was written in the meantime, which only costs one cache miss. A `del` rejection inside the compensation is logged and ignored. The data has already been computed for the fetch's own callers, and propagating the error would turn a successful read into a 503. That would change error semantics, which the proposal excludes.

### D4. What stays retained if an upstream call never settles

- **Current-epoch hung fetch:** 1 record. Callers in the same epoch join it and wait with it, which is the coalescing behaviour today. The next invalidation of the key removes the record, and later callers start a new fetch.
- **Invalidated hung fetch:** 0 map entries. Its closure, the mapped data if any, and the record are retained only by its own promise chain and the HTTP request that is awaiting it. They are released when the call settles, or when the process shuts down.
- **Deadline coverage:** undici's `headersTimeout`/`bodyTimeout` defaults (300 s each) normally make a stalled call reject, mapped to 503 by `handleDialFetchError`. They are not an absolute guarantee: a body that keeps trickling resets `bodyTimeout`, and the options are defaults rather than configured values. The spec therefore states the bound relative to live requests and does not claim an absolute one. The details spec scenario "DIAL Core unreachable" used to cite an "SDK timeout" that the SDK does not configure. Because this change already modifies that requirement block, the delta rewords the scenario to name the transport defaults.

### Race timelines

Notation: `F0` is the older fetch and `F1` the newer one. `I` is the invalidation. `R` denotes a record, `S` the pending map and `C` the cache.

**T1. Baseline (existing scenario).** F0 registers R0 → I: `S.delete` → I: `del` → F1 registers R1 → F0 resolves: `S.get ≠ R0`, so it skips `set` and its `finally` leaves R1 alone → F1 resolves: `S.get = R1`, so it runs `set` and its `finally` deletes R1. Result: C = F1's data and S is empty.

**T2. F0 settles during I's `del` (closed by D2).**

- Today: I `await del` (pending) → F0 resolves: gen unchanged → `set(stale)` → I bumps gen. Result: C holds stale data for 60 s.
- Proposed: I runs `S.delete` (sync) before it `await`s the `del` → F0 resolves: `S.get ≠ R0`, so no `set`. Result: C is empty.

**T3. A caller joins during I's `del` (closed by D2).**

- Today: I `await del` → a new caller sees `S.get = P0` and joins it → it receives pre-invalidation data.
- Proposed: the slot is already empty, so the caller starts F1.

**T4. Why numeric eviction is unsafe (rejects d).** F0 starts with gen 0 → I bumps gen to 1 → an eviction removes the gen entry → F0 resolves: `get ?? 0 = 0 = start` → `set(stale)`. Under D1 there is no number to evict, and R0 never becomes current again.

**T5. I overlaps F0's `set` (closed by D3).** F0: `isCurrent` → `set` issued (in flight) → I runs `S.delete`, then `del` is issued → the store applies the `del` before the `set` (permitted by the API) → C = stale. F0 then re-checks: `S.get ≠ R0`, so it runs `del`. Result: C is empty. If F1 wrote in between, its value may be removed, causing one miss and never stale data.

**T6. Repeated invalidation during one live fetch.** F0 R0 → I₁ deletes R0 → F1 registers R1 → I₂ deletes R1 → I₃ (S is already empty, so delete is a no-op) → F0 and F1 settle: neither is current, so neither runs `set` and neither `finally` deletes anything. Result: S is empty and C is empty.

**T7. Rejection.** F0 rejects. `handleDialFetchError` throws inside `fetchDeploymentDetails`, so no write happens, and the `finally` in `getDeploymentDetails` deletes R0 if it is still current. Joined callers receive the same rejection.

**T8. Coalesced callers in one epoch.** C1 creates R0 → C2 sees `S.get = R0` and awaits `R0.promise` → R0 settles → C1's `finally` deletes R0. C2 has no `finally` of its own over S, as today.

**T9. Old `finally` vs new record.** F0 is invalidated → F1 registers R1 → F0 settles: its `finally` sees `S.get = R1 ≠ R0` and does not delete. A later C3 joins R1.

**T10. A request still reading the cache when I runs (found during implementation).** C1 calls `get` and is suspended → I runs `S.delete` (a no-op: C1 has no record yet) and then `del` → C1 resumes, misses the cache, registers R1 and calls upstream → a later C2 joins R1 → R1 caches its result. This is correct: R1's upstream call is sent after I started, and every caller invalidates only after its DIAL Core write has succeeded, so R1 reads post-write state. The old code fenced this request only by accident, because it bumped the generation after `await del`. The original "in flight when a logout invalidates its key" test relied on that accident. It started the stale request and invalidated before the request had reached DIAL Core. The test now waits until the upstream call has been sent, which is what the spec scenario describes ("still awaiting DIAL Core").

### Ordering assumptions retained

- A JS turn is atomic: everything between two `await`s runs uninterrupted, so the read-check-delete on `S` is atomic. That is the only atomicity this design relies on.
- No atomicity of `cache-manager` `set`/`del` is assumed. D3 makes the outcome independent of their relative ordering.
- `cacheManager.get` returning a value written by a fetch that was later fenced is prevented by D3 after both settle. A `get` that runs **between** a fenced fetch's `set` landing and its compensating `del` can still read the stale value. This window spans only the microtasks between those two store operations, and it exists only when the store reorders the operations. It is documented rather than eliminated, because closing it would need a compare-and-set primitive that cache-manager does not provide.

## Risks / Trade-offs

- [The compensating `del` evicts a newer value] → It costs one extra upstream call. Correctness is unaffected. This is acceptable because the trigger is rare: an invalidation must land during a `set` that is already in flight.
- [The record identity guard is copied incorrectly, for example by comparing promises] → The slice-2 tests T6, T9 and T5 fail if the fence or the cleanup uses the wrong identity.
- [Tests that depend on the type of the private map] → Only `deployments-details.service.spec.ts` touches the service internals. It asserts reclamation through TypeScript bracket access to the private field (`service['pendingDetailsRequests'].size`). The idle test instead checks that every `Map`/`Set` field on the service is empty, so any per-key history fails it under whatever name it is reintroduced. The same bracket access is already used in `apps/chat-api/src/toolsets/auth/tests/toolsets-auth.service.spec.ts` (`service['dialClient']`), and the property under test is the state bound itself, which cannot be observed through behaviour alone. No new public API is added.
- [Hung upstream calls hold memory] → Unchanged from today, and limited by the undici defaults as described in D4. No absolute bound is claimed.
- [Multiple replicas] → Each replica has its own cache, and only the replica that handled the write invalidates its copy. This is pre-existing behaviour and out of scope.

## Migration Plan

This is a single-commit change in the service plus tests and specs. There is no data migration, nothing persisted, and no configuration.

**Rollback:** revert the commit. The lifetime `Map` comes back. It is larger but correct, apart from the T2/T3 window, which the revert reopens. The revert needs no follow-up.
