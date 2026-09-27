# Design: show-scheduled-task-completed-state

## Context

A one-time (`date`-trigger) scheduled task that has fired is terminal, but the UI shows it as **Paused**. Root cause: DIAL Scheduler exposes no authoritative active/paused field, so the BFF derives `isActive = upstream.next_run_time != null` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts:169`, a documented assumption from `archive/2026-08-11-add-scheduled-task-active-toggle`). After a one-time task fires, `next_run_time` is null, so it is indistinguishable from a user-paused schedule.

Verified upstream facts that shape this design (all recorded in archived change designs):

- **List items carry no `trigger`** — a live logged list response (2026-07-24, `archive/2026-07-24-add-scheduled-tasks-list-and-cards` Open Questions) is `{ id, display_name, service_id, next_run_time, trigger_type, created_by, created_at, updated_at }`. `trigger.date` is available only on get/create/update shapes.
- **Run history is the only fired-vs-paused discriminator**: `GET schedules/{id}/runs` is paginated, newest-first, with status `success | error | in_progress | missed`.
- **Upstream sort already handles nulls**: schedules with no `next_run_time` sort last when `order_by=next_run_time` (`archive/2026-08-03-add-scheduled-tasks-server-sort`, confirmed against a live Scheduler).
- The detail-page Active switch is **already disabled** for `triggerType === 'date' && nextRunTime == null` (`apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx:256`).

Stakeholders: scheduled-tasks card/detail UI consumers; the `apps/chat-api` scheduled-tasks domain owner (upstream-call and cache cost); the `libs/scheduled-tasks` owner (library isolation and theming contract).

## Goals / Non-Goals

**Goals:**

- A "Completed" badge on cards of terminal tasks — one-time tasks that have finished running, and recurring tasks whose activity window has closed — replacing the schedule pill, with `Completed > Paused > Scheduled` visual precedence and exactly one status element rendered.
- A BFF-owned `isCompleted` derivation that separates completed from paused in **both** directions (paused-future and paused-never-ran), centralized in one mapper/service location.
- Detail view: a completed state in the details summary and an explanatory label on the already-disabled Active toggle.
- Lib stays host-agnostic: it receives a pre-resolved boolean and owns only visual precedence.

**Non-Goals:**

- No new endpoints (the field rides the existing list/get responses).
- No separate "Failed" or "Missed" terminal states (a run that ended in `Error` still shows Completed; outcome lives in run history).
- No date text on the badge (design mock shows badge-only).
- No sort code changes (upstream behavior already matches; verification only).
- No change to pause/resume endpoints, run-history UI, or the unread-tracking capability.

## Decisions

### Decision 1: `isCompleted` is BFF-computed from run history, on both list and get paths

**Chosen rule** — `isCompleted: true` means "can no longer produce a future run", via two terminal shapes:

```
// Shape A — expired recurring: unambiguous from fields alone, no runs call
triggerType === 'cron' && nextRunTime == null && trigger.cron.endDate < now

// Shape B — finished one-time: fields alone are ambiguous (paused vs fired),
// so the newest run must also be terminal
triggerType === 'date'
  && (nextRunTime == null || trigger.date < now)
  && newestRun != null && newestRun.status in { Success, Error }
```

The first two clauses form the *candidate gate* (an OR, so it is path-independent: the list path evaluates it with `nextRunTime` alone because list items carry no `trigger.date`; the get path has both arms and they agree wherever both are computable). The third clause — a `runs?limit=1` upstream call (newest-first ordering is already the endpoint's documented default) — is the only signal in the system that separates "fired" from "paused, never fired".

**Extension (added during implementation, author's call after dev-testing):** Shape A — a cron schedule whose activity window has closed — reuses the same field and the same "Completed" badge rather than a distinct "Ended" state. It mirrors exactly the condition that already disables the detail view's Active switch (expired recurring), closing a gap where the detail page said "activity window has ended" while the card grid said "Paused". It needs no runs call: unlike a one-time schedule (where paused-future and fired are field-identical), a closed window with no upcoming run is conclusively terminal from the schedule fields. Caveat: list responses that omit the nested `trigger` carry no `cron.endDate`, so such deployments degrade to today's Paused display on the grid (the get path always detects it); the live list responses observed during dev-testing do carry `trigger`.

Placement: computed in `ScheduledTasksService` for `listScheduledTasks` (parallel `Promise.all` runs-checks for the page's one-time candidates, inside the existing `withCachedDialRequest` wrapper so the cost is paid once per 30s cache window) and for `getScheduledTask` (one extra upstream call per detail load). `fromUpstreamSchedule` itself stays pure — it cannot see runs; the service sets the field after mapping. The comparison against `now` uses the BFF's server clock, keeping clock-skew/timezone handling server-side and single-sourced.

**Alternatives considered:**

1. **Date-only rule from the issue ("trigger type + nextRunTime")** — rejected as *infeasible in the list path*, not merely imprecise: list items have no `trigger.date`, so a paused **future** one-time task (`nextRunTime == null` after pause) is field-identical to a completed one; marking both "Completed" would badge a fully resumable task that has not reached its date — strictly worse than today's Paused. Even where `trigger.date` exists (get path), a task paused before its date passes would be mislabeled.
2. **Frontend derivation from the runs the detail page already fetches** — rejected: duplicates the heuristic in a second place; the codebase explicitly rejected frontend duplication of a BFF heuristic once before (active-toggle Decision 1, alternative 2), and when DIAL Scheduler eventually confirms an authoritative state field, both `isActive` and `isCompleted` must be replaceable in one location.
3. **Accept the conflation (badge every date-trigger + null-`nextRunTime` task)** — rejected: same defect as 1.

### Decision 2: "Completed" means *terminal*, regardless of run outcome

A newest run of `Success` **or** `Error` marks the task completed — the badge communicates "this task has finished; it will not run again", and the outcome remains visible in the run history the detail page already renders. `InProgress` does **not** count (the run has not finished), and no run record at all means the task never fired (paused-future or paused-while-date-passed).

Consequences accepted and documented:

- **In-flight window**: between the date arriving and the run finishing, derived `isActive` is already `false`, so the card shows Paused for the seconds-to-minutes a run takes. Transient; not special-cased.
- **Active-but-missed one-time task** (scheduler downtime; newest run status `missed`): not completed → shows Paused. Same wrongness class as today's behavior; a dedicated "Missed" state is out of scope.
- The rule is **robust to the open upstream unknown** of whether a paused task whose date passes produces a `missed` record or no record — both map to "no finished run" → not completed.

### Decision 3: Lib receives a pre-resolved boolean; visual precedence is lib-owned

`ScheduledTaskItem` gains `isCompleted?: boolean` (same contract shape as `isActive`). The lib performs no date math, no API knowledge — library isolation holds, with the BFF as the app-level adapter that owns all upstream semantics.

The card's status block is extracted into an internal `ScheduledTaskStatusPill` component (own folder/module per lib conventions), driven by:

```ts
export enum ScheduledTaskStatus { Scheduled = 'scheduled', Paused = 'paused', Completed = 'completed' }

/** Resolves a card's visual status: an explicit presentationStatus wins, then Completed over Paused, over the schedule pill. */
export const getScheduledTaskStatus = (item: ScheduledTaskItem): ScheduledTaskStatus => {
  switch (item.presentationStatus) { /* Active→Scheduled, Paused→Paused, Completed→Completed */ }
  if (item.isCompleted) return ScheduledTaskStatus.Completed;
  if (item.isActive === false) return ScheduledTaskStatus.Paused;
  return ScheduledTaskStatus.Scheduled;
};
```

The `presentationStatus` override layer preserves the pre-change card contract (`presentationStatus ?? derived`), which the first implementation of this change silently dropped — restored after review.

`ScheduledTaskStatus` and `getScheduledTaskStatus` are exported from `index.ts` (the enum is reachable through documented behavior and wanted by tests; the detail view may reuse the precedence); `ScheduledTaskStatusPill` stays internal (single consumer — the card). The card resolves the per-status `text`/`textClassName` pair from an inline enum-keyed sources record (a plain map lookup — a separate `getScheduledTaskStatusInfo` helper was cut in review as pure indirection), so the card holds no branching:

```tsx
const status = getScheduledTaskStatus(item);
const { text: statusText, textClassName: statusTextClassName } = statusSources[status]; // { [ScheduledTaskStatus.Scheduled]: { text: item.scheduleLabel, ... }, ... }
```

This extraction also keeps the card free of the nested ternary that a third inline state would require (repo TS rule), and the enum-keyed sources record fails to compile when a new status member is added without an entry.

`ScheduledTaskStatusPillProps`: `status`, `text` (pre-resolved by the card — `item.scheduleLabel` for Scheduled, the badge label from card `labels` otherwise), `textClassName?`, `className?`. Render per status: Scheduled → rounded-lg pill, no icon; Paused → rounded-full badge + `IconPlayerPause`; Completed → rounded-full badge + check icon. Icons are `aria-hidden` with `stroke={DIAL_KIT_ICON_STROKE}`; the text is the accessible signal.

**Theming**: the pill's `.module.scss` reads the existing `--stc-pill-*` / `--stc-paused-*` vars plus new `--stc-completed-bg` / `--stc-completed-border` / `--stc-completed-text` — all still set on the **card root** via `buildCssVars` and cascading into the child, so the card keeps owning the public theming contract. Both badges (Paused and Completed) default to a **transparent** background with the tertiary border — only the schedule pill keeps a filled (`--bg-layer-sunken`) background; the `*BadgeBackground` overrides remain functional for a host that wants a fill. New `ScheduledTaskCardColors` entries (`completedBadgeBackground/Border/Text`) and `typography.completedBadgeClassName` follow the Paused pattern exactly, with `var(--stc-*, var(--token, #hex))` fallback chains meeting AAA (7:1) contrast. `labels.completedBadgeLabel` defaults to `'Completed'` (app passes the `t()` key; no i18n inside the lib).

### Decision 4: Detail view — keep the disabled toggle, add a reason and a summary line

The Active switch stays **disabled** (not hidden/replaced) for exhausted schedules — hiding collapses "terminal" into "state unknown", which the active-toggle design explicitly rejected (its Decision 4). This change adds an explanatory label for the disabled state (new `labels` entry threaded to the view, e.g. an `isActiveDisabledReason` text rendered near the switch) and a completed line in the details summary when `task.isCompleted` is true. The detail page reads `isCompleted` from the BFF DTO — zero new frontend API calls.

### Decision 5: Sorting — no code change, one verification

Upstream already sorts null-`next_run_time` schedules last under `order_by=next_run_time`, which covers `firstToRun` (asc) and matches the design mock (completed at grid end). `newest`/`nameAZ` are completion-agnostic. The one unverified cell is `lastToRun` (`desc`) null-placement; an explicit task verifies it against a live Scheduler and records the result — no frontend/BFF reordering is built either way (server-driven sort + infinite scroll makes client-side reordering break pagination).

### Decision 6: Cache and upstream-call cost

The runs-checks in `listScheduledTasks` run inside the existing `withCachedDialRequest` wrapper (30s TTL, `{limit, offset, search, sort}` key family, invalidated on create/update/pause/resume/delete as today) — cost is one parallel `runs?limit=1` per **date-trigger + null-`nextRunTime`** item per cache-missed page, bounded because most schedules are cron. `getScheduledTask` is uncached today and stays uncached; its runs-check is one extra parallel-safe call. A failed runs-check MUST NOT fail the list: the item degrades to `isCompleted: undefined` (card shows Paused/schedule pill as today) — enrichment is best-effort, logged at warn.

## Risks / Trade-offs

- **[Risk] N+1 upstream runs calls per list cache-miss** → bounded to fired/paused one-time tasks only, parallelized, paid once per 30s cache window per query variant; degrades to `undefined` on failure.
- **[Risk] Upstream `trigger` absence in list items is a 2026-07-24 observation and could change** → the derivation reads only `trigger_type`/`next_run_time` in the list path (both observed stable); if the list later carries `trigger`, the get-path arm simply becomes available there too.
- **[Risk] Stale `isCompleted` up to the 30s cache TTL after a run finishes** → same staleness window the list already accepts for every other field; a task flipping to completed appears on the next cache expiry or invalidating mutation.
- **[Risk] The lib refactor (extracted pill component) widens the diff inside `libs/scheduled-tasks` beyond the minimal branch-add** → buys nested-ternary compliance, a unit-testable precedence function, and a reuse point; the public theming contract does not move (vars still set on the card root).
- **[Risk] `missed` runs semantics unverified** → irrelevant to correctness of this rule (both "no record" and "missed record" mean not-completed); only the future "Missed" state, if ever built, needs it.

## Migration Plan

Purely additive: optional DTO field (OpenAPI regen + `chat-api-client` rebuild), optional lib props/exports, two i18n keys, no endpoint or behavior removals. Deploy as a single change. **Rollback:** revert the commits — consumers that ignore `isCompleted` render exactly today's UI.

## Open Questions

1. **`lastToRun` desc null-placement** — does upstream put null-`next_run_time` schedules last under `order_dir=desc` as well, or first? Verification removed from the task list — the author will dev-test it manually against a live Scheduler; no code change either way, but the observed placement is to be recorded here and pinned in a test once measured. `firstToRun` end-placement is already confirmed live.
2. **Authoritative upstream state field** (standing question inherited from the active-toggle change): when DIAL Scheduler confirms one, both `isActive` and `isCompleted` derivations are replaced in the same mapper/service location — this design keeps them centralized for exactly that day.
