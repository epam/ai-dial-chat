# catalog-card-slot Specification

## Purpose

Lets a host draw the Browse grid's cards with its own design through one render prop and a height, instead of the library growing a flag for every host-specific card.

## Requirements

### Requirement: `Catalog` accepts an optional card renderer and card height

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL declare `renderCard?: (props: CatalogCardRenderProps) => ReactNode` and `cardHeight?: number`. `CatalogCardRenderProps` (`libs/catalog/src/models/card-props.ts`, exported from the package) SHALL carry `item`, `query`, `isSelected`, `isReadonly`, `activeTab` and `onClick?`. `Catalog` SHALL forward both props to `CardGrid`. When `renderCard` is supplied, the grid SHALL call it for every cell it renders and place the result in the cell, in place of the built-in `Card`; when it is absent the built-in `Card` renders exactly as before. The list view and the Favorites strip SHALL NOT be affected.

#### Scenario: Slot replaces the built-in card

- **WHEN** `Catalog` renders with `renderCard` returning a node
- **THEN** that node is rendered for every listed item and the built-in card is not

#### Scenario: Absent slot keeps the built-in card

- **WHEN** `Catalog` renders without `renderCard`
- **THEN** the built-in cards render unchanged

### Requirement: The card receives the cell's state and an open action

`renderCard` SHALL receive `query` (the active search query), `isSelected` (whether the item is the grid's selected item), `isReadonly` (the grid's read-only flag) and `activeTab`. `onClick` SHALL open the item the way a click on the built-in card does, by calling the grid's item-click handler with the item, and SHALL be absent when the grid has no such handler.

#### Scenario: Card opens the item

- **WHEN** the supplied card calls `onClick`
- **THEN** `onCardClick` (or the details panel when none is set) receives that item

### Requirement: Card height drives the grid's rows

`cardHeight` (default `CARD_HEIGHT`, 248) SHALL be the height of one card in px. Each virtual row SHALL be `cardHeight` plus the row gap (`CARD_ROW_GAP`) high, and the grid's total height, its visible-row window and its loading skeleton SHALL be derived from it. A host drawing its own cards SHALL set it to their real height, since the grid does not measure them.

#### Scenario: Default height

- **WHEN** `cardHeight` is not set
- **THEN** every row is `CARD_HEIGHT + CARD_ROW_GAP` high

#### Scenario: Given height

- **WHEN** `cardHeight` is 180
- **THEN** every row is `180 + CARD_ROW_GAP` high and the grid's total height follows

### Requirement: The host keeps `renderCard` stable

Because the rows are memoized on their props, the host SHALL pass a memoized `renderCard`; a new function on every render redraws every visible card.
