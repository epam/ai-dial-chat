## ADDED Requirements

### Requirement: `useFavoriteEntitiesState` reproduces `FavoriteApplicationsContext`'s aggregate-load-then-optimistic-toggle behavior

`@epam/ai-dial-chat-hooks` SHALL export `useFavoriteEntitiesState(params: { loadFavorites: () =>
Promise<{ deployments: string[]; toolsets: string[]; prompts: string[]; skills: string[] }>;
updateFavorite: (id: string, isFavorite: boolean, entityType: FavoriteEntityType) => Promise<void> })`
returning `{ favoriteIds: ReadonlySet<string>, isLoading: boolean, toggleFavorite: (id: string, isFavorite:
boolean, entityType?: FavoriteEntityType) => Promise<void> }`. `FavoriteEntityType` (`Deployment` /
`Toolset` / `Prompt` / `Skill`) SHALL be exported from `@epam/ai-dial-chat-hooks`. The hook SHALL NOT
import a `server-api` module or any application Context.

#### Scenario: Hook has no server-api or context import
- **WHEN** `libs/chat-hooks` is linted and type-checked
- **THEN** `useFavoriteEntitiesState`'s source file contains no import from an app `server-api` module or
  an application Context

### Requirement: Initial load unions all four id categories into one set

On mount, the hook SHALL call `loadFavorites()` once and, on success, set `favoriteIds` to the union of
its four returned id arrays.

#### Scenario: Loaded ids from all four categories are unioned
- **WHEN** `loadFavorites` resolves with `{ deployments: ["d1"], toolsets: ["t1"], prompts: ["p1"],
  skills: ["s1"] }`
- **THEN** `favoriteIds` is `Set(["d1", "t1", "p1", "s1"])`

### Requirement: Load failure falls back to an empty set silently

If `loadFavorites()` rejects, the hook SHALL leave `favoriteIds` at its default empty set and SHALL NOT
expose any error state — matching the current context's silent-fallback behavior; there is no `error`
field in this hook's result.

#### Scenario: Load failure yields an empty set with no error surfaced
- **WHEN** `loadFavorites()` rejects
- **THEN** `favoriteIds` is an empty set, `isLoading` becomes `false`, and the hook's result has no error
  field to inspect

### Requirement: Cancellation protection on unmount

The hook SHALL guard both its success and failure branches, and the `finally`-style `isLoading` update,
against a component unmounting before the initial load settles.

#### Scenario: Unmounting before load settles causes no post-unmount state update
- **WHEN** the consuming component unmounts before `loadFavorites` resolves or rejects
- **THEN** no state setter is called after unmount

### Requirement: `toggleFavorite` is optimistic with exact-inverse rollback on failure

`toggleFavorite(id, isFavorite, entityType = FavoriteEntityType.Deployment)` SHALL first apply the
membership change to `favoriteIds` optimistically (add when `isFavorite` is `true`, delete when `false`),
then call `updateFavorite(id, isFavorite, entityType)`. On failure, the hook SHALL apply the exact inverse
of the optimistic change (delete when `isFavorite` was `true`, add when it was `false`) and SHALL
re-throw the original error so the caller can react (e.g. show a notification) — the hook itself SHALL
NOT swallow the error.

#### Scenario: Optimistic add is visible before persistence resolves
- **WHEN** `toggleFavorite("id-1", true)` is called
- **THEN** `favoriteIds` contains `"id-1"` before `updateFavorite`'s promise settles

#### Scenario: Persistence failure rolls back exactly to the pre-toggle state
- **GIVEN** `favoriteIds` does not contain `"id-1"`
- **WHEN** `toggleFavorite("id-1", true, FavoriteEntityType.Prompt)` is called and `updateFavorite`
  rejects
- **THEN** `favoriteIds` no longer contains `"id-1"` after the rejection, and the rejection is re-thrown to
  the caller

#### Scenario: Default entity type is Deployment
- **WHEN** `toggleFavorite(id, isFavorite)` is called without an `entityType`
- **THEN** `updateFavorite` is called with `FavoriteEntityType.Deployment`

### Requirement: Stable memoized result and callback identity

The hook's returned object SHALL be memoized, and `toggleFavorite` SHALL have a stable identity across
renders (empty dependency array).

#### Scenario: Two consumers under one provider share state
- **GIVEN** two components each call the hook (or, at the app layer, `useFavoriteApplications()`) backed
  by the same provider instance
- **WHEN** one toggles a favorite
- **THEN** the change is visible to the other consumer

### Requirement: `FavoriteApplicationsContext` becomes a thin wrapper, and its entity-type-to-mutator mapping stays app-owned

`apps/chat/src/context/FavoriteApplicationsContext.tsx` SHALL call `useFavoriteEntitiesState({
loadFavorites, updateFavorite })`, where `loadFavorites` wraps `getUserConfig()` and `updateFavorite`
dispatches to `updateInstalledDeployment`/`updateInstalledToolset`/`updateInstalledPrompt`/
`updateInstalledSkill` based on `entityType` (the existing `INSTALL_BY_ENTITY_TYPE` map), and SHALL
expose the hook's result unchanged through the existing `FavoriteApplicationsContextType` interface.

#### Scenario: Existing consumers see no interface change
- **WHEN** `CatalogView`, `usePromptSelectorOverlay`, `useDeploymentSelectorOverlay`, or
  `useDeploymentSelectorFieldOverlay` calls `useFavoriteApplications()`
- **THEN** the returned shape and behavior match `FavoriteApplicationsContextType` exactly as before this
  change
