## Context

The Skill Editor is split across three layers:

- `libs/skill-editor` — host-agnostic form. `SkillEditor.tsx` renders `DialFoldersTree` (from `@epam/ai-dial-react-file-manager`, a declared peer) over `buildDialFileTree(files)`, a single "Upload from device" `NeutralButton` (`SkillEditor.tsx:375`), and a one-item context menu (`SkillEditor.tsx:347`). `SkillFileUploadDialog` stages `File`s as `SkillFileUploadCandidate`s and drives `fileActions.validateBatch` / `commitBatch`.
- `libs/chat-hooks/src/skill/useSkillFileActions.ts` — the DIAL-shape adapter that owns `files` mutation, batch validation (`skill-file-batch-validation.ts`) and the manifest-import confirmation gate. `fflate` is already a dependency (used by `conversation-transfer`).
- `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` — the host page: bucket, i18n, notifications, and the server-api wrappers.

The shared DIAL picker already exists as `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` (wrapping `FileManagerAttachModal` from `@epam/ai-dial-chat-shared/file-manager`), used by the conversation composer with `onAttach(result: AttachResult)`.

Constraint found in the peer: `DialFoldersTree`'s `createdFolderPath` only injects a draft under an existing parent node (`ai-dial-react-file-manager` `FoldersTree.tsx:201`), so it cannot create a root-level folder. `renamedPath` + `onRenameSave` / `onRenameCancel` / `onRenameValidate` work on any node.

## Goals / Non-Goals

**Goals:** the Add dropdown, node Add child / Add sibling / Delete, inline folder creation, archive and DIAL-file-system sources — all funnelled through the existing staging dialog so validation stays in one place; zero host knowledge in the lib; additive API.

**Non-Goals:** rename/move, new-empty-file, persisting empty folders, by-reference DIAL attachments, non-zip archives (see proposal).

## Decisions

### D1. One add pipeline: every file source ends in the staging dialog

Device files, archive entries and DIAL picks all become `SkillFileUploadCandidate`s in `SkillFileUploadDialog`, then flow through `validateBatch` → `commitBatch`. This reuses per-row errors, batch limits, manifest detection and the manifest-import confirmation for free, which the acceptance criteria require for archives.
*Alternative:* a separate `commitEntries` host call for archives/DIAL picks — rejected, it duplicates validation and loses per-row errors.

### D2. New lib contract (all optional, host-owned)

```ts
/** A file supplied by a host source (archive entry, DIAL pick), with its path relative to the add target. */
export interface SkillFileSourceEntry { path: string; file: File }

export interface SkillEditorFileActions {
  validateBatch; commitBatch; onRemoveNode;              // unchanged
  onCreateFolder?: (path: string) => void;
  validateFolderPath?: (path: string) => string | undefined;
  extractArchive?: (archive: File) => Promise<SkillFileSourceEntry[]>;
  pickFromFileSystem?: () => Promise<SkillFileSourceEntry[] | undefined>;
}

export enum SkillFileUploadMode { Files = 'files', Archive = 'archive' }
```

Presence of a callback gates its menu entry — the conventional capability-by-prop pattern the lib already uses for `onRefineDescription`. `pickFromFileSystem` is Promise-based so the lib does not need a render slot or to know when the modal closes; the host keeps the resolver in a ref, exactly like `confirmManifestImport` in `useSkillFileActions.ts:139`.
*Alternative:* a `renderFileSystemPicker` slot — rejected: the lib would then own modal open state for a component it can't type.

### D3. Draft-node folder creation

`SkillEditor` holds `draftFolder: { parentPath: string } | null`. `treeItems` appends a `SkillFileTreeNode` of kind Folder at `<parent>/<DRAFT_SEGMENT>` (a constant sentinel containing characters `isValidSkillRelativePath` rejects, so it can never collide with a real path), whose `DialFile.name` is the default name. `DialFoldersTree` gets `renamedPath` = draft path and `onRenameSave` / `onRenameCancel` / `onRenameValidate`. Validation lives in a pure util `validateFolderName(name, siblings, parentPath, labels)` in `utils/file-tree.ts`, then `fileActions.validateFolderPath`. The parent is added to `expandedPaths`. The draft is excluded from dirty tracking because it never enters `files`.
Because `onRenameSave` receives only the value, the handler reads the draft from state — there is one draft at a time.
The Files pane renders twice (mobile accordion and desktop sidebar, toggled by CSS), so the draft records the `SkillFilesPane` it was started from and only that rendering receives the draft node and `renamedPath`: two live rename fields would both save on the same outside click, the hidden one with the prefilled name.
The kit field treats `renamedPath` as a rename, so an invalid name on Enter/blur falls back to the prefilled name and saves it; `useDraftFolder` recognises that sequence (an invalid check of a different value right before the save) and cancels instead.
*Alternative:* `createdFolderPath` — rejected (root limitation above). *Alternative:* a "New folder" popup — rejected: the issue asks for inline naming.

### D4. Target folder

A pure helper `resolveAddTarget(source, node | selectedNode)` in `utils/file-tree.ts`:
header → selected node if folder else `''`; Add child → node path; Add sibling → parent of node path (or `''`). `SkillFileUploadDialog` gains `targetFolderPath?: string` and `initialEntries?: SkillFileSourceEntry[]`; `addFiles` / the open-transition effect map every source through `joinPath(target, path)`. Surface drag-and-drop keeps targeting the root (no ambiguity about "where").

### D5. Menus

The header uses ui-kit `ButtonDropdown` (neutral variant, `IconPlus` before) — it already sets `aria-haspopup="menu"` / `aria-expanded` and the `Dropdown` provides roles and arrow keys (verified in ui-kit `ButtonDropdown.tsx`). One builder `buildAddMenuItems(target)` produces the four entries and is reused for the header and for the `children` of Add child / Add sibling, so the lists cannot drift. Delete keeps `IconTrashX` and `removeIconClassName`. Icons: `IconFolderPlus`, `IconUpload`, `IconFileZip`, `IconDatabase` — symmetric, not mirrored.

### D6. Archive expansion in `chat-hooks`

`extractSkillArchive(file): Promise<SkillFileSourceEntry[]>` in `libs/chat-hooks/src/skill/skill-archive.ts`: `unzipSync(new Uint8Array(await file.arrayBuffer()))`, skip keys ending in `/`, starting with `__MACOSX/`, or whose last segment is `.DS_Store`; normalize `\` → `/`; wrap bytes in `new File([bytes], baseName, { type })` with the MIME type from `inferMimeTypeFromPath` (`@epam/ai-dial-chat-shared`), else `''`. No path or size checks here — `validateBatch` owns them (D1). `useSkillFileActions` wires it into `fileActions.extractArchive`, adds `onCreateFolder` (dedupe on existing path) and `validateFolderPath` (returns `messages.pathInvalid` when `isValidSkillRelativePath` rejects `<path>/probe`, so a folder path is checked with the same rules as a file under it), and accepts an optional `pickFromFileSystem` it passes through untouched. The hook gains one optional `pickFromFileSystem` param — no breaking change.
Unzipping is synchronous and bounded by the file picker; the BFF's 50 MB package limit (`SKILL_UPLOAD_MAX_TOTAL_BYTES`) is enforced right after in `validateBatch`. A zip bomb is capped by the browser tab memory, same risk profile as `conversation-transfer/zip-import.ts`.

### D7. DIAL picker in the app page

`SkillEditor` page holds `isFileSystemOpen` and `fileSystemResolveRef`. `pickFromFileSystem` opens the modal and returns a Promise. `onAttach(result)`: for each `result.files` item, resolve `bucket`/`path` from `file.url ?? file.id` (`files/{bucket}/{path}`, the format `dialFileToAttachment` produces), call `downloadFile(bucket, path)` from `apps/chat/src/server-api/files.api.ts`, `await response.blob()`, build a `File` with `file.name` and `contentType`; resolve with `{ path: file.name, file }`. On any failure: `showErrorNotification` with `skillEditor.fileSystemDownloadError` and resolve `undefined`. `onClose` resolves `undefined`. The modal is `React.lazy`-loaded like in `ConversationView.tsx:123`, and mounted only while open. The resolver + parsing helper live in a new app hook `apps/chat/src/hooks/skills/useSkillFileSystemPicker.ts` (one hook per file, JSDoc'd), keeping the page thin.
Bucket-decoding reuses the existing `files/` id convention; `decodeURIComponent` is applied per segment as `safeDecodeURI` does.

### D8. Labels

New `SkillEditorLabels`: `addLabel`, `createFolderLabel`, `uploadFilesLabel`, `uploadArchiveLabel`, `openFileSystemLabel`, `addChildLabel`, `addSiblingLabel`, `deleteLabel`, `newFolderDefaultName`, `folderNameRequiredError`, `folderNameInvalidError`, `folderNameDuplicateError`, `uploadArchiveDialogTitle`, `uploadArchiveDropZoneLabel`, `uploadArchiveDropZoneMobileLabel`, `uploadArchiveErrorMessage`, `uploadArchiveEmptyMessage`, `uploadArchiveExtractingAriaLabel`. `addUploadLabel` and `removeLabel` are kept as deprecated fallbacks for `uploadFilesLabel` / `deleteLabel` (JSDoc `@deprecated`), so an old host still sees its own strings.

### Memoisation

`treeItems`, `getContextMenuItems`, the header items and the rename handlers are `useMemo` / `useCallback`, keyed on `files`, `draftFolder`, `fileActions`, labels — `DialFoldersTree` re-renders the whole tree on a new `items` identity. `useSkillFileActions` keeps `fileActions` in its single `useMemo`. The app hook returns a stable `pickFromFileSystem` via `useCallback`.

### States

- Archive extraction: dialog shows `Spinner` with `uploadArchiveExtractingAriaLabel` and disables Confirm; error → existing `role="alert"` commit-error region; empty → same region.
- DIAL picker: modal owns loading/empty/error; download failures → error notification.
- Folder draft: inline error from `DialFoldersTree`'s rename field.

## Risks / Trade-offs

- [`DialFoldersTree` context-menu submenus] — `DropdownItem.children` is supported by the kit `Dropdown`, but the tree also re-uses the same items for its row "⋮" button and right-click menu. → Test both triggers render the submenu; if a gap appears it is fixed in the sibling `ai-dial-react-file-manager` repo, not patched here.
- [Empty folders disappear on save] → Documented in README and spec; the folder is still useful as an upload target in-session.
- [Downloading many large DIAL files in the browser] → Bounded by `validateBatch`'s total-size limit right after; downloads run in parallel with `Promise.all` and abort on failure.
- [Sentinel draft path appearing in host callbacks] → Never passed out: `onRenameSave` builds `<parent>/<name>`; `onItemClick` on the draft is ignored.
- [Label rename Remove → Delete] → Deprecated fallback keeps old hosts' copy.

## Migration Plan

Additive. Ship lib + hook + page together (same repo). Rollback: revert the change; no persisted data or endpoints change.

## Open Questions

None blocking. Whether a future design wants surface drag-and-drop to target the hovered folder is left for a follow-up.
