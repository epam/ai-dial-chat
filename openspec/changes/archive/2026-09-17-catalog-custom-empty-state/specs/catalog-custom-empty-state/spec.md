## ADDED Requirements

### Requirement: `Catalog` accepts an optional custom empty-state renderer

`CatalogProps` SHALL include an optional `renderEmptyState?: (context: CatalogEmptyStateContext) => ReactNode` property. `@epam/ai-dial-catalog`'s root entry point SHALL export a `CatalogEmptyStateContext` interface with exactly these fields: `query: string`, `activeTab: string`, `hasTopicFilters: boolean`, `isMyAppsActive: boolean`. This is a UI-only, client-side prop — it introduces no new backend endpoint, no new i18n keys inside the library (the library performs no translation), and no new feature-flag gating; RTL impact is none, since the library renders no text or layout of its own for this prop, only whatever `ReactNode` the host's callback returns.

#### Scenario: Prop and type are part of the public API

- **WHEN** a consumer imports from `@epam/ai-dial-catalog`
- **THEN** `CatalogEmptyStateContext` is importable as a named type export, and `CatalogProps['renderEmptyState']` type-checks against a function of signature `(context: CatalogEmptyStateContext) => ReactNode`

### Requirement: Custom empty state renders only when the displayed result set is empty and loading has finished

`Catalog` SHALL invoke `renderEmptyState` only when `isLoading` is not true and the item set that would otherwise be handed to the active view (`CardGrid` or `ListView`) after search, topic-filter, My Apps, and active-tab filtering is applied has zero items.

#### Scenario: Loading takes precedence

- **WHEN** `isLoading` is `true`
- **THEN** `Catalog` renders its loading state and does not call `renderEmptyState`, regardless of whether the underlying item set is empty

#### Scenario: Non-empty result set never triggers the renderer

- **WHEN** the filtered/tab-scoped item set has at least one item
- **THEN** `Catalog` renders `CardGrid`/`ListView` with those items normally and does not call `renderEmptyState`

#### Scenario: Empty result set after loading triggers the renderer

- **WHEN** `isLoading` is not `true` and the filtered/tab-scoped item set has zero items and `renderEmptyState` is supplied
- **THEN** `Catalog` calls `renderEmptyState` with the current `CatalogEmptyStateContext`

### Requirement: Custom empty state renders in a single shared slot, never alongside the default empty state

When `renderEmptyState` is supplied and its result is a non-null, non-undefined `ReactNode` for the current empty state, `Catalog` SHALL render that node in place of both `CardGrid`'s and `ListView`'s own empty-state rendering, in the one content area shared by both view modes. `Catalog` SHALL NOT mount `CardGrid`'s or `ListView`'s built-in `PanelEmptyState` at the same time as the custom node, and SHALL NOT mount more than one instance of the custom node at a time, regardless of `viewMode` or whether the list view has ever been shown.

#### Scenario: Custom node fully replaces the default empty state

- **WHEN** `renderEmptyState` is supplied and returns a non-null node while the result set is empty
- **THEN** neither `CardGrid`'s nor `ListView`'s `PanelEmptyState` is rendered, and the returned node is rendered exactly once, regardless of the current `viewMode`

#### Scenario: Switching view mode does not duplicate the custom node

- **WHEN** the custom empty state is being rendered and the user switches `viewMode` between Grid and Cards (list)
- **THEN** exactly one instance of the custom node remains rendered before and after the switch

#### Scenario: Toolbar and surrounding chrome are unaffected

- **WHEN** the custom empty state is being rendered
- **THEN** the page heading, Create button, Favorites section, Toolbar (search, sort, filters), the tab row, and the details panel continue to render and behave exactly as they do when the default empty state is shown

### Requirement: Default empty state is preserved when the prop is absent or opts out

`Catalog` SHALL render its existing default empty-state behavior — `CardGrid`'s and `ListView`'s own `PanelEmptyState`, honoring `titles.noResultsTitle` and the existing default labels — whenever `renderEmptyState` is not supplied, or is supplied but returns `null` or `undefined` for the current empty state.

#### Scenario: Prop omitted

- **WHEN** `renderEmptyState` is not passed to `Catalog` and the result set is empty
- **THEN** `Catalog` renders exactly the default empty state it renders today, with no behavioral difference from before this change

#### Scenario: Prop returns null

- **WHEN** `renderEmptyState` is supplied and returns `null` for the current context while the result set is empty
- **THEN** `Catalog` falls back to rendering the default empty state for the active view

#### Scenario: Prop returns undefined

- **WHEN** `renderEmptyState` is supplied and returns `undefined` for the current context while the result set is empty
- **THEN** `Catalog` falls back to rendering the default empty state for the active view

#### Scenario: `titles.noResultsTitle` still applies to the default fallback

- **WHEN** `renderEmptyState` is supplied but returns `null`, a search query is active, and `titles.noResultsTitle` is supplied
- **THEN** the fallback default empty state shows the title produced by `titles.noResultsTitle(query)`, unchanged from current behavior

### Requirement: Custom empty state context reflects live, resolved search/filter/tab state

The `CatalogEmptyStateContext` passed to `renderEmptyState` SHALL reflect `Catalog`'s actually-resolved values at call time: `query` is the current search text; `activeTab` is the currently active tab id, or an empty string when there is no active tab; `hasTopicFilters` is `true` exactly when at least one Topics filter value is currently selected; `isMyAppsActive` is the current state of the "My Apps" toggle. These values SHALL reflect the effective value regardless of whether each is managed internally by `Catalog` or externally controlled by the host through the corresponding controlled prop (`activeTab`/`onActiveTabChange`, `filterTopics`/`onFilterTopicsChange`, `isMyAppsActive`/`onMyAppsActiveChange`).

#### Scenario: Context reflects internally-managed state

- **WHEN** `Catalog` manages `query`, `activeTab`, topic filters, and `isMyAppsActive` internally (no controlled props passed) and the result set is empty
- **THEN** the `CatalogEmptyStateContext` passed to `renderEmptyState` matches the current internal values of each field

#### Scenario: Context reflects externally-controlled state

- **WHEN** the host passes `activeTab`, `filterTopics`, and `isMyAppsActive` as controlled props and the result set is empty
- **THEN** the `CatalogEmptyStateContext` passed to `renderEmptyState` matches the host-controlled values, not any stale internal default

#### Scenario: No active tab yields an empty string

- **WHEN** `Catalog` resolves no active tab (e.g. `tabs` is empty)
- **THEN** `CatalogEmptyStateContext.activeTab` is `''`

#### Scenario: Context updates when the query, tab, filters, or My Apps toggle change

- **WHEN** the result set is and remains empty across a change to the search query, the active tab, the selected topic filters, or the My Apps toggle
- **THEN** each subsequent call to `renderEmptyState` receives a `CatalogEmptyStateContext` reflecting the new values

#### Scenario: Custom empty state disappears once results appear

- **WHEN** the result set transitions from empty to non-empty (e.g. a filter is cleared or new items load)
- **THEN** `Catalog` stops calling `renderEmptyState` and renders `CardGrid`/`ListView` with the results instead

### Requirement: Standalone `CardGrid` and `ListView` usage is unaffected

`CardGrid` and `ListView`, when used directly by a host outside of `Catalog` (per their existing exported, standalone usage), SHALL retain their current public API and SHALL continue to render their own built-in default empty state (`PanelEmptyState`) when given zero items — this change SHALL NOT add a `renderEmptyState` prop, or any other new prop, to `CardGridProps` or `ListViewProps`.

#### Scenario: CardGrid used standalone still shows its default empty state

- **WHEN** a host renders `CardGrid` directly (not through `Catalog`) with an empty `items` array
- **THEN** `CardGrid` renders its existing `PanelEmptyState` exactly as before this change, and `CardGridProps` exposes no new prop

#### Scenario: ListView used standalone still shows its default empty state

- **WHEN** a host renders `ListView` directly (not through `Catalog`) with an empty `items` array
- **THEN** `ListView` renders its existing `PanelEmptyState` exactly as before this change, and `ListViewProps` exposes no new prop
