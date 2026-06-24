## ADDED Requirements

### Requirement: catalog-filter utility tests

`libs/catalog/src/utils/catalog-filter.ts` SHALL have a Vitest test file at `libs/catalog/src/utils/catalog-filter.spec.ts` covering `filterCatalogItems`.

Test file SHALL use `describe` / `it` blocks and import only from the library's own source files — no `@epam/chat-api-client`, no app imports.

i18n: none. RTL: none. Feature gate: none.

#### Scenario: Empty query returns all items

- **WHEN** `filterCatalogItems(items, '')` is called with a non-empty items array
- **THEN** all items are returned unchanged

#### Scenario: Query matches by name (case-insensitive)

- **WHEN** `filterCatalogItems(items, 'GPT')` is called and one item has `name: 'gpt-4o'`
- **THEN** that item is included in the result

#### Scenario: Query matches by description

- **WHEN** `filterCatalogItems(items, 'vision')` is called and one item's description contains 'Vision'
- **THEN** that item is included in the result

#### Scenario: Query with no match returns empty array

- **WHEN** `filterCatalogItems(items, 'xyzzy-no-match')` is called
- **THEN** an empty array is returned

---

### Requirement: catalog-sort utility tests

`libs/catalog/src/utils/catalog-sort.ts` SHALL have a Vitest test file at `libs/catalog/src/utils/catalog-sort.spec.ts` covering `sortCatalogItems` for each `CatalogSortKey`.

#### Scenario: NameAZ sorts items alphabetically ascending

- **WHEN** `sortCatalogItems(items, CatalogSortKey.NameAZ)` is called with items having names `['Zebra', 'Alpha', 'Beta']`
- **THEN** the returned order is `['Alpha', 'Beta', 'Zebra']`

#### Scenario: Newest sorts by createdAt descending

- **WHEN** `sortCatalogItems(items, CatalogSortKey.Newest)` is called with items having different `createdAt` values
- **THEN** the most-recently-created item appears first

#### Scenario: RecentlyUpdated sorts by updatedAt descending

- **WHEN** `sortCatalogItems(items, CatalogSortKey.RecentlyUpdated)` is called
- **THEN** the most-recently-updated item appears first

#### Scenario: Unknown sort key returns items in original order

- **WHEN** `sortCatalogItems(items, 'unknown-key')` is called
- **THEN** the items array is returned in its original order without throwing

---

### Requirement: Toolbar component tests

`libs/catalog/src/components/Toolbar/Toolbar.tsx` SHALL have a Vitest + React Testing Library test at `libs/catalog/src/components/Toolbar/tests/Toolbar.spec.tsx`.

Tests SHALL mock `@epam/ai-dial-ui-kit` sub-components minimally (render their `children`/`label` props as plain text) to avoid UI kit rendering complexity.

#### Scenario: Toolbar renders section title

- **WHEN** `<Toolbar title="Browse" ... />` is rendered
- **THEN** the text "Browse" is present in the output

#### Scenario: onSortChange fires when sort is changed

- **WHEN** the sort dropdown emits a change
- **THEN** `onSortChange` is called with the new sort key

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
