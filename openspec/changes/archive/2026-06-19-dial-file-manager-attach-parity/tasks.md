## 1. BFF + model: propagate max_input_attachments from DIAL Core

- [x] 1.1 Add `max_input_attachments?: number` to `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`.
- [x] 1.2 Add `maxInputAttachments?: number` to `apps/chat-api/src/deployments/dto/deployment-item.dto.ts` with `@ApiPropertyOptional({ description: 'Maximum number of attachments allowed per message; undefined when not specified by DIAL Core' })`.
- [x] 1.3 In `mapToDeploymentItem` in `apps/chat-api/src/deployments/deployments.service.ts`, map `raw.max_input_attachments` → `maxInputAttachments` (keep `undefined` when absent).
- [x] 1.4 Add `maxInputAttachments?: number` to `DeploymentItem` in `libs/chat-shared/src/models/deployment.ts` with a JSDoc comment.
- [x] 1.5 Verify: `npm exec nx typecheck chat-api` and `npm exec nx lint chat-api` pass; `npm exec nx typecheck chat` passes.

## 2. Props plumbing, AttachResult type, and call-site wiring

- [x] 2.1 Define `AttachResult` interface (`{ files: DialFile[]; folderPaths: string[] }`) in `apps/chat/src/components/DialFileManagerModal/types/` (or alongside the modal); export it.
- [x] 2.2 Add constant `MAX_SELECTABLE_FILE_SIZE_BYTES = 512 * 1024 * 1024` to `apps/chat/src/constants/files.ts` (create the file if it does not exist).
- [x] 2.3 Update `DialFileManagerModal` `Props` interface: change `onAttach` to `(result: AttachResult) => void`; add `allowedTypes?: string[]`, `maxSelectableFileSize?: number`, `maximumAttachmentsAmount?: number`, `canAttachFolders?: boolean`, `allowedTypesLabel?: string`.
- [x] 2.4 Update `useDialFileManagerState` — change `handleAttach` to accept `AttachResult`; update `UseDialFileManagerStateResult`; pass `result.files` to `dialFilesToAttachments`.
- [x] 2.5 Update `ConversationRoute`: change `handleAttachDialFiles` to accept `AttachResult`; pass `allowedTypes={inputAttachmentTypes}`, `maxSelectableFileSize={MAX_SELECTABLE_FILE_SIZE_BYTES}`, and `maximumAttachmentsAmount={selectedDeployment?.maxInputAttachments}` to `DialFileManagerModal`.
- [x] 2.6 Update `ConversationView`: change inline `handleAttachDialFiles` to accept `AttachResult`; pass the same three constraint props using the active deployment from `useDeployments`.
- [x] 2.7 Verify: `npm exec nx typecheck chat` passes with no new errors.

## 3. Header description block

- [x] 3.1 Add i18n keys to `apps/chat/src/i18n/locales/en.json`: `dialFileManager.maxSizeSupportedTypes` (params: `maxSize`, `allowedExtensions`) and `dialFileManager.upToFiles` (param: `count`).
- [x] 3.2 Add corresponding enum members to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`.
- [x] 3.3 In `DialFileManagerModal`, compute the header description string with `useMemo` from `allowedTypes`, `maxSelectableFileSize`, and `maximumAttachmentsAmount`; use `mimeTypesToExtensionLabels` for the type label; use `allowedTypesLabel` override when provided.
- [x] 3.4 Render the description paragraph below the modal title, using `text-secondary text-sm` and `text-start` (RTL-safe). Conditionally render only when at least one constraint is active.
- [x] 3.5 Verify: open modal without constraints → no description; open with `allowedTypes=['image/*']` and `maxSelectableFileSize={MAX_SELECTABLE_FILE_SIZE_BYTES}` → description shows "Image files" and "512 MB".

## 4. Grid selection rules (hidden paths, MIME, file size)

- [x] 4.1 Create `isHiddenPath(path: string): boolean` in `apps/chat/src/utils/file-path.ts` (or add to an existing app-level file-path utility), importing `HIDDEN_FILE` from `@epam/ai-dial-chat-shared`.
- [x] 4.2 Extend `isRowSelectable` inside the `useMemo`-wrapped `gridOptions` in `DialFileManagerModal`:
  - Return `false` when `isHiddenPath(row.path)`.
  - Return `false` when `row.nodeType === DialFileNodeType.ITEM`, `row.contentType` is defined, `allowedTypes` is non-empty, and `!isMimeTypeAllowed(row.contentType, allowedTypes)`.
  - Return `false` when `row.nodeType === DialFileNodeType.ITEM`, `maxSelectableFileSize` is defined, `row.contentLength` is defined, and `row.contentLength > maxSelectableFileSize`.
  - Keep existing `DialFileNodeType.ITEM`-only guard for when `canAttachFolders` is `false` (folder rows remain non-selectable until Slice 6).
- [x] 4.3 Add `allowedTypes` and `maxSelectableFileSize` to the `useMemo` dependency array of `gridOptions`.
- [x] 4.4 Verify: `npm exec nx lint chat` and `npm exec nx typecheck chat` pass.

## 5. Disabled-row tooltip for hidden paths

- [x] 5.1 Add i18n key `dialFileManager.attachingHiddenFilesNotAllowed` to `en.json` and the corresponding enum member to `DialFileManagerI18nKeys`.
- [x] 5.2 Implement `getDisabledTooltip` in `DialFileManagerModal` as a `useCallback` that returns `t(DialFileManagerI18nKeys.AttachingHiddenFilesNotAllowed)` when `isHiddenPath(row.path)` and `undefined` otherwise.
- [x] 5.3 Pass `getDisabledTooltip` to `<DialFileManager>` (confirm prop name with UI kit MCP `getEntityDetails("component", "DialFileManager")` before wiring).
- [x] 5.4 Verify: hover/focus a hidden-path row → tooltip appears; normal row → no tooltip.

## 6. Attach handler validation and toasts

- [x] 6.1 Add i18n keys for attach toasts to `en.json` and `DialFileManagerI18nKeys`: `unsupportedFilesSkipped`, `unsupportedFilesDescription`, `tooManyFilesSelected`, `tooManyFilesDescription` (params: `count`, `limit`).
- [x] 6.2 Wire `useNotification()` into `DialFileManagerModal` to access `showNotification`.
- [x] 6.3 Update `handleAttach` in `DialFileManagerModal`:
  - Filter `selectedFiles` removing hidden paths (`isHiddenPath`) and MIME-invalid files (when `allowedTypes` is non-empty).
  - If any were removed due to MIME mismatch, call `showNotification({ variant: NotificationVariant.Info, title: t(...UnsupportedFilesSkipped), message: t(...UnsupportedFilesDescription) })`.
  - Count remaining valid files. If `maximumAttachmentsAmount > 0` and count exceeds it, call `showNotification({ variant: NotificationVariant.Error, ... })` and return without calling `onAttach` (modal stays open).
  - Otherwise, call `onAttach({ files: validFiles, folderPaths: [] })` (folder paths wired in Slice 7).
- [x] 6.4 Verify: select all-valid files → attach succeeds; select 1 unsupported type + 2 valid → info toast, 2 files attached; select 5 valid when limit is 3 → error toast, modal stays open.
- [x] 6.5 Run `npm exec nx test chat` — confirm no regressions.

## 7. Folder attach

- [x] 7.1 Extend `filesByPath` `useMemo` in `DialFileManagerModal` to index `DialFileNodeType.FOLDER` nodes in addition to `ITEM` nodes.
- [x] 7.2 Update `isRowSelectable`: return `true` for non-hidden folder rows when `canAttachFolders` is `true`; add `canAttachFolders` to the `useMemo` dependency array.
- [x] 7.3 Implement parent-folder dedup in `handleAttach`:
  - Collect `selectedFolderPaths` from selected nodes where `nodeType === DialFileNodeType.FOLDER`.
  - Exclude a folder path if another selected folder path + `'/'` is a proper prefix of it.
  - Exclude a selected file if any surviving folder path + `'/'` is a proper prefix of its path.
  - Call `onAttach({ files: dedupedFiles, folderPaths: dedupedFolderPaths })`.
- [x] 7.4 Update `useDialFileManagerState.handleAttach` to forward `folderPaths` in the result (convert only `result.files` to attachments; keep `folderPaths` for future use).
- [x] 7.5 Verify with `canAttachFolders={true}` smoke test: selecting a folder returns the folder path; selecting a folder + its nested file deduplicates the file; sibling folders are both kept.
- [x] 7.6 Run `npm exec nx lint chat` and `npm exec nx test chat` — confirm no regressions.
