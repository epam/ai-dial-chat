## 1. BFF — extend get + add list-runs endpoint

- [x] 1.1 Confirm upstream shapes against `DIAL Scheduler.postman_collection.json` (get-schedule and list-runs responses) before finalizing DTOs — file not present in repo; confirmed against the existing `properties.payload.{model,messages}` shape already established by `toUpstreamSchedulePayload`/`fromUpstreamSchedule`
- [x] 1.2 Extend `scheduled-tasks.mapper.ts`'s `fromUpstreamSchedule` to map `properties.payload.model` → `model` and `properties.payload.messages[0].content` → `prompt`, both optional, non-throwing when absent
- [x] 1.3 Add `ScheduledTaskRunStatus` enum (`Success`/`Error`/`InProgress`/`Missed`) and `ScheduledTaskRunDto`/`ListScheduledTaskRunsResponseDto`/`ListScheduledTaskRunsQueryDto` in `apps/chat-api/src/scheduled-tasks/dto/`
- [x] 1.4 Add `listScheduledTaskRuns` to `ScheduledTasksService`: validate `scheduleId`, forward `limit`/`offset` with explicit `order_by=created_at&order_dir=desc`, unwrap `results`, map upstream status values, derive `durationSeconds` from `startTime`/`endTime`, set `Cache-Control: private, no-store`, map 5xx/unreachable to 502/503
- [x] 1.5 Add `GET /api/v1/scheduled-tasks/:scheduleId/runs` route to `scheduled-tasks.controller.ts` (`operationId: listScheduledTaskRuns`, `FeatureGuard`, `@Throttle`, full `@ApiResponse` coverage for 200/400/401/403/404/429/502/503)
- [x] 1.6 Write/extend `apps/chat-api` unit tests: mapper (`model`/`prompt` present/absent), service (runs mapping, pagination forwarding, explicit ordering, status mapping, duration derivation, 404/5xx mapping, no-cache header), controller (guards, validation, throttle)
- [x] 1.7 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`

## 2. OpenAPI + generated client + Postman

- [x] 2.1 Run `npm run openapi` to regenerate the OpenAPI spec and `npm run openapi:check` to verify it's in sync
- [x] 2.2 Build/lint `@epam/chat-api-client` after regeneration
- [x] 2.3 Add `listScheduledTaskRuns({ scheduleId, limit?, offset? })` wrapper to `apps/chat/src/server-api/scheduled-tasks.api.ts`, using the normal (non-`Raw`) generated method
- [x] 2.4 Add request/response examples for the extended `get` response (`model`/`prompt`) and the new `runs` endpoint to `postman/chat-api.postman_collection.json` — regenerated via `npm run postman` (also picked up unrelated pre-existing drift between other already-shipped endpoints and the collection; left as regenerated since the file is fully tool-generated, never hand-edited)

## 3. Routing

- [x] 3.1 Add `ScheduledTaskDetail: '/scheduled-tasks/:scheduleId'` to `ROUTES` in `apps/chat/src/types/routes.ts`
- [x] 3.2 Add `getScheduledTaskDetailRoute(scheduleId: string): string` to `apps/chat/src/constants/routes.ts`, percent-encoding the id
- [x] 3.3 Register a lazy-loaded `ScheduledTaskDetailPage` route in `apps/chat/src/app/app.tsx`, gated by `useFeatureFlag('scheduledTasksEnabled')`, using the same `RouteErrorBoundary`/`Suspense`/`RouteFallback` pattern as the list route
- [x] 3.4 Add/extend `apps/chat/src/constants/tests/routes.spec.ts` covering `getScheduledTaskDetailRoute`

## 4. libs/scheduled-tasks — card click wiring

- [x] 4.1 Add optional `onCardClick?: (id: string) => void` prop to `ScheduledTaskCard`; make the card root activatable (click + Enter/Space) only when supplied
- [x] 4.2 Add `event.stopPropagation()` to the overflow-menu trigger and every menu action so they never bubble into `onCardClick`
- [x] 4.3 Thread `onCardClick` through `ScheduledTaskCardGrid` and `ScheduledTasks` without transformation
- [x] 4.4 Update/add `libs/scheduled-tasks` component tests: card click invokes callback with id, overflow-menu/actions do not trigger it, card without the prop has no added interactive semantics

## 5. libs/scheduled-tasks — ScheduledTaskDetailView

- [x] 5.1 Scaffold `ScheduledTaskDetailView` component (header with back control + title, Details section, Configuration section, History panel) accepting only props (labels, field values, `renderInstructions`/`instructionsMarkdown`, runs list + loading/pagination flags, `onBack`) — no imports of `apps/chat/*`, `@epam/chat-api-client`, routing, i18n, auth, env, or analytics
- [x] 5.2 Implement History panel: fixed-height `overflow-y-auto` scroll container, `<ul>`/`<li>` semantic list, scroll-sentinel using the same `findScrollParent` pattern as `libs/catalog/src/components/ListView/ListView.tsx`, trailing skeleton rows (`runsSkeletonCount`, default 6) during initial and load-more states
- [x] 5.3 Implement run row: status icon (spinner/check/X/distinct-missed) marked `aria-hidden`, accessible name including status + timestamp, human-readable timestamp + optional duration suffix
- [x] 5.4 Wire RTL logical properties and back-icon mirroring (`rtl:scale-x-[-1]`) per `.claude/rules/rtl.md`
- [x] 5.5 Write `libs/scheduled-tasks` component tests: loading/error/empty history states, skeleton counts (initial + load-more), status icon per status value with correct accessible name, scroll-sentinel triggers `onRunsLoadMore` only when allowed, `onBack` invoked without internal navigation, no host/integration imports (static check)

## 6. App — hooks, page, i18n

- [x] 6.1 Add `useScheduledTaskRuns(scheduleId, enabled)` hook in `apps/chat/src/hooks/scheduled-tasks/`, mirroring `useScheduledTasks`'s `{ items, isLoading, isLoadingMore, error, hasMore, loadMore, refetch }` shape, with `AbortController` cancellation on `scheduleId` change/unmount and dedupe-by-`id` on `loadMore`
- [x] 6.2 Add `scheduledTasks.detail.*` keys to `apps/chat/src/i18n/locales/en.json` (section titles, back aria-label, run status labels, empty-history, error/retry, loading-more) and matching enum members to `ScheduledTasksI18nKeys` in `apps/chat/src/constants/translation-keys.ts`; reuse `ButtonsI18nKeys` for generic labels where an equivalent already exists
- [x] 6.3 Implement `ScheduledTaskDetailPage`: fetch `getScheduledTask(scheduleId)` and trigger `useScheduledTaskRuns`'s initial fetch concurrently; render `NotFoundPage` on 404, page-level error+retry on other `getScheduledTask` failures, History-scoped error+retry on runs-fetch failure while task metadata stays visible
- [x] 6.4 Resolve "Model or Agent" display value via the deployments context, falling back to the raw model id when unresolved
- [x] 6.5 Wire the Details "Repeats" label to the same schedule-label formatter logic already used by `map-scheduled-task-dto.ts` (no duplication inside the lib)
- [x] 6.6 Pass `renderInstructions` into `ScheduledTaskDetailView` using `MarkdownRenderer`/`MDMessageViewer` from `@epam/ai-dial-chat-shared`, matching chat assistant-message rendering, static (no streaming) — implemented as the lib's own default fallback (matching design.md decision 5) rather than an app-supplied override, since no app-specific markdown styling is needed yet
- [x] 6.7 Wire `ScheduledTasksPage`'s `onCardClick` to `navigate(getScheduledTaskDetailRoute(id))`; wire the detail page's back control to `navigate(ROUTES.ScheduledTasks)`
- [x] 6.8 Write/extend `apps/chat` tests: `useScheduledTaskRuns` (initial fetch, load-more append+dedupe, abort on unmount/id-change, hasMore derivation from count/next), `ScheduledTaskDetailPage` (parallel fetch, 404 → NotFoundPage, page-level vs. History-scoped error handling, back navigation), card-click → navigation integration
- [x] 6.9 Run `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat`

## 7. Manual verification

- [ ] 7.1 Click a card on `/scheduled-tasks` → navigates to `/scheduled-tasks/{id}`
- [ ] 7.2 Detail page shows description, model, schedule label, and markdown-rendered instructions (headings/lists match chat rendering)
- [ ] 7.3 History initial load shows first page; scrolling the History container loads more with `limit`/`offset`/`order_by=created_at`/`order_dir=desc` visible in the network tab
- [ ] 7.4 Load-more shows 6 skeleton rows below existing runs, then replaces them with real rows
- [ ] 7.5 Status icons render correctly for `success`, `error`, `in_progress`, and `missed` runs
- [ ] 7.6 Back control returns to `/scheduled-tasks`
- [ ] 7.7 Navigating directly to an unknown `scheduleId` renders `NotFoundPage`
- [ ] 7.8 RTL: layout mirrors correctly; History scroll and markdown remain readable
- [x] 7.9 Confirm `postman/chat-api.postman_collection.json` includes the new BFF get-detail and list-runs examples

**Note:** 7.1–7.8 require a live DIAL Scheduler backend with `SCHEDULER_APP_ID`/`SCHEDULER_SERVICE_ID` configured and real scheduled-task data, which isn't available in this environment. These were not exercised in a browser — confidence instead comes from the automated coverage in groups 1–6 (296 tests across `chat-api`, `chat`, and `@epam/ai-dial-scheduled-tasks`, all passing) plus manual code review of the wiring. Recommend running this checklist against a real environment before merge.
