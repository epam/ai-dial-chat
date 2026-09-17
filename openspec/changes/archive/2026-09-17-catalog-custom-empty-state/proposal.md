## Why

`@epam/ai-dial-catalog` always renders its own `PanelEmptyState` (icon + title
text) when a search/filter/tab combination produces zero items. A consuming
host that wants a richer empty state — a custom icon, a longer description, a
scoped "Create" call to action — currently has no supported extension point:
`titles.noResultsTitle` only swaps the heading string. An external consuming
project worked around this by adding a Vite `transform` plugin that
string-replaces two fragments in the built `@epam/ai-dial-catalog/index.js`
bundle to splice in a render prop. This is fragile by construction — it is
coupled to the minified output shape of a specific package version and throws
(by design) the moment the bundle text shifts — and it duplicates two of
`Catalog.tsx`'s own values (`activeTab`, `isMyAppsActive`, topic-filter
presence) via source-string matching instead of reading them.

Exposing the same seam as a real, documented render prop removes the need for
bundle patching, keeps `Catalog`'s internal/controlled state as the single
source of truth for the context passed out, and keeps the default rendering
unchanged for every consumer that does not opt in.

## What Changes

- Add an optional `renderEmptyState?: (context: CatalogEmptyStateContext) => ReactNode` prop to `CatalogProps` (`libs/catalog/src/models/catalog-props.ts`).
- Export a new `CatalogEmptyStateContext` interface from the library's root entry point (`libs/catalog/src/index.ts`), with fields `query`, `activeTab`, `hasTopicFilters`, and `isMyAppsActive` — matching the shape and field names an external consumer's own bundle-patch workaround already used, so that consumer can drop its type cast and its Vite bundle-patch plugin without changing its own component code.
- In `Catalog.tsx`, when the final displayed set (`tabFiltered`) is empty and `renderEmptyState` is supplied and returns a non-null/undefined node, render that node in the single content slot that currently hosts `CardGrid`/`ListView`, instead of mounting either component's own empty state. Toolbar, search, filters, tabs, Favorites, and the details panel are unaffected.
- When `renderEmptyState` is absent, or is called and returns `null`/`undefined`, fall back to the existing behavior unchanged (`CardGrid`'s and `ListView`'s own `PanelEmptyState`, `titles.noResultsTitle`, default labels).
- No changes to `CardGrid` or `ListView`'s own public API or default empty-state rendering — a host that uses either component standalone (outside `Catalog`) is unaffected, since the new prop and its dispatch logic live only in `Catalog.tsx`.
- No changes to loading/error handling.

## Capabilities

### New Capabilities

- `catalog-custom-empty-state`: lets a host replace `Catalog`'s Browse-area empty state with a custom render-prop component driven by live search/filter/tab context, while preserving the default empty state for hosts that don't opt in.

### Modified Capabilities

_(none — no existing spec file describes `Catalog`'s default empty-state behavior as a standalone capability; this change adds a new capability rather than altering documented requirements of an existing one.)_

## Impact

- **Code**: `libs/catalog/src/models/catalog-props.ts` (new prop), `libs/catalog/src/components/Catalog/Catalog.tsx` (dispatch logic), `libs/catalog/src/index.ts` (new type export), `libs/catalog/README.md` (new documented prop + example).
- **Public API**: Additive only — one new optional prop and one new exported type. No existing prop, export, or default behavior changes for a consumer that does not pass `renderEmptyState`.
- **Consumers**: an external consuming project can migrate off its bundle-patch plugin once this ships, but that migration is out of scope for this change — this repo only ships the library-side contract.
- **No backend, routing, or i18n impact** — the render prop is a plain callback; any translated strings inside the host's rendered node remain the host's responsibility, consistent with `libs/*` never importing i18n.
