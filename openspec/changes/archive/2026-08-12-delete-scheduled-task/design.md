## Context

The Scheduled Task detail page is a per-task route (`ROUTES.ScheduledTaskDetail`) behind the `scheduledTasksEnabled` feature flag. Its header is owned by two layers:

- `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx` — the app-level host page. Owns routing (`ROUTES`, `getScheduledTaskEditRoute`), the `useScheduledTaskRuns` hook, notification dispatch (`useNotification`), and all API calls via `apps/chat/src/server-api/scheduled-tasks.api.ts`.
- `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx` — the host-agnostic presentational component (per AGENTS.md §Library isolation). Header action row currently renders, in inline-end order: Active switch (`isActive`/`isActiveUpdating`/`isActiveDisabled`/`onActiveChange`, lines 134-158) then Edit (`onEdit`, `NeutralButton` + `IconPencilMinus`, lines 160-169). This ordering and prop-naming convention (`isXxxUpdating` for in-flight mutation state, `onXxx` for the callback) was established by `add-scheduled-task-active-toggle` and is the pattern this change extends.

The BFF (`apps/chat-api/src/scheduled-tasks/`) proxies DIAL Scheduler via raw `fetch` (not the DIAL SDK — Scheduler is reached through `dialClient.baseUrl + /v1/deployments/applications/{SCHEDULER_APP_ID}/route/v1/schedules...`, a DIAL-Core-routed but non-Core-native upstream, matching the existing exception documented for `AppService`'s raw-fetch usage in `scheduled-tasks.service.ts`). Upstream error mapping already exists (`dial-error.mapper.ts`'s `mapDialHttpStatus`/`handleDialFetchError`) and needs no new logic for the delete case's 404/409/502/503 — only the correct call site.

DIAL Scheduler's upstream contract has been updated (per the proposal's authoritative spec) to add `DELETE /schedules/{schedule_id}` and an `is_deleted` field on all schedule reads. Neither exists in the current mapper/DTO/generated client.

## Goals / Non-Goals

**Goals:**

- Add a `DELETE /api/v1/scheduled-tasks/:scheduleId` BFF endpoint that proxies the upstream delete 1:1 (no hard/soft prediction) and returns `204` with an empty body.
- Surface `isDeleted: boolean` end-to-end (upstream `is_deleted` → mapper → `ScheduledTaskDto` → generated client → frontend), analogous to how `isActive` was added.
- Add a `Delete` header action + confirmation dialog + deleted-state rendering to the detail page, keeping `ScheduledTaskDetailView` host-agnostic.
- Ensure no client-visible state (browser history, cached query, notification) references the deleted task once the flow completes.

**Non-Goals:**

- Deciding or influencing hard-vs-soft delete strategy (upstream-owned).
- Any restore, undo, or deleted-task listing capability.
- Changing pause/resume/edit behavior beyond disabling them during an in-flight delete or when `isDeleted` is `true`.
- A dedicated per-route rate limit stricter than the existing mutation limit (10/60000ms) unless a specific abuse scenario is identified — none is, so the existing limit is reused (see Decision 6).

## Decisions

### Decision 1: Dedicated `deleteScheduledTask` service method, not a third `ScheduleAction`

`performScheduleAction` (`scheduled-tasks.service.ts:447-475`) is `POST`-only, always issues a follow-up `GET`, and always returns a `ScheduledTaskDto`. `DELETE /schedules/{schedule_id}` is a different HTTP verb, returns `204 No Content` with an empty body, and must never attempt a follow-up `GET` (a hard-deleted schedule would 404, and a soft-deleted one only needs the caller to know deletion succeeded, not a refreshed DTO). A dedicated `deleteScheduledTask(userSub, accessToken, scheduleId): Promise<void>` method — sibling to `getScheduledTask`/`createScheduledTask`, not a variant of `performScheduleAction` — is the correct shape. It calls `fetchUpstream` with `DELETE` and the existing `buildSchedulesUrl(scheduleId)` helper (`scheduled-tasks.service.ts:107-119`, already used for `GET`/`PUT` single-schedule calls), then calls `invalidateListCache(userSub)` on success, mirroring the pause/resume cache-invalidation contract.

**Alternative considered:** reuse `ScheduleAction` with a `Delete` member and adapt `performScheduleAction` to skip the follow-up `GET` when the action is `Delete`. Rejected — it would make `performScheduleAction`'s return type conditionally `Promise<ScheduledTaskDto | void>`, complicating every existing pause/resume call site's typing for a case that shares almost no logic with them.

### Decision 2: `fetchUpstream` must support a genuinely empty `204` response

The existing `fetchUpstream` (`scheduled-tasks.service.ts:202-258`) is used today only for calls whose success path parses a JSON body (`GET`/`POST`/`PUT`) or, for pause/resume, ignores the body but the upstream response still isn't documented as strictly empty. The delete call must not attempt `response.json()` on a `204` (which would throw on an empty body). The service method for delete calls `fetchUpstream` and, on success, discards the response without parsing — no new parameter is needed on `fetchUpstream` itself as long as the caller simply doesn't call `.json()`; this only requires that `fetchUpstream`'s non-throwing success path doesn't unconditionally parse the body before returning it to the caller. If `fetchUpstream` currently does eagerly parse JSON internally, `deleteScheduledTask` needs its own minimal `fetch`+`mapDialHttpStatus`/`handleDialFetchError` call, or `fetchUpstream` needs a `parseJson: boolean` (default `true`) option — the implementer must check `fetchUpstream`'s actual body-handling before choosing between these two; either is acceptable as long as no `.json()` call executes against a `204` body.

### Decision 3: `isDeleted` is read directly from upstream `is_deleted`, not derived

Unlike `isActive` (derived heuristically from `next_run_time` presence, per `add-scheduled-task-active-toggle`'s documented-assumption caveat), `is_deleted` is an explicit upstream field per the authoritative contract in this proposal. `fromUpstreamSchedule` (`scheduled-tasks.mapper.ts`) adds `isDeleted: upstream.is_deleted ?? false` to its return object, and `UpstreamScheduleResponse` gains an optional `is_deleted?: boolean` field. `ScheduledTaskDto` gains `isDeleted?: boolean` (optional, `@ApiPropertyOptional` + `@IsBoolean()` + `@IsOptional()`, mirroring `isActive`'s decorator pattern exactly) — kept optional rather than required so older test fixtures / partial upstream responses don't force every call site to supply it, consistent with how `nextRunTime`/`createdAt`/`isActive` are all optional today.

**Explicit non-inference rule:** `nextRunTime: null` on its own must NOT be treated as evidence of deletion anywhere in the mapper, service, or frontend — it already means "paused or exhausted" per the existing `isActiveDisabled` logic (`add-scheduled-task-active-toggle`'s "Active switch is disabled... when a schedule can no longer produce a future run" requirement). Only `isDeleted === true` may drive deleted-state UI.

### Decision 4: Frontend deleted-state gating lives in `ScheduledTaskDetailPage`, not `ScheduledTaskDetailView`

Per library isolation, the lib component doesn't know about routing or "what a deleted task means for navigation" — it only needs a boolean. `ScheduledTaskDetailView` gains an `isDeleted?: boolean` prop (default `false`/`undefined` = normal rendering). When `true`, the view renders its existing sections read-only:

- Delete and Edit buttons are not rendered (mirrors the existing "Edit button renders only when `onEdit` is supplied" pattern — the host page simply omits `onEdit`/`onDelete` when `isDeleted` is `true`, so `isDeleted` itself only needs to gate the Active switch and add a visible "Deleted" label/badge, since the other two actions are already conditionally rendered based on callback presence).
- The Active switch does not render (host omits `isActive`, since a deleted schedule can never be active).
- History remains rendered exactly as today (no new prop needed — it already renders independently of the header actions).
- A new read-only label (`scheduledTasks.detail.deletedStateLabel`) renders near the title, using existing UI conventions for a status badge (the same visual language as History row status treatments, not a novel component).

`ScheduledTaskDetailPage` computes this by reading `task.isDeleted` after `getScheduledTask` resolves and conditionally passing `onEdit`/`onDelete`/`isActive`/`onActiveChange` as `undefined` when `isDeleted` is `true`, rather than `ScheduledTaskDetailView` special-casing `isDeleted` for every action independently. This keeps the "when is X shown" logic in one place (the lib's existing "callback present → action renders" rule) instead of duplicating an `isDeleted` check in three places inside the lib.

### Decision 5: Confirmation dialog reuses `ConfirmationPopup`, state owned by the page

`ConfirmationPopup` (`@epam/ai-dial-ui-kit`, `ConfirmationPopupVariant.Danger`) is already the established destructive-confirmation pattern (`ConversationPanelMenu.tsx:174-195`, `LogoutConfirmationModal.tsx:38-46`). `ScheduledTaskDetailPage` owns:

- `isDeleteDialogOpen: boolean` — opened by the header's `onDelete` callback, closed by `ConfirmationPopup`'s `onCancel`/`onClose` (both wired to the same no-API handler) or by a successful delete.
- `isDeleting: boolean` — `true` for the duration of the `deleteScheduledTask` call; passed to `ConfirmationPopup`'s `isLoading` and `disableConfirmButton`, and to `ScheduledTaskDetailView`'s `isDeleting` prop so Edit/Active can be disabled while a delete is pending (per requirement: "prevent conflicting Edit, Active, and Delete actions" during deletion).
- Focus restoration: the Delete button element (via a `ref` held in the page, since the lib exposes no ref today — the page can wrap the header in a container `ref` and query the button, or `ScheduledTaskDetailView` can `forwardRef`/expose an internal button `ref` through a prop callback (`onDeleteButtonRef` or similar) if `ConfirmationPopup` doesn't already restore focus to its trigger automatically). **Open question below** on whether `ConfirmationPopup` handles this natively — check via `getEntityDetails` before implementing (do not assume).

`ScheduledTaskDetailView` gains: `onDelete?: () => void` (opens dialog — owned by the page, not the lib itself, since the lib never renders the dialog; only the page does, matching how the lib never renders navigation for `onEdit`), `isDeleting?: boolean` (disables Delete/Edit/Active while `true`), and the `isDeleted?: boolean` prop from Decision 4. The lib does **not** render `ConfirmationPopup` itself — that stays in `ScheduledTaskDetailPage`, consistent with "routing, API calls, notifications... must remain in `apps/chat`" from the proposal, and because a modal dialog triggered by a header button is app-level UI orchestration, not per-field presentation.

### Decision 6: Reuse the existing mutation rate limit (10/60000ms)

Pause/resume/create/update all use `@Throttle({ default: { limit: 10, ttl: 60000 } })`. Delete is a single-shot, user-confirmed, low-frequency action with no plausible higher-abuse profile than pause/resume (both of which can also be triggered by a single click). No stricter limit is justified; reuse the existing decorator value verbatim for consistency and to avoid an undocumented magic number.

### Decision 7: BFF error mapping — reuse `mapDialHttpStatus`/`handleDialFetchError`, no new error-shape work

Upstream's bare-JSON-string error body for `DELETE` is handled the same way existing bare-string upstream errors are handled today (`mapDialHttpStatus(status, context, logger, errorBody)` already accepts an opaque `errorBody` and produces a typed Nest exception without echoing upstream internals — confirmed by its existing use for `GET`/`POST`/`PUT` error paths). No new sanitization logic is needed: 404→`NotFoundException`, 409→`ConflictException`, 502 (upstream `BadGatewayException` passthrough is already the ≥500 default)→`BadGatewayException`, and `handleDialFetchError`'s timeout/network path→`ServiceUnavailableException` (satisfying the "503 for upstream timeout/unavailability" requirement without new code). The controller's `@ApiResponse` annotations document all four (404/409/502/503) plus 400/401/403/429 consistent with every other route in this controller.

### Decision 8: Frontend distinguishes "already gone" (404/409) from "retryable" (502) at the notification layer, not the API layer

`deleteScheduledTask` (both the server-api wrapper and the generated client method) throws on any non-2xx exactly like every other wrapper in `scheduled-tasks.api.ts` — no special-casing in the API layer. `ScheduledTaskDetailPage`'s catch handler inspects the thrown error's status (via the same `getApiErrorDetails(err)` helper already used for pause/resume error handling, `ScheduledTaskDetailPage.tsx:285-290`) and selects one of three localized messages: `deleteNotFoundError` (404/409 — already gone, so the page could optionally still refresh-and-redirect since the task is definitely unreachable either way, but per the proposal's requirement 8 the page must NOT navigate away except on a confirmed `204`, so even a 404/409 keeps the user on the page with an explanatory message rather than auto-redirecting) vs. `deleteRetryableError` (502/503 — safe to retry) vs. a generic `deleteGenericError` fallback for anything else.

## Risks / Trade-offs

- **[Risk] `fetchUpstream` may not currently support a body-less success path cleanly** (Decision 2) → Mitigation: implementer verifies `fetchUpstream`'s current body-parsing behavior in the first backend task before wiring the controller/service, and either confirms the empty-body path already works or adds the minimal `parseJson` option; this is called out as an explicit early task in `tasks.md` so it's resolved before dependent tasks build on it.
- **[Risk] Regenerating `@epam/chat-api-client` is a generated-artifact diff that must not be hand-edited**, and a botched regeneration could silently drop or mis-type `isDeleted`/`deleteScheduledTask` → Mitigation: the standard `npm run openapi` → `openapi:check` → build/lint `chat-api-client` sequence (already the enforced pipeline) catches shape drift; tasks.md includes a dedicated verification task for this sequence before any frontend wrapper code is written against it.
- **[Risk] Focus-restoration-on-dialog-close may not be automatic in `ConfirmationPopup`** (Decision 5's open question) → Mitigation: verified via `getEntityDetails("component", "ConfirmationPopup")` (or the kit's actual export name) before implementation; if not automatic, the page manages a `useRef` on the Delete button and calls `.focus()` in the dialog's `onClose`/`onCancel` handler, a well-established manual pattern requiring no lib changes.
- **[Risk] A 502 (scheduler unregister failure) leaves the task live but the user may be confused why "Delete" appears to have failed** → Mitigation: the retryable-error message (Decision 8) explicitly tells the user the task was NOT deleted and it's safe to retry, per the upstream contract's own guidance that "no database change occurred, the task remains live, and retrying is safe."
- **[Trade-off] Not adding a per-route stricter rate limit (Decision 6) accepts the same 10/60000ms ceiling pause/resume/update already accept** — acceptable since delete is gated behind an explicit confirmation dialog, making rapid repeated calls user-friction-bound already.
- **[Trade-off] `isDeleted` optionality (Decision 3) means some code paths could see `undefined` rather than `false`** for schedules mapped before this field existed in cached responses (if any caching outlives a deploy) — mitigated by the BFF's list cache being short-TTL (30s epoch-based) and per-item GETs never being cached, so stale-shape responses cannot persist meaningfully past a deploy.

## Migration Plan

1. Backend: add `is_deleted` to `UpstreamScheduleResponse`, `isDeleted` to `ScheduledTaskDto`/mapper, add `deleteScheduledTask` service method + controller route, update Swagger.
2. Run `npm run openapi` (regenerates `libs/chat-api-client/openapi.json` + generated SDK), then `npm run openapi:check`, then build/lint `chat-api-client`.
3. Frontend: add `deleteScheduledTask` wrapper in `scheduled-tasks.api.ts`, extend `ScheduledTaskDetailViewProps`/`ScheduledTaskDetailView`, wire `ScheduledTaskDetailPage` (dialog state, delete handler, deleted-state gating, i18n keys), add locale strings.
4. Backend and frontend test suites (see `tasks.md`) run per-slice via `nx test chat-api` / the frontend's Vitest target.
5. No data migration is needed — deletion state lives entirely in DIAL Scheduler; the BFF/frontend only read/write through the existing proxy.
6. Rollback: standard commit revert (see proposal.md "Rollback Strategy") — additive-only changes at every layer mean no forward-only migration blocks a revert.

## Open Questions

- Does `ConfirmationPopup` (`@epam/ai-dial-ui-kit`) restore focus to its trigger element automatically on close, or must the host manage a ref? Resolve via `getEntityDetails` before implementing the dialog task.
- Does `fetchUpstream` (`scheduled-tasks.service.ts:202-258`) already tolerate a `204`/empty-body success response, or does it unconditionally call `.json()`? Resolve by reading the method's current implementation before writing `deleteScheduledTask`.
- Does the upstream `DELETE /schedules/{schedule_id}` response, when it results in a soft-delete, return `204` synchronously once the DB row is marked `is_deleted: true`, or could there be eventual-consistency lag before a subsequent `GET` reflects it? Not testable without the live upstream; if lag exists, the frontend's immediate post-delete `GET`-and-render-deleted-state flow would need a brief retry — out of scope to design speculatively without confirmed upstream behavior, but flagged for the implementer to verify against a real Scheduler instance if available in a lower environment.
