## Why

The Scheduled Task detail page (`apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`, header rendered by `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx:110-171`) currently offers no way to remove a task the owner no longer wants — the header only has the Active switch and Edit. DIAL Scheduler has published an updated contract, `DELETE /schedules/{schedule_id}`, that deletes a schedule (hard-deleting it when it has no run history, soft-deleting it with `is_deleted: true` when it does) and now also surfaces `is_deleted` on every schedule read. Without this change, users have no in-product way to stop and remove a task, and the BFF/frontend have no representation for a soft-deleted schedule that a stale link or bookmark could still resolve to.

## What Changes

- Add a destructive **Delete** action to the Scheduled Task detail-page header, positioned after Active and before Edit (Active → Delete → Edit), following the existing `ScheduledTaskDetailView` host-agnostic prop pattern (`onDelete`, `isDeleting`, `isDeleted`).
- Add an accessible confirmation dialog (reusing `ConfirmationPopup` / `ConfirmationPopupVariant.Danger` from `@epam/ai-dial-ui-kit`, the same pattern as `apps/chat/src/components/ConversationPanel/ConversationPanelMenu.tsx:174-195`) that must be confirmed before any delete request is sent, and that blocks Cancel/Escape/close from calling the API.
- Add the BFF endpoint `DELETE /api/v1/scheduled-tasks/:scheduleId` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`), proxying `DELETE {DIAL_CORE_URL}/.../schedules/{scheduleId}` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`), returning `204 No Content` and invalidating the existing list cache (`invalidateListCache`, `scheduled-tasks.service.ts:503-520`) on success.
- **BREAKING (generated client / DTO contract)**: add `isDeleted: boolean` to `ScheduledTaskDto`, mapped from upstream `is_deleted` in `fromUpstreamSchedule` (`scheduled-tasks.mapper.ts`); regenerate `@epam/chat-api-client` to add `deleteScheduledTask` and the new field. Existing consumers of `ScheduledTaskDto` are additive-only (new optional-safe field with a documented default of `false`/absent-treated-as-false), so this is additive rather than removing/renaming anything.
- Add a frontend `deleteScheduledTask(scheduleId)` wrapper in `apps/chat/src/server-api/scheduled-tasks.api.ts`, wired into `ScheduledTaskDetailPage.tsx` with success (notify + navigate to `ROUTES.ScheduledTasks`) and failure (stay on page, actionable notification) handling.
- Render an explicit read-only "deleted" state on the detail page when `isDeleted` is `true` (via direct URL or stale link), disabling Delete/Edit/Active while keeping History visible.
- Add i18n keys under the existing `scheduledTasks.detail` namespace and `ScheduledTasksI18nKeys` enum for the new labels/messages, with RTL and WCAG 2.1 AAA compliance.

## Non-goals

- Restoring a deleted Scheduled Task, or any restore endpoint/UI.
- Letting the caller choose hard vs. soft deletion — DIAL Scheduler decides this unilaterally; the BFF and frontend must not attempt to predict or influence it.
- Deleting run history — history remains visible for soft-deleted schedules wherever it's already shown today.
- A deleted-tasks list, filter, or any new listing surface for deleted tasks.
- Bulk deletion of multiple tasks in one action.
- Delete affordances on the Scheduled Tasks list cards or from conversation/message panels — only the detail-page header gets Delete in this change.
- Changing the Active switch's own behavior (it is reused, not modified, beyond sitting next to the new Delete button and being disabled while a delete is in flight).
- Any redesign of the detail-page header beyond inserting the Delete action into the existing action row.
- Implementing the feature itself as part of this OpenSpec proposal — this change produces `proposal.md`/`design.md`/spec deltas/`tasks.md` only; implementation happens under `/opsx:apply`.

## Capabilities

### New Capabilities

_None._ This change extends two existing capabilities rather than introducing a new one.

### Modified Capabilities

- `scheduled-task-detail-page`: adds the Delete header action, the confirmation-dialog flow, the deleted-state read-only rendering, and the `onDelete`/`isDeleting`/`isDeleted` props on `ScheduledTaskDetailView`.
- `scheduled-tasks-api`: adds the `DELETE /api/v1/scheduled-tasks/:scheduleId` endpoint, the `isDeleted` field on `ScheduledTaskDto` (mapped from upstream `is_deleted`), and the upstream error-mapping contract for the new upstream `DELETE /schedules/{schedule_id}` responses (404/409/502/503).

## Impact

- **Frontend app**: `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`, `apps/chat/src/server-api/scheduled-tasks.api.ts`, `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json`.
- **Frontend lib**: `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx`, `libs/scheduled-tasks/src/models/scheduled-task-detail-view-props.ts`.
- **BFF**: `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`, `scheduled-tasks.service.ts`, `scheduled-tasks.mapper.ts`, `dto/scheduled-task.dto.ts`, `dto/get-scheduled-task.dto.ts` (reused), `types/schedule-action.enum.ts` (not reused — delete is a distinct HTTP verb/route, not a `performScheduleAction` action).
- **Generated client**: `libs/chat-api-client/openapi.json`, `libs/chat-api-client/src/generated/src/apis/ScheduledTasksApi.ts`, plus the corresponding model types — regenerated via `npm run openapi` / `openapi:check`, never hand-edited.
- **Upstream dependency**: DIAL Scheduler's `DELETE /schedules/{schedule_id}` and the `is_deleted` field on schedule reads — both assumed available per the contract supplied with this proposal; no upstream code changes are in scope here.
- **Tests**: new backend controller/service tests (`apps/chat-api/src/scheduled-tasks/*.spec.ts`), new frontend component/page tests (`ScheduledTaskDetailPage`/`ScheduledTaskDetailView` `tests/` folders).

## Acceptance Criteria

1. The detail-page header renders Delete between Active and Edit whenever those controls are present, using a destructive red treatment, the standard delete icon (`aria-hidden`), and a visible "Delete" label with an accessible name and ≥44×44px target.
2. Clicking Delete opens a confirmation dialog stating the deletion is permanent and irreversible and the task will never run again, before any network call is made; Cancel, Escape, or closing the dialog make zero API calls and restore focus to the Delete button.
3. Confirming calls `DELETE /api/v1/scheduled-tasks/:scheduleId` exactly once; while it is in flight, the dialog stays open with a loading confirm action, resubmission is blocked, and Edit/Active/Delete are all disabled.
4. A `204` response closes the dialog, invalidates/refreshes Scheduled Task queries, shows a localized success notification, and navigates to `ROUTES.ScheduledTasks`, leaving no reachable state for the deleted detail page.
5. A `404`/`409`/`502`/`503` (or any other failure) keeps the user on the detail page with the task's data intact, stops the loading state, allows retry, and shows a distinct localized, actionable error message for not-found/already-deleted vs. a retryable scheduler failure.
6. `ScheduledTaskDto` exposes `isDeleted: boolean` mapped from upstream `is_deleted`; a task with `isDeleted: true` renders as an explicit read-only deleted state with Delete/Edit/Active all disabled or absent, while History remains visible.
7. The BFF endpoint enforces the existing `ScheduledTasksEnabled` feature guard, session authentication, and creator isolation (delegated to upstream `created_by` scoping); it never caches its own response and never leaks the upstream's bare-string error body.
8. `@epam/chat-api-client` is regenerated (never hand-edited) to include `deleteScheduledTask` and `isDeleted`; `npm run openapi:check` passes.
9. All new interactive elements and messages satisfy WCAG 2.1 AAA, support RTL via logical Tailwind classes, and work at both `mobile` and `desktop` breakpoints.

## Alternatives Considered

- **Add Delete to the Scheduled Tasks list card instead of (or in addition to) the detail page.** Rejected for this change per explicit scope: the upstream contract and UX request are detail-page-first; list-card delete is a distinct surface with its own row-context confirmation-placement questions and is left to a future change.
- **Model delete as a third `ScheduleAction` alongside `Pause`/`Resume` in `performScheduleAction`.** Rejected: `performScheduleAction` is `POST`-only and always follows up with a `GET` to return a refreshed `ScheduledTaskDto` — that shape doesn't fit a `DELETE` that returns `204 No Content` with an empty body. A dedicated `deleteScheduledTask` service method mirrors the existing `getScheduledTask`/`createScheduledTask`-style dedicated methods more accurately.
- **Let the frontend choose hard vs. soft delete via a request option.** Rejected: the upstream contract explicitly states the Scheduler alone decides the deletion strategy based on run history; exposing a caller-supplied option would contradict the contract and create a request shape the upstream ignores or rejects.
- **Infer deleted state from `nextRunTime: null` instead of adding `isDeleted`.** Rejected: `nextRunTime: null` already has an existing, distinct meaning (paused/exhausted schedule, per `add-scheduled-task-active-toggle`'s `isActiveDisabled` logic); overloading it for "deleted" would make the two states indistinguishable and break the disabled-Active-switch heuristic already shipped.
- **Optimistically remove the task from UI state immediately on Delete confirm.** Rejected: requirement 8 in the upstream instructions explicitly forbids navigating away or removing the task before a confirmed `204`, since a `502` (scheduler unregister failure) means the task is still live and must remain visible/editable.

## Backward Compatibility

- `ScheduledTaskDto.isDeleted` is a new optional-shaped field (documented default: absent/`false` means not deleted, mirroring how `isActive`/`nextRunTime` are already optional and additive per `scheduled-tasks-api`'s "Scheduled task next-run and creation timestamps" requirement). Existing callers of `GET`/`LIST`/`POST`/`PUT` scheduled-task endpoints that don't read `isDeleted` are unaffected.
- The new `DELETE /api/v1/scheduled-tasks/:scheduleId` route is additive; no existing route, DTO field, or client method is removed or renamed.
- Regenerating `@epam/chat-api-client` is additive-only (new method, new optional field) — no existing generated method signature changes.
- Existing bookmarked/shared links to a since-deleted task's detail page continue to resolve (the route and `GET` still succeed for a soft-deleted schedule); they now render the new read-only deleted state instead of a broken or misleadingly-editable page.

## Rollback Strategy

- The change is additive at every layer (new route, new field, new UI action gated behind explicit user interaction), so rollback is a standard revert of the commits/PR:
  1. Revert the BFF controller/service/mapper/DTO changes — removes the `DELETE` route and `isDeleted` field; no data migration is involved since deletion state lives entirely in DIAL Scheduler, not in any BFF-owned store.
  2. Revert the regenerated `@epam/chat-api-client` artifacts alongside the BFF revert (`npm run openapi` regenerates from the reverted Swagger output) so the generated client and DTOs stay in lockstep.
  3. Revert the frontend wrapper, page wiring, `ScheduledTaskDetailView` props, and i18n keys.
- No feature flag is introduced for this change (it extends the already-flagged `scheduledTasksEnabled` surface), so rollback is purely a code revert, not a flag flip. If a partial rollback is ever needed (e.g. keep the BFF endpoint but hide the UI), the header's `onDelete` prop can be omitted by the host page without touching the BFF, since `ScheduledTaskDetailView` already treats every action prop as independently optional.
- Because the frontend never optimistically deletes and always waits for `204` before navigating, no client-side state can be left inconsistent by an aborted or rolled-back deploy — a mid-rollout task deletion either fully succeeded upstream (and remains deleted regardless of a later UI rollback) or the UI simply stops offering the action.
