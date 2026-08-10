## Why

The backend `PUT /api/v1/scheduled-tasks/:scheduleId` (`updateScheduledTask`) endpoint, its DTOs, and the frontend `server-api` wrapper already exist and are fully functional, but there is no UI path to reach them: the `scheduled-task-detail-page` spec explicitly forbids an Edit control in the header (`openspec/specs/scheduled-task-detail-page/spec.md:57-69`), and the `scheduled-tasks-api` spec notes `updateScheduledTask` is "not wired to UI in the current iteration" (`openspec/specs/scheduled-tasks-api/spec.md:18`). A user who wants to fix a typo in a prompt or move a run time currently has to delete the task and recreate it from scratch. This change closes that gap by wiring the existing update endpoint to a new edit page reached from the detail page.

## What Changes

- Amend the `scheduled-task-detail-page` header requirement to allow an **Edit** action (outlined button, pencil icon, inline-end of the header), rendered only once the task has loaded successfully. **BREAKING** (spec-level): supersedes the current "header SHALL NOT render Edit... controls" requirement.
- Add an `onEdit?: () => void` prop to `ScheduledTaskDetailViewProps` and restructure the detail view's header to an end-side action slot (`libs/scheduled-tasks`, host-agnostic — no routing/API knowledge added to the lib).
- Add a new route `/scheduled-tasks/:scheduleId/edit` (`ROUTES.ScheduledTaskEdit`) with a `getScheduledTaskEditRoute(scheduleId)` builder, lazy-loaded and registered in `apps/chat/src/app/app.tsx` following the existing `ScheduledTaskDetail`/`ScheduledTaskCreate` pattern.
- Add a new `ScheduledTaskEditPage` that fetches the task via `getScheduledTask`, prefills the existing `ScheduledTaskCreateForm` editor via a new reverse mapper (DTO → form values), and submits via `updateScheduledTask` instead of `createScheduledTask`. No changes to `ScheduledTaskCreateForm`'s presentational contract are required — the page supplies edit-flavored labels/values/`onSubmit`.
- Add a reverse trigger/cron mapper (`mapScheduledTaskDtoToFormValues` or equivalent) that inverts `buildCronFields`/`buildCronWindowBoundary` (UTC → local), and a fail-safe path: if a task's trigger or required fields (`model`, `prompt`) cannot be represented losslessly by the current editor, the edit page shows a non-destructive error and disables Save rather than submitting a coerced value.
- Wire `ScheduledTaskCard`'s already-existing `onEdit` overflow-menu action (`libs/scheduled-tasks/src/components/ScheduledTaskCard/ScheduledTaskCard.tsx:74-83`, currently unwired at `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx:124-126`) to the same edit route, since the lib-side plumbing already exists and the marginal cost is one page-level callback.

## Capabilities

### New Capabilities

None — this reuses the existing `scheduled-task-create-form` presentational contract and existing API surface rather than introducing a new capability.

### Modified Capabilities

- `scheduled-task-detail-page`: header gains a conditional Edit action; supersedes the "no Edit control" requirement; adds navigation to the edit route.
- `scheduled-task-create-form`: the create-form's host page(s) gain an edit mode — page-owned prefill, reverse trigger mapping, and update-vs-create submission — while the presentational component contract is unchanged. Delta spec documents the new page-level edit behavior built on top of the existing form.
- `navigation-routing` — if no scheduled-tasks-specific routing requirements exist there already, this section is a no-op; otherwise the new route is added following the documented pattern (`openspec/specs/navigation-routing/spec.md`).

`scheduled-tasks-api` is unchanged: `PUT /api/v1/scheduled-tasks/:scheduleId` already exists and is already spec'd; this change only starts consuming it. No delta spec needed there.

## Impact

- **Frontend routes**: `apps/chat/src/types/routes.ts` (new `ScheduledTaskEdit` enum value), `apps/chat/src/constants/routes.ts` (new `getScheduledTaskEditRoute` builder), `apps/chat/src/app/app.tsx` (new lazy route registration).
- **Frontend pages**: new `apps/chat/src/pages/ScheduledTaskEditPage/ScheduledTaskEditPage.tsx`; `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx` (new `onEdit` handler); `apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx` (wire existing `onEdit` prop).
- **Frontend utils**: `apps/chat/src/utils/scheduled-task-trigger.ts` (new reverse mapper + representability check).
- **Lib**: `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/` (new `onEdit` prop, header layout change); no changes to `ScheduledTaskCreateForm`'s public contract.
- **i18n**: new keys for Edit button, edit-page title, update success/failure notifications, and unsupported-trigger error message.
- **No backend, DTO, OpenAPI, or generated-client changes** — `PUT /api/v1/scheduled-tasks/:scheduleId` and `updateScheduledTask` are already implemented and unmodified by this change.
- **Known trust-boundary note** (not changed by this proposal, but relevant to review): `apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts` has no explicit `createdBy === sub` check on `getScheduledTask`/`updateScheduledTask`; ownership scoping relies entirely on forwarding the caller's own access token to DIAL Scheduler upstream. This change does not alter that boundary and treats it as an existing, accepted trust assumption.
