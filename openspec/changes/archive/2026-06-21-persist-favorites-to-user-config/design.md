## Context

`CatalogView` renders a `<Catalog>` component with `onToggleFavorite(id, isFavorite)` and `favorites` / `items` props. Currently `onToggleFavorite` is a no-op and `isUserFavorite` on each catalog item is derived from `deployment.isInstalled` — a field returned by the DIAL Core deployments API that does not reflect the user's personal preference.

The backend already stores personal favorites in `UserConfig.deployments.installed` (a `string[]` of deployment IDs). Two endpoints already exist:
- `GET /api/v1/user-config` — returns the full config including `deployments.installed`
- `PATCH /api/v1/user-config/deployments` — adds or removes one ID from `deployments.installed`

Both are wrapped in `apps/chat/src/server-api/user-config.api.ts` as `getUserConfig()` and `updateInstalledDeployment(id, isInstalled)`.

No backend work is needed.

## Goals / Non-Goals

**Goals:**
- `onToggleFavorite` persists the new state to `PATCH /api/v1/user-config/deployments` and updates local UI immediately (optimistic update with rollback on failure).
- On mount `CatalogView` loads `GET /api/v1/user-config` and seeds the favorites set from `deployments.installed`.
- `mapDeploymentToCatalogItem` derives `isUserFavorite` from the loaded favorites set instead of `deployment.isInstalled`.

**Non-Goals:**
- No new backend endpoints.
- No change to the `DeploymentsContext` shape — it continues to provide raw deployment items only.
- No optimistic persistence to `localStorage` (DIAL Core is the source of truth).
- No real-time multi-tab sync.

## Decisions

### 1. Favorites state lives in `CatalogView`, not in `DeploymentsContext`

`DeploymentsContext` is shared by the conversation model selector and other consumers that have no interest in favorites. Putting favorites state there would widen its API surface and force every consumer to re-render on toggle.

A local `useState<Set<string>>` inside `CatalogView` is sufficient — the catalog page is the only consumer, and the state scope matches the feature scope.

**Alternative considered**: A new `FavoritesContext` shared across the app. Rejected — there is no cross-route consumer today; this can be promoted to context if needed later.

### 2. Load user config inside `CatalogView` via a dedicated `useFavoriteApplications` hook

Following the project hook pattern (`useFavicon.ts` as reference): a custom hook in `apps/chat/src/hooks/` with `useEffect` + cancelled flag, exposing `{ favoriteIds, isLoading, toggleFavorite }`.

This keeps `CatalogView` clean and makes the hook independently testable.

**Alternative**: inline `useEffect` in the component. Rejected — mixing fetch logic with render logic, harder to test.

### 3. Optimistic update + rollback

On toggle: update the `Set<string>` state immediately, fire the API call, and on failure restore the previous set. This keeps the UI snappy and avoids a full re-fetch after every star click.

### 4. `mapDeploymentToCatalogItem` signature change: add `favoriteIds: ReadonlySet<string>`

Currently uses `deployment.isInstalled` from the DTO, which reflects a DIAL Core field, not user preference. The function becomes a pure mapper with explicit input.

Callers pass the set from the hook. Any existing call sites that don't pass favorites can default to an empty set (none currently rely on `isInstalled` for another purpose).

Both `isUserFavorite` and `isStarred` are set from `favoriteIds.has(deployment.id)`. `isUserFavorite` drives CatalogView's split of items into the browse and favorites sections; `isStarred` drives `Card.initialIsStarred` inside the catalog library's `CardRowRenderer`.

### 5. `UpdateInstalledDto.id` regex relaxed

Real deployment IDs contain characters outside the original `@Matches(/^[\w\-./@]+$/)` allowlist — specifically `:` (e.g. `anthropic.claude-opus-4:0`). The constraint is changed to `@Matches(/^\S+$/)` (no whitespace) so any valid non-whitespace ID is accepted.

This is a pure validation fix; no schema or storage changes are required.

### 6. RTL / responsive

The `<Catalog>` component from `@epam/ai-dial-catalog` owns its own layout. `CatalogView` adds no new layout of its own, so no RTL or breakpoint changes are needed in this slice.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Stale favorites if user has two tabs open | Accepted — no real-time sync; page refresh restores latest state |
| `PATCH` fails silently after optimistic update | Rollback to previous `Set` on rejection; UI reverts to pre-toggle state |
| Cold-load flicker: items appear unfavorited before config loads | `isLoading` from the hook gates `onToggleFavorite` (button disabled) but items still render; star icons are in their default (unfavorited) state for ~1 round-trip |

## Migration Plan

No data migration needed — `deployments.installed` already persists correctly. Existing users' stored favorites are immediately respected because the hook reads from the same field on first load.

Rollback: revert `CatalogView.tsx` and `map-deployment-to-catalog-item.ts` only.

## Open Questions

_(none blocking implementation)_
