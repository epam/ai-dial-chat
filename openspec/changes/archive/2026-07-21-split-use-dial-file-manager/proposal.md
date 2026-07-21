## Why

`apps/chat/src/hooks/files/useDialFileManager.ts` is a 2482-line hook with 79 React hook calls and 15+ direct `server-api/files.api` imports, backed by a 4017-line spec file. It owns listing/navigation, search, upload batches, folder creation, download, delete/rename/copy/move, sharing, and metadata — every new file-manager feature lands in this one file, and it has grown +255 lines since Jul 15 across two recent features. Backend `FilesService` was already decomposed in archived change `2026-07-16-split-files-service` (facade now 205 lines); the frontend hook did not follow the same boundary split.

## What Changes

- Decompose `useDialFileManager` into five focused sub-hooks under `apps/chat/src/hooks/files/` — listing/navigation, upload batches, CRUD mutations (delete/rename/copy/move/create-folder/download), sharing, and metadata — each owning its own state, `server-api/files.api` calls, and effects.
- Keep `useDialFileManager` as a thin composer hook that calls the five sub-hooks and returns the exact same `UseDialFileManagerOptions` / `UseDialFileManagerResult` shape it returns today. `DialFileManagerShell`, `DialFileManagerModal`, and `DialFileManagerPage` require **no changes**.
- Extract module-level pure helpers (permission mapping, virtual-path helpers, DTO builders) into standalone `*.util.ts` files co-located under `hooks/files/`, instead of living inside the composer file.
- Split `useDialFileManager.spec.tsx` (4017 lines) into per-hook spec files under `hooks/files/tests/<concern>/`, relocating existing `describe` blocks verbatim; keep one slim composer spec that verifies wiring between sub-hooks.
- No REST/API contract changes, no `@epam/chat-api-client` changes, no UI/behavior changes for the attach modal, standalone `/files` page, or any tab/variant/actionProfile combination.

## Capabilities

### New Capabilities

- `dial-file-manager-hook-decomposition`: defines the ownership map between `useDialFileManager` and its five sub-hooks (listing, upload, mutations, sharing, metadata), and the equivalence contract that the composer's public options/result shape and all existing file-manager behavior are preserved across the refactor.

### Modified Capabilities

None. This is an internal refactor with no change to observable behavior, so no existing spec's *requirements* change — only implementation-detail references to `useDialFileManager.ts` as the sole owner of listing/upload/sharing/mutation logic will be updated to point at the new sub-hook names. Those are non-normative implementation notes, not requirement changes, so no delta spec files are needed for:

- `dial-file-manager-attach-ui`, `file-manager-shell`, `file-manager-standalone-page`, `file-manager-tabs`, `file-manager-sharing`, `file-manager-upload`, `file-manager-upload-archive`, `file-manager-copy-move`, `file-manager-delete-api`, `file-manager-download`, `file-manager-rename-api`, `file-manager-folder-creation`.

## Impact

- **Code:** `apps/chat/src/hooks/files/useDialFileManager.ts` (2482 → target <250 lines) and `hooks/files/tests/useDialFileManager.spec.tsx` (4017 lines, split by concern). New files: `useDialFileListing`, `useDialFileUploadBatch`, `useDialFileMutations`, `useDialFileSharing`, `useDialFileMetadata`, plus `*.util.ts` helper modules, each with a co-located spec.
- **Consumers (unchanged contract):** `DialFileManagerModal.tsx`, `DialFileManagerPage.tsx`, `DialFileManagerShell.tsx` (which independently assembles its own `gridOptions`/`toolbarOptions`/etc. via `useMemo` from the flat result — the composer does not build option bags itself, correcting an inaccuracy in the original request).
- **No changes:** `@epam/chat-api-client`, `server-api/files.api.ts`, `useDialFileManagerState.ts` (separate hook used by `NewConversationComposer`, out of scope), `ConversationView.tsx` attach-modal duplication (tracked as an optional out-of-scope follow-up).
- **Dependencies:** none added or removed.
