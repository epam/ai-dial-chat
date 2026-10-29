# catalog-scroll-to-top Specification

## Purpose

A floating "Scroll to top" button in the catalog that appears after the user scrolls down one screen and, when activated, returns the catalog (grid or list view) to the top and focuses the search input.

## Requirements

### Requirement: Catalog shows a "Scroll to top" button once scrolled down

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) SHALL render a `ScrollToTopButton` (`libs/catalog/src/components/ScrollToTopButton/ScrollToTopButton.tsx`) while the user has scrolled the catalog down by at least one scroll-body height, and SHALL NOT render it otherwise.

The scrolled offset is the sum of:

- the `scrollTop` of `Catalog`'s scroll body (the `overflow-y-auto` element below the heading), and
- in list view only, the vertical offset of the `ListView` grid rows, as reported by `ListView`'s `onRowsScroll`.

The threshold is the scroll body's `clientHeight`. The visibility state SHALL be owned by the `useCatalogScrollToTop` hook (`libs/catalog/src/hooks/useCatalogScrollToTop/useCatalogScrollToTop.ts`) as a single boolean local to `Catalog`; no context or provider is added. The hook SHALL listen with a passive `scroll` listener, coalesce updates to one per animation frame, and update React state only when the boolean flips. The listener SHALL be removed on unmount.

The button SHALL behave the same in every tab (models, agents, toolsets, skills, prompts) and in both `CatalogViewMode.Grid` and `CatalogViewMode.Cards` (list) view. It SHALL NOT render while `isLoading` is true, and SHALL NOT render in `CatalogPickerModal` or `AddOnCatalogModal`.

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

### Requirement: Activating the button returns to the top and focuses search

Activating the button (pointer click, Enter or Space) SHALL:

1. scroll `Catalog`'s scroll body to `top: 0`, with `behavior: 'smooth'`, or `behavior: 'auto'` when `prefers-reduced-motion: reduce` matches;
2. in list view, call `ListView`'s `scrollToTop()` handle so the grid rows also return to the first row;
3. move focus to the catalog search input (the kit `Search` rendered by `Toolbar`) with `preventScroll: true`, on desktop and mobile alike.

After the scroll the button SHALL be removed by the visibility rule above; because focus has already moved to the search input, keyboard focus SHALL NOT fall back to `document.body`.

#### Scenario: Grid view returns to top

- **WHEN** the button is visible in grid view and the user clicks it
- **THEN** the scroll body's `scrollTo` is called with `{ top: 0, behavior: 'smooth' }`
- **AND** the search input is the active element

#### Scenario: List view resets both scroll positions

- **WHEN** the button is visible in list view and the user activates it with Enter
- **THEN** the scroll body is scrolled to the top
- **AND** `ListView`'s `scrollToTop()` is called
- **AND** the search input is the active element

#### Scenario: Reduced motion scrolls instantly

- **WHEN** `prefers-reduced-motion: reduce` matches and the user clicks the button
- **THEN** the scroll body's `scrollTo` is called with `{ top: 0, behavior: 'auto' }`

#### Scenario: Mobile focuses search too

- **WHEN** the catalog renders at mobile width and the user taps the button
- **THEN** the search input is the active element

### Requirement: Button look, placement and accessible name

`ScrollToTopButton` SHALL render the 2.0 `FabButton` from `@epam/ai-dial-ui-kit` with an `IconArrowNarrowUp` icon at `DIAL_ICON_SIZE.LG` and `stroke={DIAL_KIT_ICON_STROKE}`, marked `aria-hidden`. The button's `aria-label` and its tooltip text SHALL be `CatalogTitles.scrollToTopLabel`, defaulting to `'Scroll to top'`. `CatalogTitles.scrollToTopLabel` SHALL be read by `Catalog` and forwarded to `ScrollToTopButton`.

The button SHALL be positioned absolutely inside `Catalog`'s root `section`, at the bottom inline-end corner using logical utilities (`inset-e-*`, `bottom-*`), above the scroll body (`z-10`):

- on desktop, at the same inline-end/bottom inset as the mobile floating Create button uses (`inset-e-4`, `bottom-4`);
- on mobile, when the floating Create button is visible, stacked directly above it so neither control overlaps the other; when the floating Create button is not visible, in the Create button's spot.

RTL impact: placement uses logical properties so the button moves to the left edge under `dir="rtl"`. The up-arrow is direction-agnostic and SHALL NOT be mirrored.

The button SHALL NOT add horizontal overflow to the page at 360px width.

#### Scenario: Default accessible name

- **WHEN** `Catalog` renders the button without `titles.scrollToTopLabel`
- **THEN** a button named "Scroll to top" is rendered
- **AND** its icon is `aria-hidden`

#### Scenario: Host label is used

- **WHEN** `Catalog` receives `titles={{ scrollToTopLabel: 'Nach oben' }}` and the button is visible
- **THEN** the button's accessible name is "Nach oben"

#### Scenario: No overlap with the floating Create button on mobile

- **WHEN** the catalog renders at 360×640 with the Create button visible and the button visible
- **THEN** the bounding boxes of the "Scroll to top" button and the floating Create button do not intersect
- **AND** the page has no horizontal overflow

#### Scenario: RTL placement

- **WHEN** the catalog renders under `dir="rtl"` and the button is visible
- **THEN** the button sits at the bottom-left corner and its icon is not mirrored

### Requirement: `Toolbar` exposes the search input through `searchInputRef`

`ToolbarProps` (`libs/catalog/src/models/toolbar-props.ts`) SHALL include an optional `searchInputRef?: Ref<HTMLInputElement>`. `Toolbar` SHALL forward it to `TitleRow` (`libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`), which SHALL pass it to the kit `Search`'s `inputRef`. `Catalog` SHALL pass its own ref so the scroll-to-top action can focus the field. Omitting the prop SHALL leave `Toolbar`'s behavior unchanged.

#### Scenario: Ref resolves to the search input

- **WHEN** `Toolbar` renders with a `searchInputRef`
- **THEN** `searchInputRef.current` is the `<input>` inside the toolbar's `role="search"` region

### Requirement: `ListView` exposes a scroll handle and reports row scroll

`ListViewProps` (`libs/catalog/src/models/list-props.ts`) SHALL include:

- an optional `ref?: Ref<ListViewHandle>`, where the exported `ListViewHandle` interface has a single method `scrollToTop(): void`;
- an optional `onRowsScroll?: (top: number) => void`, called with the grid body's vertical scroll offset in pixels whenever the rows scroll.

`ListView` SHALL implement both with the `GridApi` it already holds: `scrollToTop()` calls `ensureIndexVisible(0, 'top')` (a no-op while the grid has no API or no rows), and `onRowsScroll` is driven by the grid's `bodyScroll` event, reporting only vertical changes. The listener SHALL be removed when the API changes or `ListView` unmounts. Neither the handle nor the callback SHALL expose a `GridApi` or any other ag-grid type to the caller.

`ListViewHandle` SHALL be exported from `libs/catalog/src/index.ts`.

#### Scenario: Handle scrolls to the first row

- **WHEN** a caller holds a `ListView` ref and calls `ref.current.scrollToTop()` with 500 rows rendered
- **THEN** the grid's `ensureIndexVisible` is called with `0` and `'top'`

#### Scenario: Handle is safe before the grid is ready

- **WHEN** `scrollToTop()` is called before the grid has reported its API
- **THEN** nothing throws

#### Scenario: Row scroll is reported

- **WHEN** the grid emits a `bodyScroll` event with `direction: 'vertical'` and `top: 480`
- **THEN** `onRowsScroll` is called with `480`

#### Scenario: Horizontal scroll is not reported

- **WHEN** the grid emits a `bodyScroll` event with `direction: 'horizontal'`
- **THEN** `onRowsScroll` is not called

### Requirement: Host passes a translated label

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL pass `scrollToTopLabel: t(CatalogI18nKeys.ScrollToTop)` in `Catalog`'s `titles`. `CatalogI18nKeys.ScrollToTop` SHALL be declared in `apps/chat/src/constants/translation-keys.ts` with value `'catalog.scrollToTop'`, and the i18n key `catalog.scrollToTop` SHALL exist in `apps/chat/src/i18n/locales/en.json` with the English value "Scroll to top" (today `en.json` is the only locale file; any locale added later inherits the key per AGENTS.md "Adding a new locale").

#### Scenario: Translated label reaches the button

- **WHEN** the app runs in a non-English locale and the user scrolls a long catalog tab past the threshold
- **THEN** the button's accessible name is that locale's `catalog.scrollToTop` string
