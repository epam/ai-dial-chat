## Context

`DialFileManagerModal` + `useDialFileManager` have been the BFF-backed attach modal since Phase 0. All P0 slices (upload, delete, rename, tabs, conflicts, pagination) are archived. Four P1 gaps remain before the attach modal matches legacy `FileManagerModal` on `development`:

| Gap | Current state | Missing |
|-----|---------------|---------|
| Attach folders E2E (#23) | `canAttachFolders` wired through modal + `isRowSelectable`; `AttachResult.folderPaths` built correctly in `handleAttach` | `ConversationRoute` / `ConversationView` never pass the prop; both `handleAttachDialFiles` callsites discard `folderPaths`; BFF does not expose `folderAttachments` from DIAL Core deployment features |
| Search (#18) | `navigationPanelOptions: { searchable: false }` | `onSearchFiles` handler; recursive BFF listing per tab |
| Tree state (#14) | No `expandedPaths` / `loadedPaths` / `onExpandedPathsChange` | Lazy subfolder fetch on expand; state lives only in the per-folder `Map` cache |
| Modal polish (#25, #54) | No `autoSelectUploadedItems`; generic empty states | Auto-add uploaded paths to `selectedPaths`; tab-specific i18n copy |

**Key constraint:** `useDialFileManager` and `DialFileManagerModal` both live in `apps/chat/`; BFF calls stay in `apps/chat/src/server-api/files.api.ts`. No libs boundary changes for this change.

## Goals / Non-Goals

**Goals:**
- Wire `canAttachFolders` end-to-end from `selectedDeployment.features.folderAttachments` (per-deployment DIAL Core capability) → BFF `DeploymentFeaturesDto` → modal → attach handlers in both `ConversationRoute` and `ConversationView`; forward `folderPaths` as `Attachment` objects with `AttachmentType.File` via `dialFolderPathToAttachment`.
- Add `onSearchFiles` to `useDialFileManager`: debounced, recursive BFF listing per active tab, result mapped to ui-kit tree/grid items; clear search restores folder cache.
- Add `expandedPaths` / `loadedPaths` hook state; `onExpandedPathsChange` triggers fetch for unloaded child paths reusing the existing per-folder `Map` cache.
- Add `autoSelectUploadedItems` to `DialFileManagerModal`; tab-specific empty states via i18n keys; evaluate `prepareFileName` byte-limit necessity.
- Each slice ends with passing `npx nx test chat` + `npx nx lint chat`.

**Non-Goals:**
- Standalone file manager page (#7502), copy/move (#7503), cross-folder picker.
- Review tab, row preview, `additionalFilesAndFolders` injection.
- New BFF endpoints (reuse existing `listFiles` / `listSharedFiles` / `listPublicFiles` with `recursive: true`).
- Library extraction (`DialFileManagerShell` is Phase 2).

## Decisions

### D1 — `canAttachFolders` source of truth

**Question:** Where does the `canAttachFolders` boolean come from?

`canAttachFolders` is a per-deployment capability, not a global app-config flag. DIAL Core exposes it as `features.folder_attachments` (snake_case) on each deployment in the `/openai/deployments` listing response. It varies per deployment — e.g. an Echo application may support folder attachments while a model does not.

**Decision:** Read `folderAttachments` from the selected deployment object already available in `DeploymentsContext`: `selectedDeployment?.features?.folderAttachments`. This requires:
1. Extending `RawDeploymentFeaturesDto` (BFF) with `folder_attachments?: boolean`.
2. Mapping it to `folderAttachments?: boolean` in `DeploymentFeaturesDto` and in `mapToDeploymentItem`.
3. Regenerating the OpenAPI client (`npm run openapi`).
4. In `ConversationRoute` and `ConversationView`: passing `canAttachFolders={selectedDeployment?.features?.folderAttachments}` to `DialFileManagerModal`.

No changes to `useClientConfig()` or `/api/v1/client-config` are needed.

### D2 — `folderPaths` handling in attach flow

**Question:** Does legacy `FileManagerModal` attach folder _contents_ recursively, or just the folder path reference?

Legacy forwards only folder paths to the conversation model as `Attachment` objects with type `folder`. The conversation model sends these to the DIAL Core, which resolves folder contents server-side. It does **not** expand folder contents client-side before attaching.

**Decision:** Mirror legacy behavior exactly — `handleAttachDialFiles` in both call sites receives `AttachResult`; it passes `result.files` through the existing `dialFilesToAttachments` pipeline and maps `result.folderPaths` to `Attachment` objects via `dialFolderPathToAttachment`. Folder attachments use `AttachmentType.File` (no separate `Folder` enum member — DIAL Core resolves folder contents server-side regardless of client-side type). No recursive BFF listing needed here.

### D3 — Search implementation

**Question:** Dedicated search endpoint vs reusing list + `recursive: true`?

Legacy `useFileManager` calls the same listing endpoint with `recursive: true` and a client-side name filter. The BFF `listFiles` / `listSharedFiles` / `listPublicFiles` already accept `recursive`. No new endpoint needed.

**Decision:** `onSearchFiles(query: string)` in `useDialFileManager`:
1. Debounce 300 ms.
2. On non-empty query: call the active-tab listing function with `{ recursive: true }`, store results in a separate `searchResults` ref (not the folder cache), map to grid items with name-filter applied client-side (BFF returns all recursive items; filtering client-side keeps parity with legacy).
3. On empty query: clear `searchResults`, re-show folder cache for current path.
4. Expose `isSearching` boolean for loading UX.
5. `hideSearchPathItemName: true` mirrors legacy: search results show the full path rather than just the file name in the navigation breadcrumb.

### D4 — Tree state ownership

**Question:** Hook state vs `DialFileManager` internal state?

`DialFileManager` from `@epam/ai-dial-ui-kit` accepts controlled `expandedPaths` / `loadedPaths` props and an `onExpandedPathsChange` callback — the component does not own this state internally.

**Decision:** `useDialFileManager` owns `expandedPaths: Set<string>` and `loadedPaths: Set<string>`. `onExpandedPathsChange(paths)` diffs against current `expandedPaths`, fetches children for any newly expanded path not yet in `loadedPaths`, stores results in the per-folder `Map` cache, marks path as loaded. Tab switch resets `expandedPaths` to empty (lazy re-expand on demand) to avoid stale cross-tab state.

### D5 — `autoSelectUploadedItems`

**Question:** How does legacy modal auto-select uploaded files?

Legacy watches the Redux upload queue; once a batch settles it adds the resulting file paths to Redux selection state. Current modal already tracks `uploadBatchState` in the hook.

**Decision:** `DialFileManagerModal` gets an `autoSelectUploadedItems?: boolean` prop (default `true` to match legacy attach modal default). In a `useEffect` keyed on `uploadBatchState.status === 'done'`, extract successfully uploaded paths from `uploadBatchState.files`, call `setSelectedPaths(prev => [...new Set([...prev, ...uploadedPaths])])`.

### D6 — `prepareFileName` byte-limit trim

**Question:** Does legacy `prepareFileName` apply a meaningful byte cap that `sanitizeFileName` misses?

Legacy `prepareFileName` caps filenames at 255 bytes (UTF-8). Current `sanitizeFileName` strips forbidden characters but has no byte cap. A 255-byte cap is non-trivial for CJK/emoji filenames.

**Decision:** Add a `trimFileNameToByteLimit(name: string, limit = 255)` utility alongside `sanitizeFileName` in `apps/chat/src/utils/file.ts`. Apply it as the last step in `sanitizeFileName` (or composably). This closes the gap cleanly without a new abstraction layer.

### D7 — Tab-specific empty states

**Decision:** Add three key groups to `en.json` and `DialFileManagerI18nKeys`:
- `dialFileManager.myFiles.emptyStateTitle` / `dialFileManager.myFiles.emptyStateDescription`
- `dialFileManager.shared.emptyStateTitle` / `dialFileManager.shared.emptyStateDescription`
- `dialFileManager.organization.emptyStateTitle` / `dialFileManager.organization.emptyStateDescription`

Pass per-active-tab values as `emptyStateTitle` / `emptyStateDescription` props to `DialFileManager`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `folderAttachments` absent from some deployment responses | `folderAttachments` is optional in `DeploymentFeaturesDto`; `canAttachFolders` defaults to `undefined` which coerces to `false` in `DialFileManagerModal`; existing behavior unchanged |
| Recursive list for search can be slow on large buckets | 300 ms debounce; abort in-flight request on new query; show `isSearching` spinner |
| `expandedPaths` reset on tab switch may surprise users who switch tabs and return | Legacy resets the same way; acceptable parity |
| `trimFileNameToByteLimit` splits multi-byte characters mid-sequence | Use `TextEncoder` byte length check + splice on character boundary, not byte boundary |
| `autoSelectUploadedItems` effect fires on every upload batch; fast double-upload could double-add paths | `Set` dedup in `setSelectedPaths` prevents duplicates |

## Migration Plan

No data migration needed. All changes are additive props + hook extensions in `apps/chat/`. Roll out is a standard PR merge:
1. Slice 1 (attach folders E2E) — low risk, props wiring only.
2. Slice 2 (search) — gated behind `searchable: true` prop; existing `false` preserved until slice lands.
3. Slice 3 (tree state) — no visual regression if `expandedPaths` starts empty; tree is already rendered.
4. Slice 4 (polish) — `autoSelectUploadedItems` default `true` changes UX; regression tests cover selection state.

Rollback: revert the PR. No persistent state, no DB migration.

## Open Questions

- **OQ1:** Does `DialFileManager` from `@epam/ai-dial-ui-kit` accept `treeOptions.headerTitle` or a different prop name for tree header i18n? Confirm via `getEntityDetails("component", "DialFileManager")` before Slice 3.
- **OQ2:** Does `DialFileManager` expose `autoSelectUploadedItems` natively, or must the host manage `selectedPaths` externally? Confirm via ui-kit MCP before Slice 4.
- **OQ3 (resolved):** `attachFolders` is NOT a global client-config flag. It is a per-deployment capability exposed by DIAL Core as `features.folder_attachments` on the deployment object. Source: `@epam/ai-dial-typescript-sdk` type definitions. Decision captured in D1.
