# Spec: catalog-favorites-persistence

## Purpose

Persisting a user's catalog favorites and wiring the toggle through `CatalogView`.

## Requirements

### Requirement: Favorites are shared app state, loaded and persisted by one provider

Favorites SHALL live in a context at `apps/chat/src/context/FavoriteApplicationsContext.tsx`, whose `FavoriteApplicationsProvider` is mounted once near the app root and whose `useFavoriteApplications` consumer throws when used outside it.

A per-call-site hook is explicitly the wrong shape here: the catalog and the in-chat model selector both read and mutate favorites, and independent hook instances would leave one of them showing stale stars until a full page reload.

The provider SHALL:
- On mount, call `getUserConfig()` from `apps/chat/src/server-api/user-config.api.ts` and seed `favoriteIds` with the **union** of `config.deployments.installed`, `config.toolsets.installed`, `config.prompts.installed`, and `config.skills.installed` — favorites are one flat id set spanning every favouritable entity kind, not a deployments-only list.
- Use a `cancelled` flag inside `useEffect` to prevent `setState` after unmount, clearing `isLoading` in a `finally` so a failed load still settles.
- Expose `favoriteIds: ReadonlySet<string>`, `isLoading: boolean`, and `toggleFavorite(id, isFavorite, entityType?): Promise<void>`.
- Dispatch the persistence call by `entityType` through a `Record<FavoriteEntityType, …>` lookup over `updateInstalledDeployment` / `updateInstalledToolset` / `updateInstalledPrompt` / `updateInstalledSkill`, defaulting to `FavoriteEntityType.Deployment` when the caller omits it.
- Apply an optimistic local update, then persist; on rejection undo exactly that one id with a functional `setFavoriteIds` update — adding back what it removed, or removing what it added — rather than restoring a captured snapshot, so a concurrent toggle of another id is not clobbered.
- Re-throw after rolling back, so the caller can surface the failure. `toggleFavorite` returning a promise is part of its contract.

Idempotency comes from set semantics rather than an in-flight guard: repeating the same toggle converges on the same set.

The provider SHALL NOT call `useTranslation`, read route params, access `localStorage`, or import from `apps/chat-api/**`.

i18n keys needed: none (hook has no user-visible strings).

RTL impact: none.

#### Scenario: Favorites load from user config on mount

- **WHEN** the provider mounts and `getUserConfig()` resolves with installed ids across several sections
- **THEN** `favoriteIds` is the union of every section's `installed` list and `isLoading` is `false`

#### Scenario: isLoading is true during the initial fetch

- **WHEN** the provider is first rendered and `getUserConfig()` has not yet resolved
- **THEN** `isLoading` is `true`

#### Scenario: Unmount before fetch completes — no state update

- **WHEN** the provider unmounts before `getUserConfig()` resolves
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

#### Scenario: API failure rolls back the optimistic update and re-throws

- **WHEN** `toggleFavorite('app-3', true)` is called and the persistence call rejects
- **THEN** `'app-3'` is removed again and the returned promise rejects, so the caller can report it

#### Scenario: A rollback does not clobber a concurrent toggle

- **WHEN** one toggle fails while another id was toggled in the meantime
- **THEN** only the failed id is reverted and the other id keeps its new state

#### Scenario: A non-deployment entity persists through its own endpoint

- **WHEN** `toggleFavorite` is called with `FavoriteEntityType.Toolset`
- **THEN** the toolset install endpoint is called, not the deployment one

#### Scenario: Using the consumer outside the provider throws

- **WHEN** `useFavoriteApplications()` is called with no `FavoriteApplicationsProvider` above it
- **THEN** it throws a descriptive error

---

### Requirement: mapDeploymentToCatalogItem accepts explicit favoriteIds

`mapDeploymentToCatalogItem` (`libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`) SHALL read `favoriteIds: ReadonlySet<string>` from its options object (default: empty set) and set both `isUserFavorite` and `isStarred` to `favoriteIds.has(deployment.id)` instead of reading `deployment.isInstalled`. `mapToolsetToCatalogItem` in the same module SHALL derive both flags the same way from the same set — the set spans entity kinds, so every mapper consults it identically.

- `isUserFavorite` is used by `CatalogView` to split items into the browse and favorites sections.
- `isStarred` is used by the catalog library's `CardRowRenderer` as `Card.initialIsStarred`; without it the browse cards always initialise with an unfilled star regardless of the current favorites state.

The `deployment.isInstalled` field SHALL no longer be referenced inside this function.

RTL impact: none.

#### Scenario: isUserFavorite and isStarred are true when id is in favoriteIds

- **WHEN** `mapDeploymentToCatalogItem` is called with `favoriteIds: new Set(['dep-1'])` and `deployment.id === 'dep-1'`
- **THEN** the returned item has `isUserFavorite: true` and `isStarred: true`

#### Scenario: isUserFavorite and isStarred are false when id is not in favoriteIds

- **WHEN** `mapDeploymentToCatalogItem` is called with `favoriteIds: new Set(['dep-2'])` and `deployment.id === 'dep-1'`
- **THEN** the returned item has `isUserFavorite: false` and `isStarred: false`

#### Scenario: isUserFavorite and isStarred are false with empty favoriteIds

- **WHEN** `mapDeploymentToCatalogItem` is called with an empty `favoriteIds`
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
- `onToggleFavorite` SHALL resolve the item's `FavoriteEntityType` from its catalog type and call `toggleFavorite(id, isFavorite, entityType)`.
- `onToggleFavorite` SHALL be disabled (no-op) while the catalog's combined loading state is `true` — favorites are only one of its inputs.
- `onToggleFavorite` SHALL report the outcome: a success notification on both add and remove (removing a favourite is as successful as adding one), and on rejection an error notification carrying the trace id from the failed request. It SHALL NOT re-throw — the notification is the whole response.
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

- **WHEN** the catalog's combined loading state is `true`
- **THEN** calling `onToggleFavorite` does nothing and no API call is made

#### Scenario: Both toggle directions are confirmed

- **WHEN** a favourite is added, and separately removed, and both persist successfully
- **THEN** a success notification is shown in each case, worded for that direction

#### Scenario: A failed toggle surfaces a trace id

- **WHEN** the persistence call rejects
- **THEN** an error notification is shown carrying the failed request's trace id, and nothing is re-thrown to the catalog
