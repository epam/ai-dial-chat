# Spec Delta

## MODIFIED Requirements

### Requirement: Task detail and initial run-history page are fetched concurrently and independently

Once the context derives a valid `{ scheduleId, runId }` pair, it SHALL start two requests without either waiting for the other:

- `getScheduledTask(scheduleId)` from `apps/chat/src/server-api/scheduled-tasks.api.ts`, tracked as `taskState: 'loading' | 'error' | 'success'` with the resolved `ScheduledTaskDto` on success.
- The first page of `useScheduledTaskRuns(scheduleId ?? '', Boolean(scheduleId), task?.nextRunTime)`, exposed as-is on the context value. The context SHALL pass its own already-resolved `task?.nextRunTime` into this call rather than fetching the task a second time; the hook's background-refresh behavior (polling while a run is in progress, a one-shot refresh at `nextRunTime`) is otherwise identical to any other consumer of the shared hook and is not re-specified here.

Fetches SHALL use the existing `cancelled`-flag-before-`setState` convention (per `useFavicon.ts` and `useScheduledTaskRuns.ts:173`). Rendering of the conversation messages and the existing sources-panel content SHALL NOT be blocked or delayed by either request's pending or failed state.

#### Scenario: Both requests start together

- **WHEN** the context resolves a valid `scheduleId`/`runId` pair for the first time in a session
- **THEN** `getScheduledTask(scheduleId)` and the initial `listScheduledTaskRuns` page are both requested before either resolves

#### Scenario: Conversation renders while task data is pending or failed

- **WHEN** `taskState` is `'loading'` or `'error'`
- **THEN** the conversation's messages continue to render normally

#### Scenario: Run history hook receives the task's next run time once resolved

- **WHEN** `getScheduledTask(scheduleId)` resolves and `task.nextRunTime` becomes available
- **THEN** the context's `useScheduledTaskRuns` call is passed that `nextRunTime` value on its next render, without triggering a second `getScheduledTask` request
