## Why

### Problem

A user viewing a saved scheduled task cannot run it immediately to obtain a fresh result without waiting for its trigger. The supplied design adds a **Start now** header action and a new **In progress** entry in History; the supplied Scheduler contract now supports this operation.

## What Changes

### Solution

- Add Start now after Edit on the task detail page. Submit the saved definition once and insert the server-returned run into History immediately after HTTP 202.
- Expose `POST /api/v1/scheduled-tasks/:scheduleId/run` and `GET /api/v1/scheduled-tasks/:scheduleId/runs/:runId` through the existing BFF and generated client. Poll that run every two seconds for up to 70 seconds.
- Keep schedule activation, trigger, next run and update timestamp unchanged. Preserve loaded history, deduplicate by run id, and show terminal status/conversation navigation when available.
- Preserve credential-stage failures as a typed response field and prompt the user to sign in to DIAL Chat. Do not preflight external sign-in or automatically repeat a POST.
- Localize action, pending, accepted, polling and failure feedback. Support keyboard access, RTL and the existing mobile History tab.

### Non-goals

Model list/filter changes from sections 1–2 of the attachment; starting from list cards, editing payloads at launch, cancelling runs, server-side concurrency locks, scheduler changes, new global providers, or changes to ordinary scheduled execution.

### Acceptance criteria

1. One activation makes one bodyless POST; successful acceptance adds exactly one real run at the top of History with the existing In progress spinner, without waiting for a list refresh.
2. Status polling uses the returned id, preserves older pages and stops on terminal status, navigation, feature disablement or the 70-second deadline. Reaching the deadline does not falsely mark the run failed.
3. The loaded schedule and schedule-list cache are unchanged by starting a run. Deleted tasks cannot be started; request errors create no fabricated row.
4. Credential failures prompt sign-in; other errors retain actionable localized feedback. No automatic POST retry occurs, including after login.
5. Responsive/RTL, request-race, API security, generated-contract and regression tests pass; public API documentation is updated.

## Capabilities

### New Capabilities

None; extend the existing detail and API capabilities.

### Modified Capabilities

- `scheduled-task-detail-page`: add Start now and accepted-run tracking; remove the previous explicit prohibition of a run-now control; distinguish exhausted triggers from manual execution.
- `scheduled-tasks-api`: add immediate-run and single-run endpoints, credential-stage projection, and clarify that completion describes automatic scheduling.

## Impact

- Follow `apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts:269` and `scheduled-tasks.service.ts:589` for authenticated run access; reuse `scheduled-tasks.mapper.ts:274` for run normalization.
- Follow `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx:65` for page ownership and its stale-guard mutation pattern. An app hook owns manual execution; the existing run-history hook remains responsible for pagination and ordinary 15-second refresh (`libs/chat-hooks/src/scheduled-task/use-scheduled-task-runs.ts:30`). No new context is needed.
- Shared-library scope is limited to additive, optional presentation props in `libs/scheduled-tasks` and generated artifacts in `libs/chat-api-client`. The app passes callbacks, pending/disabled values and localized labels; networking, auth, navigation, credential recovery and polling stay in `apps/chat`. No new exception to library isolation is needed.
- Extend the existing configured `scheduledTasksApi` through `apps/chat/src/server-api/scheduled-tasks.api.ts`; regenerate from backend Swagger, never edit generated files.
- Update affected app/lib READMEs and the scheduled-task API summary in `docs/architecture.md` during implementation. Reuse `scheduledTasksEnabled` and its role policy; no new feature key or environment variable.

### Alternatives considered

Reusing only the existing 15-second history refresh is smaller but misses immediate feedback and the attached single-run polling contract. Choose an app-owned manual-run hook over changing polling behavior for every shared-history consumer.

### Backward compatibility and rollback

Endpoints and DTO fields are additive. Optional presentation props keep existing hosts working without Start now. Deploy backend before frontend; reverting the frontend removes the action without modifying saved schedules or accepted runs. Old clients ignore the new response field.

### Planning assumptions

Clarification questions were sent about concurrency, eligibility and mobile adaptation. Pending answers, this proposal recommends disabling Start now while any known run is in progress, allowing all non-deleted schedules (including paused/completed), and wrapping the existing mobile header actions while retaining the text label. These are explicit product assumptions, not claims established by the desktop screenshot. Review them before apply.

Sources: user-provided `model_expose_and_run_now_endpoint.md`, section 3, and the attached desktop screenshot. No environment values or credentials are required for this proposal.
