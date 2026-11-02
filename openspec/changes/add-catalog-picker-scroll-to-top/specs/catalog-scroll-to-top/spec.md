## MODIFIED Requirements

### Requirement: Catalog shows a "Scroll to top" button once scrolled down

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) SHALL render a `ScrollToTopButton` (`libs/catalog/src/components/ScrollToTopButton/ScrollToTopButton.tsx`) while the user has scrolled the catalog down by at least one scroll-body height, and SHALL NOT render it otherwise.

The scrolled offset is the sum of:

- the `scrollTop` of `Catalog`'s scroll body (the `overflow-y-auto` element below the heading), and
- in list view only, the vertical offset of the `ListView` grid rows, as reported by `ListView`'s `onRowsScroll`.

The threshold is the scroll body's `clientHeight`. The visibility state SHALL be owned by the `useCatalogScrollToTop` hook (`libs/catalog/src/hooks/useCatalogScrollToTop/useCatalogScrollToTop.ts`) as a single boolean local to `Catalog`; no context or provider is added. The hook SHALL listen with a passive `scroll` listener, coalesce updates to one per animation frame, and update React state only when the boolean flips. The listener SHALL be removed on unmount.

The button SHALL behave the same in every tab (models, agents, toolsets, skills, prompts) and in both `CatalogViewMode.Grid` and `CatalogViewMode.Cards` (list) view. It SHALL NOT render while `isLoading` is true. The catalog pickers' own button is defined by "Catalog pickers show a 'Scroll to top' button once the list is scrolled down".

The feature is not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. It emits no telemetry and adds no cached data.

#### Scenario: Hidden at the top

- **WHEN** the catalog renders a long Skills tab with the scroll body at `scrollTop` 0
- **THEN** no "Scroll to top" button is rendered

#### Scenario: Appears after one screen in grid view

- **WHEN** the scroll body's `clientHeight` is 600 and the user scrolls it to `scrollTop` 600 in grid view
- **THEN** the "Scroll to top" button is rendered

#### Scenario: Stays hidden for a short scroll

- **WHEN** the scroll body's `clientHeight` is 600 and the user scrolls it to `scrollTop` 300
- **THEN** no "Scroll to top" button is rendered

#### Scenario: List rows count toward the offset

- **WHEN** the catalog is in list view, the scroll body is at `scrollTop` 200 with `clientHeight` 600, and `ListView` reports a row offset of 400
- **THEN** the "Scroll to top" button is rendered

#### Scenario: Disappears when scrolled back up manually

- **WHEN** the button is visible and the user scrolls back so the combined offset is below the threshold
- **THEN** the button is no longer rendered

#### Scenario: Same behavior on every tab

- **WHEN** the user switches from a scrolled Skills tab to the Agents tab and scrolls Agents past the threshold
- **THEN** the button is rendered for the Agents tab as well

## ADDED Requirements

### Requirement: Catalog pickers show a "Scroll to top" button once the list is scrolled down

`CatalogPickerModal` (`libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`) SHALL render `ScrollToTopButton` (`libs/catalog/src/components/ScrollToTopButton/ScrollToTopButton.tsx`) while its default list (the `ListView` given `listProps`) is scrolled down by at least the list box's height, and SHALL NOT render it otherwise. `AddOnCatalogModal` (`libs/catalog/src/components/AddOnCatalogModal/AddOnCatalogModal.tsx`) renders its list through `CatalogPickerModal`'s `listProps` and SHALL show the same button with no logic of its own.

The scrolled offset is the vertical offset of the `ListView` rows, as reported by `ListView`'s `onRowsScroll`; the picker's body itself does not scroll. The threshold is the `clientHeight` of the box that holds the list below the search and filters. The visibility state SHALL be owned by `useCatalogScrollToTop` (`libs/catalog/src/hooks/useCatalogScrollToTop/useCatalogScrollToTop.ts`), local to `CatalogPickerModal`, with that box as its scroll body and list view on. No context or provider is added, and updates are coalesced to one per animation frame, as in `Catalog`.

Activating the button (pointer click, Enter or Space) SHALL call `ListView`'s `scrollToTop()` handle and move focus to the picker's search input (the kit `Search`, through its `inputRef`) with `preventScroll: true`, so keyboard focus does not fall back to `document.body` when the button unmounts.

The button SHALL be positioned absolutely inside the list box, at its bottom inline-end corner (`inset-e-4`, `bottom-4`, `z-10`), and SHALL NOT be mirrored under `dir="rtl"`. Its accessible name and tooltip SHALL be `CatalogPickerModalLabels.scrollToTop`, defaulting to `'Scroll to top'`. `AddOnCatalogModalLabels` extends `CatalogPickerModalLabels` and SHALL forward the field unchanged.

The button SHALL NOT render while the loading, failure or empty state replaces the list, and SHALL NOT render for a list given through `renderList`.

A `ref` or `onRowsScroll` the host passes in `listProps` SHALL keep receiving the `ListView` handle and every row offset; the picker chains them rather than replacing them.

The feature is not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. It emits no telemetry and adds no cached data. No i18n key is added in `apps/chat`, which renders neither picker; a host fills `labels.scrollToTop` with its own translation.

#### Scenario: Hidden at the top of the picker list

- **WHEN** `CatalogPickerModal` renders 200 items with `listProps` and the rows have not been scrolled
- **THEN** no "Scroll to top" button is rendered

#### Scenario: Appears after one list height

- **WHEN** the list box's `clientHeight` is 400 and `ListView` reports a row offset of 400
- **THEN** the "Scroll to top" button is rendered

#### Scenario: Stays hidden for a short scroll

- **WHEN** the list box's `clientHeight` is 400 and `ListView` reports a row offset of 399
- **THEN** no "Scroll to top" button is rendered

#### Scenario: Returns to the first row and focuses search

- **WHEN** the button is visible and the user activates it
- **THEN** `ListView`'s `scrollToTop()` is called
- **AND** the picker's search input is the active element

#### Scenario: Host label names the button

- **WHEN** the picker receives `labels={{ title: 'Add toolset', catalog: 'Toolsets', scrollToTop: 'Nach oben' }}` and the button is visible
- **THEN** the button's accessible name is "Nach oben"

#### Scenario: Add-on picker shows the button

- **WHEN** `AddOnCatalogModal` renders a long toolset list and its rows are scrolled by one list height
- **THEN** the "Scroll to top" button is rendered

#### Scenario: Host's own row-scroll callback still fires

- **WHEN** the host passes `listProps={{ type: CatalogEntityType.Model, onRowsScroll }}` and the rows scroll to 480
- **THEN** `onRowsScroll` is called with `480`

#### Scenario: No button for a host-rendered list

- **WHEN** the picker renders its items through `renderList`
- **THEN** no "Scroll to top" button is rendered, however far the host's list is scrolled

#### Scenario: Hidden while the list is replaced by a state

- **WHEN** the button is visible and the search leaves no matching items
- **THEN** the empty state is shown and no "Scroll to top" button is rendered
