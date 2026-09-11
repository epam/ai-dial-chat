## Context

`ScheduledTaskDetailView` (`libs/scheduled-tasks/src/components/ScheduledTaskDetailView/ScheduledTaskDetailView.tsx`) renders its body as one wrapper with three inline column blocks: Details (`desktop:w-[360px]`), Configuration (`flex-1`), History (`desktop:w-[360px]`). Below the desktop breakpoint (≥1280px since the app-wide boundary move) the wrapper is `flex-col` and the three sections simply stack, with the History card keeping its `max-h-[70vh]` self-scrolling container and sticky title/footer regions at every width.

The app-wide responsive boundary is owned by `useIsMobile` in `libs/chat-shared/src/hooks/useIsMobile.ts` (`(max-width: 1279px)`), which `libs/scheduled-tasks` may consume — it already depends on `@epam/ai-dial-chat-shared`. `DialFileManagerShell` is the in-repo precedent for a lib branching on this hook.

The kit ships a 2.0 `Tabs` component (`@epam/ai-dial-ui-kit`): a controlled tab row (`tabs: TabItem[]`, `activeTabId`, `onTabChange`, optional `ariaLabel`) implementing the ARIA tabs pattern with arrow-key navigation. It renders only the tab row — panels stay with the consumer. `libs/catalog` (`Catalog.tsx` + `utils/catalog-tabs.ts`) is the reference composition.

Stakeholder decisions already made: tab order Details → Configuration → History; default tab Details; History at mobile is standard top-to-bottom flow; no count badges; a separate `describe` block for mobile-branch tests.

## Goals / Non-Goals

**Goals:**

- At mobile/tablet (≤1279px), the detail body renders one tab row (Details, Configuration, History) with exactly one section visible at a time, Details active by default.
- At desktop (≥1280px), the body is pixel-equivalent to today's three-column layout.
- The three section bodies are extracted into reusable internal components so each layout composes the same content — no duplicated section markup between layouts.
- History at mobile/tablet reads as standard page flow: no self-scrolling card, no sticky regions, inline "Show more".
- ARIA tabs semantics end-to-end: named tablist, panels with `role="tabpanel"` and accessible names.

**Non-Goals:**

- No tab count badges (e.g. unread-run counts) — explicitly deferred.
- No changes to the host page (`apps/chat` `ScheduledTaskDetailPage`) beyond what a new optional label prop makes possible — data fetching, props, and i18n keys are unchanged.
- No changes to the desktop History card behavior (self-scrolling container + sticky regions remain at desktop).
- No persistence of the selected tab across sessions or navigation.
- No changes to the runs pagination hook or data flow — presentation only.

## Decisions

### Decision 1: Branch on `useIsMobile`, do not dual-mount with CSS visibility

The mobile layout (tab row + one panel) and the desktop layout (three columns) are different *stateful* subtrees: the tab row owns selection state, and the desktop layout mounts all three sections at once.

**Chosen:** `{isMobile ? <TabsLayout/> : <ColumnsLayout/>}` using `useIsMobile` from `@epam/ai-dial-chat-shared`. Each section mounts exactly once, in whichever container the current viewport uses.

_Alternative considered:_ mount both layouts and toggle with `desktop:hidden` / `hidden desktop:*` (the pattern `BuilderFormActions` uses for its two buttons). Rejected here: it would duplicate all three section subtrees in the DOM — including the paginated runs list, skeletons, and markdown rendering — keep a hidden stateful `Tabs` alive at desktop, and risk duplicate run-row DOM ids. The project's responsive rules reserve the hook exactly for "a component must mount entirely different subtrees per breakpoint".

**Tab state placement:** the `useState` for the active tab lives at the `ScheduledTaskDetailView` level (not inside the mobile-only subtree), so the selection survives a viewport resize across the boundary instead of resetting. Default `'details'`.

### Decision 2: Section components are content-only; the rendering context owns titles

Three internal components are extracted (`ScheduledTaskDetailsSection`, `ScheduledTaskConfigurationSection`, `ScheduledTaskHistorySection`), each rendering only its content — no `<h2>` title, no field-set chrome that presumes a column.

**Rationale:** at mobile the tab labels *are* the section titles; repeating "Details" as a tab and again as an `<h2>` inside the panel would be redundant. At desktop the column wrappers keep their existing `<h2>`s, preserving the current heading structure. The Configuration section's "Instructions" field label stays inside the section (it labels content, not the section).

_Alternative considered:_ sections render their own titles with a `showTitle` prop. Rejected — two call sites, two different title idioms; a boolean prop that flips markup per context is the same complexity with a wider surface.

_Implementation nuance (recorded during apply):_ the History section is the one exception — its card variant renders the `<h2>` inside the section, because the title sits inside the card's sticky header and cannot be separated from that chrome without duplicating the header markup in the view. The flow variant (mobile/tab panel) renders no title, so the intent — no duplicated visible titles in tab panels, desktop headings unchanged — still holds.

### Decision 3: Kit 2.0 `Tabs`, internal state, labels reused

The tab row is the kit's 2.0 `Tabs` with `tabs` built from the existing `labels.detailsTitle` / `labels.configurationTitle` / `labels.historyTitle` strings in the fixed order Details, Configuration, History. Selection is internal `useState` (default Details).

_Alternatives considered:_ (a) Catalog-style optional controlled `activeTabId`/`onTabChange` props — rejected: no host need exists, and every added prop widens the lib's public contract; add later if a host asks. (b) 1.0 `DialTabs` (overflow-aware, collapses to a dropdown on small screens) — rejected: only three tabs, no overflow expected, and 2.0 is the mandated generation.

**Accessibility wiring:** the tab row gets `ariaLabel` from a new optional `labels.tabsAriaLabel` (English default `'Scheduled task sections'`, per the lib no-i18n rule — no new app i18n key required). Each panel container gets `role="tabpanel"` and an accessible name from its tab's label (`aria-label`), since the kit's `Tabs` renders only the row and does not expose tab element ids for `aria-labelledby`; if implementation finds the kit does expose stable tab ids, `aria-labelledby` may be used instead — either satisfies the requirement.

### Decision 4: History at mobile/tablet is standard top-to-bottom flow

In the mobile History panel, the section content renders in normal document flow inside the page's scroll container: no `max-h-[70vh]` inner scroll container, no sticky title/next-run header, no sticky footer — the "Show more" button renders inline after the loaded rows (it remains disabled while `isLoadingMore`, and absent when `!hasMore`, exactly as at desktop). The next-run label renders above the run list, unstuck.

**Rationale:** an inner scroll container nested inside a tab panel on a phone fights the page scroll and hides the Show-more affordance off-screen; the user asked for standard flow explicitly.

### Decision 5: Section components stay internal to the lib

The three section components are exported from their modules for the detail view's use but are **not** re-exported from `libs/scheduled-tasks/src/index.ts`. The lib's public API gains only the optional `tabsAriaLabel` label field on the existing labels interface.

**Rationale:** the sections are composition details of `ScheduledTaskDetailView`; exporting them would make every future internal tweak a public-API decision and add README obligations for components no host needs directly.

## Risks / Trade-offs

- [JS-branch flash: on first client render `useIsMobile` resolves synchronously from `matchMedia`, so there is no desktop→mobile flash in practice; under SSR the hook returns `false` until mount] → The detail page is an authenticated, client-rendered route (lazy-loaded via `React.lazy`), so no SSR tree renders the body. No mitigation needed; verify once in the browser.
- [Resize across the boundary swaps subtrees, losing panel scroll position] → Accepted: tab selection is preserved (Decision 1); scroll position loss on a live viewport resize is standard for this pattern elsewhere in the app.
- [Extraction could silently change desktop rendering] → The desktop columns wrap the same components with the same classes moved, not rewritten; the existing desktop test suite (unchanged mocks) must stay green, and the desktop History card behavior is explicitly out of scope.
- [Kit `Tabs` API drift (e.g. `TabItem` vs `TabModel` naming seen in `libs/catalog`)] → Confirm the exact item type with the ui-kit MCP (`getEntityDetails`) before writing the tab builder; do not copy from `catalog`'s older call site.
- [Two layouts drift apart over time (a section gets a mobile-only bug)] → Both layouts compose the same extracted components, so content drift is structurally impossible; only container chrome differs. The mobile `describe` block pins the tab behavior.

## Migration Plan

Pure presentational change inside one lib component; no API, data, or host-page migration. Rollback is reverting the component + tests. Deploy as a normal frontend release; the feature flag gating the whole detail page (`scheduledTasksEnabled`) already covers exposure.

## Open Questions

None — order, default tab, History flow, badges (out of scope), and test placement were all settled during exploration. The only implementation-time check is the kit `Tabs` id/`TabItem` detail noted in Decision 3 and Risks.
