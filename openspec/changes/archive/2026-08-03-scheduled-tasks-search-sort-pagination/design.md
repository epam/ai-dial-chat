## Context

`GET /api/v1/scheduled-tasks` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts:34,40,72`) takes no query parameters today. `scheduled-tasks.service.ts:61-66` calls `${dialClient.baseUrl}/v1/deployments/applications/${SCHEDULER_APP_ID}/route/v1/schedules/` with a plain `GET`, no query string, and `extractListItems`/`extractListPagination` (service.ts:131-174) already parse an upstream `{count, limit, offset, results, next, previous}` envelope into `ListScheduledTasksResponseDto` — so upstream pagination fields exist and are already understood by this mapper, they're just never requested with non-default `limit`/`offset`. The list is cached per-user only (`scheduled-tasks:list:${userSub}`, 30s TTL, `LIST_CACHE_TTL_MS`) with no query-param variance, invalidated on create/update via `invalidateListCache`.

On the frontend, `useScheduledTasks` (`apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts`) fetches the entire (single-page) list once per `enabled`/`refetchToken` change and keeps `{ items, isLoading, error, refetch }`. `ScheduledTasksPage` then runs `filterScheduledTaskItems`/`sortScheduledTaskItems` (`libs/scheduled-tasks/src/utils/filter-sort.ts`) over that already-fetched array — search and sort only ever see what happened to be on the first upstream page.

**Upstream contract — confirmed from the DIAL Scheduler's FastAPI source** (`list_schedules` route handler and its `Pagination` dependency, shared by the requester):

```python
@router.get("/", response_model=Page[ScheduleListItem])
async def list_schedules(
    service: ScheduleServiceDep,
    pagination: PaginationDep,
    metadata_filter: MetadataFilterDep,
    name_filter: NameFilterDep,
    user_id: Annotated[str, Depends(get_user_id)],
) -> Page[ScheduleListItem]:
    """... Supports filtering by name via the `name` query parameter; only schedules whose
    `display_name` contains the given value as a case-insensitive substring are returned. ..."""
```

```python
@dataclass
class Pagination:
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1)
    offset: int = Query(default=0, ge=0)
```

This confirms:
- **Pagination**: plain `limit` (`ge=1`, no upstream-enforced maximum) and `offset` (`ge=0`) query params, matching the response envelope fields the BFF already parses.
- **Search**: maps to the upstream `name` query parameter — case-insensitive substring match against `display_name`. The BFF's `search` param is renamed to `name` only when calling upstream; the BFF-facing contract keeps calling it `search` (already the more natural name for a UI-facing param, and avoids leaking the upstream key name into our own API).
- **Sort: upstream does not support it.** The `list_schedules` signature has no sort/order dependency at all — only `pagination`, `metadata_filter`, and `name_filter`. There is no upstream parameter to map a `sort` value to, and no larger-page-then-sort fallback is being built for it either (see Decision below — sort is descoped from this change entirely).

There is also an upstream `metadata__<key>=<value>` filter (`parse_metadata_filter`), unrelated to this change's search/sort/pagination scope — not used here.

## Goals / Non-Goals

**Goals:**
- Full dataset search (not just the first fetched page) and full dataset pagination via infinite scroll, both backed by the upstream DIAL Scheduler list endpoint's `name` and `limit`/`offset` parameters.
- A distinct "loading more" state (6 skeleton cards) separate from the existing initial-load spinner.
- Preserve `libs/scheduled-tasks`'s host isolation: the lib receives plain data/state/callbacks (`items`, `hasMore`, `isLoadingMore`, `onLoadMore`, `searchQuery`) and has no knowledge of the BFF endpoint, query params, or upstream contract.

**Non-Goals:**
- **Server-side / full-dataset sort.** The upstream DIAL Scheduler list endpoint has no sort/order capability (confirmed from source, see Context). This change does not add a `sort` query parameter to the BFF and does not attempt a BFF-side "fetch everything and sort" workaround. The existing sort dropdown (`firstToRun`/`lastToRun`/`newest`/`nameAZ`) is kept exactly as it behaves today: a client-side sort applied to whatever items are currently loaded in the browser. Once infinite scroll is in place, this means sort only orders the pages fetched so far, not the full remote dataset — a known, accepted limitation, not silently fixed by this change.
- Card actions (edit/delete/run-now).
- Changes to the create/authoring form or trigger-building logic (covered by the separate `scheduled-tasks-timezone-calendar-picker` change).
- New highlighting behavior beyond the existing title `Highlight` usage — `searchQuery` continues to flow to cards unchanged.

## Decisions

### 1. BFF list endpoint gains `limit`, `offset`, `search` (no `sort`) as its own stable contract

`GET /api/v1/scheduled-tasks` accepts:

| Param | Type | Validation | Behavior when omitted |
|---|---|---|---|
| `limit` | number | `@IsOptional() @IsInt() @Min(1) @Max(100)` — upstream itself has no max; 100 is a BFF-chosen sanity bound | current single-page default (unchanged back-compat) |
| `offset` | number | `@IsOptional() @IsInt() @Min(0)` | `0` |
| `search` | string | `@IsOptional() @IsString() @MaxLength(200)`, trimmed | omitted from upstream call entirely (not sent as `name=`) |

No `sort` parameter is added — see Non-Goals. `ScheduledTasksSortKey` (`libs/scheduled-tasks/src/types/scheduled-tasks-sort-key.ts`) remains a purely frontend, client-side-only concept; nothing about it changes in the BFF contract.

This is a **request DTO** (`ListScheduledTasksQueryDto`) validated by the existing global `ValidationPipe` (`whitelist:true, forbidNonWhitelisted:true, transform:true`), per `apps/chat-api/AGENTS.md`.

Alternative considered: accept an opaque upstream `next` cursor URL from the client instead of `limit`/`offset`. Rejected — the BFF should own how it talks to Scheduler (it may need to inject auth/service_id independent of what the client sees), and `next`/`previous` are already just informational fields in the response envelope, not meant to be replayed by the caller.

### 2. Upstream param mapping: direct passthrough, `search` → `name`

`scheduled-tasks.service.ts` maps the validated BFF DTO directly: `limit`/`offset` pass through unchanged; `search` (when non-empty after trimming) is sent upstream as `name`. No other mapping or fallback logic is needed since both confirmed upstream params are simple passthroughs.

### 3. Cache key varies by normalized `{limit, offset, search}`; TTL unchanged

Cache key becomes `` `scheduled-tasks:list:${userSub}:${normalizedParams}` `` where `normalizedParams` is a stable serialization of `{limit, offset, search}` (defaults applied before serializing, so `?limit=20` and no `limit` produce the same key when 20 is the default). TTL stays `LIST_CACHE_TTL_MS = 30_000`. `invalidateListCache` on create/update must delete **all** cached variants for the user (key-prefix scan/delete, not a single key), since a new task can affect every page/search combination's correctness.

Alternative considered: disable caching entirely for any non-default query. Rejected — search-as-you-type would otherwise hit upstream on every debounced keystroke with no benefit from the existing cache layer's staleness tolerance (30s is already short enough that stale search results are an acceptable trade-off, matching the existing default-list behavior).

### 4. `useScheduledTasks` becomes a stateful pagination + server-search owner; sort stays a local, client-side concern

Refactor (naming: keep `useScheduledTasks`, no rename needed) to hold `{ items, searchQuery, sortKey, isLoading, isLoadingMore, error, hasMore, setSearchQuery, setSortKey, loadMore, refetch }`.

- **Reset + fetch page 0** on: mount, `searchQuery` change (debounced ~300ms), and `refetch()` (post-create). `search` is the only value sent upstream that affects which items come back.
- **`sortKey` change does NOT trigger a refetch.** It only changes how the already-accumulated `items` are ordered for rendering (same client-side sort as today, applied to whatever has been loaded so far via `sortScheduledTaskItems` or an equivalent kept for this purpose — see Decision 6).
- **Append** on `loadMore()`: only when `hasMore && !isLoadingMore && !isLoading`; next `offset = items.length`.
- **`hasMore`**: `next != null` from the response envelope — prefer the upstream-provided cursor over independently recomputing from `count`/`offset`/`items.length`, since it's authoritative and avoids an off-by-one if `count` is ever approximate.
- **Abort in-flight requests** via `AbortController` on every `searchQuery` change and on unmount, following the existing `useFavicon.ts` cancelled-flag/cleanup pattern referenced in AGENTS.md.
- Dedupe appended items by `id` in case of an overlapping page caused by a concurrent create.

### 5. Infinite scroll: reuse the catalog's scroll-parent pattern, not a bare `IntersectionObserver`

The sentinel element sits at the bottom of the card grid; detecting "reached bottom" reuses `findScrollParent` / scroll-listener wiring from `libs/catalog/src/components/ListView/ListView.tsx` rather than instantiating a fresh `IntersectionObserver` against a non-document root, for consistency with the one existing infinite-scroll implementation in this codebase and to avoid a second, subtly different scroll-detection mechanism.

### 6. Skeletons: `ScheduledTaskCardSkeleton` via `DialSkeleton`, initial load keeps the existing spinner

- New `ScheduledTaskCardSkeleton` in `libs/scheduled-tasks` built on `DialSkeleton` from `@epam/ai-dial-ui-kit`, sized to match `ScheduledTaskCard`'s footprint (title block, description lines, schedule pill). `aria-hidden="true"`. `DialSkeleton`'s default `bg-layer-raised` color token resolves to a near-white fallback (`#fcfcfc`) in this app (never overridden), which is invisible against the white `CardShell` — every `DialSkeleton` instance MUST pass an explicit `color="var(--bg-layer-4)"`, matching the one other skeleton-over-a-card usage in this codebase (`libs/catalog/src/components/CardGrid/CardGrid.tsx`). This was found the hard way (two rounds of blank-card screenshots) and is not optional polish.
- Exactly `skeletonCount` (default 6) render appended **inside the same grid container as the last section's real cards** (`ScheduledTaskCardGrid` gained a `trailingSkeletonCount` prop for this), not in a separate trailing `<div>`. Appending to a *new* grid container starts a fresh row unconditionally, leaving a visible gap in the last real row whenever the loaded count isn't a multiple of the column count (e.g. 20 items in a 3-column grid) — reported and confirmed via screenshot. Rendering skeletons as additional children of the same CSS grid lets `grid-auto-flow` continue filling the current row exactly like a real appended card would. The existing centered `DialSpinner` remains for the true initial load (`isLoading === true && items.length === 0`) — these are two distinct, non-overlapping states.
- `ScheduledTasks` (lib) gains `hasMore: boolean`, `isLoadingMore?: boolean`, `skeletonCount?: number` (default 6), `onLoadMore?: () => void` — all presentational; the scroll sentinel lives inside the lib and calls `onLoadMore` when it fires and `hasMore && !isLoadingMore`, keeping upstream/BFF knowledge entirely in `apps/chat`. Trailing skeletons are attached to whichever section renders last (bottom-most) among `'shared'`/`'myTasks'`, since that's the section visually adjacent to where the next page's cards will land — not distributed proportionally or by any prediction of which section new items will belong to (unknowable before the response arrives).

### 7. `filter-sort.ts`: drop the search half, keep the sort half unchanged

`filterScheduledTaskItems` is removed — search is now server-driven (Decision 4), so filtering the in-memory array is no longer correct (it would hide items that only failed to match on a page that happens to be loaded, while matching items further upstream stay invisible). `sortScheduledTaskItems` is **kept as-is** and continues to be called by `ScheduledTasks`/`ScheduledTasksPage` over the accumulated `items`, per the Non-Goals section — sorting the full remote dataset is out of scope since upstream cannot do it. The "no results for search" empty state triggers off the server returning an empty `items` array for a non-empty `searchQuery`, not off a local filter zeroing a non-empty array — this is a behavior change callers of `ScheduledTasks` must account for.

## Risks / Trade-offs

- **[Risk] Sort only ever reflects the pages loaded so far, not the full remote dataset, once infinite scroll ships** → Accepted as a known limitation (Non-Goals) rather than solved with a "fetch everything and sort in the BFF" workaround, since the upstream endpoint was purpose-built without sort and materializing full result sets per request would add real latency/memory cost for a feature that wasn't asked to be perfectly consistent — just not to regress below today's (single-page) sort behavior.
- **[Risk] Cache-key-per-query-variant increases cache cardinality and could reduce hit rate for search-as-you-type** → Mitigation: 30s TTL is already short; accept lower hit rate as a known trade-off rather than adding search-specific cache bypass logic that complicates invalidation.
- **[Risk] `invalidateListCache` must now delete a family of keys instead of one exact key** → Mitigation: verify the cache-manager store in use (in-memory `cache-manager`) supports key enumeration/prefix deletion; if it doesn't cleanly support scan-and-delete, consider a versioned-key approach (bump a per-user cache "epoch" integer on invalidate, embed it in the key) instead of literal prefix deletion.
- **[Risk] Infinite scroll + skeleton insertion interacting with section grouping** → `ScheduledTasks` groups items by `sectionKey` (`'shared'` / `'myTasks'`, per the existing `scheduled-tasks-page-ui` spec) into separate `ScheduledTaskSection`s, each with its own CSS grid. An earlier version rendered skeletons in a fully separate trailing `<div className="grid ...">` below all sections — simple, but wrong in practice: a separate grid container always starts a new row, leaving a visible empty gap in the last real row whenever `itemCount % columns !== 0`, confirmed via screenshot. Fixed by appending skeleton cards as trailing children **inside** the last section's own grid (`ScheduledTaskCardGrid`'s new `trailingSkeletonCount` prop), so they continue the existing row via `grid-auto-flow` instead of forcing a new one. Trade-off accepted: skeletons visually appear "under" whichever section happens to render last, not the section the new items will actually belong to (unknowable before the response arrives) — a minor, temporary mislabel during a sub-second loading state, judged preferable to a persistent layout gap.
- **[Risk] `DialSkeleton`'s default color token is invisible against this app's card background** → `bg-layer-raised` (`DialSkeleton`'s default) compiles to `background-color: var(--bg-layer-raised, #fcfcfc)`; this app never defines `--bg-layer-raised`, so every skeleton bar silently fell back to `#fcfcfc` — indistinguishable from the white `CardShell`. Mitigation: pass `color="var(--bg-layer-4)"` explicitly (that token does have real contrast, `#d1dbea` fallback), matching the codebase's one other skeleton-over-card precedent. Any future skeleton added against a light card background in this app should default to checking whether `bg-layer-raised` actually renders, not assume the ui-kit default is visible.
- **[Risk] `DEFAULT_PAGE_LIMIT` (upstream's default when `limit` is omitted) is an unconfirmed numeric value** → Low impact: the BFF only needs to know it exists as a sane default, not its exact number, since the BFF always sends an explicit `limit` once pagination is wired up on the frontend (a fixed page size, e.g. matching the 6-skeleton batch or a slightly larger UI-chosen page size). Confirm the actual page size to use empirically/from product input during frontend implementation (§ tasks), not from upstream's default.

## Open Questions

(none blocking — upstream contract for pagination and search is confirmed from source; sort is explicitly out of scope for this change, see Non-Goals)
