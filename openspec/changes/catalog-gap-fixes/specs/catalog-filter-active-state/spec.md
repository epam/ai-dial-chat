## ADDED Requirements

### Requirement: fromChecked filter state in Catalog

`libs/catalog/src/components/Catalog/Catalog.tsx` SHALL maintain `fromChecked: Set<string>` as internal React state, initialized to `new Set<string>()` (empty = no filter active = all items pass through).

`isAnyFilterActive` SHALL be derived as `fromChecked.size > 0 && fromChecked.size < allFromIds.size`, where `allFromIds` is the `Set<string>` of all distinct `item.folderId` (or equivalent source-identifier field) across current `items`.

`clearAllFilters` SHALL call `setFromChecked(new Set())`, resetting the filter to show all items.

`fromChecked` and `setFromChecked` SHALL be passed down to `Toolbar` via new `ToolbarProps` fields `fromChecked: Set<string>` and `onFromChange: (checked: Set<string>) => void`, so `FilterRow` → `Filter` have correct wiring when the tree-checkbox UI is completed.

Neither `fromChecked` nor any filter-active boolean SHALL be added to `CatalogProps`; filter state is entirely internal.

State owner: `Catalog` component (`libs/catalog/src/components/Catalog/Catalog.tsx`).

Memoisation: `clearAllFilters` SHALL be wrapped with `useCallback(() => setFromChecked(new Set()), [])`.

i18n keys: none — no new user-visible strings.

RTL impact: none — filter state is not direction-dependent.

Feature gate: none.

Observability: none.

#### Scenario: Initial render — filter inactive

- **WHEN** `Catalog` mounts with any `items` array
- **THEN** `fromChecked` is `new Set()`, `isAnyFilterActive` is `false`, and all non-hidden items pass through to the grid/list

#### Scenario: fromChecked partially set — filter active

- **WHEN** `fromChecked` contains some but not all source IDs (e.g. `Set { 'folderA' }` out of `['folderA', 'folderB']`)
- **THEN** `isAnyFilterActive` is `true` and `FilterRow` renders the "Clear all" button

#### Scenario: fromChecked equals all IDs — filter inactive

- **WHEN** `fromChecked` has the same size as `allFromIds`
- **THEN** `isAnyFilterActive` is `false` and the "Clear all" button is not rendered

#### Scenario: clearAllFilters resets state

- **WHEN** `clearAllFilters` is called while `fromChecked` has values
- **THEN** `fromChecked` becomes `new Set()` and `isAnyFilterActive` becomes `false`

#### Scenario: Toolbar receives wiring props

- **WHEN** `Catalog` renders `Toolbar`
- **THEN** `Toolbar` receives the current `fromChecked`, `onFromChange` callback, `isAnyFilterActive`, and `onClearFilters` props with the correct values

---

### Requirement: CatalogSortOption re-exported from index

`libs/catalog/src/index.ts` SHALL export `CatalogSortOption` from `./models/sort`.

#### Scenario: Consumer can import CatalogSortOption from the package root

- **WHEN** a consumer imports `CatalogSortOption` from `@epam/ai-dial-catalog`
- **THEN** the import resolves without error and the type is available for use
