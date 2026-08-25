## 1. Backend contract: upstream body-handling verification

- [x] 1.1 Read `apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts:202-258` (`fetchUpstream`) and confirm whether its success path already tolerates a `204`/empty body, or unconditionally calls `.json()`. If it unconditionally parses JSON, add a `parseJson: boolean` option (default `true`) so a `DELETE` caller can opt out, or extract a minimal `DELETE`-specific fetch path that reuses `mapDialHttpStatus`/`handleDialFetchError` without parsing a body. (design.md Decision 2 / Open Questions)

## 2. Backend: mapper and DTO for `isDeleted`

- [x] 2.1 Add `is_deleted?: boolean` to `UpstreamScheduleResponse` in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`.
- [x] 2.2 Add `isDeleted: upstream.is_deleted ?? false` to `fromUpstreamSchedule`'s return object in the same file.
- [x] 2.3 Add `isDeleted?: boolean` to `ScheduledTaskDto` (`apps/chat-api/src/scheduled-tasks/dto/scheduled-task.dto.ts`) with `@ApiPropertyOptional({ example: false })`, `@IsOptional()`, `@IsBoolean()`, mirroring the existing `isActive` field's decorator block.
- [x] 2.4 Write/extend `scheduled-tasks.mapper.spec.ts` (or the existing mapper test file) covering: `is_deleted: true` → `isDeleted: true`; `is_deleted: false` → `isDeleted: false`; `is_deleted` absent → `isDeleted: false` without throwing; a response with `is_deleted: true` and `next_run_time: null` maps `nextRunTime: undefined` without the mapper treating deletion as evidence for anything else.
  - Depends on: 2.1, 2.2, 2.3

## 3. Backend: `deleteScheduledTask` service method

- [x] 3.1 Add `deleteScheduledTask(userSub: string, accessToken: string, scheduleId: string): Promise<void>` to `ScheduledTasksService` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`), calling `this.buildSchedulesUrl(scheduleId)` (existing helper, lines 107-119) with method `DELETE`, no request body, using the body-handling approach resolved in Task 1.1.
- [x] 3.2 On success, call `await this.invalidateListCache(userSub)` before returning (mirroring the pause/resume/update pattern at lines 364/433/473).
- [x] 3.3 On upstream error, rely on the existing `mapDialHttpStatus`/`handleDialFetchError` call inside the shared fetch path (no new error-shape code) so 404/409/502/timeout map exactly as documented in `specs/scheduled-tasks-api/spec.md`'s "Delete a scheduled task" requirement — do NOT call `invalidateListCache` on any error path.
- [x] 3.4 Write `scheduled-tasks.service.spec.ts` cases: successful delete calls the correct upstream `DELETE` URL with no body and invalidates the list cache; a 404/409/502 upstream response propagates as the corresponding mapped exception and does NOT invalidate the cache; a network/timeout error maps to `ServiceUnavailableException` (503).
  - Depends on: 3.1, 3.2, 3.3

## 4. Backend: controller route and Swagger

- [x] 4.1 Add `DELETE :scheduleId` route to `ScheduledTasksController` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`), reusing `GetScheduledTaskDto` for `@Param()` validation (same as `getScheduledTask`/`pauseScheduledTask`).
- [x] 4.2 Add `@HttpCode(HttpStatus.NO_CONTENT)`, `@Throttle({ default: { limit: 10, ttl: 60000 } })` (reusing the existing mutation limit per design.md Decision 6), and `@ApiOperation({ operationId: 'deleteScheduledTask', summary: 'Delete a scheduled task', description: '...' })`.
- [x] 4.3 Add full `@ApiResponse` coverage: 204 (no `type`, empty body), 400, 401, 403, 404, 409, 429, 502, 503 — mirroring the pause/resume `@ApiResponse` block style (lines 264-291) with descriptions matching `specs/scheduled-tasks-api/spec.md`.
- [x] 4.4 Wire the handler to read `sub`/`at` from `req.user as SessionUser` and call `this.scheduledTasksService.deleteScheduledTask(sub, at, params.scheduleId)`, returning `void`/`undefined` so Nest sends an empty `204` body.
- [x] 4.5 Write/extend `scheduled-tasks.controller.spec.ts` (or a supertest e2e spec, following the existing test file's style) covering: authenticated owner delete returns `204` with an empty body; unauthenticated request returns `401`; `scheduledTasksEnabled` disabled returns `403`; invalid `scheduleId` (path-traversal payload) returns `400` without contacting upstream; upstream 404/409/502 propagate as documented; rate-limit exceeded returns `429`.
  - Depends on: 4.1, 4.2, 4.3, 4.4, 3.1-3.4

## 5. Backend verification (pre-OpenAPI regeneration)

- [x] 5.1 Run `npm exec nx test chat-api` and confirm all new and existing scheduled-tasks specs pass.
- [x] 5.2 Run `npm exec nx lint chat-api` and fix any violations.
- [x] 5.3 Run `npm exec nx build chat-api` and confirm it builds cleanly with the new route/DTO field.
  - Depends on: 2.1-2.4, 3.1-3.4, 4.1-4.5

## 6. OpenAPI regeneration and generated-client verification

- [x] 6.1 Run `npm run openapi` (regenerates `libs/chat-api-client/openapi.json` and the generated SDK under `libs/chat-api-client/src/generated`) — do NOT hand-edit any file under `src/generated`.
- [x] 6.2 Run `npm run openapi:check` and resolve any reported drift.
- [x] 6.3 Confirm the regenerated `ScheduledTasksApi` (`libs/chat-api-client/src/generated/src/apis/ScheduledTasksApi.ts`) exposes a `deleteScheduledTask` method and that the schedule model type now includes `isDeleted`.
- [x] 6.4 Run `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client` to verify the regenerated client compiles and lints cleanly.
  - Depends on: 5.1, 5.2, 5.3

## 7. Frontend: server-api wrapper

- [x] 7.1 Add `deleteScheduledTask(scheduleId: string): Promise<void>` to `apps/chat/src/server-api/scheduled-tasks.api.ts`, calling `scheduledTasksApi.deleteScheduledTask({ scheduleId })` (the generated client instance from `apps/chat/src/server-api/api-client.ts:184`), following the existing wrapper style (e.g. `getScheduledTask`, lines 33-36).
- [x] 7.2 Confirm `scheduleId` reaches the generated client already URL-encoded per the generated client's own path-parameter handling (consistent with how `getScheduledTask`/`pauseScheduledTask` already behave) — no additional manual `encodeURIComponent` needed in the wrapper unless the generated method requires it.
- [x] 7.3 Write a unit test for the wrapper (co-located per the existing `scheduled-tasks.api.ts` test conventions, if any exist, or a new `tests/` file) asserting it calls `scheduledTasksApi.deleteScheduledTask` with the given `scheduleId` and resolves to `undefined` on a `204`.
  - Depends on: 6.1-6.4

## 8. Frontend lib: `ScheduledTaskDetailView` props and header action

- [x] 8.1 Extend `ScheduledTaskDetailViewProps` (`libs/scheduled-tasks/src/models/scheduled-task-detail-view-props.ts`) with: `deleteButtonLabel?: string`, `onDelete?: () => void`, `isDeleting?: boolean`, `isDeleted?: boolean`, `deletedStateLabel?: string` (labels required together with their gating callback per the existing `editButtonLabel`/`onEdit` convention).
- [x] 8.2 In `ScheduledTaskDetailView.tsx` (`libs/scheduled-tasks/src/components/ScheduledTaskDetailView/`), insert the Delete action between the Active switch and the Edit `NeutralButton` in the header's end-side action row (lines ~133-170), rendered only when `onDelete` is supplied AND `isDeleted` is not `true`; use a destructive-styled control with the standard delete icon (`aria-hidden`) and the localized `deleteButtonLabel`. Use `mcp__ai-dial-ui-kit__searchEntity`/`getEntityDetails` to find the correct destructive button component and its exact prop API — do not guess or grep `node_modules`.
- [x] 8.3 Gate the Active switch and Edit button rendering on `isDeleted !== true` in addition to their existing conditions (per design.md Decision 4 — `isDeleted` suppresses all three regardless of callback presence).
- [x] 8.4 Render the deleted-state indicator (using `deletedStateLabel`) near the title when `isDeleted` is `true`, using an existing status-badge visual convention already present in the lib (e.g. the History row status treatment) rather than a new bespoke component.
- [x] 8.5 Apply `disabled` to the Active switch, Delete action, and Edit button (whichever are otherwise eligible to render) when `isDeleting` is `true`, without removing them from the DOM.
- [x] 8.6 Update/add tests in `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/tests/` covering: Delete renders only when `onDelete` is supplied and `isDeleted` is not `true`; clicking Delete calls `onDelete` exactly once and performs no navigation/network/dialog rendering; `isDeleted: true` suppresses Edit/Delete/Active regardless of other props and shows the deleted-state indicator; `isDeleting: true` disables but does not remove Active/Delete/Edit; header action order is Active → Delete → Edit when all three are eligible.
  - Depends on: 8.1

## 9. Frontend lib: RTL and accessibility for the new header action

- [x] 9.1 Ensure the Delete action and deleted-state indicator use logical Tailwind classes (`ms/me`, `ps/pe`, `text-start/end`) per `.claude/rules/rtl.md`; confirm the delete icon is symmetric and explicitly NOT mirrored (no `rtl:scale-x-[-1]` applied to it).
- [x] 9.2 Confirm the Delete action exposes an accessible name equal to `deleteButtonLabel`, a minimum 44×44 CSS pixel touch target, a `:focus-visible` treatment matching its hover state, and a native `disabled` attribute (not a purely visual disabled style) when `isDeleting` is `true`.
- [x] 9.3 Add/extend an RTL-focused test asserting the header's end-side action order (Active → Delete → Edit) is unchanged and unmirrored when a `dir="rtl"` ancestor is present, while the back icon still mirrors.
  - Depends on: 8.1-8.6

## 10. Frontend app: confirmation dialog and delete flow in `ScheduledTaskDetailPage`

- [x] 10.1 Use `mcp__ai-dial-ui-kit__getEntityDetails("component", "ConfirmationPopup")` (or its actual exported name) to confirm its exact prop API and whether it restores focus to its trigger element automatically on close (design.md Open Questions) before writing the dialog wiring.
- [x] 10.2 Add `isDeleteDialogOpen`, `isDeleting` state to `ScheduledTaskDetailPage.tsx`; add a `handleDeleteClick` that opens the dialog (passed as `onDelete` to `ScheduledTaskDetailView`) and, if Task 10.1 finds focus restoration is not automatic, a `deleteButtonRef` to restore focus on close.
- [x] 10.3 Render `ConfirmationPopup` with `variant={ConfirmationPopupVariant.Danger}`, a localized title/description stating the deletion is permanent and irreversible, `Cancel`/destructive `Delete` labels (reusing `ButtonsI18nKeys.Cancel`/`ButtonsI18nKeys.Delete` where applicable), `isLoading={isDeleting}`, `disableConfirmButton={isDeleting}`, and `onCancel`/`onClose` both wired to a no-API close handler that also restores focus (per Task 10.1's finding).
- [x] 10.4 Add `handleDeleteConfirm` calling `deleteScheduledTask(scheduleId)` exactly once, setting `isDeleting: true` for the call's duration; guard against a second call while `isDeleting` is already `true`.
- [x] 10.5 On success: close the dialog, show a localized success notification via `useNotification` (mirroring the pattern at `ScheduledTaskDetailPage.tsx:271-278`), and `navigate(ROUTES.ScheduledTasks)`.
- [x] 10.6 On failure: set `isDeleting: false`, keep the dialog's error path visible per the dialog's own affordances, do NOT close the dialog automatically nor navigate away, and show a localized error notification selecting between `deleteNotFoundError` (mapped 404/409), `deleteRetryableError` (mapped 502), and `deleteGenericError` (anything else) based on the thrown error's status via the existing `getApiErrorDetails(err)` helper (same helper used at `ScheduledTaskDetailPage.tsx:285-290`), including the request/trace id when available.
- [x] 10.7 Pass `onDelete={handleDeleteClick}`, `isDeleting`, and `isDeleted={task?.isDeleted}` to `ScheduledTaskDetailView`; when `task?.isDeleted` is `true`, do NOT pass `onEdit`/`onDelete`/`isActive`/`onActiveChange` for that render (per design.md Decision 4).
  - Depends on: 8.1-8.6, 7.1-7.3, 10.1

## 11. Frontend app: i18n

- [x] 11.1 Add `ScheduledTasksI18nKeys` enum members (in `apps/chat/src/constants/translation-keys.ts`) for: `DetailDeleteButtonLabel`, `DetailDeleteConfirmTitle`, `DetailDeleteConfirmDescription`, `DetailDeleteConfirmingLabel`, `DetailDeleteSuccess`, `DetailDeleteNotFoundError`, `DetailDeleteRetryableError`, `DetailDeleteGenericError`, `DetailDeletedStateLabel`, mapping to `scheduledTasks.detail.deleteButtonLabel`, `.deleteConfirmTitle`, `.deleteConfirmDescription`, `.deleteConfirmingLabel`, `.deleteSuccess`, `.deleteNotFoundError`, `.deleteRetryableError`, `.deleteGenericError`, `.deletedStateLabel`.
- [x] 11.2 Add the corresponding English strings under the `scheduledTasks.detail` namespace in `apps/chat/src/i18n/locales/en.json`, placed alongside the existing detail-section keys.
- [x] 11.3 Confirm `ScheduledTaskDetailPage.tsx` resolves every one of these via `useTranslation().t()` and passes plain strings into `ScheduledTaskDetailView` — never a raw key or hard-coded literal.
  - Depends on: 10.1-10.7

## 12. Frontend app: `ScheduledTaskDetailPage` tests

- [x] 12.1 Add tests (in `apps/chat/src/pages/ScheduledTaskDetailPage/tests/`) verifying: Delete renders in the header in the order Active → Delete → Edit when the task is loaded and not deleted; clicking Delete opens the confirmation dialog without calling `deleteScheduledTask`.
- [x] 12.2 Add tests verifying: Cancel, Escape, and dialog-close each result in zero `deleteScheduledTask` calls and restore focus to the Delete action.
- [x] 12.3 Add tests verifying: confirming calls `deleteScheduledTask` exactly once with the current `scheduleId`; a second confirm activation while the first call is pending does not issue a second call; Active/Edit/Delete are all disabled while `isDeleting` is `true`.
- [x] 12.4 Add tests verifying: a resolved `204` closes the dialog, shows the success notification, and navigates to `ROUTES.ScheduledTasks`; an empty `204` body does not throw a JSON-parse error.
- [x] 12.5 Add tests verifying: a mapped 404/409 failure shows the not-found/already-deleted message and keeps the user on the page with the task's data intact; a mapped 502 failure shows the retryable-error message; any other failure shows the generic error message — in all three cases, no navigation occurs and `isDeleting` returns to `false`.
- [x] 12.6 Add a test verifying a task loaded with `isDeleted: true` renders the read-only deleted state with no enabled Delete/Edit/Active controls, while History still renders.
- [x] 12.7 Add tests covering keyboard interaction (Tab to Delete, Enter/Space activates; Escape closes the dialog) and confirm all assertions use accessible role/label/text queries (`getByRole`, `getByLabelText`), not test ids or CSS selectors.
- [x] 12.8 Use the `responsive-design` skill's checks (or its documented manual-equivalent assertions where feasible in Vitest/RTL) to confirm the header action row and dialog render correctly at both `mobile` and `desktop` breakpoints, and add an RTL-rendered test asserting the header action order and icon mirroring described in `specs/scheduled-task-detail-page/spec.md`.
  - Depends on: 10.1-10.7, 11.1-11.3

## 13. Final Nx verification

- [x] 13.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0` and resolve any violations across `chat-api`, `chat-api-client`, `scheduled-tasks` (lib), and `chat`.
- [x] 13.2 Run `npm exec nx affected --target=test --base=origin/development-1.0` and confirm all affected projects pass.
- [x] 13.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` and confirm all affected projects build.
- [x] 13.4 Re-run `npm run openapi:check` one final time to confirm no drift was introduced by later frontend-only tasks.
  - Depends on: 1.1-12.8
