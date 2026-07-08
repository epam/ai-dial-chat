## Why

The DIAL File Manager (GitHub #7503) has no way to copy a file/folder to another folder or move one across folders. [file-manager-rename-api](../../specs/file-manager-rename-api/spec.md) added `POST /api/v1/files/rename`, but that endpoint is same-folder-only — it powers ui-kit's inline rename affordance, not a distinct destination-folder flow, and `useDialFileManager.onMoveToFiles` (`apps/chat/src/hooks/files/useDialFileManager.ts:1392`) is currently hardcoded to always call `renameFiles()`. There is also no `onCopyFiles` wiring and no progress/cancel UI for a fan-out batch operation. Without this, users cannot reorganize files without downloading and re-uploading them.

This is step 9 of the #7503 migration roadmap (BFF copy + cross-folder move) and is scoped narrowly to the transport + core wiring; the destination-folder picker UI (step 10), same-folder duplicate (step 11), and the full standalone action matrix (step 12) are separate follow-up OpenSpec changes so each stays independently reviewable and archivable, per [openspec/config.yaml](../../config.yaml) task-slicing rules.

## What Changes

- **New BFF endpoint** `POST /api/v1/files/copy` — proxies DIAL Core `copyResource` for a batch of files/folders, reusing the existing `expandFolderContents` pagination helper for folder copy. Same partial-failure/per-item-result contract as `/delete` and `/rename`.
- **New BFF endpoint** `POST /api/v1/files/move` — proxies DIAL Core `moveResource` for a batch of files/folders across **different** source/destination folders (distinct from the existing same-folder `/rename` endpoint, which stays untouched).
- **`FilesService`** gains `copyFiles`/`copyItem`/`copyFolderItem` and `moveFiles`/`moveItem`/`moveFolderItem`, mirroring the `renameFiles`/`renameItem`/`renameFolderItem` structure already in `apps/chat-api/src/files/files.service.ts:1088`.
- **OpenAPI regeneration** — `copyFiles()` and `moveFiles()` methods added to `@epam/chat-api-client`, with matching thin wrappers in `apps/chat/src/server-api/files.api.ts`.
- **`useDialFileManager` hook**:
  - Adds `onCopyFiles(items, destinationFolder)` wired to the new `/copy` endpoint (ui-kit's `DialFileManager.onCopyFiles` prop — copy-paste).
  - Extends the existing `onMoveToFiles(items, sourceFolder, destinationFolder)` to branch on whether `sourceFolder === destinationFolder`: same-folder continues to call `/rename` (inline rename — **unchanged behavior**), different folders now call the new `/move` endpoint (cut-paste / cross-folder move). This is required because ui-kit exposes a single `onMoveToFiles` callback for **both** rename and cut-paste (confirmed via `getEntityDetails("component", "DialFileManager")`), so there is no separate ui-kit prop to hang a "move" handler off of.
  - Adds `isCopying`/`isMoving` state and an `OperationLoaderModal` (new component, modeled on the legacy `apps/chat/src/components/FileManager/OperationLoaderModal.tsx` on the `development` branch, rebuilt with current conventions) shown during copy/move with a cancel affordance.
- **`DialFileManagerShell`** wires the new `onCopyFiles` prop and Copy/Move action labels (`DialFileManagerActions.Copy` / `.Move`, already defined in ui-kit) when present in the hook's `actionLabels`.
- **`file-manager-tabs`** capability: the per-tab action-label table gains Copy and Move rows (`my_files` only, WRITE-gated) alongside the existing Rename row.

**Non-breaking**: additive endpoints and props; existing `/rename` contract, inline-rename behavior, and the attach-modal flow (`actionProfile=attach`) are untouched.

## Capabilities

### New Capabilities

- `file-manager-copy-move`: BFF `POST /api/v1/files/copy` and `POST /api/v1/files/move` contracts (DTOs, folder-expansion reuse, partial-failure semantics, rate limiting), hook wiring (`onCopyFiles`, extended `onMoveToFiles`), and the operation-loader progress/cancel UI.

### Modified Capabilities

- `file-manager-tabs`: per-tab action-label table gains Copy and Move rows, `my_files`-only and WRITE-gated, matching the existing Rename row's visibility rule.

## Impact

- **Backend**: `apps/chat-api/src/files/` — two new controller routes, two new DTO files (`copy-files.dto.ts`, `move-files.dto.ts` mirroring `rename-files.dto.ts`), new service methods reusing `expandFolderContents`.
- **Generated client**: `libs/chat-api-client/` regenerated after Swagger update (`npm run openapi`, `npm run openapi:check`).
- **Frontend**: `apps/chat/src/server-api/files.api.ts` (new `copyFiles`/`moveFiles` wrappers), `useDialFileManager` hook, `DialFileManagerShell` + its `types/labels.ts`, a new `OperationLoaderModal` component, i18n keys in `apps/chat/src/i18n/locales/en.json` + `apps/chat/src/constants/translation-keys.ts`.
- **Docs**: OpenSpec capability specs document the copy/move API and the tab action-matrix delta.
- **Dependencies**: none new — uses the already-installed `@epam/ai-dial-typescript-sdk` `copyResource`/`moveResource` operations (confirmed present at `node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts`) and the already-defined ui-kit `onCopyFiles`/`DialCopiedItem`/`DialFileManagerActions.Copy`/`.Move` contracts (confirmed via the `ai-dial-ui-kit` MCP server).
- **Out of scope (tracked as separate follow-up OpenSpec changes)**: destination-folder picker UI (`add-file-manager-select-folder-modal`), same-folder duplicate (`add-file-manager-duplicate`), and the full standalone action-matrix rollout including `actionProfile=full` (`add-file-manager-standalone-actions`). Until the picker ships, `onCopyFiles`/cross-folder `onMoveToFiles` are reachable only through the ui-kit's own copy-paste/cut-paste affordances (e.g. keyboard shortcuts within the grid/tree), not a dedicated menu action — a standalone "Copy"/"Move" menu entry that opens a destination picker is step 10's job.
