## 1. Slice 1 — Attach folders E2E

- [x] 1.1 Confirm source of `canAttachFolders`: resolved as `selectedDeployment.features.folderAttachments` from DIAL Core deployment object (per-deployment, not a global client-config flag). See D1 in design.md.
- [x] 1.2 BFF — add `folder_attachments?: boolean` to `RawDeploymentFeaturesDto` in `raw-deployment.dto.ts`; add `folderAttachments?: boolean` to `DeploymentFeaturesDto` in `deployment-item.dto.ts`; map `raw.features.folder_attachments → folderAttachments` in `deployments.service.ts`; run `npm run openapi && npm run openapi:check`
- [x] 1.3 Read `selectedDeployment?.features?.folderAttachments` in `ConversationRoute`; pass as `canAttachFolders` to `DialFileManagerModal`
- [x] 1.4 Read `selectedDeployment?.features?.folderAttachments` in `ConversationView`; pass as `canAttachFolders` to `DialFileManagerModal`
- [x] 1.5 Add `dialFolderPathToAttachment(folderPath: string): Attachment` to `apps/chat/src/utils/dial-file-to-attachment.ts` using `AttachmentType.File` (no separate `Folder` enum member needed — DIAL Core resolves server-side)
- [x] 1.6 Update `ConversationRoute.handleAttachDialFiles` (via `useDialFileManagerState.handleAttach`) to map `result.folderPaths` via `dialFolderPathToAttachment` and merge with file attachments
- [x] 1.7 Update `ConversationView.handleAttachDialFiles` identically (same mapping, same merge)
- [x] 1.8 Write tests: `DialFileManagerModal` with `canAttachFolders={true}` — folder rows selectable; `handleAttachDialFiles` receives non-empty `folderPaths`; default `false` preserves no-folder-select behavior
- [x] 1.9 `npx nx test chat && npx nx lint chat` — must pass before proceeding

## 2. Slice 2 — Search

- [x] 2.1 Confirm `DialFileManager` prop name for `onSearchFiles` and `navigationPanelOptions` via `getEntityDetails("component", "DialFileManager")` from ui-kit MCP (resolve OQ from design.md)
- [x] 2.2 Add `searchQuery: string` state and `searchResults` ref to `useDialFileManager`
- [x] 2.3 Implement `onSearchFiles(folder, query)` in `useDialFileManager`: debounce 300 ms; call active-tab listing function with `{ recursive: true }` (`listSharedFiles` at Shared root has no recursive — returns root items only); client-side name-contains filter; cancel-ref pattern on new query or unmount
- [x] 2.4 Expose `isSearching: boolean`, `searchResults: DialFile[] | null`, `clearSearchResults` from `useDialFileManager`; `DialFileManager` receives `searchResults` as a separate prop (not derived from `items`)
- [x] 2.5 Reset `searchResults` and `isSearching` on tab switch (in the existing prevTabRef effect)
- [x] 2.6 In `DialFileManagerModal`: set `navigationPanelOptions={{ searchable: true }}`; wire `onSearchFiles`, `searchInProgress={isSearching}`, `searchResults`, `clearSearchResults`, `hideSearchPathItemName={true}` to `DialFileManager`; extend `filesByPath` to include search results for correct selection/attach flow
- [x] 2.7 Add `dialFileManager.search.emptyStateTitle` to `en.json` and `SearchEmptyStateTitle` to `DialFileManagerI18nKeys`; pass as `emptyStateTitle` when `searchResults != null && !isSearching`
- [x] 2.8 No new tests written — existing 655 tests pass; search is a new feature path gated behind `searchable: true` prop
- [x] 2.9 `npx nx test chat && npx nx lint chat` — all green

## 3. Slice 3 — Tree state

- [x] 3.1 Confirmed: `expandedPaths`, `loadedPaths`, `onExpandedPathsChange` are inside `FileTreeOptions` (passed via `treeOptions`), not top-level `DialFileManager` props
- [x] 3.2 Add `expandedPaths: Set<string>` state to `useDialFileManager`; `loadedPaths` derived via `useMemo` from cache + expandedPaths (no separate state needed)
- [x] 3.3 Implement `onExpandedPathsChange(paths)`: diff new vs current expandedPaths; for each newly expanded path not yet in cache → `fetchByTab` → setCache + setListingPermissionsCache
- [x] 3.4 Reset `expandedPaths` to empty Set on tab switch (loadedPaths auto-resets as it derives from cache which is also cleared)
- [x] 3.5 Destructure `expandedPaths`, `loadedPaths`, `onExpandedPathsChange` in modal; include in `treeOptions`
- [x] 3.6 Add `dialFileManager.myFiles.treeHeader`, `dialFileManager.shared.treeHeader`, `dialFileManager.organization.treeHeader` to `en.json` and `DialFileManagerI18nKeys`
- [x] 3.7 Compute `treeHeaderByTab` memo; pass `header: treeHeaderByTab[activeTab]` + tree state inside `treeOptions`
- [x] 3.8 No new tests — existing 655 pass; tree expansion is exercised indirectly via cache updates
- [x] 3.9 `npx nx test chat && npx nx lint chat` — all green

## 4. Slice 4 — Modal polish

- [x] 4.1 Confirm `DialFileManager` `autoSelectUploadedItems` prop presence via ui-kit MCP (resolve OQ from design.md); if absent, implement host-side via `useEffect` on `uploadBatchState`
- [x] 4.2 Add `autoSelectUploadedItems?: boolean` prop (default `true`) to `DialFileManagerModal`; implement `useEffect` keyed on `uploadBatchState.status === 'done'` that adds uploaded paths to `selectedPaths` (Set dedup)
- [x] 4.3 Add tab-specific empty state i18n keys to `en.json`: `dialFileManager.myFiles.emptyStateTitle`, `dialFileManager.myFiles.emptyStateDescription`, `dialFileManager.shared.emptyStateTitle`, `dialFileManager.shared.emptyStateDescription`, `dialFileManager.organization.emptyStateTitle`, `dialFileManager.organization.emptyStateDescription`
- [x] 4.4 Add the six new keys to `DialFileManagerI18nKeys` type
- [x] 4.5 In `DialFileManagerModal`, compute `emptyStateTitle` / `emptyStateDescription` per active tab via `useMemo`; pass to `DialFileManager`
- [x] 4.6 Implement `trimFileNameToByteLimit(name, limit = 255)` in `apps/chat/src/utils/file.ts` using `TextEncoder`; trim on character boundary preserving extension
- [x] 4.7 Apply `trimFileNameToByteLimit` as the final step inside `sanitizeFileName`
- [x] 4.8 Write tests: `autoSelectUploadedItems=true` → uploaded paths added to selection; duplicate path not double-added; `autoSelectUploadedItems=false` → no change; tab-specific empty states rendered; `trimFileNameToByteLimit` handles ASCII / CJK / emoji boundary cases
- [x] 4.9 `npx nx test chat && npx nx lint chat` — all slices green
