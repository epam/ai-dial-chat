## MODIFIED Requirements

### Requirement: CatalogView wires onToggleFavorite through useFavoriteApplications

`CatalogView` SHALL use `useFavoriteApplications` to obtain `favoriteIds`,
`isLoading`, and `toggleFavorite`.

- `catalogItems` SHALL be derived via `useMemo` passing `favoriteIds` to
  `mapDeploymentToCatalogItem`.
- `onToggleFavorite` SHALL resolve the item's `FavoriteEntityType` from its
  catalog type and call `toggleFavorite(id, isFavorite, entityType)`.
- `onToggleFavorite` SHALL be disabled (no-op) while the catalog's combined
  loading state is `true` — favorites are only one of its inputs.
- `onToggleFavorite` SHALL report the outcome: a success notification on both
  add and remove, and on rejection an error notification carrying the trace id
  from the failed request. It SHALL NOT re-throw.
- The `Catalog` component SHALL receive the updated `items` and `favorites`
  derived from the live `favoriteIds` set.
- `favorites` SHALL be computed through the pure
  `deriveFavoriteItems(visibleCatalogItems)` helper from
  `@epam/ai-dial-chat-hooks`. The helper SHALL select `isUserFavorite` items in
  input order and SHALL NOT own, load, persist, or mutate favorite state.

Memoisation: `catalogItems`, `favorites`, and `filteredItems` SHALL be wrapped in
`useMemo`; `onToggleFavorite` SHALL be wrapped in `useCallback`.

Feature flag: none required.

RTL impact: none (the `Catalog` component owns its own layout).

Accessibility: `onToggleFavorite` is invoked by `Catalog`'s own toggle control;
no additional ARIA attributes are needed in `CatalogView`.

#### Scenario: Toggling a favorite updates the catalog display immediately

- **WHEN** the user toggles the favorite star on item `'app-1'`
- **THEN** the item moves to the `favorites` section before the API call resolves

#### Scenario: API failure reverts the display

- **WHEN** the user toggles `'app-1'` and persistence rejects
- **THEN** the item returns to the non-favorites section

#### Scenario: Toggle is disabled while loading

- **WHEN** the catalog's combined loading state is `true`
- **THEN** calling `onToggleFavorite` does nothing and no API call is made

#### Scenario: Both toggle directions are confirmed

- **WHEN** a favourite is added, and separately removed, and both persist
- **THEN** a success notification is shown in each case

#### Scenario: A failed toggle surfaces a trace id

- **WHEN** the persistence call rejects
- **THEN** an error notification carries the request trace id and nothing is
  re-thrown to the catalog

#### Scenario: Derivation reuses the live multi-entity flags

- **WHEN** visible model, toolset, prompt, and skill items have
  `isUserFavorite: true`
- **THEN** `deriveFavoriteItems` includes all of them without replacing the
  provider or dispatching any persistence request
