# catalog-toolbar-slot Specification

## Purpose

Lets a host replace the catalog's Browse toolbar with its own design through one render prop, instead of the library growing a flag for every host-specific layout.

## Requirements

### Requirement: `Catalog` accepts an optional toolbar renderer

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL declare `renderToolbar?: (props: ToolbarProps) => ReactNode`. When the prop is supplied, `Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) SHALL render its result in place of the built-in `Toolbar`, inside the same wrapper and above the entity-type tabs, and SHALL NOT render the built-in `Toolbar`. When the prop is absent, `Catalog` SHALL render the built-in `Toolbar` exactly as before.

#### Scenario: Slot replaces the built-in toolbar

- **WHEN** `Catalog` renders with `renderToolbar` returning a node
- **THEN** that node is rendered and the built-in toolbar's search field is not

#### Scenario: Absent slot keeps the built-in toolbar

- **WHEN** `Catalog` renders without `renderToolbar`
- **THEN** the built-in toolbar renders unchanged

### Requirement: The slot receives the props the built-in toolbar receives

`renderToolbar` SHALL be called with a `ToolbarProps` object built from the same values and callbacks `Catalog` passes to the built-in `Toolbar`: `totalCount` (the count after search, topic and "My" filtering), `viewMode`, `onViewModeChange`, `onViewModeIntent`, `query`, `onQueryChange`, `searchInputRef`, `sortKey`, `sortOptions`, `onSortChange`, `filters`, `filterValues`, `onFiltersChange`, `isMyAppsActive`, `onMyAppsChange`, the title and label props, and `browseHeaderRenderer`. `Catalog` SHALL keep owning the state behind them, so a callback invoked from the slot updates the listing exactly as the built-in toolbar's control would.

#### Scenario: Slot drives search

- **WHEN** the slot calls `onQueryChange` with a name fragment
- **THEN** the listing narrows to the items whose name matches

#### Scenario: Slot drives the topic filter

- **WHEN** the slot calls `onFiltersChange` with a set of topics
- **THEN** the listing narrows to the items having one of those topics

#### Scenario: Slot drives the view mode

- **WHEN** the slot calls `onViewModeChange` with `CatalogViewMode.Cards`
- **THEN** the slot is re-rendered with `viewMode` equal to `CatalogViewMode.Cards`

### Requirement: The host owns what the built-in toolbar provided

With `renderToolbar` supplied, the host SHALL attach `searchInputRef` to its search input so the "Scroll to top" control can focus it (`catalog-scroll-to-top`), and SHALL provide its own layout below the phone breakpoint, because the browse-settings sheet belongs to the replaced toolbar (`catalog-mobile-browse-settings`). `CatalogPickerModal` does not use `Catalog`'s toolbar and SHALL be unaffected by this prop.
