## MODIFIED Requirements

### Requirement: `Catalog` accepts an optional custom empty-state renderer

`CatalogProps` SHALL include an optional property `renderEmptyState?: (context: CatalogEmptyStateContext) => ReactNode`.

`@epam/ai-dial-catalog`'s root entry point SHALL export a `CatalogEmptyStateContext` interface with exactly these fields:

- `query: string`
- `activeTab: string`
- `hasTopicFilters: boolean`
- `folderSelection: CatalogFolderSelection`

This is a UI-only, client-side prop:

- it introduces no new backend endpoint;
- it adds no new i18n keys inside the library, which performs no translation;
- it adds no new feature-flag gating;
- RTL impact is none, since the library renders no text or layout of its own for this prop, only the `ReactNode` the host's callback returns.

#### Scenario: Prop and type are part of the public API

- **WHEN** a consumer imports from `@epam/ai-dial-catalog`
- **THEN** `CatalogEmptyStateContext` is importable as a named type export, and `CatalogProps['renderEmptyState']` type-checks against a function of signature `(context: CatalogEmptyStateContext) => ReactNode`

### Requirement: Custom empty state renders only when the displayed result set is empty and loading has finished

`Catalog` SHALL invoke `renderEmptyState` only when `isLoading` is not true and the item set the active view (`CardGrid` or `ListView`) would receive has zero items. That item set is the one left after search, topic, folder and active-tab filtering.

#### Scenario: Loading takes precedence

- **WHEN** `isLoading` is `true`
- **THEN** `Catalog` renders its loading state and does not call `renderEmptyState`, whether or not the underlying item set is empty

#### Scenario: Non-empty result set never triggers the renderer

- **WHEN** the filtered, tab-scoped item set has at least one item
- **THEN** `Catalog` renders `CardGrid` or `ListView` with those items as usual and does not call `renderEmptyState`

#### Scenario: Empty result set after loading triggers the renderer

- **WHEN** `isLoading` is not `true`, the filtered, tab-scoped item set has zero items, and `renderEmptyState` is supplied
- **THEN** `Catalog` calls `renderEmptyState` with the current `CatalogEmptyStateContext`

### Requirement: Custom empty state context reflects live, resolved search/filter/tab state

The `CatalogEmptyStateContext` passed to `renderEmptyState` SHALL reflect the values `Catalog` has actually resolved at call time:

- `query` is the current search text.
- `activeTab` is the active tab id, or an empty string when there is no active tab.
- `hasTopicFilters` is `true` exactly when at least one Topics filter value is selected.
- `folderSelection` is the current folder selection, `{ path: [] }` for All entities.

Each value SHALL be the effective one, whether `Catalog` manages it internally or the host controls it through the matching controlled prop: `activeTab`/`onActiveTabChange`, `filterTopics`/`onFilterTopicsChange`, or `folderSelection`/`onFolderSelectionChange`.

#### Scenario: Context reflects internally-managed state

- **WHEN** `Catalog` manages `query`, `activeTab`, the topic filters and the folder selection internally (no controlled props passed) and the result set is empty
- **THEN** the `CatalogEmptyStateContext` passed to `renderEmptyState` matches the current internal value of each field

#### Scenario: Context reflects externally-controlled state

- **WHEN** the host passes `activeTab`, `filterTopics` and `folderSelection` as controlled props and the result set is empty
- **THEN** the `CatalogEmptyStateContext` passed to `renderEmptyState` matches the host-controlled values, not a stale internal default

#### Scenario: No active tab yields an empty string

- **WHEN** `Catalog` resolves no active tab (for example, `tabs` is empty)
- **THEN** `CatalogEmptyStateContext.activeTab` is `''`

#### Scenario: Context updates when the query, tab, filters, or folder change

- **WHEN** the result set is and stays empty across a change to the search query, the active tab, the selected topic filters or the folder selection
- **THEN** each later call to `renderEmptyState` receives a `CatalogEmptyStateContext` with the new values

#### Scenario: Custom empty state disappears once results appear

- **WHEN** the result set goes from empty to non-empty (for example, a filter is cleared or new items load)
- **THEN** `Catalog` stops calling `renderEmptyState` and renders `CardGrid` or `ListView` with the results
