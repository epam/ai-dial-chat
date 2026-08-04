## Context

The prior change (`archive/2026-08-03-scheduled-tasks-search-sort-pagination`) wired server-side search (`name`) and pagination (`limit`/`offset`) through `GET /api/v1/scheduled-tasks`, but explicitly descoped sort: its design.md states "the upstream DIAL Scheduler list endpoint has no sort/order capability" based on the `list_schedules` route signature available at the time (`pagination`, `metadata_filter`, `name_filter` only). That decision is now superseded — the upstream Scheduler service source confirms `GET /schedules/` also accepts `order_by` (`created_at` | `next_run_time` | `name`) and `order_dir` (`asc` | `desc`), defaulting to `created_at desc` when omitted. Schedules with no `next_run_time` (paused/inactive) sort last when ordering by `next_run_time` — handled upstream.

Today, `useScheduledTasks` (`apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts`) fetches pages via `search`/`limit`/`offset` only; `ScheduledTasks` (lib) calls `sortScheduledTaskItems` (`libs/scheduled-tasks/src/utils/filter-sort.ts`) over the accumulated, already-fetched `items` array to produce display order. This means sort only ever orders whatever pages happen to be loaded — a task that should be first by `next_run_time` doesn't move to the top if it lives on page 3 and the user hasn't scrolled there. `ScheduledTasksSortKey` (`firstToRun` | `lastToRun` | `newest` | `nameAZ`) is already the shared enum name used by the toolbar UI and by `sortScheduledTaskItems`.

## Goals / Non-Goals

**Goals:**
- Push sort order to the upstream Scheduler via `order_by`/`order_dir`, so the 4 existing sort options apply to the full search-filtered remote dataset, not just loaded pages.
- Reuse `ScheduledTasksSortKey` as the BFF-facing `sort` contract name — no new enum, no new UI, no new i18n keys.
- Keep the BFF cache correct by extending the existing `{limit, offset, search}` cache-key normalization to include `sort`.

**Non-Goals:**
- Reimplementing "missing `next_run_time` sorts last" logic in the frontend — upstream already handles this when `order_by=next_run_time`.
- Any change to the toolbar UI, sort option labels, or i18n keys.
- Persisting the user's sort preference across sessions (noted as a possible follow-up, not built here).
- Metadata filters, Skill picker, or any other scheduled-task UI surface.

## Decisions

### 1. BFF `sort` param mirrors the frontend enum name; BFF owns the upstream mapping

`GET /api/v1/scheduled-tasks` gains:

| Param | Type | Validation | Behavior when omitted |
|---|---|---|---|
| `sort` | string | `@IsOptional() @IsEnum(ScheduledTasksSortKey)` | defaults to `firstToRun` before building the upstream URL |

`ScheduledTasksSortKey` is redefined (or mirrored — see Decision 4) inside `apps/chat-api/src/scheduled-tasks/dto/` as the DTO-level enum, with values `firstToRun` | `lastToRun` | `newest` | `nameAZ`, matching the frontend lib's existing enum values exactly so no translation layer is needed between the two.

The BFF always sends an explicit `order_by` **and** `order_dir` upstream, even when the client omits `sort` — this makes the BFF's own default (`firstToRun` → `next_run_time asc`) the observable default, rather than silently inheriting upstream's raw `created_at desc` default, which doesn't match today's UI default in `useScheduledTasks`.

Alternative considered: let the BFF omit `order_by`/`order_dir` when `sort` is omitted and rely on upstream's default. Rejected — it would silently change the default sort order depending on whether the client happens to pass `sort` on the first request, and decouples the BFF's documented default from what it actually returns.

### 2. Direct 1:1 mapping table, no upstream ordering logic in the frontend

```
firstToRun → order_by=next_run_time, order_dir=asc
lastToRun  → order_by=next_run_time, order_dir=desc
newest     → order_by=created_at,    order_dir=desc
nameAZ     → order_by=name,           order_dir=asc
```

This mapping lives in `ScheduledTasksService` alongside the existing `search` → `name` passthrough mapping added in the prior change. No enum-value renaming, no partial/fuzzy mapping — each of the 4 UI options maps to exactly one upstream pair.

**Confirmed during manual verification against a live DIAL Scheduler**: upstream's `order_by` enum accepts exactly `created_at`, `next_run_time`, or `name` — a `display_name` value was tried first (matching the schedule model's field name) and rejected with a `422` validation error (`"Input should be 'created_at', 'next_run_time' or 'name'"`). Reverting to `order_by=name` resolves to the expected alphabetical-by-title order in manual testing, confirming `name` is the correct upstream field for this sort option.

### 3. Cache key extends to `{limit, offset, search, sort}`; TTL and invalidation strategy unchanged

Cache key becomes `` `scheduled-tasks:list:${userSub}:${normalizedParams}` `` where `normalizedParams` now serializes `{limit, offset, search, sort}` with defaults applied before serialization (so an omitted `sort` and an explicit `sort=firstToRun` produce the same key). `LIST_CACHE_TTL_MS` (30s) and the existing "delete all cached variants for the user on create/update" invalidation behavior are unchanged — they already have to handle a growing key family from the prior change's `{limit, offset, search}` addition, so no new invalidation logic is needed, only extending the key's serialized shape.

### 4. Remove the "unknown `sort` rejected" contract test; frontend stops sorting client-side

The prior change's `scheduled-tasks-api` spec had a scenario asserting the BFF rejects any `sort` query param (`whitelist:true, forbidNonWhitelisted:true` on the global `ValidationPipe` means an unrecognized query key 400s). That scenario is removed and replaced with the opposite contract: `sort` is accepted when it is one of the 4 enum values, and still 400s for any other value (validation behavior is unchanged in mechanism — `sort` simply moves from "unknown key" to "known key with an enum constraint").

On the frontend, `ScheduledTasks` (lib) stops calling `sortScheduledTaskItems` for display order and renders `items` in the order the hook returns them (i.e., server order). `sortScheduledTaskItems` is deleted from `libs/scheduled-tasks/src/utils/filter-sort.ts` (nothing else in the codebase consumes it, confirmed by grep during implementation) along with its ordering-assertion unit tests. `ScheduledTasksSortKey` itself is kept — it's now the shared contract name between UI toolbar state and the BFF `sort` param, referenced from both `libs/scheduled-tasks` (UI) and `apps/chat-api` (DTO), not duplicated ordering logic.

### 5. `useScheduledTasks`: `sortKey` change resets pagination exactly like `searchQuery` change

Both `searchQuery` and `sortKey` become "reset triggers": any change to either resets `items` to `[]`, resets `offset` to `0`, aborts any in-flight request (existing `AbortController` pattern from the prior change), and refetches page 0 with the current `{search, sort}` pair. `loadMore()` must include the **current** `sortKey` (mapped to `sort`) on every subsequent page request, so appended pages stay in the same server-chosen order as page 0 — there is no client-side re-sort step after append to paper over a mismatched page's order.

Unlike `searchQuery` (debounced ~300ms to avoid a request per keystroke), `sortKey` changes are user-initiated discrete toolbar selections (not free text), so they fetch immediately with no debounce.

## Risks / Trade-offs

- **[Risk] Reversing a prior "descoped, not supported" design decision could resurface if the upstream contract description turns out to be stale again** → Mitigation: this design explicitly cites the confirmed `order_by`/`order_dir` parameters and their allowed values from the current Scheduler service source (see proposal Context); if upstream changes again, the failure mode is a 400/500 from Scheduler on an unrecognized param, not a silent wrong-order result, since the BFF passes the enum-validated value straight through.
- **[Risk] Removing `sortScheduledTaskItems` and its tests deletes the last line of defense if the BFF ever returns unsorted data (e.g., cache serves a stale cross-sort-key response due to a key-normalization bug)** → Mitigation: cache-key extension in Decision 3 is the only place this could regress; the added service-level tests (cache keys differ per `sort` value) are the direct check, not a frontend re-sort safety net.
- **[Risk] Increased cache cardinality (`limit × offset × search × sort` combinations) further lowers hit rate on top of the prior change's `{limit, offset, search}` expansion** → Accepted, same trade-off already made in the prior change; 30s TTL keeps staleness bounded regardless of hit rate.

## Migration Plan

No data migration. Rollout is a single coordinated deploy of BFF + OpenAPI regen + frontend, since the frontend's `sort` query param is additive on the BFF side (BFF still works with `sort` omitted) but the frontend removal of client-side sorting depends on the BFF actually applying `sort` — deploy BFF first (backward compatible), then frontend.

## Open Questions

(none blocking — upstream `order_by`/`order_dir` contract and allowed values are confirmed from source, per proposal Context)
