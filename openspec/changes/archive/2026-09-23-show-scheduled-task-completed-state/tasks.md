## 1. BFF — DTO and derivation

- [x] 1.1 Add optional `isCompleted` to `ScheduledTaskDto` (`apps/chat-api/src/scheduled-tasks/dto/scheduled-task.dto.ts`) with `@ApiPropertyOptional` and JSDoc stating the derivation rule
- [x] 1.2 Implement the candidate gate + runs check in `ScheduledTasksService` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`): a private helper that, given a mapped `ScheduledTaskDto` and access token, returns `true`/`false`/`undefined` per the three-clause rule (date trigger; null `nextRunTime` or past `trigger.date`; newest run `Success`/`Error`), using the server clock and degrading to `undefined` on runs-call failure with a warn log
- [x] 1.3 Wire the helper into `getScheduledTask` (one runs call for candidates)
- [x] 1.4 Wire the helper into `listScheduledTasks` (parallel checks for the page's candidates, inside the existing `withCachedDialRequest` fetch closure so cached responses skip the calls)
- [x] 1.5 Unit tests for the derivation helper: future one-time (no call), completed `Success`, completed `Error`, in-flight `InProgress`, paused no-runs, paused newest-run `Missed`, recurring (no call), runs-call failure → `undefined` + warn log
- [x] 1.6 Controller/service tests: list response carries `isCompleted` per candidates; get response carries it; failed enrichment does not fail the list
- [x] 1.7 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`

## 2. API client regeneration

- [x] 2.1 Run `npm run openapi` and `npm run openapi:check`; regenerate/verify `libs/chat-api-client` picks up `isCompleted` on `ScheduledTaskDto`
- [x] 2.2 Build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`)

## 3. Lib — status model and pill component

- [x] 3.1 Add `isCompleted?: boolean` to `ScheduledTaskItem` with JSDoc (pre-resolved by the host; `true` renders the Completed badge)
- [x] 3.2 Create `libs/scheduled-tasks/src/utils/scheduled-task-status.ts` with `ScheduledTaskStatus` enum (`Scheduled`/`Paused`/`Completed`) and `getScheduledTaskStatus` precedence function, with JSDoc; export both from `index.ts`
- [x] 3.3 Create `ScheduledTaskStatusPill/ScheduledTaskStatusPill.tsx` (internal component, no `index.ts` export) with `status`/`text`/`textClassName?`/`className?` props and its own `.module.scss` reading `--stc-pill-*`, `--stc-paused-*`, and the new `--stc-completed-*` vars; check icon `aria-hidden` + `stroke={DIAL_KIT_ICON_STROKE}` + `DIAL_ICON_SIZE.SM`
- [x] 3.4 Unit tests: `getScheduledTaskStatus` precedence (completed-wins, paused, active/undefined → scheduled); pill renders one element per status with the right icon/shape and accessible name = text

## 4. Lib — card integration and theming

- [x] 4.1 Extend `ScheduledTaskCardProps`: `labels.completedBadgeLabel` (default `'Completed'`), `colors.completedBadgeBackground/Border/Text`, `typography.completedBadgeClassName` (default a verified `dial-*-text` scale class), with JSDoc quoting defaults
- [x] 4.2 Rewrite `ScheduledTaskCard`'s status block to use `getScheduledTaskStatus` + `ScheduledTaskStatusPill` (no nested ternary; schedule pill text = `item.scheduleLabel`, badge text from `labels`); add the three `--stc-completed-*` entries to the card's `buildCssVars` call
- [x] 4.3 Unit tests: completed card renders badge-only (no schedule pill, no paused badge); paused/active behavior unchanged; color and typography overrides reach the badge; defaults apply without `styles`
- [x] 4.4 Update `libs/scheduled-tasks/README.md`: new item field, new labels/colors/typography entries with defaults, `ScheduledTaskStatus` + `getScheduledTaskStatus` exports with a minimal example; run `npm run validate:docs`

## 5. Lib — detail view

- [x] 5.1 Add `labels` entries to `ScheduledTaskDetailView` props for the completed summary line and the disabled-switch reason (English defaults), thread them to the rendering sites (summary section; next to the disabled Active switch)
- [x] 5.2 Unit tests: completed task renders the summary line + reason label; non-completed renders neither; disabled switch behavior unchanged (no pause/resume calls)

## 6. App — mapper, i18n, page wiring

- [x] 6.1 Pass `isCompleted` through in `mapScheduledTaskDtoToItem` (`apps/chat/src/utils/map-scheduled-task-dto.ts`) with no reinterpretation; extend mapper tests (future one-time, completed, in-flight, paused-missed, recurring active, recurring paused fixtures)
- [x] 6.2 Add i18n keys to `ScheduledTasksI18nKeys` + `en.json` + all locale files: completed badge label, completed summary line, disabled-switch reason
- [x] 6.3 Wire `ScheduledTasksPage` to pass the completed badge label; wire `ScheduledTaskDetailPage` to pass the summary-line and switch-reason labels
- [x] 6.4 Page tests: card grid shows the Completed badge for a completed item; detail page shows summary line + reason for a completed task
- [x] 6.5 Run `npm run verify:changed`

## 7. Verification and upstream checks

- Removed: `lastToRun` desc null-placement live verification — the author will dev-test it manually (see design.md Open Question 1).

- [x] 7.2 Full pass: `npm run verify:full`, `npm run validate:docs`, and confirm no `dial-*-text` class in the new code is absent from the kit scale (`getEntityDetails("typography")`)

## 8. Extension — expired-window recurring tasks report completed

Added during dev-testing: a cron schedule whose activity window has closed with no upcoming run shows the same "Completed" badge instead of a misleading "Paused".

- [x] 8.1 Add the `isExpiredRecurring` shape to the BFF derivation (`triggerType === 'cron' && nextRunTime == null && trigger.cron.endDate < now` → `isCompleted: true`, no runs call); degrade to `false` when the response carries no `trigger.cron.endDate`
- [x] 8.2 BFF tests: expired-window recurring → `true` with no runs call; paused-within-window and unbounded recurring → `false`
- [x] 8.3 Broaden DTO/model JSDocs ("can no longer produce a future run") and the detail-page expired-window test to the realistic `isCompleted: true` DTO
- [x] 8.4 Update the spec deltas, design, and proposal for the extended rule; regenerate OpenAPI; re-run affected verification
