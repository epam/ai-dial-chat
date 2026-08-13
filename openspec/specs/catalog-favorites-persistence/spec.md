# Spec: catalog-favorites-persistence

## Purpose

Persisting a user's catalog favorites and wiring the toggle through `CatalogView`.

## Requirements

### Requirement: useFavoriteApplications hook loads and persists favorites

A custom hook `useFavoriteApplications` SHALL be created at `apps/chat/src/hooks/useFavoriteApplications/useFavoriteApplications.ts`.

The hook SHALL:
- On mount, call `getUserConfig()` from `apps/chat/src/server-api/user-config.api.ts` and seed `favoriteIds` from `config.deployments.installed`.
- Use a `cancelled` flag inside `useEffect` to prevent `setState` after unmount.
- Expose `favoriteIds: ReadonlySet<string>`, `isLoading: boolean`, and `toggleFavorite(id: string, isFavorite: boolean): void`.
- `toggleFavorite` applies an optimistic local update to `favoriteIds`, calls `updateInstalledDeployment(id, isFavorite)`, and on rejection restores the previous `favoriteIds`.
- Be idempotent: calling `toggleFavorite` while a previous call for the same ID is in-flight does not duplicate state.

The hook SHALL NOT call `useTranslation`, read route params, access `localStorage`, or import from `apps/chat-api/**`.

i18n keys needed: none (hook has no user-visible strings).

RTL impact: none.

#### Scenario: Favorites load from user config on mount

- **WHEN** the hook mounts and `getUserConfig()` resolves with `{ deployments: { installed: ['app-1', 'app-2'] } }`
- **THEN** `favoriteIds` is `Set { 'app-1', 'app-2' }` and `isLoading` is `false`

#### Scenario: isLoading is true during the initial fetch

- **WHEN** the hook is first rendered and `getUserConfig()` has not yet resolved
- **THEN** `isLoading` is `true`

#### Scenario: Unmount before fetch completes — no state update

- **WHEN** the hook unmounts before `getUserConfig()` resolves
- **THEN** `setState` is not called (cancelled flag prevents it)

#### Scenario: getUserConfig failure — isLoading false, empty set

- **WHEN** `getUserConfig()` rejects
- **THEN** `isLoading` is `false` and `favoriteIds` is an empty `Set`

#### Scenario: toggleFavorite adds an ID optimistically

- **WHEN** `toggleFavorite('app-3', true)` is called while `favoriteIds` does not contain `'app-3'`
- **THEN** `favoriteIds` immediately contains `'app-3'` before the API call resolves

#### Scenario: toggleFavorite removes an ID optimistically

- **WHEN** `toggleFavorite('app-1', false)` is called while `favoriteIds` contains `'app-1'`
- **THEN** `favoriteIds` immediately does NOT contain `'app-1'` before the API call resolves

#### Scenario: API failure rolls back the optimistic update

- **WHEN** `toggleFavorite('app-3', true)` is called and `updateInstalledDeployment` rejects
- **THEN** `favoriteIds` is restored to the state it was in before the toggle

---

### Requirement: mapDeploymentToCatalogItem accepts explicit favoriteIds

`mapDeploymentToCatalogItem` in `apps/chat/src/utils/map-deployment-to-catalog-item.ts` SHALL accept a second parameter `favoriteIds: ReadonlySet<string>` (default: empty set) and set both `isUserFavorite` and `isStarred` to `favoriteIds.has(deployment.id)` instead of reading `deployment.isInstalled`.

- `isUserFavorite` is used by `CatalogView` to split items into the browse and favorites sections.
- `isStarred` is used by the catalog library's `CardRowRenderer` as `Card.initialIsStarred`; without it the browse cards always initialise with an unfilled star regardless of the current favorites state.

The `deployment.isInstalled` field SHALL no longer be referenced inside this function.

RTL impact: none.

#### Scenario: isUserFavorite and isStarred are true when id is in favoriteIds

- **WHEN** `mapDeploymentToCatalogItem(deployment, new Set(['dep-1']))` is called with `deployment.id === 'dep-1'`
- **THEN** the returned item has `isUserFavorite: true` and `isStarred: true`

#### Scenario: isUserFavorite and isStarred are false when id is not in favoriteIds

- **WHEN** `mapDeploymentToCatalogItem(deployment, new Set(['dep-2']))` is called with `deployment.id === 'dep-1'`
- **THEN** the returned item has `isUserFavorite: false` and `isStarred: false`

#### Scenario: isUserFavorite and isStarred are false with empty favoriteIds

- **WHEN** `mapDeploymentToCatalogItem(deployment, new Set())` is called
- **THEN** the returned item has `isUserFavorite: false` and `isStarred: false` regardless of `deployment.isInstalled`

---

### Requirement: UpdateInstalledDto accepts any non-whitespace deployment ID

`UpdateInstalledDto.id` in `apps/chat-api/src/user-config/dto/update-installed.dto.ts` SHALL be validated with `@Matches(/^\S+$/)`. Real deployment IDs can contain `:` and other characters outside the previous `/^[\w\-./@]+$/` allowlist (e.g. `anthropic.claude-opus-4:0`). The only structural constraint on a deployment ID is that it contains no whitespace.

See also: `user-config-deployment-management/spec.md` — the DTO and endpoint are defined there; this requirement records the constraint change that unblocked catalog favorites.

#### Scenario: ID with colon is accepted

- **WHEN** `PATCH /api/v1/user-config/deployments` is called with `{ "id": "anthropic.claude-opus-4:0", "isInstalled": true }`
- **THEN** the response is 204

#### Scenario: ID with whitespace is rejected

- **WHEN** `PATCH /api/v1/user-config/deployments` is called with `{ "id": "has space", "isInstalled": true }`
- **THEN** the response is 400

---

### Requirement: CatalogView wires onToggleFavorite through useFavoriteApplications

`CatalogView` SHALL use `useFavoriteApplications` to obtain `favoriteIds`, `isLoading`, and `toggleFavorite`.

- `catalogItems` SHALL be derived via `useMemo` passing `favoriteIds` to `mapDeploymentToCatalogItem`.
- `onToggleFavorite` SHALL call `toggleFavorite(id, isFavorite)`.
- `onToggleFavorite` SHALL be disabled (no-op) while `isLoading` is `true`.
- The `Catalog` component SHALL receive the updated `items` and `favorites` derived from the live `favoriteIds` set.

Memoisation: `catalogItems`, `favorites`, and `filteredItems` SHALL be wrapped in `useMemo`; `onToggleFavorite` SHALL be wrapped in `useCallback`.

Feature flag: none required.

RTL impact: none (the `Catalog` component owns its own layout).

Accessibility: `onToggleFavorite` is invoked by `Catalog`'s own toggle control; no additional ARIA attributes needed in `CatalogView`.

#### Scenario: Toggling a favorite updates the catalog display immediately

- **WHEN** the user toggles the favorite star on item `'app-1'`
- **THEN** the item moves to the `favorites` section before the API call resolves

#### Scenario: API failure reverts the display

- **WHEN** the user toggles `'app-1'` and `updateInstalledDeployment` rejects
- **THEN** the item returns to the `items` (non-favorites) section

#### Scenario: Toggle is disabled while loading

- **WHEN** `isLoading` is `true`
- **THEN** calling `onToggleFavorite` does nothing and no API call is made
