## MODIFIED Requirements

### Requirement: The slot receives the props the built-in toolbar receives

`renderToolbar` SHALL be called with a `ToolbarProps` object built from the same values and callbacks `Catalog` passes to the built-in `Toolbar`:

- `totalCount`, the count after search, topic and folder filtering;
- `viewMode`, `onViewModeChange` and `onViewModeIntent`;
- `query`, `onQueryChange` and `searchInputRef`;
- `sortKey`, `sortOptions` and `onSortChange`;
- `filters`, `filterValues` and `onFiltersChange`;
- `folderTree`, `folderSelection`, `onFolderSelectionChange` and `folderLabels`;
- the title and label props;
- `browseHeaderRenderer`.

`Catalog` SHALL keep owning the state behind these props, so a callback invoked from the slot updates the listing exactly as the matching control of the built-in toolbar would.

#### Scenario: Slot drives search

- **WHEN** the slot calls `onQueryChange` with a name fragment
- **THEN** the listing narrows to the items whose name matches

#### Scenario: Slot drives the topic filter

- **WHEN** the slot calls `onFiltersChange` with a set of topics
- **THEN** the listing narrows to the items that have one of those topics

#### Scenario: Slot drives the folder

- **WHEN** the slot calls `onFolderSelectionChange` with `{ root: 'personal', path: [] }`
- **THEN** the listing narrows to personal items, and the slot is re-rendered with that `folderSelection`

#### Scenario: Slot drives the view mode

- **WHEN** the slot calls `onViewModeChange` with `CatalogViewMode.Cards`
- **THEN** the slot is re-rendered with `viewMode` equal to `CatalogViewMode.Cards`
