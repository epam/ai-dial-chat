## ADDED Requirements

### Requirement: Shared toolset folder is localized, not silently dropped

`resolveToolsetFolder` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) SHALL return `[t(CatalogI18nKeys.FolderShared), ...segments.slice(1)]` when `toolset.sharedWithMe` is true and the toolset is neither owned by the current user (`isMy`) nor rooted under the `public` segment, where `segments` is the toolset's path parsed via `stripPrefixSegments(raw, TOOLSETS_PREFIX).slice(0, -1)`.

This SHALL mirror `resolveDeploymentFolder`'s existing `sharedWithMe` branch for applications, so a shared toolset never renders an empty folder label when its remaining path segments (after dropping the owner bucket) are empty.

#### Scenario: Shared toolset with no nested folder shows the translated Shared label

- **WHEN** `mapToolsetToCatalogItem` maps a toolset with `sharedWithMe: true`, `isMy: false`, and `toolset: "toolsets/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/my-toolset__0.0.1"`
- **THEN** the resulting `CatalogItem.folder` is `[t(CatalogI18nKeys.FolderShared)]`, not `[]`

#### Scenario: Shared toolset with a nested folder shows the translated Shared label plus the nested path

- **WHEN** `mapToolsetToCatalogItem` maps a toolset with `sharedWithMe: true`, `isMy: false`, and `toolset: "toolsets/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/team/my-toolset__0.0.1"`
- **THEN** the resulting `CatalogItem.folder` is `[t(CatalogI18nKeys.FolderShared), "team"]`, and does not contain the raw bucket ID `"8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW"`
