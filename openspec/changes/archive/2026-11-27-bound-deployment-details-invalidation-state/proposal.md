# Proposal

## Why

`DeploymentsDetailsService` keeps a process-lifetime map of invalidation generations. Nothing ever deletes an entry, so it grows by one entry for every distinct user and deployment pair that was ever invalidated. The shared LRU cache does not bound it. The same invalidation path also has an ordering gap: the fence is raised only after the first `await`, so a request that settles inside that window can still cache stale details. This change keeps the stale-write guarantee and removes the metadata that only grows.

Evidence (HEAD `b51186dea`, 2026-11-27):

- `apps/chat-api/src/deployments/details/deployments-details.service.ts:66` declares `cacheGenerations = new Map<string, number>()`. Only `invalidateDetailsCache` writes to it (`:87-90`, `set(key, (get ?? 0) + 1)`). Only `fetchDeploymentDetails` reads it (`:238` when a fetch starts, `:261` before the write). No code path deletes an entry.
- `invalidateDetailsCache` runs `await cacheManager.del(details)` (`:86`) **before** it bumps the generation (`:87`) and drops the pending slot (`:91`). For the duration of that `await`:
  - an older fetch that settles still sees an unchanged generation and calls `set`, putting pre-invalidation data back into the cache after the `del`;
  - a new caller can still join the older pending promise.
- `pendingDetailsRequests` (`:61`) coalesces fetches. Its `finally` identity guard (`:216-219`) removes only the request's own slot. Invalidation deletes the slot while the older request may still be running (`:91`).
- `cache-manager` 7.2.9 `set`/`del` fan out to each store through `Promise.all` (`node_modules/cache-manager/dist/index.mjs`, `set` and `del`), and each Keyv op is itself a chain of hooks. The API promises no ordering between a `set` and a `del` for the same key when they run concurrently.
- A missing generation reads as `0`. Evicting or expiring entries naively would therefore reset a key to `0` and let an older fetch that also started at `0` cache stale data again. That rules out a TTL/LRU fix on the current numeric scheme.

Every current caller of `invalidateDetailsCache`, found by grepping the service and the facade:

| Caller | Trigger |
| --- | --- |
| `apps/chat-api/src/toolsets/listing/toolsets-listing.service.ts:330` (`invalidateCaches`, when given a toolset name) | toolset update, delete, login and logout, through `ToolsetsMutationService` and `ToolsetsAuthService` (`apps/chat-api/src/toolsets/auth/toolsets-auth.service.ts:65`, `:133`) |
| `apps/chat-api/src/applications/applications.service.ts:555` (`updateApplication`) | application update |
| `apps/chat-api/src/applications/applications.service.ts:666` (`invalidateAfterWrite`, one call per id) | other application writes |
| `apps/chat-api/src/deployments/deployments.service.ts:52` (facade re-binding) | no production caller. Only `apps/chat-api/src/deployments/tests/deployments.service.spec.ts` uses it. |

## What Changes

- Fence each details fetch with the identity of its own pending-request record instead of a per-key numeric generation. A fetch may write to the cache only while its record is still the key's current pending entry. Invalidation removes that entry, so every older fetch for the key is fenced at once.
- Remove `cacheGenerations`. After the change the service keeps per-key state only while a request for the key's current epoch is in flight. An invalidated key with nothing in flight keeps no metadata.
- Make invalidation fence first. Drop the pending entry synchronously, before the first `await`, so no settle or join can slip into the gap. Only then delete the cache entries for `details` and for the companion `deployments:interfaces:*` key.
- After the fenced `set` resolves, re-check the fence. If an invalidation ran while the `set` was in flight, issue one compensating `del`. Worst case this costs one cache miss, never a stale read. This removes the dependence on `set`/`del` ordering.
- Add characterization tests for the race timelines (old/new completion order, failure, invalidation while a `set` is in flight, invalidation while a `del` is in flight) and tests that show the state is reclaimed.
- Add regression coverage showing that, once the toolset login/logout and application-write paths have run with a real `DeploymentsDetailsService`, details cached under an earlier auth state never reach a later response.
- Update the `deployment-details-api` spec: record who owns the invalidation state, the reclamation guarantee, and its limits, and replace the generation-counter rationale.

Unchanged: the response mapping, the 60 000 ms TTLs, error semantics (502/503/404), the cache keys scoped to the principal, coalescing for callers in the same epoch, the `finally` identity guard, the `invalidateDetailsCache(userSub, deployment)` signature and every caller, routes, DTOs, OpenAPI and the generated client.

## Alternatives considered

| Option | Correctness | Complexity / risk | Bound | Verdict |
| --- | --- | --- | --- | --- |
| (a) Per-key generation plus an in-flight refcount; delete the entry when the count reaches 0 | Correct if every exit path decrements exactly once | Two maps plus a counter; a missed decrement on rejection leaks again, an extra one resets too early | Live keys only | Rejected: same bound as (b) with more state and a refcount invariant to defend |
| (b) Identity fencing on the pending-request record (**chosen**) | Correct by construction: an invalidated record can never become current again, so there is no counter to reset | One map, which already exists; removes code | Live keys only, 0 when idle | **Chosen** |
| (c) Keep the lifetime map and add a size gauge or log | Correct | Trivial | Unbounded | Rejected as the end state. It stays the rollback target. |
| (d) TTL/LRU on `cacheGenerations` | Unsafe: eviction resets the key to 0 and brings back the stale write | Low | Bounded | Rejected: stale-result safety cannot be kept with numeric reset |

## Non-goals

- No generalized cache or fencing framework, and no change to `withCachedDialRequest`.
- No LRU tuning and no reopening of the shared cache store options in `apps/chat-api/src/app/cache.config.ts`.
- No refactoring of deployment mapping and no moving of `build*Details`.
- No route, DTO, OpenAPI, generated-client, persistence, UI or i18n change.
- No cross-replica invalidation. The cache lives in process memory, as before.
- No new upstream request deadline. The design records what the current transport defaults cover.

## Acceptance criteria

- `cacheGenerations` no longer exists. After any number of distinct keys have been invalidated with no request in flight, the service holds no per-key invalidation state (a test asserts the pending map is empty).
- While requests are in flight, per-key state is at most one record per key with a current-epoch fetch. Invalidated fetches that have not settled hold no map entry.
- The existing "in flight when a logout invalidates its key" scenario still passes. New tests also pass for both completion orders, a rejected old or new fetch, repeated invalidation during one live request, invalidation while a `set` is in flight, invalidation while a `del` is in flight, and coalesced callers in the same epoch.
- Real-service regressions for toolset login/logout and `updateApplication` show that a later details response never carries the pre-change snapshot.
- `openspec validate --strict` passes. `npm run validate:specs` passes. `npm exec nx test chat-api` and `npm exec nx lint chat-api` pass. OpenAPI output is unchanged.

## Rollback / compatibility

Not breaking: there is no contract change. Rollback is a plain revert of the service and its specs. The previous lifetime `Map` uses more memory but is correct, apart from the pre-existing ordering gap during `await del`, which a revert brings back.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deployment-details-api`: the in-flight invalidation guarantee now also covers concurrent invalidation and cache writes. A new requirement defines who owns the invalidation state, when it is reclaimed, and what stays retained while an upstream request never settles.

## Impact

- Code: `apps/chat-api/src/deployments/details/deployments-details.service.ts` only.
- Tests:
  - `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`
  - `apps/chat-api/src/toolsets/auth/tests/toolsets-auth.service.spec.ts` (a new real-wiring regression suite)
  - `apps/chat-api/src/applications/tests/applications.service.spec.ts` (extends the existing regression suite)
  - `apps/chat-api/src/toolsets/tests/toolsets.controller.spec.ts` runs unchanged as a check that the HTTP contract still holds.
- Specs: `openspec/specs/deployment-details-api/spec.md`, through the delta.
- Docs: none. `docs/architecture.md` does not describe this mechanism (to be confirmed in tasks).
- i18n / UI / RTL / a11y / feature flags: none. No user-visible strings.
- Libs: none touched.
