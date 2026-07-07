## Why

GitHub issue #7501 tracks remaining P1 gaps between the BFF-backed `DialFileManagerModal` + `useDialFileManager` and the legacy `FileManagerModal` on `development`. Four gaps block attach-modal parity: attach-folders E2E wiring, search, lazy tree state, and auto-select + empty-state polish. All shipped P0 slices (upload, delete, rename, tabs, conflicts) are already archived; this change closes the remaining P1 items.

## What Changes

- **Slice 1 — Attach folders E2E:** Wire `canAttachFolders` from deployment/bucket capability into `ConversationRoute` and `ConversationView`; update `useDialFileManagerState.handleAttach` and both `handleAttachDialFiles` handlers to consume `AttachResult.folderPaths`.
- **Slice 2 — Search:** Add `onSearchFiles(query)` to `useDialFileManager` using BFF recursive listing per active tab; enable `navigationPanelOptions.searchable: true` and `hideSearchPathItemName: true` in `DialFileManagerModal`.
- **Slice 3 — Tree state:** Hook owns `expandedPaths` / `loadedPaths`; `onExpandedPathsChange` triggers lazy subfolder fetch from per-folder `Map` cache; pass `treeOptions` header i18n through `DialFileManagerModal`.
- **Slice 4 — Modal polish:** `autoSelectUploadedItems` prop (default matches legacy); tab-specific `emptyStateTitle` / `emptyStateDescription` via i18n keys; optional `prepareFileName` byte-limit trim if legacy had measurable limits.

## Capabilities

### New Capabilities

- `file-manager-search`: Recursive file search inside the attach modal via BFF list API with `recursive: true`, debounced, per-tab (my / shared / public endpoints). Covers `onSearchFiles`, `searchable: true`, and `hideSearchPathItemName`.
- `file-manager-tree-state`: Hook-owned `expandedPaths` / `loadedPaths` with lazy child fetch on expand; `onExpandedPathsChange` callback; tree header i18n via `dialFileManager.*` keys; per-folder `Map` cache reuse.
- `file-manager-attach-modal-polish`: `autoSelectUploadedItems` (add uploaded paths to `selectedPaths` after batch settles); tab-specific empty state copy via `DialFileManagerI18nKeys`; optional `prepareFileName` byte-limit trim as sibling to `sanitizeFileName`.

### Modified Capabilities

- `dial-file-manager-attach-folders`: E2E wiring delta — `canAttachFolders` passed from call sites (`ConversationRoute`, `ConversationView`); `handleAttach` / `handleAttachDialFiles` consume `folderPaths` per legacy behavior.

## Impact

- **`apps/chat/src/hooks/files/useDialFileManager.ts`** — new `onSearchFiles`, `expandedPaths`, `loadedPaths`, `onExpandedPathsChange`; `handleAttach` updated to forward `folderPaths`.
- **`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`** — `canAttachFolders` prop passed through; `searchable: true`; `treeOptions`; `autoSelectUploadedItems`; tab-specific empty states.
- **`apps/chat/src/components/ConversationRoute/ConversationRoute.tsx`** and **`ConversationView.tsx`** — pass `canAttachFolders`; handle `folderPaths` in attach callback.
- **`apps/chat/src/server-api/files.api.ts`** — reuse existing `listFiles` / `listSharedFiles` / `listPublicFiles` with `recursive: true` for search; no new BFF endpoint expected.
- **`apps/chat/src/i18n/locales/en.json`** — new keys for tab-specific empty states and tree headers.
- **`apps/chat-api`** — no changes; BFF already supports `recursive` param on list endpoints.
- **Specs** — `dial-file-manager-attach-folders` receives a requirements delta; three new specs created for slices 2–4.
