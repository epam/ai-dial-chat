## Why

Issue #10031 ("[Catalog] Filter improvements") reworks how the Catalog narrows its listing, and the current controls get in the way:

- The "From" filter is a labelled pill. Topics are buffered behind Clear/Apply, and nothing on the page says which topics are applied.
- Source is reduced to a single "My" checkbox.
- The user cannot browse by folder, although every `CatalogItem` already carries a `folder` path (`Personal` / `Shared with me` / `Organization` › …). See `resolveDeploymentFolder` in `libs/chat-hooks/src/catalog/map-deployment-to-catalog-item.ts`.

The design (Figma "DIAL Chat 2.0 – Catalog", nodes 2038-35477, 2038-44293, 2041-48541 and 2042-49157) replaces these with three things: an icon filter that applies immediately, removable topic tags, and a folder tree with breadcrumbs. The issue asks for the same change in every "Change agent"-like picker.

## Problem

- `Filter` (`libs/catalog/src/components/Filter/Filter.tsx`) and the phone `BrowseSettingsSheet` (`libs/catalog/src/components/Toolbar/BrowseSettingsSheet.tsx`) buffer the selection until Apply. The trigger reads "From: 2 of 47", and no tag row shows what is applied.
- "My" (`isMyAppsActive`) is the only source filter. It is persisted by `apps/chat/src/hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference.ts` and drives `PersonalEmptyState`.
- The title is the static "Browse" (`TitleRow`, `libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`). There is no folder navigation.
- `CatalogPickerModal` (`libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`) and the `AddOnCatalogModal` built on it render their own copy of the same `Filter` with "My".

## Solution

**Topics filter**

- The desktop trigger becomes an icon-only `GhostIconButton` (`IconFilter2`, the three-line filter icon) with an active dot.
- Its dropdown has a "Topics" heading with a "Clear all" link, then one checkbox row per topic.
- Each toggle applies at once. There is no footer and no Apply. A press outside closes the list.
- The phone Filtering page works the same way: header "Clear all", immediate apply, no footer. Its Root row summary becomes `selected of total-topics`.

**Applied-topic tags**

- A tag row under the search shows one closable kit `Tag` per applied topic, on desktop and phone.
- When three or more topics are applied, the row ends with a "Clear all" link.

**"My" removed**

- The "My" filter row is removed from every surface.
- The **Personal** folder replaces it. The personal empty state is keyed off the Personal folder.

**Folders**

- The title row reads "All entities {count}" followed by a "Folders ▾" button.
- On desktop the button opens a popover with a folder tree, at most 700px tall: All entities › Personal / Shared with me / Organization › subfolders. On phone a round chevron button opens a "Folders" `BottomSheet` with the same tree.
- Picking a row filters the listing to that folder and its subfolders, then closes the popover or sheet.
- Once a folder is selected, the title becomes kit `Breadcrumbs`, for example "All entities › Organization › Design Assets 24". Earlier segments are links back up the tree. On phone the middle collapses to "…".
- The tree is built in the lib from the loaded items' `folder` paths. The host supplies only the root list and its labels.

**Persistence**

- The main Catalog page persists the selected folder in place of the "My" toggle.
- Pickers keep it in memory, as they do today.

**Same changes in every picker**

- `CatalogView` in selector mode (Change agent, prompt picker, skill picker) gets the new toolbar for free.
- `CatalogPickerModal` / `AddOnCatalogModal` swap their `Filter` for the new filter, tag row and Folders control.

## What Changes

**`libs/catalog`**

- `Filter` becomes an icon-only, immediate-apply topic filter. Gone: `isMyAppsActive`, `onMyAppsChange`, `myAppsLabel`, `defaultLabel`, `clearLabel` and `applyLabel`. Added: `clearAllLabel` and `triggerLabel`. **BREAKING**
- New `AppliedTopicTags`: closable tags plus "Clear all" from three tags.
- New `CatalogFolderTree` (`role="tree"`), plus `FoldersButton`, which renders a popover on desktop and a sheet on phone.
- New pure helpers in `libs/catalog/src/utils/catalog-folders.ts`: `buildCatalogFolderTree`, `filterByFolder`, `getCatalogItemFolderPath` and `isFolderSelectionValid`.
- New public types `CatalogFolderRootKind` (enum), `CatalogFolderRoot` and `CatalogFolderSelection`.
- `CatalogProps` / `ToolbarProps` change:
  - Removed: `isMyAppsActive`, `onMyAppsActiveChange`, `filterMyAppsLabel` and `filterFromLabel`. **BREAKING**
  - Added: `folderRoots`, `folderSelection` and `onFolderSelectionChange`.
  - `CatalogTitles` gains `folders: Partial<CatalogFolderLabels>` and `filterClearAllLabel`.
  - The `browseTitle` default becomes "All entities".
- `CatalogEmptyStateContext.isMyAppsActive` is replaced by `folderSelection`. **BREAKING**
- `BrowseSettingsSheetLabels` drops `myApps`, `clear` and `apply`, and gains `clearAll`. **BREAKING**
- `CatalogPickerModal` gets the same filter, tags and folders. `CatalogItemsQuery.isMyOnly` is replaced by `folder`. **BREAKING**
- `README.md` is updated for every renamed or added export, prop and label.

**`apps/chat`**

- `useCatalogSortFilterPreference` drops `isMyAppsActive` and persists `folderSelection` under the new `StorageKey.CatalogFolderSelection` (`'catalogFolderSelection'`). `StorageKey.CatalogIsMyAppsActive` is removed.
- `useCatalogItems` reconciles a stale persisted folder to All entities.
- `CatalogView` passes `folderRoots`, which omits Personal while `OverlayFeature.CatalogHideMyApps` is on, and translates every new label.
- New i18n keys:
  - `catalog.allEntities` ("All entities")
  - `catalog.folders.button` ("Folders")
  - `catalog.folders.treeLabel` ("Folders")
  - `catalog.folders.breadcrumbLabel` ("Folder path")
  - `catalog.folders.showHiddenSegments` ("Show hidden path segments")
  - `catalog.filter.label` ("Filter by topic")
  - `catalog.filter.clearAll` ("Clear all")
  - `catalog.filter.removeTag` ("Remove {{topic}}")
  - `catalog.filter.appliedTags` ("Applied topics")
- Existing keys reused: `catalog.folder.personal`, `catalog.folder.shared`, `catalog.folder.public` and `catalog.browseSettings.topics`.
- Keys removed: `catalog.browseSettings.from` and `catalog.browseSettings.my`.

## Capabilities

### New Capabilities

- `catalog-folder-navigation`: the folder roots and tree derived from item folders, the Folders popover (desktop) and sheet (phone), folder filtering, breadcrumbs, controlled selection, and picker parity.
- `catalog-topic-filter`: the icon-only immediate-apply topic filter, the applied-topic tag row with "Clear all", and parity in `CatalogPickerModal`.

### Modified Capabilities

- `catalog-mobile-browse-settings`: the Filtering page loses "My" and Clear/Apply, applies immediately, and gets a header "Clear all". The active dot and count now track topics only. The label set changes.
- `catalog-personal-empty-state`: triggered by the Personal folder selection instead of the "My" filter.
- `catalog-sort-filter-persistence`: the hook persists the folder selection instead of "My". `CatalogView` reconciles and wires it.
- `catalog-custom-empty-state`: the context carries `folderSelection` instead of `isMyAppsActive`.
- `catalog-toolbar-slot`: the slot receives the folder props instead of the "My" props.

## Non-goals

- No new backend endpoint and no DIAL Core folder listing. Empty folders do not appear in the tree.
- No change to how `folder` paths are mapped in `libs/chat-hooks`.
- No change to sorting, view mode, tabs or the favorites strip.
- No URL or deep-link state for the folder.

## Alternatives considered

- **Tree source.** Build it from the loaded items (chosen: pure, no requests, always consistent with what can be listed), or fetch it from DIAL Core through new host callbacks (shows empty folders, but needs lazy loading, error states and a new lib contract). The user chose the items.
- **Root membership.**
  - By the item flags `isMyApp` / `sharedWithMe` (chosen).
  - By matching `folder[0]` against a translated label. Rejected: it is fragile when labels change.
  - By a host-built tree. Rejected: it duplicates logic in every host.
- **Removing "My".** Keep it hidden behind a prop for compatibility, or remove it (chosen). The lib version stays at 0.0.1, and the Personal folder is the same filter with a better place in the UI.

## Acceptance criteria

- Desktop and phone match the four Figma frames:
  - icon filter with dot;
  - immediate apply;
  - "Clear all" in the list header;
  - tags under the search, with "Clear all" from three tags;
  - "All entities" title with count and Folders button;
  - tree popover (≤700px) or sheet;
  - breadcrumbs after a folder is picked.
- No "My" row remains anywhere. Picking Personal on an empty creatable tab shows the personal empty state.
- The Change agent, prompt and skill pickers and `CatalogPickerModal` all show the new controls. Only the main Catalog page persists the folder.
- `npm run validate:docs`, `npm run validate:specs` and `npm run verify:full` pass.

## Impact

- **Libs touched:** `libs/catalog` (public API, **BREAKING**, version stays `0.0.1`). No new dependency: `Tag`, `Breadcrumbs`, `Dropdown`, `BottomSheet` and `LinkButton` already come from `@epam/ai-dial-ui-kit`. No change to `libs/chat-hooks` or `libs/chat-shared`.
- **Isolation:** the lib never reads storage, flags or translations. The host passes the roots, labels, controlled selection and change callback. Persistence and the `CatalogHideMyApps` decision stay in `apps/chat/src/hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference.ts` and `apps/chat/src/components/CatalogView/CatalogView.tsx`.
- **Model:** the tree component follows the `ContentFileTree` pattern (`libs/catalog/src/components/Details/TabsContent/ContentFileTree/ContentFileTree.tsx`): `role="tree"`, roving focus and expand state.
- **Backward compatibility:** a persisted `catalogIsMyAppsActive` value is ignored and removed. After the upgrade, a user who had "My" on lands on All entities. Rollback is a revert of the change. The old key is not migrated back, so a reverted build starts with "My" off.
- **i18n:** new keys as listed above, all in `apps/chat/src/i18n/locales/en.json` through `CatalogI18nKeys`.
- **Docs:** `libs/catalog/README.md`. `docs/architecture.md` is untouched, since no lib, app, context or route is added.
