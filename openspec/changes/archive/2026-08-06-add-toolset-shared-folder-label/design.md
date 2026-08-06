## Context

`resolveToolsetFolder` and `resolveDeploymentFolder` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) both derive a `CatalogItem.folder: string[]` used to render a folder/path label in the Catalog details panel header. `resolveDeploymentFolder` has three branches — Personal (`isMy`), Shared (`sharedWithMe`), Public — each substituting a localized label for the raw bucket/root segment. `resolveToolsetFolder` only has Personal and Public branches; a shared, non-public toolset falls through to a bare `segments.slice(1)`, which drops the bucket segment without substituting any label, so the details panel shows no folder text at all for shared toolsets whose remaining path is empty.

## Goals / Non-Goals

**Goals:**
- Shared toolsets show a translated "Shared" folder label, matching shared applications' behavior.

**Non-Goals:**
- Any change to `resolveDeploymentFolder` or the application folder-resolution path (already correct).
- Any change to how `sharedWithMe` is computed or transmitted from the backend.

## Decisions

Add a `toolset.sharedWithMe` branch to `resolveToolsetFolder`, placed after the `isMy` check and before the raw-segment computation needs to happen (mirroring `resolveDeploymentFolder`'s branch ordering: Personal → Shared → Public → raw). Since `segments` (the parsed/stripped path) is needed for both the Shared and Public branches, the branch checks `toolset.sharedWithMe` after `segments` is computed, then returns `[t(CatalogI18nKeys.FolderShared), ...segments.slice(1)]` before the existing Public check, matching the deployment-side precedence (checked before Public, since a bucket segment is never literally `"public"` for a truly shared item in practice, but following the same order keeps the two functions structurally parallel and easy to compare).

Alternative considered: guard the Shared branch on `t != null` the way the existing Personal/Public branches do (since `t` is optional on this function). Rejected for the same reason as the sibling change `fix-deployment-folder-bucket-id-leak` — but this function's `t` param stays optional here (unlike `mapDeploymentToCatalogItem`'s `t`) because `mapToolsetToCatalogItem`'s only call site (`CatalogView.tsx`) always supplies `t`, and no un-decoded/un-prefixed raw segment can leak from this function regardless of `t` (verified in the prior change) — so keeping the guard on the new branch, consistent with the two existing branches, does not reintroduce that risk.

## Risks / Trade-offs

[Existing tests hard-coding `resolveToolsetFolder` behavior for a shared, non-public toolset] → none found currently exercise this exact case; new test added to cover it.
