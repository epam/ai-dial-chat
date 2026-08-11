## Why

The Scheduled Tasks catalog (`/scheduled-tasks`) renders cards but has no drill-down: users cannot read a task's full configuration or inspect its run history without leaving the app. Upstream DIAL Scheduler already exposes both a schedule-detail endpoint and a paginated run-history endpoint (confirmed in `DIAL Scheduler.postman_collection.json`), but the BFF only proxies list/create/get/update and the `get` DTO does not yet surface `prompt`/`model`. This change adds the missing detail page and the BFF surface it needs.

## What Changes

- Add route `ROUTES.ScheduledTaskDetail` (`/scheduled-tasks/:scheduleId`) and a `getScheduledTaskDetailRoute(scheduleId)` helper; register a lazy-loaded `ScheduledTaskDetailPage` behind the existing `scheduledTasksEnabled` flag.
- Wire card-click navigation from the list (`ScheduledTasks` → `ScheduledTaskCardGrid` → `ScheduledTaskCard`) to the new route, with overflow-menu actions (`Edit`/`Run`/`Delete`) stopping propagation so they never trigger navigation.
- Extend `GET /api/v1/scheduled-tasks/:scheduleId` to additionally map `description`, `model`, and `prompt` from the upstream response, so the detail page has everything it needs from a single call.
- Add new endpoint `GET /api/v1/scheduled-tasks/:scheduleId/runs` — a paginated, non-cached proxy of the upstream `.../schedules/{scheduleId}/runs` list, forwarding `limit`/`offset` and always sending an explicit `order_by=created_at&order_dir=desc`. Regenerate `@epam/chat-api-client` and add `listScheduledTaskRuns` to `apps/chat/src/server-api/scheduled-tasks.api.ts`. Add matching Postman examples.
- Add a new presentational `ScheduledTaskDetailView` in `libs/scheduled-tasks`, plus `useScheduledTaskRuns` app hook, plus `ScheduledTaskDetailPage` app page: Details + Configuration (instructions rendered through the same `MarkdownRenderer`/`MDMessageViewer` stack chat messages use) + a History panel with infinite-scroll pagination (6-row skeletons, status icons for `success`/`error`/`in_progress`/`missed`).
- Header in this iteration is back-navigation + title only — no Edit/Delete/Active-toggle/Run-now controls.
- Add `scheduledTasks.detail.*` i18n keys; RTL/AAA a11y per existing repo rules.

**Out of scope** (see design.md for the full list): edit/delete/active-toggle/run-now on the detail header, `GET .../runs/{runId}`, polling/auto-refresh of in-progress runs, history search/sort UI, unread-dot indicators, and linking a run row to its conversation (no conversation id is exposed by the list-runs endpoint in this iteration).

## Capabilities

### New Capabilities

- `scheduled-task-detail-page`: The detail page itself — routing/navigation wiring, the `ScheduledTaskDetailView` presentational component, the `useScheduledTaskRuns` hook, History pagination/infinite-scroll behavior, loading/error/not-found states, i18n, and RTL/a11y for the new page.

### Modified Capabilities

- `scheduled-tasks-api`: `GET /api/v1/scheduled-tasks/:scheduleId` gains `model`/`prompt` fields; new `GET /api/v1/scheduled-tasks/:scheduleId/runs` endpoint (list, paginate, map, validate `scheduleId`, not cached).
- `navigation-routing`: New `ROUTES.ScheduledTaskDetail` route entry and `getScheduledTaskDetailRoute` helper registered alongside the existing route table.
- `scheduled-tasks-page-ui`: `ScheduledTaskCard`/`ScheduledTaskCardGrid`/`ScheduledTasks` gain an `onCardClick` prop threaded down from the page, wired to navigation; overflow-menu actions must stop click propagation.

## Impact

- `apps/chat/src/app/app.tsx` — new lazy route registration.
- `apps/chat/src/constants/routes.ts`, `apps/chat/src/types/routes.ts` — new route + helper.
- `apps/chat/src/hooks/scheduled-tasks/` — new `useScheduledTaskRuns.ts`.
- `apps/chat/src/server-api/scheduled-tasks.api.ts` — new `listScheduledTaskRuns` wrapper.
- `apps/chat/src/pages/` (or equivalent) — new `ScheduledTaskDetailPage`.
- `apps/chat/src/i18n/locales/en.json`, `apps/chat/src/constants/translation-keys.ts` — new `scheduledTasks.detail.*` keys.
- `apps/chat-api/src/scheduled-tasks/` — controller/service/mapper/DTOs for the new runs endpoint and the extended get-detail mapping.
- `libs/scheduled-tasks/` — new `ScheduledTaskDetailView` component and supporting sub-components; `onCardClick` prop on existing card/grid components.
- `libs/chat-api-client` — regenerated client for the new endpoint.
- `postman/chat-api.postman_collection.json` — new request examples.
