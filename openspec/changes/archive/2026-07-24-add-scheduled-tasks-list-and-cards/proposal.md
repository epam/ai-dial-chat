## Why

Users can create scheduled tasks (`add-scheduled-task-create-form`) and the BFF can list them (`GET /api/v1/scheduled-tasks`, `add-scheduled-tasks-api`), but the Scheduled Tasks page never calls that endpoint — the content region always renders `PanelEmptyState` regardless of data. Search and sort controls exist in the toolbar but are inert. To validate the scheduled-tasks UX end-to-end, the list page needs to fetch real data and render it as a catalog-style card grid.

## What Changes

- Add `apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts`: fetches `listScheduledTasks()` on mount, exposes `items`/`isLoading`/`error`/`refetch`.
- Wire `ScheduledTasksPage` to the hook; refetch the list when the user navigates back from the create form so a newly created task appears without a manual reload.
- Map `ScheduledTaskDto[]` to a lib-facing `ScheduledTaskItem[]` shape.
- Extend `ScheduledTaskDto` (+ backend mapper) only if a live upstream/scheduler response confirms fields the card UI needs (e.g. `status`, `owner`, `createdAt`, prompt preview, `model`, `nextRunAt`) that aren't already on the DTO — no invented fields.
- Extend `@epam/ai-dial-scheduled-tasks` (`libs/scheduled-tasks`) with presentational, host-agnostic components: `ScheduledTaskCard`, `ScheduledTaskSection`, `ScheduledTaskCardGrid`, and update the `ScheduledTasks` root to branch on `isLoading` / `error` / empty / has-items / filtered-to-zero states instead of always rendering the empty state.
- Card titles render search matches via the shared `Highlight` component per `.claude/rules/search-results-highlight.md`.
- Implement client-side search (by `displayName`/description) and client-side sort (`firstToRun`, `lastToRun`, `newest`, `nameAZ`) over the fetched list — no new BFF query parameters.
- Card overflow menu is rendered via injected callbacks (`onEdit?`, `onRunNow?`, `onDelete?`); only wired where a real capability exists today. Run now / Delete have no backend endpoint yet and are out of scope for this change; Edit is wired only if an edit route already exists, otherwise omitted.
- New i18n keys under `scheduledTasks.list.*` / `scheduledTasks.card.*` (section titles, no-results copy, card menu labels, loading/error/retry).

## Capabilities

### New Capabilities

None — this change extends the existing `scheduled-tasks-page-ui` capability's UI surface rather than introducing an independently-versionable capability. Card/grid/search/sort behavior is added as new requirements on that spec.

### Modified Capabilities

- `scheduled-tasks-page-ui`: the "content region SHALL always render `PanelEmptyState`" requirement is replaced with conditional loading / error / empty / card-grid / no-results behavior, driven by fetched data, search, and sort.

## Impact

- **Affected code:** `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx`, new `apps/chat/src/hooks/scheduled-tasks/useScheduledTasks.ts`, `apps/chat/src/utils/map-scheduled-task-dto.ts` (or page-local mapping), `libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx` and new sibling components, `apps/chat/src/i18n/locales/*.json`, `apps/chat/src/constants/translation-keys.ts`.
- **`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`**: fixed a bug where `listScheduledTasks` always resolved zero items against a real DIAL Scheduler, which returns a paginated `{ results }` envelope rather than `{ items }` or a bare array. Found via debug logging added while investigating "tasks are created but the list is empty".
- **`apps/chat-api/src/scheduled-tasks/dto/scheduled-task.dto.ts`, `scheduled-tasks.mapper.ts`**: extended with confirmed-present optional `nextRunTime`/`createdAt` fields (regenerated OpenAPI spec/client accordingly).
- **Dependencies:** requires `add-scheduled-tasks-api` and `add-scheduled-task-create-form` already merged (both are archived).
- **No changes** to routing, feature flag, or navigation gating — those are established by `scheduled-tasks-page-ui` and untouched here.
