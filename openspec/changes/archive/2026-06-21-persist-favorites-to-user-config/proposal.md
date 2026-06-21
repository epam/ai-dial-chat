## Why

`onToggleFavorite` in `CatalogView` is a no-op — favorites are lost on every page refresh. The user config already has a `deployments.installed` store and a `PATCH /api/v1/user-config/deployments` endpoint; we just need to wire the frontend so toggling a catalog favorite persists to that store and is restored on next load.

## What Changes

- **Frontend — `CatalogView`**: `onToggleFavorite(id, isFavorite)` now calls `updateInstalledDeployment` and updates local state; initial favorites are loaded from `GET /api/v1/user-config` on mount.
- **Frontend — `mapDeploymentToCatalogItem`**: accepts an explicit `favoriteIds: ReadonlySet<string>` parameter instead of reading `deployment.isInstalled` from the DTO, so the catalog UI reflects the user's own preference rather than whatever the API happens to return.
- **Frontend — loading/error states**: `CatalogView` shows a disabled state while the user config is loading and handles optimistic updates with rollback on API failure.
- **No backend changes**: all required endpoints (`GET /api/v1/user-config`, `PATCH /api/v1/user-config/deployments`) already exist.

## Capabilities

### New Capabilities

- `catalog-favorites-persistence`: Persists catalog application favorites to user config, loads them on mount, and propagates toggling through the existing `PATCH /api/v1/user-config/deployments` endpoint.

### Modified Capabilities

_(none — existing endpoint behavior is unchanged)_

## Impact

- `apps/chat/src/components/CatalogView/CatalogView.tsx` — adds user config loading + toggle handler
- `apps/chat/src/utils/map-deployment-to-catalog-item.ts` — signature change (accepts `favoriteIds`)
- `apps/chat/src/server-api/user-config.api.ts` — already exports both required helpers; no change needed
- No backend files changed
