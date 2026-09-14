## Why

Since the app-wide responsive boundary moved to 1280px, the Scheduled Task detail page's three body sections (Details, Configuration, History) simply stack vertically on mobile and tablet. History — often the most-visited content — sits below a long Details/Configuration stack, and the History card's self-scrolling `max-h-[70vh]` container-with-sticky-regions pattern reads poorly on touch viewports. The design calls for the three sections to become tabs at mobile/tablet, with the desktop three-column layout unchanged.

## What Changes

- Extract the three body sections of `ScheduledTaskDetailView` (`libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx`) into internal presentational section components — content only, no section titles (the rendering context owns titling: desktop columns keep their `<h2>`s, the mobile tab row carries the titles as tab labels):
  - `ScheduledTaskDetailsSection` (description / model / repeats / active-window field list)
  - `ScheduledTaskConfigurationSection` (instructions markdown + `renderInstructions` fallback)
  - `ScheduledTaskHistorySection` (run list, skeletons, error/retry, next-run label, Show-more)
- At mobile/tablet (≤1279px) the body renders the `@epam/ai-dial-ui-kit` 2.0 `Tabs` component with tab order **Details, Configuration, History**, **Details** as the default active tab, internal tab state, one active panel visible at a time; tab labels reuse the existing `labels.detailsTitle` / `configurationTitle` / `historyTitle` strings (no new i18n keys).
- At desktop (≥1280px) the body keeps the current three-column layout, each column wrapping the same extracted section components plus its existing `<h2>` title — pixel-equivalent to today.
- The History panel at mobile/tablet renders in **standard top-to-bottom flow**: no `max-h-[70vh]` self-scrolling card, no sticky title/next-run header, no sticky footer — the "Show more" button renders inline below the loaded rows.
- The breakpoint branch uses `useIsMobile` from `@epam/ai-dial-chat-shared` (exactly `(max-width: 1279px)`), mounting only one layout's subtree at a time rather than CSS-hiding a duplicate of all three sections.
- No tab count badges (explicitly out of scope).
- `ScheduledTaskDetailView`'s public prop surface is unchanged except one new optional label for the tab list's accessible name (English default, per the lib no-i18n rule).
- A separate `describe` block in the detail-view spec covers the mobile branch with `useIsMobile` mocked (tabs render, default tab, panel switching, History flow), while the existing desktop tests keep passing.

## Capabilities

### New Capabilities

_(none — all requirements land in the existing detail-page capability)_

### Modified Capabilities

- `scheduled-task-detail-page`: the body layout requirement changes — at mobile/tablet the Details/Configuration/History sections render as one-tab-at-a-time tab panels instead of stacked columns; the History panel requirement changes for mobile/tablet — standard top-to-bottom flow replaces the self-scrolling container with sticky header/footer; a new requirement covers the tab row itself (order, default, state, accessible tablist/panel semantics) and the section-component extraction.

## Impact

- `libs/scheduled-tasks/src/components/ScheduledTaskDetailView/` — body restructure + three new sibling section component folders (`ScheduledTaskDetailsSection/`, `ScheduledTaskConfigurationSection/`, `ScheduledTaskHistorySection/`) with their own `tests/` subfolders
- `libs/scheduled-tasks/src/models/scheduled-task-detail-view-props.ts` — one optional tab-list label prop
- `libs/scheduled-tasks` depends on `@epam/ai-dial-chat-shared` already (no new dependency; `useIsMobile` comes from there)
- No `apps/chat` changes required (props unchanged; the page keeps passing the same strings)
- Section components stay internal to the lib — `index.ts` public API is not extended (except the label prop type already exported through the existing props interface)
- `openspec/specs/scheduled-task-detail-page/spec.md` — requirements updated on archive
