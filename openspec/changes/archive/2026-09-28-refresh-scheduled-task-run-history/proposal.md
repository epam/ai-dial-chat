# Proposal

## Why

`useScheduledTaskRuns` (`libs/chat-hooks/src/scheduled-task/use-scheduled-task-runs.ts`) fetches page 0 of a schedule's run history once on mount and never refreshes it (`refetch()` exists only as a manual, full-reset action triggered by the user). Two consequences follow from the same staleness: an in-progress run's spinner (`ScheduledTaskRunDtoStatusEnum.InProgress`) never resolves to its terminal status without the user navigating away and back, and a new run that starts while a panel is open never appears. Both consumers — `ScheduledTaskDetailPage.tsx` and `ActiveScheduledTaskContext.tsx` — inherit this from the shared hook. Fixing it now (GitHub issue #8970, milestone `release-1.2`) removes a rough edge in the just-shipped Scheduled Tasks feature before more users depend on it.

## What Changes

- `useScheduledTaskRuns` (`libs/chat-hooks/src/scheduled-task/use-scheduled-task-runs.ts`) gains a new `nextRunTime?: string | null` option and two background-refresh triggers, both merging into the existing `items` state rather than resetting it:
  - **Poll while in-progress**: every 15s while any loaded run has `status === ScheduledTaskRunDtoStatusEnum.InProgress`, re-fetch page 0 and merge results into `items` by `id` (update in place, prepend unseen ids, never remove). Stops when no run is in-progress, or after 20 consecutive no-change polls (5 minutes), whichever comes first.
  - **One-shot refresh at `nextRunTime`**: schedules a single refresh 5s after `nextRunTime`, only while the tab is visible; if `nextRunTime` has already passed at mount, refreshes once immediately.
  - Both triggers pause while the tab is hidden (one catch-up refresh on return to visible), never run while `isLoading`/`isLoadingMore` is `true`, and a failed background refresh keeps the current `items` and does not surface the foreground error state.
- `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts` (the app adapter) threads a new `nextRunTime` parameter through to the shared hook.
- `ScheduledTaskDetailPage.tsx` and `ActiveScheduledTaskContext.tsx` each pass their own already-fetched `task?.nextRunTime` into the hook call — neither needs a new fetch.
- No new capability, no new endpoint, no new UI: existing consumers get live-updating history for free.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `scheduled-task-detail-page`: the requirement documenting the `useScheduledTaskRuns(scheduleId, enabled)` hook contract (`openspec/specs/scheduled-task-detail-page/spec.md`) currently describes only the initial-fetch/`loadMore`/`AbortController` behavior; it needs a delta describing the new background-refresh triggers, the merge-not-reset semantics, and the new `nextRunTime` argument `ScheduledTaskDetailPage` now supplies.
- `scheduled-task-conversation-context`: the requirement stating the context uses "the first page of `useScheduledTaskRuns(scheduleId, true)` (reused unmodified)" (`openspec/specs/scheduled-task-conversation-context/spec.md`) becomes inaccurate once the hook takes a new `nextRunTime` argument that this context must also supply from its own `task` state; needs a delta correcting that requirement.

## Alternatives Considered

Polling/scheduling logic could instead live in the app-level adapter (`apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts`) or a new companion hook, mirroring `useAppVersionCheck.ts`'s pattern. Rejected: the state that must be merged into (`items`, the `offset`/`generation` staleness-guard refs) is private to the shared lib hook, so a split would require exposing those internals across a hook boundary for no benefit; full comparison in `design.md`.

## Impact

- **Code**: `libs/chat-hooks/src/scheduled-task/use-scheduled-task-runs.ts` (behavior + new option), its test file `libs/chat-hooks/src/scheduled-task/tests/useScheduledTaskRuns.spec.ts` (extended), `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts` (new parameter), `apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx` and `apps/chat/src/context/ActiveScheduledTaskContext.tsx` (pass `task?.nextRunTime`).
- **API surface**: none — no backend/OpenAPI change; the existing `GET /api/v1/scheduled-tasks/:scheduleId/runs` endpoint (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts:205`, already `Cache-Control: private, no-store`, unthrottled) is called more often by the same client, at a bounded rate.
- **Dependencies**: none added. The hook newly imports `ScheduledTaskRunDtoStatusEnum` (a runtime value, not just a type) from the already-declared `@epam/ai-dial-chat-api-client` dependency in `libs/chat-hooks/package.json` — an established pattern in this lib (e.g. `libs/chat-hooks/src/conversation/tests/stage.spec.ts` imports `StageDtoStatusEnum` the same way).
- **i18n**: none. No new user-visible strings — existing status labels/icons already render `InProgress`→terminal transitions; only the timing of when that data changes is new.
- **Feature flags**: none new. Already fully gated behind the existing `scheduledTasksEnabled` flag through both consumers.
- **Backward-compat / rollback**: additive and non-breaking. `nextRunTime` is optional (omitting it simply disables the one-shot trigger); the poll trigger activates only when an in-progress run is present, so a caller that never sees one observes no behavior change. Revert is a straight revert of the hook/consumer changes — no data migration, no persisted state, no API contract to unwind.
