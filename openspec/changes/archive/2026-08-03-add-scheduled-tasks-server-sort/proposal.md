## Why

The Scheduled Tasks list currently sorts only the tasks already loaded on the client, so once search/pagination (`2026-08-03-scheduled-tasks-search-sort-pagination`) is in place, sort order breaks down for any dataset larger than the first page — a task ordered "first to run" can be sitting on a page the user hasn't loaded yet. The upstream DIAL Scheduler already supports `order_by`/`order_dir` on `GET /schedules/`, so sort should be pushed through the BFF and applied server-side, over the full remote (search-filtered) dataset, instead of only over loaded pages.

## What Changes

- Add optional `sort?: ScheduledTasksSortKey` query param to `GET /api/v1/scheduled-tasks` (BFF), validated against the same 4-value enum already used by the frontend toolbar (`firstToRun` | `lastToRun` | `newest` | `nameAZ`).
- Map each `sort` value to upstream `order_by`/`order_dir` in `ScheduledTasksService`; BFF always sends an explicit `order_by`/`order_dir` pair upstream (default `firstToRun` when the client omits `sort`), rather than relying on upstream's raw `created_at desc` default.
- Extend the existing response cache key to include `sort` alongside `{limit, offset, search}`.
- **BREAKING (internal contract only, no external consumers)**: remove the current BFF validation that rejects any `sort` query param — `sort` becomes a supported, first-class param instead of a rejected one.
- `useScheduledTasks`: pass `sort` on every fetch (initial load, sort change, debounced search, load-more); a `sortKey` change resets `items` and refetches from offset 0, same as a search change.
- `ScheduledTasks` lib stops re-sorting the loaded `items` array client-side and renders server-returned order directly; `sortScheduledTaskItems` client-side comparator is removed (or deprecated if referenced elsewhere) along with its ordering-assertion tests.
- Regenerate OpenAPI + `@epam/chat-api-client` + `apps/chat/src/server-api/scheduled-tasks.api.ts` for the new query param.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `scheduled-tasks-api`: `GET /api/v1/scheduled-tasks` gains a `sort` query param mapped to upstream `order_by`/`order_dir`; cache-key requirement extended; the requirement rejecting unknown/unsupported `sort` params is removed.
- `scheduled-tasks-page-ui`: sort behavior changes from "client-side comparator over loaded items" to "server-driven sort over the full filtered dataset" — sort changes trigger a refetch/reset of pagination, and load-more preserves the active sort server-side.

## Impact

- **Backend**: `apps/chat-api/src/scheduled-tasks/` — DTO (`ListScheduledTasksQueryDto`), `ScheduledTasksService` upstream URL building, cache-key normalization, controller/service tests.
- **OpenAPI/codegen**: `openapi` spec, `@epam/chat-api-client`, `apps/chat/src/server-api/scheduled-tasks.api.ts`.
- **Frontend**: `apps/chat/src/hooks` (`useScheduledTasks`), `libs` scheduled-tasks UI (`ScheduledTasks` component, `sortScheduledTaskItems` util removal), associated spec/unit tests.
- **No i18n or UI label changes** — same 4 sort options, same toolbar UX.
