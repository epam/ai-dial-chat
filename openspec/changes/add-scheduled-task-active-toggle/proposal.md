## Why

The Scheduled Task detail page (`apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`) and its host-agnostic `ScheduledTaskDetailView` (`libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx`) currently only support viewing a schedule and navigating to Edit — `openspec/specs/scheduled-task-detail-page/spec.md` (Requirement "Detail page header shows back navigation and title, plus an Edit action once loaded") explicitly states the header "SHALL NOT render Delete, Active-toggle, or Run-now controls in this iteration." A user who wants to temporarily stop a recurring task must open Edit, which is a heavier flow than a single toggle and (per the create/update spec) forces a full `PUT` of every field. This proposal adds a dedicated Active switch so pause/resume is a one-click, reversible action, backed by two new BFF endpoints that proxy the DIAL Scheduler's own pause/resume actions instead of overloading the update endpoint.

## What Changes

- Add `isActive: boolean | undefined` to `ScheduledTaskDto`, derived centrally in `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts`'s `fromUpstreamSchedule` from the upstream schedule state. **Open question (see design.md "Active-state derivation"):** no live DIAL Scheduler pause/resume response, and no upstream field documenting an explicit active/paused state, was found in this repository (`libs/chat-api-client/openapi.json` has no `schedules/{id}/pause|resume` path, and `UpstreamScheduleResponse` in `scheduled-tasks.mapper.ts:52-75` has no `is_active`/`paused`/`status` field). The proposed default is deriving `isActive` from `next_run_time != null` — the only currently observed signal — but this is a documented assumption, not a confirmed contract, and MUST be verified against a live DIAL Scheduler instance or its OpenAPI spec before merging; design.md records the fallback if the assumption is wrong.
- Add two new BFF endpoints on `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts` (**new**, additive — not breaking):
  - `POST /api/v1/scheduled-tasks/:scheduleId/pause` (`operationId: pauseScheduledTask`) — proxies DIAL Scheduler `POST .../schedules/{schedule_id}/pause`.
  - `POST /api/v1/scheduled-tasks/:scheduleId/resume` (`operationId: resumeScheduledTask`) — proxies DIAL Scheduler `POST .../schedules/{schedule_id}/resume`.
  - Both return the refreshed `ScheduledTaskDto` (see design.md "Mutation response shape" for why), invalidate the caller's scheduled-tasks list cache on success only, and reuse the existing `FeatureGuard`/`RequireFeature(FeatureKey.ScheduledTasksEnabled)`/session-auth/`scheduleId` allowlist pattern already used by `getScheduledTask`/`updateScheduledTask`.
- Regenerate `libs/chat-api-client` so `ScheduledTasksApi` exposes `pauseScheduledTask`/`resumeScheduledTask`, and add thin wrappers `pauseScheduledTask(scheduleId)` / `resumeScheduledTask(scheduleId)` to `apps/chat/src/server-api/scheduled-tasks.api.ts`, following the existing `updateScheduledTask` wrapper pattern (`scheduled-tasks.api.ts:38-45`).
- Add an **Active** switch (`DialSwitch` from `@epam/ai-dial-ui-kit`) to the detail-page header's inline-end side, before the existing Edit `NeutralButton`, in both `ScheduledTaskDetailView` (`libs/scheduled-tasks`) and `ScheduledTaskDetailPage` (`apps/chat`). Toggling off calls `pauseScheduledTask`; toggling on calls `resumeScheduledTask`; both use an optimistic update with rollback-on-failure (see design.md).
- Modify `openspec/specs/scheduled-task-detail-page/spec.md`'s "Detail page header shows back navigation and title, plus an Edit action once loaded" requirement: the header now SHALL render the Active switch (still SHALL NOT render Delete or Run-now).
- Add new i18n keys under `scheduledTasks.detail` in `apps/chat/src/i18n/locales/en.json` / `ScheduledTasksI18nKeys` (`apps/chat/src/constants/translation-keys.ts`): `activeStatusLabel`, `pauseSuccess`, `resumeSuccess`, `activeStatusUpdateError`. The existing `DetailActiveWindowLabel` (`scheduledTasks.detail.activeWindowLabel`, value "Active", referring to the cron activity date window — `translation-keys.ts:301`) is NOT reused, per the brief; a new, distinctly-named key carries the switch's "Active" label to avoid two different UI elements sharing one translated string with different meanings.

## Non-goals

- Delete and Run-now controls on the detail page (spec explicitly continues to exclude them).
- Editing trigger, model, prompt, or description via this switch — no `PUT` is issued by pause/resume.
- Switches on Scheduled Tasks list-page cards, bulk pause/resume, or automatic polling of active state.
- Run-history behavior changes; History panel/data is unaffected by pause/resume.
- Deriving `isActive` from any signal other than the one documented and flagged as an assumption above — no additional undocumented heuristics.

## Capabilities

### New Capabilities

_None._ This change extends two existing capabilities; it does not introduce a new domain capability.

### Modified Capabilities

- `scheduled-tasks-api`: adds `pauseScheduledTask`/`resumeScheduledTask` endpoints and requirements for the `ScheduledTaskDto.isActive` field, its cache-invalidation behavior, and error-code coverage.
- `scheduled-task-detail-page`: modifies the header requirement to add the Active switch (order, rendering conditions, host-agnostic prop contract on `ScheduledTaskDetailView`), and adds requirements for optimistic pause/resume interaction, accessibility, RTL, and i18n for the new control.

## Impact

- **Backend**: `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts`, `scheduled-tasks.service.ts`, `scheduled-tasks.mapper.ts`, `dto/scheduled-task.dto.ts` (new `isActive` field), two new DTOs for the pause/resume path parameter (reuse `GetScheduledTaskDto`) and response.
- **Generated client**: `libs/chat-api-client` regenerated (`npm run openapi`, `npm run openapi:check`, build+lint) — additive only, no existing operation signature changes.
- **Frontend**: `apps/chat/src/server-api/scheduled-tasks.api.ts` (two new wrappers), `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx` (new state + handlers), `apps/chat/src/i18n/locales/en.json` + `apps/chat/src/constants/translation-keys.ts` (new keys).
- **Library**: `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/` (new props: `isActive?`, `isActiveUpdating?`, `onActiveChange?`), `libs/scheduled-tasks/src/models/scheduled-task-detail-view-props.ts` (or equivalent) — no new host/API imports, preserving library isolation.
- **Docs**: `openspec/specs/scheduled-task-detail-page/spec.md` and `openspec/specs/scheduled-tasks-api/spec.md` updated via delta specs in this change.
- **Backward compatibility / rollback**: Fully additive and non-breaking. `isActive` is optional on `ScheduledTaskDto` (existing consumers ignore it). The two new endpoints are new routes; no existing route signature changes. Rollback is a revert of this change's commits — no data migration, no destructive schema change, and no removal of existing capability behavior (Edit still works unchanged).

## Alternatives considered

- **Overload the existing `PUT /api/v1/scheduled-tasks/:scheduleId` update endpoint to encode pause/resume** (e.g. a body flag) — rejected: the brief and the existing `updateScheduledTask` contract (`scheduled-tasks-api/spec.md` "Update scheduled task") already fully re-sends `displayName`/`trigger`/`model`/`prompt`; reusing it for a pure state toggle would force the frontend to round-trip fields it isn't editing, and risks accidentally mutating them. Dedicated pause/resume endpoints match the upstream DIAL Scheduler's own action-endpoint shape 1:1, keeping the BFF a thin proxy.
- **Derive `isActive` purely in the frontend from `Boolean(nextRunTime)`** — rejected per the brief: this can't distinguish a paused recurring schedule from a completed one-time schedule or one with no future run in every case, and doing it in React duplicates a contract decision that belongs in one place. Centralizing derivation in the BFF mapper (still today's best-available signal until the upstream contract is confirmed) keeps that logic single-sourced and swappable once an authoritative field is confirmed.
- **Do nothing (no proposal)** — rejected: leaves users unable to pause without a full Edit round-trip, and edit requires re-supplying every task field.
