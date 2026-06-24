## ADDED Requirements

### Requirement: catalog-filter utility tests

`libs/catalog/src/utils/catalog-filter.ts` SHALL have a Vitest test file at `libs/catalog/src/utils/catalog-filter.spec.ts` covering `filterCatalogItems`.

`filterCatalogItems` filters by `item.name`, `item.description`, and `item.type` — all lowercased, trimmed query match. Test file SHALL use `describe` / `it` blocks and import only from the library's own source files.

i18n: none. RTL: none. Feature gate: none.

#### Scenario: Empty query returns all items

- **WHEN** `filterCatalogItems(items, '')` is called with a non-empty items array
- **THEN** all items are returned unchanged

#### Scenario: Query matches by name (case-insensitive)

- **WHEN** `filterCatalogItems(items, 'GPT')` is called and one item has `name: 'gpt-4o'`
- **THEN** that item is included in the result

#### Scenario: Query matches by description

- **WHEN** `filterCatalogItems(items, 'vision')` is called and one item's `description` contains `'Vision'`
- **THEN** that item is included in the result

#### Scenario: Query matches by type

- **WHEN** `filterCatalogItems(items, 'agent')` is called and one item has `type: CatalogEntityType.Agent`
- **THEN** that item is included in the result

#### Scenario: Query with no match returns empty array

- **WHEN** `filterCatalogItems(items, 'xyzzy-no-match')` is called
- **THEN** an empty array is returned

---

### Requirement: catalog-sort utility tests

`libs/catalog/src/utils/catalog-sort.ts` SHALL have a Vitest test file at `libs/catalog/src/utils/catalog-sort.spec.ts` covering `sortCatalogItems`.

Key behaviour to cover:
- Featured items (`isFeatured: true`) always appear before non-featured items in every sort mode.
- `CatalogSortKey.NameAZ` — sort within each group by `name` locale-ascending.
- `CatalogSortKey.Newest` — sort within each group by `updatedAt` descending; items without `updatedAt` sort last.
- `CatalogSortKey.RecentlyUpdated` — preserves original (API) order within each group.
- Unknown sort key — preserves original order without throwing.

#### Scenario: NameAZ sorts items alphabetically ascending

- **WHEN** `sortCatalogItems(items, CatalogSortKey.NameAZ)` is called with non-featured items named `['Zebra', 'Alpha', 'Beta']`
- **THEN** the returned order is `['Alpha', 'Beta', 'Zebra']`

#### Scenario: Featured items appear before non-featured in NameAZ

- **WHEN** `sortCatalogItems(items, CatalogSortKey.NameAZ)` is called with a mix of featured and non-featured items
- **THEN** all featured items appear first, sorted alphabetically among themselves, followed by non-featured items sorted alphabetically

#### Scenario: Newest sorts by updatedAt descending

- **WHEN** `sortCatalogItems(items, CatalogSortKey.Newest)` is called with items having different `updatedAt` values
- **THEN** the item with the largest `updatedAt` appears first

#### Scenario: Newest — items without updatedAt sort last

- **WHEN** `sortCatalogItems(items, CatalogSortKey.Newest)` is called and some items have no `updatedAt`
- **THEN** items without `updatedAt` appear after all items that have it

#### Scenario: RecentlyUpdated preserves original order

- **WHEN** `sortCatalogItems(items, CatalogSortKey.RecentlyUpdated)` is called
- **THEN** the items are returned in their original array order (featured group first, then non-featured, both in original order)

#### Scenario: Unknown sort key preserves original order without throwing

- **WHEN** `sortCatalogItems(items, 'unknown-key')` is called
- **THEN** the items are returned in their original order and no exception is thrown

---

### Requirement: Toolbar component tests

`libs/catalog/src/components/Toolbar/Toolbar.tsx` SHALL have a Vitest + React Testing Library test at `libs/catalog/src/components/Toolbar/tests/Toolbar.spec.tsx`.

Tests SHALL mock `@epam/ai-dial-ui-kit` sub-components minimally (render their `children`/`label` props as plain text) to avoid UI kit rendering complexity.

#### Scenario: Toolbar renders section title

- **WHEN** `<Toolbar title="Browse" ... />` is rendered
- **THEN** the text "Browse" is present in the output

#### Scenario: Clear all button is hidden when no filter is active

- **WHEN** `isAnyFilterActive={false}` is passed
- **THEN** no "Clear all" button is rendered

#### Scenario: Clear all button is visible when filter is active

- **WHEN** `isAnyFilterActive={true}` is passed
- **THEN** a button with label matching the `clearAllLabel` prop is rendered

#### Scenario: onClearFilters fires when Clear all is clicked

- **WHEN** the "Clear all" button is clicked
- **THEN** `onClearFilters` is called once

---

### Requirement: ListView component tests

`libs/catalog/src/components/ListView/ListView.tsx` SHALL have a Vitest + React Testing Library test at `libs/catalog/src/components/ListView/tests/ListView.spec.tsx`.

The ag-grid dependency SHALL be mocked at the module level (`vi.mock`) to avoid JSDOM layout issues.

#### Scenario: ListView renders without crashing

- **WHEN** `<ListView items={[]} query="" ariaLabel="Catalog" emptyStateTitle="No items" />` is rendered
- **THEN** the component mounts without throwing

#### Scenario: Empty state title is shown when items is empty

- **WHEN** `items` is empty and `emptyStateTitle="No items"` is provided
- **THEN** the text "No items" appears in the rendered output

#### Scenario: onToggleFavorite is called when star is toggled

- **WHEN** a row's star action is triggered in the mocked grid
- **THEN** `onToggleFavorite` is called with the item's id and the new star state
