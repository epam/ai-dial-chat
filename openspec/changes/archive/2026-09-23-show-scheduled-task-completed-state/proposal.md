# Show a "Completed" state on scheduled-task cards for one-time tasks that have already run

Issue: [epam/ai-dial-chat#8931](https://github.com/epam/ai-dial-chat/issues/8931)

## Why

A terminal scheduled task — a one-time (`date`-trigger) task that has already fired, or a recurring task whose activity window has closed — will never run again, but the UI cannot express that. Because DIAL Scheduler exposes no active/paused field, the BFF derives `isActive = next_run_time != null` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts:169`), so a fired one-time task is indistinguishable from a user-paused one and the card shows a misleading **Paused** badge for a task the user never paused and cannot meaningfully resume.

## What Changes

- **BFF**: new optional `isCompleted` field on `ScheduledTaskDto`, computed in `listScheduledTasks` and `getScheduledTask`: a one-time task with nothing left to run whose newest run is terminal (`Success` or `Error`, via a `GET schedules/{id}/runs?limit=1` check) is completed, as is a recurring task whose cron activity window has closed with no upcoming run (fields alone, no runs call). OpenAPI spec regenerated, `chat-api-client` rebuilt.
- **App mapper**: `mapScheduledTaskDtoToItem` passes `isCompleted` through 1:1 (`apps/chat/src/utils/map-scheduled-task-dto.ts:159`), mirroring the existing `isActive` pass-through.
- **Lib** (`libs/scheduled-tasks`): new `ScheduledTaskItem.isCompleted` prop; the card's status block is extracted into an internal `ScheduledTaskStatusPill` component driven by an exported `getScheduledTaskStatus` function and `ScheduledTaskStatus` enum (`Completed > Paused > Scheduled`); a "Completed" badge (check icon, modelled on the existing Paused badge) replaces the schedule pill for completed tasks. Detail view gains a completed line in the details summary and an explanatory label on the already-disabled Active toggle.
- **Sorting**: no code change — upstream already sorts null-`next_run_time` schedules last under `order_by=next_run_time` (verified in `archive/2026-08-03-add-scheduled-tasks-server-sort`); one verification task pins `lastToRun` desc null-placement.
- **Docs**: lib README updated for the new props/exports; `npm run validate:docs` passes.

## Capabilities

### New Capabilities

(none — all affected behavior belongs to existing capabilities)

### Modified Capabilities

- `scheduled-tasks-api`: new requirement — `ScheduledTaskDto.isCompleted` BFF-computed field (list + get paths, runs-based derivation), sibling to the existing "Scheduled task active state field" requirement.
- `scheduled-tasks-page-ui`: "Card active state is populated from the BFF isActive field" is extended — the card derives a three-state status (`completed`/`paused`/`scheduled`) from `isCompleted`/`isActive` and renders the matching pill/badge via the extracted `ScheduledTaskStatusPill`.
- `scheduled-task-detail-page`: "Active switch is disabled, not hidden, when a schedule can no longer produce a future run" is extended — the disabled switch carries an explanatory label, and the details summary shows the completed state for one-time tasks that finished.

## Impact

- **Code**: `apps/chat-api/src/scheduled-tasks/` (mapper, service, DTOs, controller docs), `libs/chat-api-client/` (regenerated), `apps/chat/src/utils/map-scheduled-task-dto.ts` + tests, `libs/scheduled-tasks/src/` (new `ScheduledTaskStatusPill` component + `utils/scheduled-task-status.ts`, `ScheduledTaskCard`, `ScheduledTaskDetailView`, props models, `index.ts`, README), `apps/chat/src/i18n/locales/en.json` + `translation-keys.ts` (new "Completed" badge label, disabled-toggle reason).
- **API contract**: additive optional field only — non-breaking for existing consumers; `npm run openapi` + `npm run openapi:check` required.
- **Upstream calls**: list cost grows by one parallel `runs?limit=1` call per date-trigger item with null `nextRunTime` per cache-missed page (bounded: only fired/paused one-time tasks); get grows by one runs call per detail load.
- **i18n**: two new user-visible strings (badge label "Completed", toggle-disabled reason).
- **Library isolation** (scope-creep flag: touches `libs/*`): the lib stays free of completion semantics — it receives `isCompleted` as a pre-resolved boolean on `ScheduledTaskItem` (host-owned derivation, same contract as `isActive`) and only owns visual precedence. All date/run-history/upstream knowledge stays in the BFF; i18n stays in the app via the existing `labels` prop pattern.
- **Rollback / backward-compat**: purely additive — revert the commits; `isCompleted` is optional everywhere (DTO, item model, props), so consumers that ignore it render exactly today's UI.
