## Why

`GET /api/v1/scheduled-tasks` fetches only a single upstream page and the frontend searches/sorts entirely client-side over that one page (`libs/scheduled-tasks/src/utils/filter-sort.ts`). Users with more schedules than fit on one upstream page never see the rest, and search only ever operates on the fetched slice, not the full dataset. The BFF's `ListScheduledTasksResponseDto` already surfaces `count`/`limit`/`offset`/`next`/`previous`, but nothing consumes them. This change wires real pagination and search through to the upstream DIAL Scheduler, with infinite scroll and skeleton loading on the frontend. Sort stays client-side and out of scope for server-driven behavior: the upstream DIAL Scheduler's `list_schedules` endpoint has no sort/order parameter at all (confirmed from its source), so there is no upstream capability to wire sort into.

## What Changes

- Extend `GET /api/v1/scheduled-tasks` to accept `limit`, `offset`, and `search` query parameters, validated in a request DTO, and forward them to the upstream DIAL Scheduler list call (`search` maps to upstream's `name` substring filter; `limit`/`offset` pass through unchanged).
- Change the per-user list cache (`scheduled-tasks:list:${userSub}`, 30s TTL) to vary by normalized `{limit, offset, search}`.
- Replace client-side-only search (`filterScheduledTaskItems` in `libs/scheduled-tasks/src/utils/filter-sort.ts`) with server-driven search: the frontend hook resets and refetches page 0 on search change instead of filtering the already-fetched array. Sort (`sortScheduledTaskItems`) is unchanged — it keeps ordering whatever items are currently loaded in the browser, since there is no upstream sort to defer to.
- Add infinite scroll to the Scheduled Tasks list: a scroll sentinel triggers fetching and appending the next page when the user reaches the bottom of the card grid.
- Add a loading state for "load more" distinct from the existing initial-load spinner: exactly 6 skeleton cards render below the loaded cards while the next page is in flight.
- Regenerate the OpenAPI client and the `apps/chat/src/server-api/scheduled-tasks.api.ts` wrapper to accept the new list parameters.
- **BREAKING**: none — `GET /api/v1/scheduled-tasks` gains optional query parameters with backward-compatible defaults (omitting them preserves today's single-page behavior); no existing field is removed from the response envelope.

## Capabilities

### New Capabilities

(none — this change modifies requirements of two existing capabilities)

### Modified Capabilities

- `scheduled-tasks-api`: `GET /api/v1/scheduled-tasks` gains `limit`/`offset`/`search` query parameters forwarded upstream (`search` → upstream `name`), and the list cache key/strategy changes to account for query-param variance. No `sort` parameter is added — upstream has no sort capability.
- `scheduled-tasks-page-ui`: search becomes server-driven (reset + refetch on search change) instead of client-side filtering over a single fetched page; the list gains infinite-scroll pagination and load-more skeleton states. Sort remains an unchanged client-side operation over the currently loaded items.

## Impact

- `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts` — accept and validate new query params.
- `apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts` — forward `limit`/`offset` and `search` (as upstream `name`) upstream, adjust cache key/TTL strategy.
- `apps/chat-api/src/scheduled-tasks/dto/` — new request DTO for list query params (`limit`, `offset`, `search`).
- `libs/chat-api-client/openapi.json` (regenerated) and `apps/chat/src/server-api/scheduled-tasks.api.ts` — list method gains `{ limit?, offset?, search?, signal? }`.
- `apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts` — refactor to own pagination/search state, debounced search, append-on-load-more, abort in-flight requests on search change; sort continues to be applied client-side to the accumulated items.
- `libs/scheduled-tasks/src/utils/filter-sort.ts` — `filterScheduledTaskItems` removed (search is now server-driven); `sortScheduledTaskItems` kept unchanged.
- `libs/scheduled-tasks/src/components/` — new `ScheduledTaskCardSkeleton`, scroll-sentinel/load-more wiring, `hasMore`/`isLoadingMore`/`onLoadMore` props on `ScheduledTasks`.
- `DIAL Scheduler.postman_collection (1).json` (repo root) — extend with `List schedules (limit & offset)`, `List schedules (search)`, and `List schedules (combined)` example requests using the confirmed `limit`/`offset`/`name` params (no sort example, since none exists upstream).
