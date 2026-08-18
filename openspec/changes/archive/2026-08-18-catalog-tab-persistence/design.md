## Context

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) currently owns its active-tab selection as local `useState`, seeded from `buildCatalogTabs()`'s first entry (`libs/catalog/src/utils/catalog-tabs.ts`, `TAB_ORDER = [Model, Agent, Toolset, Prompt, Skill]`). `CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) has no visibility into which tab is active and cannot restore it, so a page refresh — or a `navigate()` back from `PromptEditor`, `SkillEditor`, `ToolsetEditor`, or an app/custom-app editor — always remounts `CatalogView` → `Catalog` with no tab context, defaulting to Models.

This repo already solved the equivalent problem for sort key and topic filters (`openspec/specs/catalog-sort-filter-persistence/spec.md`): `Catalog` gained controlled `sortKey`/`onSortChange` and `filterTopics`/`onFilterTopicsChange` props with internal-state fallback, backed by a `useLocalStorage`-based hook (`useCatalogSortFilterPreference`) that `CatalogView` wires in outside selector mode. This change follows the identical shape for the active tab: a controlled prop plus a `localStorage`-backed hook, with no query param and no routing changes.

Because persistence writes on every tab switch (not just on unmount), the tab the user is on at the moment they click "Edit" is already the persisted value. Editor pages already `navigate(returnUrl)` back to the bare `ROUTES.Catalog` on save/cancel; `CatalogView` remounts, reads `localStorage`, and lands back on the same tab automatically. This is the same reasoning that already makes sort/filter "survive" an edit round-trip today (`catalog-sort-filter-persistence` needed no editor-URL changes either) — no `ReturnUrl` changes are needed for tabs either.

## Goals / Non-Goals

**Goals:**
- Active Catalog tab survives a full page refresh (Case 2, Case 3).
- Editing/creating a Prompt, Skill, Toolset, or App returns the user to the tab they started from (Case 1, Case 4) — via the same persisted-value mechanism as a refresh, not a URL parameter.
- First-ever visit (no persisted value) still defaults to the Models tab, unchanged.
- Follow the existing controlled/uncontrolled prop pattern so `Catalog` remains usable standalone and in `CatalogModal` (selector mode) without behavior change there.

**Non-Goals:**
- A `tab` query parameter or any change to `/catalog`'s route/URL shape — deliberately rejected in favor of matching the existing sort/filter persistence mechanism exactly (see Decision 1).
- Persisting the search query text (`query` state in `Catalog.tsx`) — out of scope per the proposal.
- Per-tab filter/sort state (filters remain global across tabs, matching current `catalog-sort-filter-persistence` behavior) — this change only adds the missing tab dimension.
- Changing `CatalogModal`'s (selector mode) tab behavior — stays uncontrolled/session-only, consistent with how sort/filter selector-mode is handled today.
- Deep-linking to a specific tab via a shareable URL — not requested by the bug report; can be layered on later without conflicting with this design if ever needed.

## Decisions

**1. `localStorage` persistence only, no query param — matches `catalog-sort-filter-persistence` exactly.**
The bug report's four cases (refresh loses tab, edit-return loses tab) are all plain component remounts; a `localStorage`-backed hook that persists on every change already solves all of them, because the persisted value at read-time is always the value most recently written — including "right before navigating to an editor". A query param was initially considered (for the case where an explicit link should override a stale persisted value) but rejected: there is no requirement here for shareable/bookmarkable per-tab URLs, and avoiding the query param keeps this change a pure copy of the already-accepted sort/filter pattern — same hook shape, same storage mechanism, no new route/query-param surface, no `handleEdit`/`createOptions` changes.

**2. Controlled `activeTab`/`onActiveTabChange` props on `Catalog`, mirroring `sortKey`/`onSortChange`.**
Same rationale as the existing sort/filter props: `Catalog` stays host-agnostic (no `localStorage`) per AGENTS.md §Library isolation, while `CatalogView` supplies the controlled value. Alternative considered: an uncontrolled `initialActiveTab` (set-once) prop — rejected because `CatalogView` also needs to *write* `localStorage` on every tab change, which requires an `onActiveTabChange` callback, not just an initial value.

**3. Resolution order on `CatalogView` mount: persisted `localStorage` value → first available tab.**
Mirrors the reconciliation step already used for `filterTopics` (validate the persisted value against what's actually available before applying it) rather than trusting it blindly — the tab id must be present in `buildCatalogTabs()`'s current output, or `CatalogView` falls back to the first available tab (Models on a first-ever visit, or if a previously-visible tab type has disappeared from the current item set).

**4. No changes to `handleEdit`/`createOptions`'s `ReturnUrl` construction.**
Since `setActiveTab` (Decision 2) already persists on every tab switch, the value in `localStorage` at the moment "Edit" is clicked is already correct; the editor's own `navigate(returnUrl)` back to the bare `ROUTES.Catalog` is unchanged and sufficient. This removes an entire class of call-site edits and their associated risk (see Risks).

**5. New hook `useCatalogActiveTabPreference`, structured like `useCatalogSortFilterPreference`.**
Built on the existing `useLocalStorage` hook, storing under new `StorageKey.CatalogActiveTab`. Kept as a separate hook (not merged into `useCatalogSortFilterPreference`) to match the existing one-hook-per-persisted-concept convention (`apps/chat/src/hooks/`), even though its shape (persist + reconcile-against-available-values) is otherwise identical.

## Risks / Trade-offs

- **[Risk] A tab id becomes stale** (e.g. persisted `Toolset` from a previous session, but the current items no longer include any Toolset item) **→ Mitigation**: `CatalogView` validates the resolved tab id against `buildCatalogTabs(catalogItems)`'s current ids before applying it, falling back to the first available tab, exactly like the existing `filterTopics` reconciliation.
- **[Risk] Multiple browser tabs/windows on `/catalog` with different active tabs write over each other's `localStorage` entry** — the same risk already exists for `sortKey`/`filterTopics` today and is accepted there; no new mitigation is introduced beyond what the existing pattern already tolerates.
- **[Risk] `CatalogModal` (selector mode) accidentally becomes controlled and its tab now persists across opens, changing existing UX** **→ Mitigation**: `CatalogView` only forwards `activeTab`/`onActiveTabChange` (and calls the hook's setter) when `isSelectorMode` is falsy, identical to the existing selector-mode gate for `sortKey`/`filterTopics`.
- **[Risk] Adding a new `StorageKey` member without a migration path for existing persisted users** **→ Mitigation**: none needed; this is a purely additive key, absence simply falls back to the first tab (existing behavior), no read of an old key/shape.

## Migration Plan

No data migration required (new, additive `localStorage` key; no existing persisted state to convert). Roll out as a single frontend change: `libs/catalog` prop additions are backward compatible (optional props, default to current uncontrolled behavior), and `apps/chat` wiring is additive to `CatalogView`. Rollback is a plain revert — no server-side or schema impact.

## Open Questions

None outstanding — the bug report's four cases are all addressed by persistence-on-every-change alone, with `CatalogModal` explicitly and deliberately out of scope.
