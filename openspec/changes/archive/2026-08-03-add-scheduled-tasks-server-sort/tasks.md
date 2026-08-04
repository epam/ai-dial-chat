## 1. BFF: DTO and enum

- [x] 1.1 Add `ScheduledTasksSortKey` enum (`firstToRun` | `lastToRun` | `newest` | `nameAZ`) under `apps/chat-api/src/scheduled-tasks/dto/`, matching the frontend `libs/scheduled-tasks` enum values exactly.
- [x] 1.2 Add optional `sort?: ScheduledTasksSortKey` to `ListScheduledTasksQueryDto` with `@IsOptional() @IsEnum(ScheduledTasksSortKey)` and `@ApiPropertyOptional` Swagger metadata.

## 2. BFF: service mapping and caching

- [x] 2.1 In `ScheduledTasksService`, add the `sort` → `{order_by, order_dir}` mapping table (`firstToRun`→`next_run_time`/`asc`, `lastToRun`→`next_run_time`/`desc`, `newest`→`created_at`/`desc`, `nameAZ`→`name`/`asc`) and always send both `order_by` and `order_dir` upstream, defaulting to the `firstToRun` mapping when `sort` is omitted.
- [x] 2.2 Extend the list cache-key normalization to include `sort` (with default applied) alongside `{limit, offset, search}`; verify `invalidateListCache` still clears every variant for the user.
- [x] 2.3 Remove the existing controller/service test asserting an unknown `sort` query param is rejected as an unrecognized field; add tests: each of the 4 `sort` values forwards the correct `order_by`/`order_dir` pair, omitted `sort` forwards the `firstToRun` mapping, an invalid `sort` value 400s, and cache keys differ per `sort` value.
- [x] 2.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 3. OpenAPI and generated client

- [x] 3.1 Update the `scheduled-tasks-api` OpenAPI source for the new `sort` query parameter (enum values, description, default behavior).
- [x] 3.2 Run `npm run openapi` and `npm run openapi:check`; regenerate `@epam/chat-api-client`.
- [x] 3.3 Update `apps/chat/src/server-api/scheduled-tasks.api.ts`'s `listScheduledTasks` wrapper to accept and forward `sort`.
- [x] 3.4 Build/lint the regenerated `chat-api-client` project.

## 4. Frontend: stop client-side sorting

- [x] 4.1 Remove `sortScheduledTaskItems` (and its ordering-assertion tests) from `libs/scheduled-tasks/src/utils/filter-sort.ts`, after confirming via grep that nothing else in the codebase imports it.
- [x] 4.2 Update `ScheduledTasks` (lib) to render `items` in received order for both grouping and within-group ordering, removing the sort-before-group step; keep `sortKey`/`onSortChange` wired to the toolbar control only.
- [x] 4.3 Keep `ScheduledTasksSortKey` exported from the lib as the shared contract type.

## 5. Frontend: wire sort into data fetching

- [x] 5.1 Update `useScheduledTasks` (`apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts`) so a `sortKey` change resets `items`/`offset` and triggers an immediate (non-debounced) refetch at page 0, passing `sort: sortKey` — mirroring the existing `searchQuery` reset-and-refetch behavior.
- [x] 5.2 Pass `sort: sortKey` on every `listScheduledTasks` call: initial mount fetch, sort-change refetch, debounced search refetch, `loadMore()`, and `refetch()` after create.
- [x] 5.3 Ensure `loadMore()` uses the current `sortKey` value (not a stale closure) so appended pages stay in server order.
- [x] 5.4 Update `useScheduledTasks.spec.ts`: invert the existing "sort does not trigger a fetch" test into "sort change triggers a new fetch with the new `sort` param and resets pagination offset."

## 6. Frontend: verification

- [x] 6.1 Run `npm exec nx test chat @epam/ai-dial-scheduled-tasks` and `npm exec nx lint chat @epam/ai-dial-scheduled-tasks`. (Ran via direct `vitest`/`eslint` invocations on the touched projects/files, since the Nx-wired `test`/`lint` targets currently fail upstream of this change on pre-existing, unrelated errors in `@epam/ai-dial-attachment-input` and `@epam/ai-dial-chat-shared`.)
- [x] 6.2 Manual check with >20 scheduled tasks (mix of active/paused, varied `createdAt`/`nextRunTime`/`displayName`): confirm each of the 4 sort options changes order to match upstream, confirm changing sort resets the list and shows `sort=`/`order_by`/`order_dir` in the network tab, confirm load-more preserves sort order across pages, and confirm sort + search compose correctly. (Verified against a live DIAL Scheduler instance via debug logs + UI: `sort=nameAZ` initially mapped to `order_by=display_name`, which the live upstream rejected with `422` — corrected to `order_by=name`, then confirmed working correctly by the user in the running app.)

## 7. Docs

- [x] 7.1 If any `docs/` design doc describes the Scheduled Tasks list's search/sort/pagination contract, update it in the same commit to reflect server-driven sort. (Checked all of `docs/**/*.md` — none reference the Scheduled Tasks list endpoint, sort, or pagination contract; nothing to update.)
