## 1. Confirm data shape

- [x] 1.1 Inspect a live `GET {DIAL_CORE_URL}/v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules/` response (or the scheduler's `openapi.json` if no live instance is reachable) and record which of `createdAt`/`nextRunAt`/owner/visibility/prompt fields actually exist upstream.
- [x] 1.2 (N/A — no upstream source was reachable to confirm extra fields; `ScheduledTaskDto`/`scheduled-tasks.mapper.ts` left unchanged per the fallback in 1.3.) If confirmed fields are missing from `ScheduledTaskDto`, extend `apps/chat-api/src/scheduled-tasks/dto/scheduled-task.dto.ts` and `scheduled-tasks.mapper.ts` with `@ApiPropertyOptional` fields only (additive, non-breaking); update `apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.mapper.spec.ts`. Add a spec delta note only if `scheduled-tasks-api`'s own spec needs a field addition (check `openspec/specs/scheduled-tasks-api/spec.md`).
- [x] 1.3 If no additional fields are confirmed, document in a short note in this change's `design.md` open questions that the fallback (no `createdAt`/owner grouping) is what shipped, and proceed with `id`/`displayName`/`trigger`-only mapping.
- [x] 1.4 `npm exec nx test chat-api` && `npm exec nx lint chat-api` (only if 1.2 touched chat-api).

## 2. Lib: ScheduledTaskItem model and card

- [x] 2.1 Add `libs/scheduled-tasks/src/models/scheduled-task-item.ts` (`ScheduledTaskItem` interface per design.md).
- [x] 2.2 Add `libs/scheduled-tasks/src/components/ScheduledTaskCard/ScheduledTaskCard.tsx`: title via `Highlight` (`@epam/ai-dial-chat-shared`), optional "N NEW" badge, optional description line, schedule pill, optional location breadcrumb with RTL-mirrored chevron, overflow-menu trigger rendering only actions with a supplied `onEdit`/`onRunNow`/`onDelete` prop. `role="group"` + accessible name on the card root.
- [x] 2.3 Add `libs/scheduled-tasks/src/components/ScheduledTaskCard/tests/ScheduledTaskCard.spec.tsx`: title highlighting, pill/breadcrumb render-as-is (no formatting logic), overflow menu shows only supplied actions and calls the right callback with the card id.
- [x] 2.4 `npm exec nx test scheduled-tasks` && `npm exec nx lint scheduled-tasks`.

## 3. Lib: section, grid, and root state branching

- [x] 3.1 Add `libs/scheduled-tasks/src/components/ScheduledTaskSection/ScheduledTaskSection.tsx` (title + count badge).
- [x] 3.2 Add `libs/scheduled-tasks/src/components/ScheduledTaskCardGrid/ScheduledTaskCardGrid.tsx` (responsive grid of `ScheduledTaskCard`, mobile-first per `.claude/skills/responsive-design/SKILL.md`).
- [x] 3.3 Update `libs/scheduled-tasks/src/models/scheduled-tasks-props.ts`: add `items: ScheduledTaskItem[]`, optional `error`, `onRetry`; keep `isLoading` default `false`.
- [x] 3.4 Update `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx` content region to branch: loading (`Spinner`) → error (message + retry) → empty source list (`PanelEmptyState`) → filtered-to-zero (no-results state) → grouped grid (group by `sectionKey`, sort by `sortKey`, render `ScheduledTaskSection`s of `ScheduledTaskCardGrid`). Add the `aria-live="polite"` status region announcing state transitions.
- [x] 3.5 Implement the sort comparator (`firstToRun`/`lastToRun` by `sortValues.nextRunAt`, `newest` by `sortValues.createdAt`, `nameAZ` by `displayName`; missing sort field sorts last) and the search filter (case-insensitive substring on `displayName` + `descriptionPreview`) as pure functions colocated with `ScheduledTasks` or in a small utils file within the lib.
- [x] 3.6 Update `libs/scheduled-tasks/src/index.ts` exports for the new components/types if consumers need them directly.
- [x] 3.7 Update/extend existing `ScheduledTasks` tests: loading, error+retry, empty list, filtered-to-zero, grouped grid render, sort ordering, search filtering. Verify no `apps/chat`/API-client/routing/flag/analytics imports anywhere in `libs/scheduled-tasks/src`.
- [x] 3.8 `npm exec nx test scheduled-tasks` && `npm exec nx lint scheduled-tasks`.

## 4. App: data fetching and mapping

- [x] 4.1 Add `apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts`: fetch `listScheduledTasks()` on mount using `AbortController` + cancelled flag + async/await (per `useFavicon.ts` pattern); expose `{ items, isLoading, error, refetch }`.
- [x] 4.2 Add `apps/chat/src/hooks/scheduled-tasks/tests/useScheduledTasks.spec.ts`: fetch-on-mount, unmount-before-resolve does not update state, refetch triggers a new call, rejected fetch sets `error`.
- [x] 4.3 Add `apps/chat/src/utils/map-scheduled-task-dto.ts`: map `ScheduledTaskDto[]` → `ScheduledTaskItem[]` — format `trigger` into a human-readable `scheduleLabel`, format `locationLabel`/`sectionKey` from whatever fields 1.1–1.3 confirmed (single `myTasks` section if no grouping data), compute `sortValues` from confirmed date fields.
- [x] 4.4 Add unit tests for the mapper covering: date-trigger vs cron-trigger label formatting, fallback single-section behavior when no owner/visibility data exists, missing optional fields don't throw.
- [x] 4.5 `npm exec nx test chat` && `npm exec nx lint chat`.

## 5. App: wire page, i18n, RTL/a11y

- [x] 5.1 Add new i18n keys (`scheduledTasks.list.*`, `scheduledTasks.card.*`: no-results, error, retry, section titles, menu action labels) to `apps/chat/src/i18n/locales/en.json` and every other locale file; add matching members to `ScheduledTasksI18nKeys` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 5.2 Update `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx`: call `useScheduledTasks`, map DTOs via `map-scheduled-task-dto.ts`, pass `items`/`isLoading`/`error`/`onRetry` into `ScheduledTasks`, resolve new i18n strings via `t()`.
- [x] 5.3 Wire refetch-after-create: on navigating back from `ScheduledTaskCreate`, detect the return (router state/location) and call `refetch()`.
- [x] 5.4 (Verified at code level only — no DIAL Core/auth backend available in this environment for a live browser pass.) Verify RTL mirroring (breadcrumb chevron, logical properties) and AAA a11y (`role="group"` on cards, `aria-expanded` on overflow trigger, keyboard-activatable retry control, `aria-live` announcements) manually with `dir="rtl"` and keyboard-only navigation.
- [x] 5.5 Update `apps/chat/src/pages/ScheduledTasksPage/tests/ScheduledTasksPage.spec.tsx` (or create it if absent): renders items from the hook, retry calls `refetch`, refetch fires after simulated return-from-create.
- [x] 5.6 `npm exec nx test chat` && `npm exec nx lint chat` && `npm exec nx build chat`.

## 6. Spec delta and manual verification

- [x] 6.1 Confirm `openspec/changes/add-scheduled-tasks-list-and-cards/specs/scheduled-tasks-page-ui/spec.md` matches the shipped behavior (update if implementation diverged, e.g. overflow-menu-empty decision from design.md's open question).
- [x] 6.2 (Verified via code-level review; no live browser session was available in this environment.) Manually verify in the running app with `scheduledTasksEnabled` on: create a few tasks, confirm card grid, search, sort, loading/error states, and RTL layout.
- [x] 6.3 `npm exec nx affected --target=test --base=origin/development-1.0` && `npm exec nx affected --target=lint --base=origin/development-1.0`.

## 7. Production fix: list envelope shape (found via debug logging against a real deployment)

- [x] 7.1 Add temporary debug logging to `ScheduledTasksService.fetchUpstream`/`listScheduledTasks` (URL, status, response shape, resolved item count) and to `useScheduledTasks` (resolved items / fetch errors) to diagnose "tasks are created but the list is empty".
- [x] 7.2 Root-cause via the logs: the real DIAL Scheduler list endpoint returns a paginated envelope `{ count, limit, offset, results, next, previous }`, not `{ items }` or a bare array — `listScheduledTasks` always resolved 0 items against a real instance. Fix: `ScheduledTasksService.extractListItems` now reads `results` first, `items` as a fallback, then a bare array.
- [x] 7.3 Extend `ScheduledTaskDto`/`scheduled-tasks.mapper.ts` with confirmed-present optional fields `nextRunTime`/`createdAt` (mapped from upstream `next_run_time`/`created_at`); regenerate the OpenAPI spec/client (`npm run openapi`, `npm run openapi:check`, build+lint `chat-api-client`); update `map-scheduled-task-dto.ts` to populate `sortValues` from the real fields (falling back to `trigger.date` for `nextRunAt`).
- [x] 7.4 Add/extend tests: backend mapper test for `next_run_time`/`created_at` mapping, backend service test for the `{results}` envelope, frontend mapper test for `nextRunTime`/`createdAt` precedence. Add delta spec `specs/scheduled-tasks-api/spec.md` (MODIFIED "List scheduled tasks", ADDED "Scheduled task next-run and creation timestamps").
- [x] 7.5 `npm exec nx test chat-api`, `npm exec nx test chat`, `npm exec nx lint chat-api`, `npm exec nx lint chat`, `npm exec nx build chat-api` — all green.

## 8. Follow-up: list envelope still drops fields (found via debug logging against a real deployment)

- [x] 8.1 (Unresolved, documented — no live instance reachable this pass to confirm.) Whether `GET .../route/v1/schedules/{scheduleId}` (single-item get) returns `trigger.cron.fields`/`trigger.date` remains unconfirmed, since the list endpoint does not (list items only carry `trigger_type: "cron"|"date"`). Decision: do not add per-item detail fetches (N+1) to work around this without that confirmation; the list-view schedule pill still falls back to the generic recurring label for list results, same as before this task section. `triggerType` is now mapped (8.2) as the best available signal until a follow-up confirms and wires per-item detail.
- [x] 8.2 Extend `ScheduledTaskDto`/`scheduled-tasks.mapper.ts` with the confirmed-present-but-unused list fields: `service_id` → `serviceId`, `trigger_type` → `triggerType` (new `ScheduleTriggerType` enum), `updated_at` → `updatedAt`, `created_by` → `createdBy` (all `@ApiPropertyOptional`, additive). Regenerated the OpenAPI spec/client (`npm run openapi`, `npm run openapi:check`, build+lint `chat-api-client`) — all green.
- [x] 8.3 Used `createdBy` (compared against the current user's sub, resolved via `useUser()` in `ScheduledTasksPage`) to split `sectionKey` into real `shared`/`myTasks` groups in `map-scheduled-task-dto.ts` (`resolveSectionKey`), replacing the hardcoded `'myTasks'` for every item; falls back to `'myTasks'` when `createdBy` or the current user's sub is unavailable.
- [x] 8.4 Extended `ListScheduledTasksResponseDto` with the upstream pagination envelope (`count`, `limit`, `offset`, `next`, `previous`) and threaded it through `ScheduledTasksService.listScheduledTasks`/new `extractListPagination`. Frontend paging contract ("load more" vs. all-at-once) is still an open product decision — `useScheduledTasks`/`ScheduledTasksPage` were deliberately left unwired to the new fields; a user with more schedules than the upstream page size still only sees the first page.
- [x] 8.5 Extended backend mapper tests (`serviceId` on the snake_case-mapping test, new test for `updated_at`/`trigger_type`/`created_by`) and the service test (pagination fields asserted on the `{results}` envelope test). Added frontend mapper tests for the `createdBy`-based section split (`myTasks` on match, `shared` on mismatch, fallback to `myTasks` when `currentUserSub` is absent) and a `ScheduledTasksPage` test update (mocks `useUser()`). Added spec deltas: `specs/scheduled-tasks-api/spec.md` (ADDED "Scheduled task ownership and trigger-kind metadata", ADDED "List response surfaces upstream pagination metadata") and `specs/scheduled-tasks-page-ui/spec.md` (ADDED "Card grouping reflects real ownership via createdBy").
- [x] 8.6 `npm exec nx test chat-api`, `npm exec nx test chat`, `npm exec nx lint chat-api`, `npm exec nx lint chat`, `npm exec nx build chat-api`, `npm exec nx build chat`, `npm run openapi:check` — all green.
