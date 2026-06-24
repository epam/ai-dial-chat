## ADDED Requirements

### Requirement: Filter component — My Apps toggle and Topics checkboxes

`libs/catalog/src/components/Filter/Filter.tsx` SHALL render a `DialDropdown` containing:
1. A `DialCheckbox` for the "My Apps" toggle (`id="filter-my-apps"`).
2. When `values` is non-empty: a separator, a Topics section heading, and a scrollable list of `DialCheckbox` items (one per topic, `id="filter-topic-{topic}"`).

Topic checkboxes are sorted alphabetically (`[...values].sort()`).

The `DialLinkButton` trigger label is computed by `getFilterButtonLabel`:
- Neither active → `defaultLabel` (default: `'From'`).
- Only `isMyAppsActive` → `myAppsLabel` (default: `'My Apps'`).
- Only topics → `getFromLabel(checked, values, defaultLabel)`.
- Both active → `"${myAppsLabel} · ${checked.size}"`.

The trigger gains `styles.activeLabel` when `isMyAppsActive || checked.size > 0`.

`FilterProps` fields:
- `checked: Set<string>` — selected topic strings (empty = no topic filter).
- `onChange: (checked: Set<string>) => void` — topic selection callback.
- `values?: Set<string>` — all available topics.
- `isMyAppsActive?: boolean` — My Apps toggle state.
- `onMyAppsChange?: (isActive: boolean) => void` — My Apps toggle callback.
- `myAppsLabel?: string` — default `'My Apps'`.
- `topicsLabel?: string` — Topics section heading, default `'Topics'`.
- `topicsSectionClassName?: string` — CSS class for the heading, default `'dial-tiny-text'`.
- `defaultLabel?: string` — button label when idle, default `'From'`.

i18n: all user-visible strings are props with English defaults. RTL: none. Feature gate: none.

#### Scenario: Dropdown renders My Apps checkbox

- **WHEN** `<Filter checked={new Set()} onChange={fn} />` is rendered and the trigger is clicked
- **THEN** a checkbox labelled "My Apps" is visible in the overlay

#### Scenario: Topics list renders when values provided

- **WHEN** `values={new Set(['Vision', 'Code'])}` is passed
- **THEN** checkboxes for "Code" and "Vision" appear in alphabetical order below the separator

#### Scenario: Topics section hidden when values absent

- **WHEN** `values` is `undefined` or empty
- **THEN** no separator, no "Topics" heading, and no topic checkboxes are rendered

#### Scenario: Checking a topic adds it to checked set

- **WHEN** the "Vision" checkbox is clicked while `checked` is empty
- **THEN** `onChange` is called with `Set { 'Vision' }`

#### Scenario: Unchecking a topic removes it from checked set

- **WHEN** the "Vision" checkbox is clicked while `checked` is `Set { 'Vision' }`
- **THEN** `onChange` is called with an empty set

#### Scenario: Button label — only My Apps active

- **WHEN** `isMyAppsActive={true}` and `checked` is empty
- **THEN** the trigger button label is the value of `myAppsLabel` ("My Apps")

#### Scenario: Button label — only topics active

- **WHEN** `isMyAppsActive` is false and `checked={new Set(['Vision'])}` with `values={new Set(['Vision', 'Code'])}`
- **THEN** the trigger label is produced by `getFromLabel` (e.g. "From: 1 of 2")

#### Scenario: Button label — both active

- **WHEN** `isMyAppsActive={true}` and `checked={new Set(['Vision', 'Code'])}`
- **THEN** the trigger label is `"My Apps · 2"`

#### Scenario: Trigger has active style when any filter is on

- **WHEN** either `isMyAppsActive` is true or `checked.size > 0`
- **THEN** the trigger button has the `activeLabel` CSS class applied

---

### Requirement: filters and isMyAppsActive state in Catalog

`libs/catalog/src/components/Catalog/Catalog.tsx` SHALL maintain:
- `filters: Set<string>` — initialized to `new Set()`.
- `isMyAppsActive: boolean` — initialized to `false`.

`allFilterValues` SHALL be `useMemo(() => new Set(filteredItems.flatMap(i => i.topics)), [filteredItems])`.

The item pipeline SHALL be:
```
sorted → filtered (query) → topicFiltered → myAppsFiltered → tabFiltered
```
- `topicFiltered`: when `filters.size > 0`, keep only items where `item.topics.some(t => filters.has(t))`; otherwise pass all.
- `myAppsFiltered`: when `isMyAppsActive`, keep only `item.isMyApp === true`; otherwise pass all.
- `tabFiltered`: existing entity-type tab filter applied to `myAppsFiltered`.

Tab badge counts SHALL use `myAppsFiltered` (reflects active filters, not raw `filtered`).

`isAnyFilterActive` SHALL be `filters.size > 0 || isMyAppsActive`.

`clearAllFilters` SHALL be `useCallback(() => { setFilters(new Set()); setIsMyAppsActive(false); }, [])`.

`Toolbar` SHALL receive `filters`, `onFiltersChange={setFilters}`, `filterValues={allFilterValues}`, `isMyAppsActive`, `onMyAppsChange={setIsMyAppsActive}`, plus label props from `CatalogTitles` (`clearAllLabel`, `filterFromLabel`, `filterMyAppsLabel`, `filterTopicsLabel`).

Filter state is entirely internal to `Catalog`; none of it is added to `CatalogProps`.

`CatalogItem` SHALL have an optional `isMyApp?: boolean` field. The host app populates it (e.g. from a deployment `isMy` flag). The lib does not interpret its meaning.

New fields on `CatalogTitles`: `clearAllLabel?`, `filterFromLabel?`, `filterMyAppsLabel?`, `filterTopicsLabel?` — all optional strings forwarded to `Toolbar`.

i18n: handled via `CatalogTitles` — no i18n inside the lib. RTL: none. Feature gate: none.

#### Scenario: Initial render — filters and My Apps inactive

- **WHEN** `Catalog` mounts
- **THEN** `filters` is empty, `isMyAppsActive` is `false`, `isAnyFilterActive` is `false`, all non-hidden items reach the grid

#### Scenario: Topic filter — shows only matching items

- **WHEN** `filters` contains `Set { 'Vision' }` and items have mixed topics
- **THEN** only items with `'Vision'` in their `topics` array pass through `topicFiltered`

#### Scenario: My Apps filter — shows only isMyApp items

- **WHEN** `isMyAppsActive` is `true`
- **THEN** only items where `item.isMyApp === true` pass through `myAppsFiltered`

#### Scenario: Both filters combined

- **WHEN** `filters` is non-empty and `isMyAppsActive` is `true`
- **THEN** `myAppsFiltered` contains only items that match both the topic filter AND `isMyApp`

#### Scenario: clearAllFilters resets both states

- **WHEN** `clearAllFilters` is called with both `filters` non-empty and `isMyAppsActive` true
- **THEN** `filters` becomes empty, `isMyAppsActive` becomes `false`, `isAnyFilterActive` becomes `false`

#### Scenario: Tab badge counts reflect active filters

- **WHEN** a topic filter is active that excludes some items
- **THEN** entity-type tab counts reflect only items passing the topic+myApps filters, not the raw filtered list

---

### Requirement: CatalogSortOption re-exported from index

`libs/catalog/src/index.ts` SHALL export `CatalogSortOption` from `./models/sort`.

`CatalogSortOption` is `{ value: string; label: string }` — represents a single option in the sort dropdown.

#### Scenario: Consumer can import CatalogSortOption from the package root

- **WHEN** a consumer imports `CatalogSortOption` from `@epam/ai-dial-catalog`
- **THEN** the import resolves without TypeScript errors and the type is available for use
