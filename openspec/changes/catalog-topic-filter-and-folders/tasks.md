# Tasks: catalog-topic-filter-and-folders

**Slicing strategy:** vertical, contract first inside the lib.

- Slice 1 lands the pure folder model and its tests.
- Slices 2–3 deliver the topic filter end to end on the main Catalog: lib, host and i18n.
- Slices 4–5 deliver folders end to end, persistence included.
- Slice 6 brings the pickers to parity.
- Slice 7 closes docs and verification.

Every slice leaves `apps/chat` compiling. Removed props are dropped in the same slice that rewires their only host.

**Architecture guard, for every `libs/catalog` task:** the lib must not import storage, `apps/chat`, the API client, feature flags, i18n or routing. Roots, labels, selection and callbacks arrive as props only.

## 1. Folder model (pure, lib)

- [x] 1.1 Add `CatalogFolderRootKind` (string enum), `CatalogFolderRoot` and `CatalogFolderSelection` in `libs/catalog/src/types/catalog-folders.ts`.
- [x] 1.2 Add `CatalogFolderLabels` and `CatalogFolderNode` in `libs/catalog/src/models/catalog-folders.ts`.
- [x] 1.3 Add `DEFAULT_CATALOG_FOLDER_ROOTS` and `DEFAULT_CATALOG_FOLDER_LABELS` in `libs/catalog/src/constants/catalog-folders.ts`.
- [x] 1.4 Implement `getCatalogItemFolderPath`, `buildCatalogFolderTree`, `filterByFolder` and `isFolderSelectionValid` in `libs/catalog/src/utils/catalog-folders.ts` as `const` arrow functions with JSDoc.
- [x] 1.5 Export the new types, constants and helpers from `libs/catalog/src/index.ts`, and from `libs/catalog/src/entry-points/mapping.ts` next to `filterCatalogItemsByQuery`. Update `libs/catalog/src/tests/index-exports.spec.ts`.
- [x] 1.6 Unit tests in `libs/catalog/src/utils/catalog-folders.spec.ts`:
  - membership by flags;
  - the whole-path fallback;
  - nesting and sort;
  - empty roots;
  - a `/` inside a segment;
  - prefix filtering;
  - validity of a stale path.

**Verification:** `npm run test:file -- libs/catalog/src/utils/catalog-folders.spec.ts` and `npm run test:file -- libs/catalog/src/tests/index-exports.spec.ts`.

## 2. Immediate-apply topic filter and tags (lib)

- [x] 2.1 Rewrite `libs/catalog/src/components/Filter/Filter.tsx`:
  - The trigger is an icon `GhostIconButton` with the active dot.
  - The overlay header holds "Topics" and a "Clear all" `LinkButton`.
  - Rows apply on toggle; keep the roving focus.
  - Remove the pending state, the footer and `getFilterButtonLabel`.
  - Update `FilterProps` and `FilterColors` per spec `catalog-topic-filter`.
  - Update `Filter.module.scss`: add `--cat-filter-active-dot`, drop the pill and footer vars.
- [x] 2.2 Remove `getFromLabel` and `filterByMyApp` from `libs/catalog/src/utils/catalog-filter.ts`. In `CatalogItemsQuery`, replace `isMyOnly` with `folder` plus `folderRoots`, and apply `filterByFolder` in `filterCatalogItemsByQuery`. Update `libs/catalog/src/utils/catalog-filter.spec.ts`.
- [x] 2.3 Add `libs/catalog/src/components/AppliedTopicTags/AppliedTopicTags.tsx`:
  - a named group of closable kit `Tag`s;
  - a `LinkButton` "Clear all" from `CLEAR_ALL_TAG_THRESHOLD = 3` tags;
  - focus hand-off on remove (next tag, else previous, else `fallbackFocusRef`);
  - wrap the handlers in `useCallback`.
- [x] 2.4 Tests:
  - `libs/catalog/src/components/Filter/tests/Filter.spec.tsx`, rewritten: a toggle applies, the dropdown stays open, an outside press closes it, Escape returns focus, "Clear all" is disabled while empty, the dot is shown, there is no "My" row.
  - New `libs/catalog/src/components/AppliedTopicTags/tests/AppliedTopicTags.spec.tsx`: the 2- and 3-tag thresholds, remove, Clear all, focus hand-off.
  - Queries by role and name only.

**Verification:** `npm run test:file -- libs/catalog/src/components/Filter/tests/Filter.spec.tsx`, `npm run test:file -- libs/catalog/src/components/AppliedTopicTags/tests/AppliedTopicTags.spec.tsx` and `npm run test:file -- libs/catalog/src/utils/catalog-filter.spec.ts`.

## 3. Wire the topic filter through the toolbar, sheet and host; remove "My"

- [x] 3.1 `libs/catalog/src/components/Toolbar/Rows/TitleRow.tsx`: render the new `Filter` and `AppliedTopicTags` below the search row on every breakpoint. The settings dot tracks topics only. Remove the "My" props.
- [x] 3.2 `libs/catalog/src/components/Toolbar/BrowseSettingsSheet.tsx`: the Filtering page gets a header "Clear all", immediate apply, no footer and no "My" row. The Root count is `selected of topics.length`.
- [x] 3.3 `libs/catalog/src/models/toolbar-props.ts`:
  - `BrowseSettingsSheetLabels` drops `myApps`, `clear` and `apply`, and gains `clearAll`;
  - `ToolbarProps` drops `isMyAppsActive`, `onMyAppsChange`, `filterMyAppsLabel` and `filterFromLabel`, and gains `filterLabel`, `filterClearAllLabel`, `appliedTopicsLabel` and `formatRemoveTopicLabel`.
- [x] 3.4 Update `libs/catalog/src/constants/browse-settings.ts` to match.
- [x] 3.5 `libs/catalog/src/models/catalog-props.ts` and `libs/catalog/src/components/Catalog/Catalog.tsx`:
  - remove `isMyAppsActive` and `onMyAppsActiveChange` and their internal state;
  - add the new `CatalogTitles` filter labels;
  - keep the pipeline compiling with the "My" step removed (the folder step lands in 4.4);
  - `PersonalEmptyState` is temporarily never shown until 4.4;
  - `CatalogEmptyStateContext` drops `isMyAppsActive`.
- [x] 3.6 `apps/chat/src/components/CatalogView/CatalogView.tsx` and `apps/chat/src/hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference.ts`:
  - stop passing "My";
  - drop `isMyAppsActive` from the hook;
  - remove `StorageKey.CatalogIsMyAppsActive` from `apps/chat/src/types/storage-key.ts`;
  - add the one-time `removeItem('catalogIsMyAppsActive')` effect.
- [x] 3.7 i18n (dedicated task):
  - Add `catalog.filter.label`, `catalog.filter.clearAll`, `catalog.filter.appliedTags` and `catalog.filter.removeTag` to `apps/chat/src/i18n/locales/en.json`, and the matching members to `CatalogI18nKeys` in `apps/chat/src/constants/i18n-keys/catalog.ts`.
  - Remove `catalog.browseSettings.from` / `catalog.browseSettings.my` and their enum members.
  - Fill every new lib label in `CatalogView`.
- [x] 3.8 Tests:
  - update `libs/catalog/src/components/Toolbar/tests/Toolbar.spec.tsx`, `Toolbar.mobile.spec.tsx` and `Toolbar.tablet.spec.tsx`: tags under the search, the icon trigger order, the sheet's immediate apply and "Clear all";
  - update `libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx` (no "My");
  - update `apps/chat/src/hooks/useCatalogSortFilterPreference/tests/` for the removed toggle and the key cleanup;
  - update the `CatalogView` tests that referenced "My" or "From".

**Verification:** `npm run test:file -- libs/catalog/src/components/Toolbar/tests/Toolbar.spec.tsx`, `npm run test:file -- libs/catalog/src/components/Toolbar/tests/Toolbar.mobile.spec.tsx`, `npm run test:file -- libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx` and the hook spec under `apps/chat/src/hooks/useCatalogSortFilterPreference/`. Then run `npm run verify:changed` once for slices 2–3.

## 4. Folder tree, Folders control and breadcrumbs (lib)

- [x] 4.1 Add `libs/catalog/src/components/CatalogFolderTree/CatalogFolderTree.tsx` and its `.module.scss`, following `libs/catalog/src/components/Details/TabsContent/ContentFileTree/ContentFileTree.tsx`:
  - `role="tree"` and `treeitem` with levels;
  - caret toggles;
  - roving keys;
  - auto-expand of the ancestors of the selection;
  - `FolderTreeColors` through `buildCssVars`;
  - `rowClassName` defaulting to `dial-small-text`.
- [x] 4.2 Add `libs/catalog/src/components/FoldersButton/FoldersButton.tsx`:
  - desktop: kit `Button` plus `Dropdown` (`DropdownOverlayRole.Dialog`, `max-h-[700px]` bounded by `--fui-available-height`);
  - phone (`useIsPhone`): round `GhostIconButton` plus `BottomSheet`;
  - close and return focus on pick;
  - `FoldersButtonColors.label`.
  - Lazy-loading is not needed: the tree is small and the trigger is always visible. Record this in the component's JSDoc per `.claude/rules/bundle-performance.md`.
- [x] 4.3 Add `libs/catalog/src/components/Toolbar/Rows/CatalogFolderHeader.tsx`: `ItemHeader` for All entities, kit `Breadcrumbs` (`maxVisibleItems` 3 below 768px) with a count otherwise. Render it plus `FoldersButton` in the first row of `TitleRow`, still honouring `browseHeaderRenderer`.
- [x] 4.4 `libs/catalog/src/components/Catalog/Catalog.tsx` and `libs/catalog/src/models/catalog-props.ts`:
  - add `folderRoots`, `folderSelection`, `onFolderSelectionChange` and `titles.folders`, with controlled and internal state;
  - build the memoized tree from `items`;
  - add the `filterByFolder` step before the tab step;
  - pass `folderTree`, `folderSelection`, `onFolderSelectionChange` and `folderLabels` to `Toolbar` and `renderToolbar`;
  - set the `browseTitle` default to "All entities";
  - trigger `PersonalEmptyState` on `root === Personal`;
  - add `CatalogEmptyStateContext.folderSelection`.
- [x] 4.5 Tests:
  - new `libs/catalog/src/components/CatalogFolderTree/tests/CatalogFolderTree.spec.tsx`: keyboard, `aria-expanded` / `aria-selected`, auto-expand;
  - new `libs/catalog/src/components/FoldersButton/tests/FoldersButton.spec.tsx`: desktop popover and phone sheet, pick closes, Escape keeps the selection;
  - update `libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx`: the breadcrumb trail and navigating up, folder filtering, the personal empty state on Personal, the empty-state context;
  - update `libs/catalog/src/components/Catalog/tests/Catalog.mobile.spec.tsx`: the collapsed trail and the sheet.

**Verification:** `npm run test:file -- libs/catalog/src/components/CatalogFolderTree/tests/CatalogFolderTree.spec.tsx`, `npm run test:file -- libs/catalog/src/components/FoldersButton/tests/FoldersButton.spec.tsx`, `npm run test:file -- libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx` and `npm run test:file -- libs/catalog/src/components/Catalog/tests/Catalog.mobile.spec.tsx`.

## 5. Folder host wiring and persistence (apps/chat)

- [x] 5.1 Add the pure `apps/chat/src/hooks/useCatalogSortFilterPreference/parse-catalog-folder-selection.ts` with unit tests in `apps/chat/src/hooks/useCatalogSortFilterPreference/tests/parse-catalog-folder-selection.spec.ts`.
- [x] 5.2 Extend `useCatalogSortFilterPreference` with `folderSelection` and `setFolderSelection` on `StorageKey.CatalogFolderSelection` (`'catalogFolderSelection'`, added to `apps/chat/src/types/storage-key.ts`). Update the hook tests for restore, the malformed fallback and persistence on set.
- [x] 5.3 `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`: accept `persistedFolderSelection` and `folderRoots`, and return the memoized `reconciledFolderSelection`, skipped while loading. Add tests in its existing spec for a valid folder, a stale folder and the loading state.
- [x] 5.4 `apps/chat/src/components/CatalogView/CatalogView.tsx`:
  - build a memoized `folderRoots` from `buildDeploymentFolderLabels(t)`, dropping Personal while `isCatalogHideMyAppsEnabled`;
  - pass `folderSelection` and `onFolderSelectionChange` only outside selector mode;
  - set `browseTitle` to `t(CatalogI18nKeys.AllEntities)`;
  - fill `titles.folders`.
- [x] 5.5 i18n (dedicated task):
  - Add `catalog.allEntities`, `catalog.folders.button`, `catalog.folders.treeLabel`, `catalog.folders.breadcrumbLabel` and `catalog.folders.showHiddenSegments` to `apps/chat/src/i18n/locales/en.json`, with the matching `CatalogI18nKeys` members.
  - Drop the `ButtonsI18nKeys.Browse` usage in `CatalogView`. Keep the key if other callers use it; check with grep first.
- [x] 5.6 Tests: `CatalogView` passes the roots without Personal under `CatalogHideMyApps`; selector mode passes no folder control props.

**Verification:** `npm run test:file -- apps/chat/src/hooks/useCatalogSortFilterPreference/tests/parse-catalog-folder-selection.spec.ts`, the `useCatalogSortFilterPreference` and `useCatalogItems` specs, and the `CatalogView` spec under `apps/chat/src/components/CatalogView/`. Then run `npm run verify:changed` once for slices 4–5.

## 6. Picker parity

- [x] 6.1 `libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`:
  - swap in the new `Filter` and `AppliedTopicTags`;
  - add the local folder state, the `folderRoots` prop, and the heading-row trail plus `FoldersButton`;
  - update `CatalogPickerModalLabels` (drop `from`, `my`, `clear` and `apply`; add `filter`, `clearAll`, `appliedTopics`, `formatRemoveTopic` and `folders`).
- [x] 6.2 `libs/catalog/src/components/AddOnCatalogModal/AddOnCatalogModal.tsx`: forward `folderRoots` and the new labels.
- [x] 6.3 Tests: update `libs/catalog/src/components/CatalogPickerModal/tests/CatalogPickerModal.spec.tsx` and `libs/catalog/src/components/AddOnCatalogModal/tests/AddOnCatalogModal.spec.tsx` for immediate apply, tags, folder narrowing and the trail.
- [x] 6.4 Confirm that the selector-mode pickers (`apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`, `apps/chat/src/components/PromptSelector/PromptCatalogModal.tsx`, `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx`) need no code change. Add one `CatalogView` selector-mode test asserting the Folders button and the icon filter render.

**Verification:** `npm run test:file -- libs/catalog/src/components/CatalogPickerModal/tests/CatalogPickerModal.spec.tsx` and `npm run test:file -- libs/catalog/src/components/AddOnCatalogModal/tests/AddOnCatalogModal.spec.tsx`.

## 7. RTL, accessibility, docs and closing verification

- [x] 7.1 RTL (dedicated task):
  - logical classes only (`ms-*`, `inset-e-*`, `text-start`) in `Filter`, `AppliedTopicTags`, `CatalogFolderTree`, `FoldersButton` and `CatalogFolderHeader`;
  - the collapsed tree caret is mirrored with `rtl:scale-x-[-1]`;
  - add one `dir="rtl"` render test in `libs/catalog/src/components/CatalogFolderTree/tests/CatalogFolderTree.spec.tsx`: ArrowRight/ArrowLeft semantics follow the visual direction, as in `ContentFileTree`.
- [x] 7.2 Run the `lib-theming` and `i18n-strings` audits on `libs/catalog`. Fix any hard-coded colour, typography or string they report.
- [x] 7.3 Update `libs/catalog/README.md`:
  - the removed and renamed props;
  - the new exports (`CatalogFolderRootKind`, `CatalogFolderRoot`, `CatalogFolderSelection`, `CatalogFolderLabels`, the folder helpers and `DEFAULT_CATALOG_FOLDER_*`);
  - the new `*Colors` fields;
  - the label fields with their defaults;
  - every example that passed `isMyAppsActive` or `filterFromLabel`.

  Then run `npm run validate:docs`.
- [ ] 7.4 Run `npm run validate:specs`. Close with a single `npm run verify:full`, run through the `lean-verification` skill, plus `npm run build:quiet`, because the lib's public entry points change.

## Follow-ups (out of scope)

- [ ] F.1 If design asks for empty DIAL Core folders in the tree, add a host-supplied `extraFolderPaths` merge into `buildCatalogFolderTree`.
