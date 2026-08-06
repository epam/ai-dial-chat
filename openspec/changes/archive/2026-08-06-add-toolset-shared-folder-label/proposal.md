## Why

A shared Toolset shows no folder/path label at all in the Catalog details panel ("About" header, below the name), while a shared Application correctly shows a translated "Shared" label there. Root cause: `resolveToolsetFolder` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) has no branch for `toolset.sharedWithMe`, unlike `resolveDeploymentFolder`, which explicitly returns `[t(CatalogI18nKeys.FolderShared), ...segments.slice(1)]` when `deployment.sharedWithMe` is true. For a shared toolset that isn't public and isn't owned by the current user, `resolveToolsetFolder` falls through to `segments.slice(1)`, silently dropping the bucket segment with no replacement label — if the toolset has no additional nested folder beyond its owner bucket, the result is an empty array and the details panel shows nothing where "Shared" should appear.

## What Changes

- Add a `sharedWithMe` branch to `resolveToolsetFolder`, mirroring `resolveDeploymentFolder`: when `toolset.sharedWithMe` is true, return `[t(CatalogI18nKeys.FolderShared), ...segments.slice(1)]` instead of falling through to the generic `segments.slice(1)` return.
- No change to the `isMy`/Personal branch, the `public` branch, or `mapDeploymentToCatalogItem`/`resolveDeploymentFolder` (already correct).

## Capabilities

### Modified Capabilities

- `deployment-catalog-item-mapping`: extends the existing `resolveToolsetFolder`-related mapping behavior (introduced alongside `resolveDeploymentFolder` in the prior `fix-deployment-folder-bucket-id-leak` change) to also localize the shared-toolset folder segment instead of silently dropping it.

## Impact

- `apps/chat/src/utils/map-deployment-to-catalog-item.ts` — `resolveToolsetFolder` gains a `sharedWithMe` branch.
- `apps/chat/src/utils/tests/map-deployment-to-catalog-item.spec.ts` — add test coverage for a shared toolset's folder label.
- No backend, API, or DTO changes — `DialToolsetDto.sharedWithMe` already exists and is already passed through by `mapToolsetToCatalogItem`.
