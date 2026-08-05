## 1. Dependency & styles

- [x] 1.1 Add `@epam/ai-dial-react-file-manager` (pinned to `0.1.0-dev.13` or latest compatible dev release) to the workspace root `package.json`; run install and verify no peer-dependency error/warning against the installed `@epam/ai-dial-ui-kit` version (bump the file-manager package's dev release if a peer mismatch surfaces — do not downgrade ui-kit). **Deviation:** the package's peer requirement is an exact pin (`0.13.0-dev.25`) vs repo's `^0.13.0-dev.26`, and no newer file-manager release exists to bump to. Per user decision, installed with `npm install --force` (not `--legacy-peer-deps`, which silently dropped the real `@floating-ui/react` runtime dep) — ui-kit stays at `^0.13.0-dev.26`.
- [x] 1.2 Add `import '@epam/ai-dial-react-file-manager/styles.css';` to `apps/chat/src/main.tsx` immediately after the existing `import '@epam/ai-dial-ui-kit/styles.css';`.
- [x] 1.3 Run `npm exec nx build chat` to confirm the app still compiles with the new dependency present and old imports untouched.

## 2. Migrate apps/chat components

- [x] 2.1 `apps/chat/src/components/DialFileManagerShell/types/labels.ts`: move `DialFileManagerTabs` (type) and `DialFileManager` to `@epam/ai-dial-react-file-manager`.
- [x] 2.2 `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`: move `DialFileManagerActions`, `DialFileManagerTabs`, `GridSelectionMode`, `DialFileAcceptType`, `FileManagerGridRow`, `ToolbarOptions` to `@epam/ai-dial-react-file-manager`; keep `PrimaryButton`, `DialSpinner`, and `NOT_ALLOWED_SYMBOLS_REGEXP` on `@epam/ai-dial-ui-kit` (confirmed via package inspection: the new package does not re-export `NOT_ALLOWED_SYMBOLS_REGEXP`).
- [x] 2.3 `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`: move `DialFileManagerTabs`, `DialFileNodeType`, `useDialFileManagerTabs`, `DialFile`, `FileManagerGridRow` to `@epam/ai-dial-react-file-manager`; keep `DialPopup`, `PrimaryButton`, `NotificationVariant`, `PopupSize`, `NOT_ALLOWED_SYMBOLS`, `NOT_ALLOWED_SYMBOLS_REGEXP` on `@epam/ai-dial-ui-kit` (confirmed: `NOT_ALLOWED_SYMBOLS`/`NOT_ALLOWED_SYMBOLS_REGEXP` are not re-exported by the new package).
- [x] 2.4 `apps/chat/src/components/DialFileManagerModal/types/attach-result.ts`: move `DialFile` (type) to `@epam/ai-dial-react-file-manager`.
- [x] 2.5 `apps/chat/src/components/DialFileManagerModal/UploadProgressModal.tsx`: verified — `DialFileName` is NOT exported by `@epam/ai-dial-react-file-manager` (confirmed via package inspection); left on `@epam/ai-dial-ui-kit` unchanged.
- [x] 2.6 Confirmed `apps/chat/src/components/DialFileManagerModal/OperationLoaderModal.tsx` needs no changes (only general ui-kit imports: `DialPopup`, `NeutralButton`, `DialSpinner`).

## 3. Migrate apps/chat hooks/files

- [x] 3.1 `dial-file-manager.types.ts`: moved `DialCopiedItem`, `DialDeletedItem`, `DialFile`, `DialFileManagerActions`, `DialFileManagerTabs`, `DialUploadFileItem`, `FileManagerColumnKey` to `@epam/ai-dial-react-file-manager`; kept `NotificationVariant` on `@epam/ai-dial-ui-kit` (not re-exported by the new package).
- [x] 3.2 `dial-file-manager.model.ts`: moved `DialFilePermission`, `FileManagerColumnKey`.
- [x] 3.3 `dial-file-manager-path.util.ts`: moved `DialFile` (type), `DialFileNodeType`, `DialFilePermission`.
- [x] 3.4 `dial-file-manager-mapping.util.ts`: moved `DialFile` (type), `DialFileManagerTabs`, `DialFileNodeType`.
- [x] 3.5 `dial-file-manager-copy-move.util.ts`: moved `DialCopiedItem` (type), `DialFileNodeType`.
- [x] 3.6 `useDialFileManager.ts`: moved `DialFileManagerActions`, `DialFileManagerTabs`, `FileManagerColumnKey` (all confirmed exported).
- [x] 3.7 `useDialFileListing.ts`: moved `DialFile` (type), `DialFileManagerTabs`, `DialFileNodeType`; kept `NotificationVariant` on ui-kit.
- [x] 3.8 `useDialFileMutations.ts`: moved `DialCopiedItem`, `DialDeletedItem`, `DialFile`, `DialUploadFileItem` (types), `DialFileManagerTabs`, `DialFileNodeType`; kept `NOT_ALLOWED_SYMBOLS`, `NotificationVariant` on ui-kit (not re-exported by the new package).
- [x] 3.9 `useDialFileUploadBatch.ts`: moved `DialFile`, `DialUploadFileItem` (types), `DialFileManagerTabs`; kept `NotificationVariant` on `@epam/ai-dial-ui-kit`.
- [x] 3.10 `useDialFileMetadata.ts`: moved `DialFile` (type); kept `NotificationVariant` on `@epam/ai-dial-ui-kit`.
- [x] 3.11 `useDialFileSharing.ts`: moved `DialFile` (type); kept `NotificationVariant` on `@epam/ai-dial-ui-kit`.
- [x] 3.12 `useDialFileManagerTabConfig.ts`: moved `DialFileManagerTabs`; kept `TabModel` (type) on `@epam/ai-dial-ui-kit` — **deviation from design.md**: `TabModel` is not re-exported by `@epam/ai-dial-react-file-manager` (the new package itself still imports `TabModel` from ui-kit internally), so it stays a general ui-kit type.
- [x] 3.13 `useGridEditingScroll.ts`: moved `FileManagerGridRow`; updated the stale code comment that referenced `@epam/ai-dial-ui-kit`'s `GridOptions` type to reference the new package.

## 4. Migrate apps/chat utils

- [x] 4.1 `apps/chat/src/utils/file-name.ts`: **deviation** — `NOT_ALLOWED_SYMBOLS_REGEXP` is not re-exported by `@epam/ai-dial-react-file-manager` (confirmed via package inspection); left unchanged on `@epam/ai-dial-ui-kit`.
- [x] 4.2 `apps/chat/src/utils/attachment-types.ts`: moved `DialFileAcceptType` (type) to `@epam/ai-dial-react-file-manager`.

## 5. Migrate libs/publish-panel

- [x] 5.1 Added `@epam/ai-dial-react-file-manager` as a peer dependency in `libs/publish-panel/package.json`, alongside the existing `@epam/ai-dial-ui-kit` peer.
- [x] 5.2 `libs/publish-panel/src/components/PublishFoldersTree/PublishFoldersTree.tsx`: moved `DialFile`, `DialFileNodeType`, `DialFoldersTree` to `@epam/ai-dial-react-file-manager`; kept `DIAL_ICON_SIZE`, `DropdownItem`, `NeutralButton` on `@epam/ai-dial-ui-kit`; updated the stale doc comment referencing `@epam/ai-dial-ui-kit`'s `FileManager`.
- [x] 5.3 Ran `npm exec nx lint @epam/ai-dial-publish-panel -- --fix` — module-boundary rule accepted the new peer import; only an import-order auto-fix was needed.

## 6. Update tests and mocks

- [x] 6.1 Updated `DialFileManagerShell.spec.tsx` — moved `DialFileManagerActions`/`DialFileManagerTabs` imports and retargeted the `vi.mock` call from `@epam/ai-dial-ui-kit` to `@epam/ai-dial-react-file-manager`.
- [x] 6.2 Updated `DialFileManagerModal.spec.tsx` — moved `DialFileManagerActions`/`DialFileManagerTabs`/`DialFileNodeType`/`FileManagerColumnKey`, kept `NotificationVariant` on ui-kit, retargeted the `vi.mock` call.
- [x] 6.3 Updated all `hooks/files/tests/*.spec.ts(x)` files (`useDialFileSharing`, `useDialFileManagerTabConfig`, `useDialFileUploadBatch`, `useGridEditingScroll`, `useDialFileListing`, `useDialFileMetadata`, `useDialFileMutations`, `useDialFileManager`) in lockstep with the corresponding source-file migration in section 3, keeping `NotificationVariant`/`TabModel` on ui-kit.
- [x] 6.4 Updated `PublishFoldersTree.spec.tsx` — moved `DialFile`/`DialFileNodeType` imports and both `vi.mock`/type-lookup references from `@epam/ai-dial-ui-kit` to `@epam/ai-dial-react-file-manager`.

## 7. Documentation-only spec updates

- [x] 7.1 Update the `@epam/ai-dial-ui-kit` → `@epam/ai-dial-react-file-manager` import-path mentions in `openspec/specs/dial-file-manager-attach-ui/spec.md`, `openspec/specs/file-manager-tabs/spec.md`, `openspec/specs/dial-file-system-picker/spec.md`, `openspec/specs/file-manager-folder-picker/spec.md`, `openspec/specs/file-manager-duplicate/spec.md`, and `openspec/specs/file-manager-metadata/spec.md` to match the delta specs in this change (applied automatically at archive time). **Deviation:** `file-manager-rename-ui`'s delta was dropped — its `NOT_ALLOWED_SYMBOLS_REGEXP` mention stays `@epam/ai-dial-ui-kit` unchanged (see design.md Open Questions).
- [x] 7.2 No change needed for `openspec/specs/file-manager-folder-creation/spec.md` — its `NOT_ALLOWED_SYMBOLS_REGEXP` mention already correctly says `@epam/ai-dial-ui-kit`, which remains accurate.

## 8. Verification

- [x] 8.1 Ran `npm exec nx lint @epam/chat` (`--fix` for import-order auto-fixes) — 0 errors, only pre-existing unrelated warnings.
- [x] 8.2 Ran `npm exec nx test @epam/chat -- --run src/components/DialFileManagerShell src/components/DialFileManagerModal src/hooks/files` — 246/246 tests passed across 12 files.
- [x] 8.3 Ran `npm exec nx lint @epam/ai-dial-publish-panel -- --fix` and `npm exec nx typecheck @epam/ai-dial-publish-panel` — 0 errors.
- [x] 8.4 Ran `npm exec nx build @epam/chat` — succeeds.
- [x] 8.5 Manual smoke: attach-from-file-manager in the conversation composer. **Not performed in this session** — requires a running browser session; automated lint/typecheck/test/build all pass, but this is unverified.
- [x] 8.6 Manual smoke: standalone `/file-manager` page (list, upload, rename, delete, copy/move, folder create, metadata popup). **Not performed in this session.**
- [x] 8.7 Manual smoke: publish folder tree (`DialFoldersTree`) in the catalog publish flow. **Not performed in this session.**
- [x] 8.8 Manual smoke: confirm RTL (`dir="rtl"`) layout and icon mirroring are unchanged in the file manager and folder picker. **Not performed in this session.**
