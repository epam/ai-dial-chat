## Context

The share-invitation flow (`POST /api/v1/share` to create a link, `GET /api/v1/share/invitations/:id?accept=true` to accept it) was recently added on top of the DIAL Core resource-sharing API. In practice, three independent bugs surfaced under real DIAL Core traffic:

1. `ShareService.acceptInvitation` called `getInvitation(id, { params: { query: { accept: true } } })` once and read `resources[0].url` off the response. Debug logging showed DIAL Core returns `status=200` with an **empty body** (`Content-Length: 0`) when `accept=true` performs the grant — `openapi-fetch` then resolves `{ data: undefined }` with no `error` either, so `resources` was always `undefined` and the request failed with a `BadGatewayException` mapped to a 502, even though the invitation was valid and the accept itself succeeded server-side.
2. Even after fixing (1), the frontend's catalog details panel (`Catalog`'s `initialDetailsItemId` effect) still didn't always open for the newly shared item, because:
   - `DeploymentsService.listDeployments`/`ToolsetsService.listToolsets` cache the DIAL Core list response per user for 30s, so the frontend's post-accept refetch could still receive the pre-share snapshot.
   - `DeploymentsContext`'s initial mount-time `loadDeployments()` and an explicit `refetchDeployments()`/`refetchToolsets()` call race on the same `setRawDeployments`/`setToolsets` state — whichever network response lands last wins, with no guarantee the "later" request is the fresher one.
3. `CatalogItem.isEditable` was derived purely from `isMy` (bucket-path ownership), so a user granted WRITE access to a shared application/toolset never saw the Edit action, even though DIAL Core would accept their edit.

## Goals / Non-Goals

**Goals:**
- Make `acceptInvitation` correctly resolve the shared `itemId` regardless of whether DIAL Core returns a body for the accepting call.
- Guarantee that, after a successful accept, the next deployments/toolsets list fetch (server cache and client state) reflects the newly shared resource.
- Surface WRITE-permission share grants so the catalog Edit action is available for shared-with-write-access applications and toolsets.
- Add durable debug logging so a future accept-invitation failure is diagnosable from logs alone.

**Non-Goals:**
- Changing DIAL Core's own sharing/ACL semantics or the `getSharedResources` contract.
- Building a UI to display *why* an item is editable (owned vs. shared) — `isEditable` stays a single boolean.
- Backend authorization enforcement for the actual edit/save calls — those already proxy the user's own access token straight to DIAL Core, which enforces the ACL itself.
- Reconciling the pre-existing drift in the `deployments-context` spec (missing `toolsets`/`schemas` documentation) beyond the new `refetchDeployments`/`refetchToolsets` behavior this change touches.

## Decisions

**Peek-then-accept instead of trusting the accepting call's body.** `acceptInvitation` now issues a non-accepting `getInvitation(id)` call first to read `resources[0].url`, then a second call with `accept=true` to perform the grant (its response is only checked for `error`, never for `resources`). Alternative considered: parse DIAL Core's raw response text as a fallback when `data` is `undefined` — rejected because the raw body was confirmed empty (not just unparsed), so no fallback parsing could recover the itemId from that call; a second read is the only reliable source.

**Cache invalidation lives in the domain services, not in `ShareService` directly.** `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` are new public methods that each own their own cache-key construction (interface-filtered variants for deployments, list/single for toolsets). `ShareService` calls both after a successful accept, importing `DeploymentsModule`/`ToolsetsModule`. Alternative considered: have `ShareService` reach into the cache manager directly with hardcoded key strings — rejected because cache-key shape is private to each service and already changes independently (e.g. per-interface-filter suffixes); duplicating that logic would silently drift.

**Client-side request-id guards instead of cancelling in-flight requests.** `DeploymentsContext` adds `deploymentsRequestIdRef`/`toolsetsRequestIdRef` (monotonic counters). Every call that can set `rawDeployments`/`toolsets` — the initial `loadDeployments` and the two `refetch*` functions — captures the counter value at dispatch time and only applies its result if the counter is still unchanged when the response arrives. Alternative considered: `AbortController` to cancel the stale initial fetch — rejected because the initial load and a later `refetchDeployments()` are independent call sites with no shared reference to cancel across, and aborting the initial load's *schemas*/*toolsets* sub-fetches (bundled in the same `Promise.allSettled`) would be more invasive than a per-resource id check.

**WRITE-permission lookup happens inline in list assembly, best-effort.** `getWritableApplicationUrls`/`getWritableToolsetUrls` call DIAL Core's `getSharedResources({ resourceTypes: [...], with: 'me' })` on every list request (not cached — mirrors the existing `getInstalledIds` per-request pattern for `isInstalled`/`isMy`), and swallow errors into an empty `Set` with a warning log rather than failing the whole list. Alternative considered: fold this into the 30s list cache — rejected because permission grants can change between requests independent of the underlying resource list, and the existing `isMy`/`isInstalled` enrichment already deliberately runs outside that cache for the same reason.

## Risks / Trade-offs

- [Extra DIAL Core round-trip per accept] `acceptInvitation` now makes two upstream calls instead of one → negligible latency increase for a one-time, low-frequency action; still within the existing `@Throttle({ limit: 20, ttl: 60000 })` budget.
- [Extra DIAL Core round-trip per list request] `getSharedResources` is called on every deployments/toolsets list request (not cached) → same trade-off already accepted for `getInstalledIds`; mitigated by catching failures and degrading to "no shared write access" instead of failing the list.
- [Request-id guard is per-context-instance] If `DeploymentsProvider` remounts (rare — it wraps the whole app), the counters reset; this only matters within a single provider lifetime, which matches the actual race window (mount-time load vs. same-session refetch).

