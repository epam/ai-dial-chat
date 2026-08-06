# deployment-catalog-item-mapping Specification

## Purpose
TBD - created by archiving change fix-deployment-folder-bucket-id-leak. Update Purpose after archive.
## Requirements
### Requirement: Deployment folder is always resolved through localized, decoded segments

`mapDeploymentToCatalogItem` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) SHALL accept a required `t: TFunction` parameter and SHALL derive the returned `CatalogItem.folder` value exclusively via `resolveDeploymentFolder(deployment, t)`. There SHALL be no code path in which `CatalogItem.folder` is derived from an un-decoded, un-prefix-stripped split of `deployment.applicationFolder`.

`resolveDeploymentFolder` SHALL continue to:
- Return `[t(CatalogI18nKeys.FolderPersonal)]` when `deployment.isMy` is true.
- Strip the `applications/` prefix from `deployment.applicationFolder` and percent-decode each path segment before use.
- Replace the first remaining segment with `t(CatalogI18nKeys.FolderShared)` when `deployment.sharedWithMe` is true, dropping that segment (the bucket ID) from the returned path.
- Replace the first remaining segment with `t(CatalogI18nKeys.FolderPublic)` when it case-insensitively equals `"public"`, dropping that segment from the returned path.

Every call site of `mapDeploymentToCatalogItem` SHALL supply `t` obtained from `useTranslation()` (or an equivalent `TFunction`), including both call sites in `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx`.

#### Scenario: Shared Quick App folder never exposes the raw bucket ID

- **WHEN** `useDeploymentSelectorOverlay` maps a deployment with `sharedWithMe: true` and `applicationFolder: "applications/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/appdata/quick-apps"` into a `CatalogItem` for the details panel
- **THEN** the resulting `CatalogItem.folder` is `[t(CatalogI18nKeys.FolderShared), "appdata", "quick-apps"]` and contains no segment equal to the raw bucket ID `"8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW"`

#### Scenario: Public app folder is localized, not raw

- **WHEN** a deployment with `sharedWithMe: false`, `isMy: false`, and `applicationFolder: "applications/public/my-folder"` is mapped
- **THEN** the resulting `CatalogItem.folder` is `[t(CatalogI18nKeys.FolderPublic), "my-folder"]`

#### Scenario: Personal app folder is localized

- **WHEN** a deployment with `isMy: true` is mapped, regardless of its `applicationFolder` value
- **THEN** the resulting `CatalogItem.folder` is `[t(CatalogI18nKeys.FolderPersonal)]`

#### Scenario: Compile-time enforcement that `t` is always supplied

- **WHEN** any code in `apps/chat/src` calls `mapDeploymentToCatalogItem` without passing a `t` argument
- **THEN** the TypeScript build fails, since `t` is a required (non-optional) parameter

### Requirement: Shared toolset folder is localized, not silently dropped

`resolveToolsetFolder` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) SHALL return `[t(CatalogI18nKeys.FolderShared), ...segments.slice(1)]` when `toolset.sharedWithMe` is true and the toolset is neither owned by the current user (`isMy`) nor rooted under the `public` segment, where `segments` is the toolset's path parsed via `stripPrefixSegments(raw, TOOLSETS_PREFIX).slice(0, -1)`.

This SHALL mirror `resolveDeploymentFolder`'s existing `sharedWithMe` branch for applications, so a shared toolset never renders an empty folder label when its remaining path segments (after dropping the owner bucket) are empty.

#### Scenario: Shared toolset with no nested folder shows the translated Shared label

- **WHEN** `mapToolsetToCatalogItem` maps a toolset with `sharedWithMe: true`, `isMy: false`, and `toolset: "toolsets/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/my-toolset__0.0.1"`
- **THEN** the resulting `CatalogItem.folder` is `[t(CatalogI18nKeys.FolderShared)]`, not `[]`

#### Scenario: Shared toolset with a nested folder shows the translated Shared label plus the nested path

- **WHEN** `mapToolsetToCatalogItem` maps a toolset with `sharedWithMe: true`, `isMy: false`, and `toolset: "toolsets/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/team/my-toolset__0.0.1"`
- **THEN** the resulting `CatalogItem.folder` is `[t(CatalogI18nKeys.FolderShared), "team"]`, and does not contain the raw bucket ID `"8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW"`

