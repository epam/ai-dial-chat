## Context

`libs/catalog/src/components/Catalog/Catalog.tsx` computes a pipeline of
derived item lists: `filteredItems` → `sorted` → `filtered` (search) →
`topicFiltered` → `myAppsFiltered` → `tabFiltered` (active tab). `tabFiltered`
is the value actually handed to both `CardGrid` (`Catalog.tsx:582`) and
`ListView` (`Catalog.tsx:605`), both rendered unconditionally side by side
inside the same wrapper `div` (`Catalog.tsx:560-622`), toggled only by a
`hidden` class on whichever one isn't the active `viewMode`. Each of
`CardGrid` and `ListView` independently renders `PanelEmptyState` when its own
`items.length === 0` (`CardGrid.tsx:111-117`, `ListView.tsx:33-39`) — there is
no single place today that knows "the visible result set is empty" apart from
recomputing `tabFiltered.length === 0`, which `Catalog.tsx` already does for
the `emptyTitle` string (`Catalog.tsx:442`) and for its container's own
conditional Tailwind classes (`Catalog.tsx:562,572`).

`query`, `activeTab`, `filters` (topics), and `isMyAppsActive` are each either
internal `useState` or externally controlled (`controlledActiveTab`,
`controlledFilterTopics`, `controlledIsMyAppsActive`), resolved to a single
local const the same way regardless of source (`Catalog.tsx:162-164,213`) —
so reading those consts after resolution already gives the "real value
regardless of controlled/uncontrolled" semantics the proposal requires,
with no new plumbing.

An external consuming project's Vite-plugin workaround confirms the intended
contract independently: it patches the exact `div` wrapper described above to
swap in `renderHostEmptyState({ query, activeTab, hasTopicFilters,
isMyAppsActive })` whenever the pre-patch item count is `0`, and passes
`Catalog`'s own resolved locals (not its own state) into the call.

## Goals / Non-Goals

**Goals:**

- Add `renderEmptyState` to `CatalogProps` and dispatch it from one place in
  `Catalog.tsx`, so `CardGrid` and `ListView` never both (or either) mount
  their own `PanelEmptyState` while a custom renderer is active.
- Export `CatalogEmptyStateContext` with the exact field set and names an
  external consuming project's workaround already depends on (`query`,
  `activeTab`, `hasTopicFilters`, `isMyAppsActive`), so adopting the real prop
  is a same-shape swap for that consumer.
- Preserve every existing default: no prop, or a prop returning
  `null`/`undefined`, must produce pixel-identical output to today.

**Non-Goals:**

- Changing `CardGrid`'s or `ListView`'s own public API, or giving either of
  them their own `renderEmptyState` prop — the proposal scopes the seam to
  `Catalog`'s single content slot only; standalone consumers of `CardGrid`/
  `ListView` are explicitly out of scope (proposal requirement 7).
- Changing loading (`isLoading`) or error (`error`) handling — both are
  explicitly frozen by the proposal (requirement 6). `Catalog`'s own
  full-panel loading spinner (`Catalog.tsx:453-459`) already returns before
  any of this logic runs, so it takes precedence unconditionally.
- i18n of the rendered custom node — the render prop returns a `ReactNode`
  the host already owns and (per `libs/*` no-i18n rule) has already
  translated; the lib does not inspect or wrap that content.

## Decisions

### 1. Dispatch point: replace the shared wrapper's children in `Catalog.tsx`, not inside `CardGrid`/`ListView`

Render the custom node in place of the `div` at `Catalog.tsx:560-622` (the one
that currently holds both the `CardGrid` wrapper and the conditionally-shown
`ListView` wrapper) when `tabFiltered.length === 0` and `renderEmptyState`
resolves to a non-null node. This is exactly the slot the existing consumer
patch targets, and it is the only point in the tree where "the final result
set used by whichever view is active is empty" is already known without
recomputation — `tabFiltered` is computed once and passed to both children
unchanged.

**Alternative considered**: pass `renderEmptyState` down into `CardGrid` and
`ListView` and have each call it when its own `items.length === 0`. Rejected:
`viewMode` toggling means both components are mounted at once
(`viewMode !== CatalogViewMode.Grid && 'hidden'` / `viewMode !==
CatalogViewMode.Cards && 'hidden'`), and `listEverShown` can be `true` while
`viewMode` is `Grid` — so both would independently satisfy
`items.length === 0` and each try to render the custom node, producing two
mounted copies (only one visible via `hidden`, but both running effects/state)
whenever list view has ever been shown. This directly violates proposal
requirement 2 ("do not mount two copies"). It would also leak the new prop
into `CardGridProps`/`ListViewProps`, contradicting Non-Goal 1.

### 2. Context values: read `Catalog`'s already-resolved locals directly

Build the `CatalogEmptyStateContext` object from the same resolved consts
`Catalog.tsx` already uses for rendering — `query`, `activeTab`, `filters`,
`isMyAppsActive` — mapping `hasTopicFilters: filters.size > 0`. These consts
are already the controlled-or-internal resolution (`Catalog.tsx:162-164,213`),
so no new state, ref, or effect is needed to satisfy "context must reflect
real values whether controlled or uncontrolled" (proposal, Behavior section).

**Alternative considered**: recompute the context fields independently inside
a new callback to decouple it from the existing internal variable names.
Rejected as pure indirection — the existing consts are already the single
source of truth Catalog itself renders from; a second computation path is a
drift risk for no benefit.

### 3. Precedence and fallback: call, then check the result, not the prop's presence

Compute `emptyStateNode = renderEmptyState?.(context)` once when
`tabFiltered.length === 0`, and treat `emptyStateNode != null` as the signal
to take the custom-render branch. A supplied `renderEmptyState` that returns
`null`/`undefined` falls through to today's default per-view rendering
unchanged (proposal Behavior item 4). This also means `renderEmptyState` is
only ever invoked when the result set is actually empty (Behavior item 1) —
never during loading (the early-return above already excludes that) and never
speculatively while items exist.

### 4. `CatalogEmptyStateContext` placement and export

Define the interface in `libs/catalog/src/models/catalog-props.ts` next to
`CatalogProps` (it is a `CatalogProps`-adjacent callback-argument type, the
same relationship `CatalogTitles` has), and re-export it as a type from
`libs/catalog/src/index.ts` alongside `CatalogProps`/`CatalogTitles`, per the
public-API-surface rule that every type reachable through a public prop must
itself be exported.

## Risks / Trade-offs

- **[Risk]** A future change to the tab-filter pipeline (e.g. renaming
  `myAppsFiltered`/`tabFiltered` or reordering filter stages) could silently
  change what "empty" or `hasTopicFilters` means for the callback without a
  compile error, since the mapping is a handful of plain reads rather than a
  named derivation.
  **Mitigation**: keep the context-construction expression colocated
  immediately next to the `tabFiltered` empty-check in `Catalog.tsx` (not
  extracted into a separate util file), so a reviewer changing the pipeline
  sees the usage in the same diff hunk.
- **[Risk]** A consumer's `renderEmptyState` implementation is expensive or
  has side effects, and gets invoked on every `Catalog` re-render while the
  result set stays empty (e.g. on every keystroke of a query that keeps
  matching nothing).
  **Mitigation**: out of scope to prevent in the library — the same is already
  true of `noResultsTitle(query)` (a function prop) called on every empty
  render today (`Catalog.tsx:442`). Document the re-render frequency in the
  README example, consistent with how `noResultsTitle` is documented as a
  function of `query`.
- **[Trade-off]** Because the dispatch point is `Catalog.tsx` rather than
  `CardGrid`/`ListView`, a host composing its own layout from the exported
  `CardGrid`/`ListView` directly (README's "composing their own layout"
  pattern) does not get the custom empty state for free — it would need to
  replicate the same `tabFiltered.length === 0` check itself. This is the
  explicit, accepted scope boundary from proposal requirement 7.

## Migration Plan

Purely additive library change — no migration for existing `ai-dial-chat`
consumers (none pass `renderEmptyState` today, so the new branch is never
taken and default output is unchanged). No backend, schema, or data
migration involved. Rollback is a normal package-version rollback per
`libs/catalog/README.md`'s existing "Rollback" section — no dependent
manifest bump is introduced by this change beyond `@epam/ai-dial-catalog`'s
own version.

## Open Questions

None — the proposal fixes the field names/shape via the existing external
consumer's own contract, and the render/no-render precedence is fully
specified by the proposal's Behavior section.
