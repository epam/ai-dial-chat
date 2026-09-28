# Spec Delta

## MODIFIED Requirements

### Requirement: History panel paginates runs via a "Show more" button inside its own scroll container

The detail page SHALL render a History panel listing the task's runs, fetched via a `useScheduledTaskRuns(scheduleId, enabled, nextRunTime)` hook (`apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts`) exposing `{ items, isLoading, isLoadingMore, error, hasMore, loadMore, refetch }`, mirroring the shape of the existing `useScheduledTasks` hook. `nextRunTime` is the currently-loaded task's `ScheduledTaskDto.nextRunTime` (`undefined`/`null` when not yet known); the page SHALL NOT fetch the task a second time to obtain it. The hook SHALL call `listScheduledTaskRuns({ scheduleId, limit: 10, offset: 0 })` for the initial page, and `loadMore()` SHALL, only when `hasMore && !isLoadingMore && !isLoading`, fetch the next page at `offset = items.length` and append the results deduplicated by `id`, with no client-side re-sorting (server order is `created_at desc`). `hasMore` SHALL be derived from `items.length < count` when `count` is present in the response, falling back to a non-null `next` field, or — when the upstream response omits both `count` and `next` — to a full-page-size heuristic (the just-fetched page had exactly `limit` items), so pagination does not permanently stop after the first page purely because upstream didn't echo a total. The hook SHALL use `AbortController` to cancel any in-flight request when `scheduleId` changes or the hook unmounts.

The hook SHALL additionally keep the History panel fresh without a manual reload, via two background-refresh triggers that merge into `items` rather than resetting them (`refetch()`'s existing full-reset-to-page-0 behavior is unchanged and is never invoked by either trigger):

- **Poll while a run is in progress**: while any entry in `items` has `status === ScheduledTaskRunDtoStatusEnum.InProgress`, the hook SHALL re-fetch page 0 (`offset: 0, limit: 10`) every 15 seconds and merge the response into `items` by `id` — an existing `id` is updated in place at its current array position (no reordering), an unseen `id` is prepended, and no entry absent from the response is removed. Polling SHALL stop as soon as no entry has `InProgress` status, or after 20 consecutive polls that each either leave the merge unchanged or fail outright (5 minutes total), whichever happens first — a poll that errors counts toward the stop threshold the same as one that resolves with no change, so a permanently-failing upstream does not poll indefinitely.
- **One-shot refresh at the next scheduled run**: when `nextRunTime` is a future instant, the hook SHALL schedule exactly one refresh for 5 seconds after that instant, merged the same way as the poll trigger. When `nextRunTime` is already in the past when the hook first receives it, it SHALL refresh once immediately instead of scheduling a future timer.

Both triggers SHALL run only while `document.visibilityState === 'visible'`; while hidden, no refresh fires, and on returning to visible the hook SHALL perform at most one catch-up refresh if a scheduled one was missed while hidden. Neither trigger SHALL fire while `isLoading` or `isLoadingMore` is `true` — this includes the one-shot trigger for an already-past `nextRunTime`: if `nextRunTime` is supplied (or first found to be past) while the initial fetch is still in flight, the immediate refresh SHALL be deferred until that fetch settles, issuing a second, distinct `listScheduledTaskRuns({ offset: 0 })` request rather than racing or replacing the initial one. Each background-refresh request (poll tick or one-shot) SHALL use its own `AbortController`, exactly as the initial fetch and `loadMore` already do. A background refresh that fails SHALL leave `items` and the foreground `error`/`loadMoreError` state untouched — it SHALL NOT surface the failure to the user — and SHALL simply be retried on the next tick. All timers and listeners created by either trigger, and any in-flight background-refresh request, SHALL be cleared/aborted on unmount and on `scheduleId` change, alongside the existing initial-fetch `AbortController` cleanup.

At the **desktop breakpoint (≥1280px)**, the History panel SHALL be rendered inside a fixed-height, self-scrolling container (`max-h-[70vh]`, `overflow-y-auto`) that does not require scrolling the whole page. Inside that scroll container: the panel title and the "Next run" label (when present) SHALL be pinned with `position: sticky; top: 0` so they stay visible while the run list scrolls beneath them; an explicit **"Show more" button** (not a scroll sentinel) SHALL render pinned with `position: sticky; bottom: 0`, below the loaded rows, only while `hasMore` is `true`. Both sticky regions SHALL use the same background as the History card so scrolled-past rows do not show through underneath them.

Below the desktop breakpoint (mobile and tablet, where the body renders as tabs), the History section SHALL render as a tab panel in **standard top-to-bottom flow** within the page's own scroll container: no inner `max-h-[70vh]` self-scrolling container, no sticky title/"Next run" header, and no sticky footer — the "Next run" label (when present) renders above the run list unstuck, and the "Show more" button renders inline below the loaded rows, only while `hasMore` is `true`, disabled while `isLoadingMore` is `true`. Activating the button, while `hasMore && !isLoadingMore && !isLoading`, SHALL invoke `loadMore()` at both breakpoints.

#### Scenario: Initial history page loads on mount

- **WHEN** `ScheduledTaskDetailPage` mounts with the feature flag enabled
- **THEN** `listScheduledTaskRuns({ scheduleId, limit: 10, offset: 0 })` is called exactly once as the initial load, and the resolved runs are passed to the History panel — independent of whether a separate immediate background refresh additionally fires afterward per the "past-due immediate refresh" scenario below

#### Scenario: Activating "Show more" loads the next page

- **WHEN** the user activates the "Show more" button and `hasMore` is `true`
- **THEN** the next page is requested at `offset = items.length`, and once resolved its items are appended (deduplicated by `id`) below the currently rendered rows with no change to the History panel's scroll position

#### Scenario: "Show more" is not rendered once all pages are loaded

- **WHEN** `hasMore` becomes `false` (after a page response, or via the full-page-size heuristic detecting a short page)
- **THEN** the "Show more" button is not rendered and no additional `listScheduledTaskRuns` request is made

#### Scenario: "Show more" is disabled while a request is already in flight

- **WHEN** `isLoadingMore` is `true`
- **THEN** the "Show more" button is rendered disabled, and `loadMore()` invoked again is a no-op while `isLoadingMore` or `isLoading` is already `true`

#### Scenario: hasMore derives from count when present, else from next, else from a full page

- **WHEN** a `listScheduledTaskRuns` response includes `count: 42` and 10 loaded items
- **THEN** `hasMore` is `true`; when a subsequent response omits `count` but includes a non-null `next`, `hasMore` remains `true` based on `next`; when a response omits both `count` and `next` and returned exactly `limit` (10) items, `hasMore` is `true`; when such a response returns fewer than `limit` items, `hasMore` is `false`

#### Scenario: Unmount or scheduleId change aborts the in-flight runs request

- **WHEN** the hook unmounts, or `scheduleId` changes, while a runs request is in flight
- **THEN** the in-flight request is aborted via `AbortController` and its resolution does not update state

#### Scenario: Sticky header and footer stay visible while the run list scrolls at desktop

- **WHEN** at the desktop breakpoint the History panel has enough rows to overflow its `max-h-[70vh]` scroll container and the user scrolls it
- **THEN** the panel title (and "Next run" label, when present) remain pinned at the top of the scroll container, and the "Show more" button (when rendered) remains pinned at the bottom, both opaque against the scrolling rows beneath them

#### Scenario: Mobile History panel renders in standard top-to-bottom flow

- **WHEN** the History tab is active below the desktop breakpoint and its run list is long enough to overflow the viewport
- **THEN** the runs scroll with the page (no inner self-scrolling container), the panel title and "Next run" label are not sticky, and the "Show more" button renders inline below the loaded rows — not pinned to the panel's bottom edge

#### Scenario: Polling starts while an in-progress run is loaded and stops once it settles

- **WHEN** `items` contains a run with `status === ScheduledTaskRunDtoStatusEnum.InProgress`
- **THEN** the hook re-fetches page 0 every 15 seconds and merges the response into `items`; once a subsequent merge leaves no entry with `InProgress` status, no further poll is scheduled

#### Scenario: Polling stops after 20 consecutive polls with no status change

- **WHEN** a run stays `InProgress` across 20 consecutive 15-second polls with no status change in the merged response
- **THEN** the hook stops polling entirely for that run without further requests, even though the run is still `InProgress`

#### Scenario: A poll that errors counts toward the stop threshold the same as one with no change

- **WHEN** a run stays `InProgress` and 20 consecutive 15-second polls each either resolve with no status change or reject outright, in any mix
- **THEN** the hook stops polling entirely once the 20th such poll completes, without waiting for a poll that never resolves successfully

#### Scenario: A background refresh merges without resetting pagination or scroll position

- **WHEN** a poll or one-shot refresh's page-0 response contains a mix of ids already present in `items` and ids not yet present
- **THEN** each already-present id is updated in place at its existing array position, each new id is prepended to the front of `items`, no id absent from the response is removed, and `hasMore`/the loaded-page `offset` are left unchanged

#### Scenario: One-shot refresh fires shortly after the next scheduled run

- **WHEN** `nextRunTime` is a future instant and the panel remains visible
- **THEN** exactly one refresh is triggered 5 seconds after `nextRunTime`, merged the same way as a poll refresh

#### Scenario: A next-run time already in the past triggers one immediate refresh

- **WHEN** the hook first receives a `nextRunTime` that is already earlier than the current time
- **THEN** it performs one refresh immediately instead of scheduling a future timer

#### Scenario: The past-due immediate refresh waits for the initial fetch to settle

- **WHEN** the hook first receives an already-past `nextRunTime` while the initial page load is still in flight (`isLoading === true`)
- **THEN** the immediate refresh does not fire until the initial fetch settles, and then issues a second, distinct `listScheduledTaskRuns({ offset: 0 })` request rather than racing or being merged into the initial one

#### Scenario: Background refresh requests are individually abortable

- **WHEN** a poll tick or a one-shot refresh issues a `listScheduledTaskRuns` request
- **THEN** that request carries its own `AbortController` signal, independent of the initial fetch's and `loadMore`'s controllers

#### Scenario: No refresh while the tab is hidden, with one catch-up refresh on return

- **WHEN** `document.visibilityState` is `'hidden'` while a poll interval or the one-shot timer would otherwise fire
- **THEN** no request is made while hidden, and on `visibilitychange` back to `'visible'` at most one catch-up refresh runs to cover what was missed

#### Scenario: Background refresh never overlaps a foreground fetch and fails silently

- **WHEN** `isLoading` or `isLoadingMore` is `true`, or a background refresh's request rejects
- **THEN** no background refresh request is made while a foreground fetch is in flight, and a rejected background refresh leaves `items`, `error`, and `loadMoreError` unchanged, retrying on the next tick without surfacing the foreground error state

#### Scenario: Unmount or scheduleId change stops all polling and scheduled refreshes

- **WHEN** the hook unmounts, or `scheduleId` changes, while a poll interval or the one-shot `nextRunTime` timer is pending, or a background-refresh request is in flight
- **THEN** the interval and timer are cleared, any in-flight background-refresh request is aborted via its `AbortController`, and no further background-refresh request fires for the previous `scheduleId`
