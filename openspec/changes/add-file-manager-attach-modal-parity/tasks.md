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

- [ ] 2.1 Confirm `DialFileManager` prop name for `onSearchFiles` and `navigationPanelOptions` via `getEntityDetails("component", "DialFileManager")` from ui-kit MCP (resolve OQ from design.md)
- [ ] 2.2 Add `searchQuery: string` state and `searchResults` ref to `useDialFileManager`
- [ ] 2.3 Implement `onSearchFiles(query)` in `useDialFileManager`: debounce 300 ms; call active-tab listing function with `{ recursive: true }`; client-side name-contains filter; `AbortController` cancel on new query or unmount
- [ ] 2.4 Expose `isSearching: boolean` from `useDialFileManager`; derive `items` from `searchResults` when `searchQuery` is non-empty, otherwise from folder cache
- [ ] 2.5 Reset `searchQuery` and `searchResults` on tab switch
- [ ] 2.6 In `DialFileManagerModal`: set `navigationPanelOptions={{ searchable: true, hideSearchPathItemName: true }}`; wire `onSearchFiles` and `isSearching` to `DialFileManager`
- [ ] 2.7 Add `dialFileManager.search.emptyStateTitle` to `en.json`; pass as empty state copy when search returns no results
- [ ] 2.8 Write tests: search returns matching files; empty query restores folder view; rapid typing debounces; tab switch clears search; Shared tab uses `listSharedFiles`
- [ ] 2.9 `npx nx test chat && npx nx lint chat` — must pass before proceeding

## 3. Slice 3 — Tree state

- [ ] 3.1 Confirm `DialFileManager` controlled tree props (`expandedPaths`, `loadedPaths`, `onExpandedPathsChange`, `treeOptions`) via ui-kit MCP `getEntityDetails` (resolve OQ from design.md)
- [ ] 3.2 Add `expandedPaths: Set<string>` and `loadedPaths: Set<string>` state to `useDialFileManager`
- [ ] 3.3 Implement `onExpandedPathsChange(paths)` in hook: diff against current `expandedPaths`; fetch children for any path not in `loadedPaths` using active-tab listing; store in per-folder `Map` cache; mark path loaded
- [ ] 3.4 Reset `expandedPaths` and `loadedPaths` to empty sets on tab switch
- [ ] 3.5 Pass `expandedPaths`, `loadedPaths`, `onExpandedPathsChange` from hook to `DialFileManager` in `DialFileManagerModal`
- [ ] 3.6 Add tree header i18n keys to `en.json`: `dialFileManager.myFiles.treeHeader`, `dialFileManager.shared.treeHeader`, `dialFileManager.organization.treeHeader`
- [ ] 3.7 In `DialFileManagerModal`, compute `treeOptions` via `useMemo` keyed on active tab; pass to `DialFileManager`
- [ ] 3.8 Write tests: expand unloaded folder → BFF fetch + children appear; expand loaded folder → no BFF request; collapse/expand round-trip uses cache; tab switch resets tree state
- [ ] 3.9 `npx nx test chat && npx nx lint chat` — must pass before proceeding

## 4. Slice 4 — Modal polish

- [ ] 4.1 Confirm `DialFileManager` `autoSelectUploadedItems` prop presence via ui-kit MCP (resolve OQ from design.md); if absent, implement host-side via `useEffect` on `uploadBatchState`
- [ ] 4.2 Add `autoSelectUploadedItems?: boolean` prop (default `true`) to `DialFileManagerModal`; implement `useEffect` keyed on `uploadBatchState.status === 'done'` that adds uploaded paths to `selectedPaths` (Set dedup)
- [ ] 4.3 Add tab-specific empty state i18n keys to `en.json`: `dialFileManager.myFiles.emptyStateTitle`, `dialFileManager.myFiles.emptyStateDescription`, `dialFileManager.shared.emptyStateTitle`, `dialFileManager.shared.emptyStateDescription`, `dialFileManager.organization.emptyStateTitle`, `dialFileManager.organization.emptyStateDescription`
- [ ] 4.4 Add the six new keys to `DialFileManagerI18nKeys` type
- [ ] 4.5 In `DialFileManagerModal`, compute `emptyStateTitle` / `emptyStateDescription` per active tab via `useMemo`; pass to `DialFileManager`
- [ ] 4.6 Implement `trimFileNameToByteLimit(name, limit = 255)` in `apps/chat/src/utils/file.ts` using `TextEncoder`; trim on character boundary preserving extension
- [ ] 4.7 Apply `trimFileNameToByteLimit` as the final step inside `sanitizeFileName`
- [ ] 4.8 Write tests: `autoSelectUploadedItems=true` → uploaded paths added to selection; duplicate path not double-added; `autoSelectUploadedItems=false` → no change; tab-specific empty states rendered; `trimFileNameToByteLimit` handles ASCII / CJK / emoji boundary cases
- [ ] 4.9 `npx nx test chat && npx nx lint chat` — all slices green
