# deployment-catalog-item-mapping Specification

## Purpose

Resolve application and toolset ownership and folder metadata into localized catalog folder paths.

## Requirements

### Requirement: Deployment folder is always resolved through localized, decoded segments

The app wrapper `mapDeploymentToCatalogItem` (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`) SHALL accept a required `t: TFunction` parameter, resolve `DeploymentFolderLabels` through `buildDeploymentFolderLabels(t)`, and delegate to the mapper in `libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`. The library mapper SHALL derive `CatalogItem.folder` exclusively via `resolveDeploymentFolder(deployment, folderLabels)`. The library SHALL consume resolved labels without importing app i18n or translation keys. There SHALL be no code path in which `CatalogItem.folder` is derived from an un-decoded, un-prefix-stripped split of `deployment.applicationFolder`.

`resolveDeploymentFolder` SHALL apply these rules in order:

- Return `[folderLabels.personal]` when `deployment.isMy` is true.
- Strip the `applications/` prefix from `deployment.applicationFolder` and percent-decode each path segment before use.
- Return `[folderLabels.shared, ...segments.slice(1)]` when `deployment.sharedWithMe` is true, dropping the owner bucket while preserving nested folders. With no folder metadata, return `[folderLabels.shared]`.
- Return `[folderLabels.public]` when the deployment type is `application` and the parsed folder path is empty. This covers configured applications whose plain IDs produce no `applicationFolder`.
- Replace the first remaining segment with `folderLabels.public` when it case-insensitively equals `"public"`, dropping that segment from the returned path.
- Otherwise return the decoded segments without inventing a root label for a model or an unspecified deployment type.

The app SHALL resolve `folderLabels.public` from `catalog.folder.public`, whose English value is `Organization`; Personal and Shared SHALL use the existing `catalog.folder.personal` and `catalog.folder.shared` translations. Folder labels SHALL be presentation data only and SHALL NOT change ownership, editability, sharing, or authentication flags. Existing card, list, and details renderers SHALL consume the same resolved `CatalogItem.folder`.

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

#### Scenario: Configured application without folder metadata shows Organization

- **GIVEN** an application with a plain ID such as `quickapps-files-demo-ah-copy` or `quickapps-files-demo-nt-copy`
- **AND** `applicationFolder` is absent or empty, and `isMy` and `sharedWithMe` are false or absent
- **WHEN** the app maps the deployment into a catalog item
- **THEN** its folder is `[t(CatalogI18nKeys.FolderPublic)]`, displayed as `Organization` in English

#### Scenario: Ownership labels take priority over the missing-folder fallback

- **WHEN** an application without folder metadata has `isMy: true`
- **THEN** its folder is `[t(CatalogI18nKeys.FolderPersonal)]`
- **AND** a non-owned application with `sharedWithMe: true` instead receives `[t(CatalogI18nKeys.FolderShared)]`

#### Scenario: Missing folder metadata does not classify a model as Organization

- **WHEN** a model deployment has no `applicationFolder` and neither ownership flag is true
- **THEN** its folder remains empty

#### Scenario: Compile-time enforcement that `t` is always supplied

- **WHEN** any code in `apps/chat/src` calls `mapDeploymentToCatalogItem` without passing a `t` argument
- **THEN** the TypeScript build fails, since `t` is a required (non-optional) parameter

### Requirement: Shared toolset folder is localized, not silently dropped

`mapToolsetToCatalogItem` in `libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts` SHALL resolve toolset folders from the effective identifier `toolset.toolset || toolset.id`. The app wrapper SHALL supply translated `folderLabels` when `t` is provided.

When labels are supplied, owned toolsets SHALL use `[folderLabels.personal]`. For non-owned shared toolsets, `resolveToolsetFolder` SHALL return `[folderLabels.shared, ...segments.slice(1)]` for a `toolsets/{bucket}/{path}` identifier, where `segments` excludes the final toolset name. For identifiers without the `toolsets/` prefix it SHALL return `[folderLabels.shared]`. Shared toolsets SHALL therefore retain their label even when no nested path is available.

#### Scenario: Shared toolset with no nested folder shows the translated Shared label

- **WHEN** `mapToolsetToCatalogItem` maps a toolset with `sharedWithMe: true`, `isMy: false`, and `toolset: "toolsets/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/my-toolset__0.0.1"`
- **THEN** the resulting `CatalogItem.folder` is `[t(CatalogI18nKeys.FolderShared)]`, not `[]`

#### Scenario: Shared toolset with a nested folder shows the translated Shared label plus the nested path

- **WHEN** `mapToolsetToCatalogItem` maps a toolset with `sharedWithMe: true`, `isMy: false`, and `toolset: "toolsets/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/team/my-toolset__0.0.1"`
- **THEN** the resulting `CatalogItem.folder` is `[t(CatalogI18nKeys.FolderShared), "team"]`, and does not contain the raw bucket ID `"8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW"`

#### Scenario: Shared toolset with a plain ID keeps its Shared label

- **WHEN** the app maps a toolset with `id: "salesforce"`, `toolset: "salesforce"`, `isMy: false`, and `sharedWithMe: true`
- **THEN** its folder is `[t(CatalogI18nKeys.FolderShared)]`

### Requirement: Configured toolsets without a resource path show Organization

When translated `folderLabels` are supplied and neither `isMy` nor `sharedWithMe` is true, the toolset mapper SHALL return `[folderLabels.public]` for a non-empty effective identifier containing no `/`. A `toolsets/public/{path}` identifier SHALL retain the Public label and its decoded nested folders. A path without the recognized `toolsets/` prefix SHALL NOT be classified as Organization solely because the prefix is missing.

When labels are omitted, the mapper SHALL preserve its existing behavior: no root label is added, and a plain ID produces an empty folder. No new translation key, feature flag, network request, or ownership/authentication inference SHALL be introduced for the folder label.

#### Scenario: Configured toolset with a plain ID shows Organization

- **WHEN** the app maps a non-owned, non-shared toolset with `id: "salesforce"` and `toolset: "salesforce"`
- **THEN** its folder is `[t(CatalogI18nKeys.FolderPublic)]`, displayed as `Organization` in English

#### Scenario: Empty toolset name falls back to the ID

- **WHEN** the same toolset has an empty `toolset` field and `id: "salesforce"`
- **THEN** its folder still uses the Organization label

#### Scenario: Owned toolset with a plain ID stays Personal

- **WHEN** the app maps a toolset with a plain ID and `isMy: true`
- **THEN** its folder is `[t(CatalogI18nKeys.FolderPersonal)]`

#### Scenario: Published toolset retains its nested path

- **WHEN** the app maps a non-owned, non-shared toolset with effective identifier `toolsets/public/QA%20team/salesforce`
- **THEN** its folder is `[t(CatalogI18nKeys.FolderPublic), "QA team"]`

#### Scenario: Unclassified resource path does not receive an Organization label

- **WHEN** a non-owned, non-shared toolset has effective identifier `owner-bucket/salesforce`
- **THEN** its folder remains empty

#### Scenario: Library caller omits translated labels

- **WHEN** a library caller maps a toolset with a plain ID without supplying `folderLabels`
- **THEN** its folder remains empty rather than containing a hardcoded root label
