## ADDED Requirements

### Requirement: Detail view body renders section tabs at mobile and tablet

`ScheduledTaskDetailView` SHALL branch its body layout on the app-wide mobile boundary (`useIsMobile` from `@epam/ai-dial-chat-shared`, `(max-width: 1279px)`), mounting exactly one layout's subtree at a time — never mounting both layouts and hiding one with CSS.

Below the desktop breakpoint (mobile and tablet), the body SHALL render a tab row (`Tabs` from `@epam/ai-dial-ui-kit`, generation 2.0) with exactly three tabs, in this order: **Details**, **Configuration**, **History**. Tab labels SHALL reuse the existing section-title label strings (`detailsTitle`, `configurationTitle`, `historyTitle`) — no new i18n keys. The **Details** tab SHALL be active by default, and tab selection SHALL be internal component state that survives a viewport resize across the boundary. Exactly one section's content SHALL be visible at a time; activating a tab SHALL swap the visible panel. Tabs SHALL NOT render count badges.

The tab row SHALL expose an accessible name (from an optional `tabsAriaLabel` label with an English default). Each visible panel SHALL expose `role="tabpanel"` with an accessible name matching its tab's label (via `aria-label`, or `aria-labelledby` when the kit's tab elements expose referenceable ids).

The three section bodies (Details fields, Configuration instructions, History run list) SHALL be extracted into internal presentational section components that render content only — no section titles — and both layouts SHALL compose those same components, so section content is identical across breakpoints. At the desktop breakpoint (≥1280px) the body SHALL render no tab row and SHALL render all three sections simultaneously in the existing three-column layout, each column keeping its `<h2>` section title. The section components SHALL NOT be re-exported from the lib's public API.

#### Scenario: Mobile renders the tab row in order with Details active by default

- **WHEN** `ScheduledTaskDetailView` renders below the desktop breakpoint with a loaded task
- **THEN** the body renders a tab row whose tabs read Details, Configuration, History in that order, the Details tab is the active one, and only the Details section's content is visible

#### Scenario: Activating a tab swaps the visible panel

- **WHEN** the user activates the History tab on a mobile/tablet body
- **THEN** the History run list becomes the visible panel, the previously visible section's content is no longer rendered, and no `onRunClick`/`onRunsLoadMore` behavior differs from the desktop History panel

#### Scenario: Desktop renders three columns and no tab row

- **WHEN** `ScheduledTaskDetailView` renders at the desktop breakpoint with a loaded task
- **THEN** no tab row is present, and the Details, Configuration, and History sections render simultaneously in the three-column layout, each with its `<h2>` section title

#### Scenario: Section content is identical across breakpoints

- **WHEN** the same loaded task renders below and at the desktop breakpoint
- **THEN** each section shows the same field values, instructions rendering, and run rows in both layouts — only the container chrome (tabs + panel vs. three columns with titles) differs

#### Scenario: Tab selection survives a viewport resize across the boundary

- **WHEN** the History tab is active and the viewport is resized past the boundary to desktop and back below it
- **THEN** the History tab is still the active tab when the tab row re-renders

#### Scenario: Tablist and panels expose accessible names

- **WHEN** the mobile/tab body renders
- **THEN** the tab row exposes an accessible name, and the visible panel exposes `role="tabpanel"` with an accessible name matching its tab's label

#### Scenario: Tabs render no count badges

- **WHEN** the tab row renders at any breakpoint
- **THEN** no tab renders a count or badge value

## MODIFIED Requirements

### Requirement: History panel paginates runs via a "Show more" button inside its own scroll container

The detail page SHALL render a History panel listing the task's runs, fetched via a `useScheduledTaskRuns(scheduleId, enabled)` hook (`apps/chat/src/hooks/scheduled-tasks/useScheduledTaskRuns.ts`) exposing `{ items, isLoading, isLoadingMore, error, hasMore, loadMore, refetch }`, mirroring the shape of the existing `useScheduledTasks` hook. The hook SHALL call `listScheduledTaskRuns({ scheduleId, limit: 10, offset: 0 })` for the initial page, and `loadMore()` SHALL, only when `hasMore && !isLoadingMore && !isLoading`, fetch the next page at `offset = items.length` and append the results deduplicated by `id`, with no client-side re-sorting (server order is `created_at desc`). `hasMore` SHALL be derived from `items.length < count` when `count` is present in the response, falling back to a non-null `next` field, or — when the upstream response omits both `count` and `next` — to a full-page-size heuristic (the just-fetched page had exactly `limit` items), so pagination does not permanently stop after the first page purely because upstream didn't echo a total. The hook SHALL use `AbortController` to cancel any in-flight request when `scheduleId` changes or the hook unmounts.

At the **desktop breakpoint (≥1280px)**, the History panel SHALL be rendered inside a fixed-height, self-scrolling container (`max-h-[70vh]`, `overflow-y-auto`) that does not require scrolling the whole page. Inside that scroll container: the panel title and the "Next run" label (when present) SHALL be pinned with `position: sticky; top: 0` so they stay visible while the run list scrolls beneath them; an explicit **"Show more" button** (not a scroll sentinel) SHALL render pinned with `position: sticky; bottom: 0`, below the loaded rows, only while `hasMore` is `true`. Both sticky regions SHALL use the same background as the History card so scrolled-past rows do not show through underneath them.

Below the desktop breakpoint (mobile and tablet, where the body renders as tabs), the History section SHALL render as a tab panel in **standard top-to-bottom flow** within the page's own scroll container: no inner `max-h-[70vh]` self-scrolling container, no sticky title/"Next run" header, and no sticky footer — the "Next run" label (when present) renders above the run list unstuck, and the "Show more" button renders inline below the loaded rows, only while `hasMore` is `true`, disabled while `isLoadingMore` is `true`. Activating the button, while `hasMore && !isLoadingMore && !isLoading`, SHALL invoke `loadMore()` at both breakpoints.

#### Scenario: Initial history page loads on mount

- **WHEN** `ScheduledTaskDetailPage` mounts with the feature flag enabled
- **THEN** `listScheduledTaskRuns({ scheduleId, limit: 10, offset: 0 })` is called exactly once and the resolved runs are passed to the History panel

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
