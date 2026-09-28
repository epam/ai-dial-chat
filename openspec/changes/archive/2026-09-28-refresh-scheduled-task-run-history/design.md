# Design

## Context

`libs/chat-hooks/src/scheduled-task/use-scheduled-task-runs.ts` owns all state for one schedule's run history — `items`, `isLoading`/`isLoadingMore`, `hasMore`, an `offset` ref, and a `generation` ref that guards against a stale response overwriting a newer one (the same guard `loadMore` already relies on). `refetch()` exists today only as a full reset back to page 0, dropping everything already loaded — explicitly the wrong primitive to reuse for a background refresh (per proposal.md and issue #8970). Two consumers call the app-level adapter `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts`, which does nothing but forward to the shared hook: `ScheduledTaskDetailPage.tsx` and `ActiveScheduledTaskContext.tsx`, both of which already hold the task DTO (and therefore `nextRunTime`) independently of the runs hook. See proposal.md - Why for the two staleness symptoms this fixes.

## Goals / Non-Goals

**Goals:**

- Keep an in-progress run's row updating to its terminal status without a manual reload.
- Surface a run that starts while a panel is open, within a bounded delay.
- Do all of this by extending the existing hook's state machine, not by adding a second source of truth.

**Non-Goals:**

- Deduplicating polling requests across multiple mounted consumers of the same `scheduleId` (e.g. the detail page and the chat-side panel open simultaneously for the same task). Each hook instance polls independently. Called out as the first mitigation to reach for if DIAL Scheduler capacity ever becomes a real constraint (see Risks below), not built now.
- Handling a run that upstream deletes out from under a background refresh — a background refresh only updates and adds, never removes (see the "never remove" scenario in the spec delta).
- Reconciling the run list against the conversation list (unread-dot freshness) — deliberately left to the existing independent mechanism (see Decisions).
- Any backend/OpenAPI change — `GET /api/v1/scheduled-tasks/:scheduleId/runs` is reused unchanged.
- Re-fetching the task DTO to obtain an updated `nextRunTime` after a run fires. `nextRunTime` is read once per value the host passes in; for a recurring (`cron`) schedule, only the currently-known next run gets the one-shot trigger. A later run is still caught, but only via the in-progress-poll trigger, and only once that run's row has actually loaded as `InProgress` (e.g. via the poll trigger already running for an earlier in-progress run, or the user reopening the panel). Chaining one-shot triggers off a self-refreshing task fetch would require this hook to own task-fetch scheduling too, which is a larger change than this issue asks for.

## Decisions

### 1. Polling/scheduling logic lives inside the shared lib hook, not a companion hook or the app adapter

**Chosen**: add the new triggers directly to `libs/chat-hooks/src/scheduled-task/use-scheduled-task-runs.ts`, alongside the existing `useEffect`/`loadMore`/`refetch` implementation.

**Alternatives considered**:

| Option | Why rejected |
|---|---|
| App-level timers in `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts`, following `useAppVersionCheck.ts` literally | `useAppVersionCheck.ts` polls a health endpoint it owns end-to-end with no shared mutable state; this hook's polling must merge into `items` and respect the `offset`/`generation` refs that are private to the shared hook. Doing it at the app level means exposing those internals across a hook boundary, or duplicating a second copy of pagination state. |
| A companion hook (`useScheduledTaskRunsPolling`) that the shared hook composes internally | Same problem one level down — the companion still needs read/write access to `items`/`generation`/`offset`, so it either becomes a thin wrapper around the same closure (no real separation) or forces those refs into a shared object passed between two hooks for no testability gain. |

`useAppVersionCheck.ts` is still the structural reference for the interval + `visibilitychange` + cleanup shape — see Decision 3.

### 2. In-progress detection uses the generated `ScheduledTaskRunDtoStatusEnum`, not the app-level mapped enum

**Chosen**: `run.status === ScheduledTaskRunDtoStatusEnum.InProgress`, importing the generated enum as a runtime value from `@epam/ai-dial-chat-api-client`.

The lib hook only ever sees raw `ScheduledTaskRunDto[]`. The mapped, lib-facing `ScheduledTaskRunStatus` enum lives in `@epam/ai-dial-scheduled-tasks`, consumed at the app level via `apps/chat/src/utils/map-scheduled-task-run-dto.ts:13-18`'s `UPSTREAM_STATUS_MAP`. `chat-hooks` does already import from `@epam/ai-dial-scheduled-tasks` elsewhere (`scheduled-task-preparation.ts`, `scheduled-task-mapping.ts`, `scheduled-task-trigger.ts`) — so the reason to avoid it here is **not** a library-isolation boundary violation. It's that `@epam/ai-dial-scheduled-tasks` is declared an **optional peer** in `libs/chat-hooks/package.json` (`peerDependencies` + `peerDependenciesMeta.optional`), and every existing chat-hooks import from it is `import type` — type-only imports are erased at compile time and impose no runtime requirement on a host that doesn't install the peer. Importing `ScheduledTaskRunStatus` as a **runtime value** (to compare against, not just type against) would be the first runtime dependency on an optional peer, silently turning it into a hard requirement for any host wiring up this hook. `@epam/ai-dial-chat-api-client`, by contrast, is a required `dependency` (not a peer) of `libs/chat-hooks/package.json`, so a runtime import from it carries no such risk. Its generated `ScheduledTaskRunDtoStatusEnum` (`libs/chat-api-client/src/generated/src/models/index.ts:6206-6213`, publicly re-exported through `libs/chat-api-client/src/index.ts`) carries the identical raw values as `UPSTREAM_STATUS_MAP`'s keys.

**Alternatives considered**:

| Option | Why rejected |
|---|---|
| Hardcode the raw string literal `'InProgress'` | Works, but duplicates a magic string that already has a generated, type-checked name available at zero extra cost. |
| Host-supplied `isRunPending?: (run) => boolean` predicate, defaulted internally | Speculative flexibility for a status vocabulary variance nothing in the codebase suggests is coming; adds an API surface with no current caller needing it. |
| Import `ScheduledTaskRunStatus` from `@epam/ai-dial-scheduled-tasks` at runtime | Would be the first runtime (non-type) import from an optional peer in this lib, forcing every host to install it even if they only use `chat-hooks`' data layer without the presentational `libs/scheduled-tasks` components. |

Precedent for importing a generated status enum as a runtime value into `chat-hooks` from a required dependency already exists in production code (not just tests): `libs/chat-hooks/src/catalog/usePublishFolders/usePublishFolders.ts` imports `ListFilesItemDtoNodeTypeEnum`; `libs/chat-hooks/src/usage/map-user-usage-to-model-limits.ts` imports `DeploymentItemDtoTypeEnum`. `@epam/ai-dial-chat-api-client` is already a declared `dependency` (not peer, correctly) of `libs/chat-hooks/package.json`.

**Known pre-existing issue, out of scope**: that dependency is currently pinned at `"*"` in `libs/chat-hooks/package.json`, which `.claude/rules/libs.md` flags as an unbounded-version defect (accepts any future breaking release silently). This predates this change and is not touched here per scope discipline — noting it so it isn't mistaken for something this change introduced.

### 3. Flat poll interval with a hard stop, no exponential backoff

**Chosen**: poll every 15 seconds while any loaded run is `InProgress`; stop entirely after 20 consecutive polls with no status change (5 minutes total, since 20 × 15s = 300s). One shared constants block, e.g.:

```ts
/**
 * Background-refresh timing for scheduled-task run history. 15s sits inside
 * the ~10-15s range considered acceptable for per-panel polling against an
 * uncached, unthrottled proxy endpoint; 20 consecutive no-change polls
 * (5 minutes) bounds how long a stuck upstream run keeps a background tab
 * polling. See design.md - Risks for the DIAL Scheduler capacity assumption.
 */
const RUNS_POLL_INTERVAL_MS = 15_000;
const RUNS_POLL_STOP_AFTER_NO_CHANGE = 20;
const NEXT_RUN_REFRESH_DELAY_MS = 5_000;
```

**Alternatives considered**:

| Option | Why rejected |
|---|---|
| Exponential backoff, no hard stop (start at 15s, double per no-change poll, cap at 60s) | Never fully stops while a run stays in-progress, which is harder to reason about and to assert in fake-timer tests (acceptance criteria explicitly want a "poll starts/stops" test, implying a clean stop condition). A run stuck in-progress for 5+ minutes is already an edge case better surfaced as "still running" than silently polled ever more sparsely. |

`useAppVersionCheck.ts` (`apps/chat/src/hooks/useAppVersionCheck/useAppVersionCheck.ts`) is the structural reference for interval + `visibilitychange` + full cleanup — its own `POLL_INTERVAL_MS` (5 minutes) is unrelated in scale (health-check cadence vs. run-history cadence) and is not reused; this change defines its own constants.

### 4. Merge semantics: update-in-place by id, prepend unseen ids, never remove

A background refresh always re-fetches page 0 (`offset: 0, limit: pageSize`). Merging into `items`:

- An id already present is replaced in place at its existing array position (status/duration/`conversationId` can all change; order is untouched — no re-sort).
- An id not yet present is prepended (upstream order is `created_at desc`, so a brand-new run is newest).
- An id present in `items` but absent from the page-0 response is left alone — never removed. Deletion handling is out of scope (Non-Goals).
- `offset.current` and `hasMore` are never touched by a background refresh — only `loadMore`'s pagination state changes those.

This reuses the same "dedupe by id" idea `loadMore` (`libs/chat-hooks/src/scheduled-task/use-scheduled-task-runs.ts:216-226`) already implements for appending, just prepending instead of appending and updating instead of skipping duplicates.

### 5. Unread state: no new mechanism

`isUnread` continues to be resolved exactly as today, purely by `mapScheduledTaskRunDtoToItem` (`apps/chat/src/utils/map-scheduled-task-run-dto.ts:70-82`) matching a run's `conversationId` against whatever `conversations` list is currently loaded, recomputed via `useMemo` on every render in both consumers. A newly-polled-in run gets its correct unread dot the moment the conversation list separately catches up — no coupling is added between this hook and `ConversationsContext`. This is the deliberate resolution to the issue's "Open questions" item on unread state, not an oversight: the tradeoff is a possible brief window where a run row appears before its unread dot does, accepted because coupling the two lists would pull conversation-list knowledge into a hook whose contract is scoped to one schedule's run history.

### 6. Background requests get their own `AbortController`, cancelled on unmount and `scheduleId` change

**Chosen**: every background-refresh request (poll tick or one-shot) creates its own `AbortController` and passes its `signal` to `client.listScheduledTaskRuns`, exactly as the initial fetch and `loadMore` already do. The cleanup that clears the poll interval and the one-shot timeout also aborts whichever background request is currently in flight.

The `generation` ref alone is not sufficient here: it prevents a stale response from calling `setState` after the hook has moved on, but it does not cancel the underlying network request — the request stays in flight, consuming a connection and (if it eventually resolves) doing wasted work, exactly what `AbortController` exists to prevent elsewhere in this same hook. The issue is explicit that "every request keeps its `AbortController`," and the initial-fetch/`loadMore` code already establishes this as the hook's own convention — background refreshes should not be the one code path that regresses to guard-only staleness handling.

### 7. The past-`nextRunTime` immediate refresh is a distinct request from the initial page load, not a duplicate of it

`ScheduledTaskDetailPage` fetches the task and the initial runs page concurrently and independently (per the existing "Detail page fetches task and first runs page in parallel and handles not-found/error states" requirement) — neither awaits the other. Consequently `nextRunTime` is not known at the instant the hook mounts; it only becomes known once the task fetch resolves, which can happen before, during, or after the initial runs page settles. The one-shot trigger for an already-past `nextRunTime` therefore cannot fire before `nextRunTime` is actually supplied, and — like every other background-refresh trigger — is gated on `!isLoading && !isLoadingMore`, so it never overlaps the initial fetch. In the common case where `nextRunTime` arrives while the initial fetch is still in flight, the immediate refresh is deferred until the initial fetch settles, then fires as a second, distinct request.

This means a task whose next run is already overdue when its detail page is opened issues **two** `listScheduledTaskRuns({ offset: 0 })` calls shortly after mount: the initial page load, and the immediate background refresh. This is intentional, not a bug — the existing "initial history page loads on mount... exactly once" scenario describes only the initial-load call itself and is unaffected; the spec delta adds a separate scenario asserting the immediate refresh waits for the initial fetch to settle rather than racing it.

### 8. `backgroundRefresh` re-checks `isLoading`/`isLoadingMore` after its own network call, not only before

**Chosen**: the guard is checked once before starting the request (unchanged) and again immediately after it resolves, before touching `itemsRef`/`setItems`. If a `loadMore()` was invoked at any point during the background request's wait, this second check sees it and the background attempt defers (returns `Skipped`) instead of merging.

Checking only before the request left a real gap: `isLoadingMore` flips to `true` synchronously the instant `loadMore()` is called — well before its own network response arrives — so a background request that started just before that call, and resolves while `loadMore`'s fetch is still in flight, could compute a merge against a now-stale `itemsRef` snapshot and overwrite the page `loadMore` is about to append. The post-request check closes this without needing to serialize the two operations — found by a second review pass, after the initial implementation only guarded the pre-request side.

### 9. The one-shot trigger claims `handledPastNextRunTime` when it fires, not only the past-due trigger

**Chosen**: Trigger 2's (one-shot) callback sets `handledPastNextRunTime.current = nextRunTime` before invoking the refresh, the same marker Trigger 3 (past-due) already used to avoid re-firing for a value it has already handled.

Without this, once the one-shot fired and `nextRunTime` had passed, any later `isLoading`/`isLoadingMore` transition (e.g. a `loadMore()` call) would re-run Trigger 3, find `target <= Date.now()` true and the marker still unset, and issue a redundant extra background refresh for the same already-handled `nextRunTime` — harmless (merge-only, no data loss) but a real deviation from the spec's "exactly one refresh" wording. Setting the marker in both places closes it.

### 10. `setTimeout` delays beyond the 32-bit limit are chained, not passed through raw

**Chosen**: `scheduleAfter` (a small chained-`setTimeout` helper) steps through `MAX_SAFE_TIMEOUT_MS`-sized (`2_147_483_647`ms, ~24.8 days) delays for a total beyond that limit, instead of calling `setTimeout` with the full delay directly.

`setTimeout`'s delay argument is a 32-bit signed integer at the platform level; a longer value silently overflows and the browser fires the callback on the next tick instead of respecting it. A monthly (or less frequent) cron schedule's `nextRunTime` can genuinely exceed ~24.8 days out, so the raw one-line `setTimeout` call from the initial implementation would convert the one-shot trigger into an immediate no-op refresh for those schedules, with nothing else catching the miss (the past-due trigger only fires once the time has actually passed, and the poll trigger needs an already-in-progress row to start). `scheduleAfter` returns a canceller that clears whichever chained step is currently pending, so the existing effect-cleanup contract is unaffected.

## Risks / Trade-offs

- **[Risk] DIAL Scheduler's own capacity for ~1 request per open panel per 15s per user is unverified.** `apps/chat-api`'s `GET /:scheduleId/runs` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.controller.ts:205-213`) is `Cache-Control: private, no-store`, explicitly "Not cached", and chat-api has no `ThrottlerModule` anywhere — it is a pure per-request proxy to DIAL Scheduler using the caller's session token, so chat-api itself imposes no additional constraint. The actual limit, if any, lives in DIAL Scheduler, which is outside this repo. → **Mitigation**: accepted as a low-residual-risk assumption for now (bounded per-panel, per-user, 5-minute-capped polling, not an unbounded background poller). If it becomes a problem in practice, the first fix is per-`scheduleId` poll de-duplication across mounted consumers — both `ScheduledTaskDetailPage` and `ActiveScheduledTaskContext` can independently poll the same `scheduleId` today if both are mounted for the same task — not reducing the interval for everyone.
- **[Risk] A background refresh racing a foreground `loadMore` could produce confusing interleaved state.** → **Mitigation**: both triggers check `isLoading`/`isLoadingMore` before firing and skip the tick entirely if either is `true`, reusing the same `generation` ref `loadMore` already uses to discard a stale response.
- **[Trade-off] No exponential backoff means a schedule with unusually long-running tasks (>5 minutes) stops getting live updates and falls back to manual `refetch()`.** Accepted per Decision 3 — simpler to test and reason about; genuinely long-running tasks are already an edge case the issue doesn't ask this change to solve indefinitely.
- **[Trade-off] Prepending a new run into a scrolled History list could visually shift already-visible rows**, since the desktop layout's `max-h-[70vh]` scroll container gets taller content above whatever the user is currently looking at. Not addressed here: scroll anchoring for a prepend is a presentational-component concern (`ScheduledTaskDetailView` in `libs/scheduled-tasks`, which this change does not touch), and a new run is comparatively rare against a poll tick that mostly just updates statuses in place (no reorder, no height change). If this proves disruptive in practice, it belongs as a follow-up to the presentational component, not to this hook.
- **[Note] No existing signal-based alternative to polling was found.** Per the issue's ask to record this if one exists: this codebase does have SSE machinery (`apps/chat-api/src/common/utils/sse.ts`, `conversation-streaming.service.ts`, `client-channel.service.ts`), but all of it is scoped to conversation-completion streaming and an unrelated toolset-login RPC channel (`client-channel-protocol` capability) — nothing publishes a "run started/completed" event a client could subscribe to instead of polling. Polling is the only viable mechanism today.

## Migration Plan

Purely additive and backward-compatible — no data migration, no persisted state, no API contract change. `nextRunTime` is an optional hook argument; omitting it (or passing `undefined`/`null`) simply disables the one-shot trigger, leaving today's behavior for that trigger only. The poll trigger only ever activates when an `InProgress` run is present, so any caller that never observes one sees no behavior change at all. Rollback is a plain revert of the hook and the two call-site changes — nothing to unwind on the backend or in persisted user data.
