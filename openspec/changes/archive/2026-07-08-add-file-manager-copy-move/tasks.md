## 1. BFF — Copy DTOs and single-file copy

- [x] 1.1 Create `CopyItemNodeType` string enum and `CopyItemDto` / `CopyFilesDto` / `CopyItemResultDto` / `CopyFilesResponseDto` DTO classes in `apps/chat-api/src/files/dto/copy-files.dto.ts`, mirroring `apps/chat-api/src/files/dto/rename-files.dto.ts` field-for-field (bucket/sourcePath/destinationPath/nodeType/name with the same class-validator decorators and `@ApiProperty` annotations)
- [x] 1.2 Add `copyFileItem(bucket, sourcePath, destPath, at)` private method to `FilesService`: build `sourceUrl`/`destinationUrl` as `files/{bucket}/{encodedPath}`, call `this.client.copyResource({ headers, body: { sourceUrl, destinationUrl, overwrite: false } })`, map 409 → `"Conflict"`, 403 → `"Forbidden"`, 404 → `"Not found"`, other → `"Copy failed"` (extract or mirror the `getRenameErrorMessage` pattern for copy)
- [x] 1.3 Add `copyFiles(items: CopyItemDto[], at: string): Promise<CopyFilesResponseDto>` public method to `FilesService`, dispatching folder items to a new `copyFolderItem` (task 2.1) and other items to `copyFileItem`, running top-level batch items via `Promise.all` (matches `renameFiles`); add structured `logger.log` at start and end (batchSize, successCount, failedCount)
- [x] 1.4 Add `@Post('copy') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60000 } })` route to `FilesController` with full `@ApiOperation`/`@ApiResponse` Swagger decorators (200/400/401/429/502/503); delegate to `FilesService.copyFiles`
- [x] 1.5 Write unit tests in `apps/chat-api/src/files/tests/files.service.spec.ts`: `copyFileItem` success (200), conflict (409), forbidden (403), not found (404), unexpected error — mirror the existing `renameFileItem` test block
- [x] 1.6 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 2. BFF — Folder copy

- [x] 2.1 Add `copyFolderItem(bucket, sourceFolderPath, destFolderPath, at)` private method to `FilesService`: normalise trailing `/`, call `expandFolderContents(bucket, srcPrefix, '', at)`, iterate expanded children sequentially calling `copyFileItem` per child (`destChildPath = destPrefix + child.archivePath`); return `success: false, error: "Partial copy"` if any child fails, matching `renameFolderItem`'s shape exactly
- [x] 2.2 Wire `copyFiles` dispatch to route `nodeType === 'folder'` items through `copyFolderItem`
- [x] 2.3 Write unit tests for `copyFolderItem`: all-success (including `.dial_folder` marker), partial failure (one child 403), pagination (multiple pages via `nextToken`), empty folder (no children) — mirror the existing `renameFolderItem` test block
- [x] 2.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 3. BFF — Move DTOs and single-file move

- [x] 3.1 Create `MoveItemNodeType` string enum and `MoveItemDto` / `MoveFilesDto` / `MoveItemResultDto` / `MoveFilesResponseDto` DTO classes in `apps/chat-api/src/files/dto/move-files.dto.ts`, mirroring `copy-files.dto.ts` (task 1.1) field-for-field
- [x] 3.2 Add `moveFileItem(bucket, sourcePath, destPath, at)` private method to `FilesService`: call `this.client.moveResource({ headers, body: { sourceUrl, destinationUrl, overwrite: false } })`, mapping errors the same way as `copyFileItem` but with `"Move failed"` as the fallback message
- [x] 3.3 Add `moveFiles(items: MoveItemDto[], at: string): Promise<MoveFilesResponseDto>` public method to `FilesService`, structured identically to `copyFiles` (task 1.3)
- [x] 3.4 Add `@Post('move') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60000 } })` route to `FilesController` with full Swagger decorators; delegate to `FilesService.moveFiles`. Confirm this route is additive and does not alter the existing `@Post('rename')` route or its dispatch logic in any way
- [x] 3.5 Write unit tests for `moveFileItem`: success, conflict, forbidden, not found, unexpected error
- [x] 3.6 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 4. BFF — Folder move

- [x] 4.1 Add `moveFolderItem(bucket, sourceFolderPath, destFolderPath, at)` private method to `FilesService`, structured identically to `copyFolderItem` (task 2.1) but calling `moveFileItem`, with `error: "Partial move"` on partial failure
- [x] 4.2 Wire `moveFiles` dispatch to route `nodeType === 'folder'` items through `moveFolderItem`
- [x] 4.3 Write unit tests for `moveFolderItem`: all-success (including `.dial_folder` marker), partial failure, pagination, empty folder
- [x] 4.4 Write integration/e2e-style tests (supertest) in `apps/chat-api/src/files/tests/files.controller.spec.ts` for both `POST /api/v1/files/copy` and `POST /api/v1/files/move`: valid single file, valid folder, validation errors (empty items, >100 items), unauthenticated
- [x] 4.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 5. OpenAPI client regeneration and server-api wrappers

- [x] 5.1 Run `npm run openapi` to regenerate `libs/chat-api-client/` from the updated Swagger; verify `filesApi.copyFiles` and `filesApi.moveFiles` methods appear in the generated client with clean names (not `FilesController_copyFiles_v1`-style)
- [x] 5.2 Run `npm run openapi:check`
- [x] 5.3 Add `copyFiles(items: CopyItemDto[]): Promise<CopyFilesResponseDto>` and `moveFiles(items: MoveItemDto[]): Promise<MoveFilesResponseDto>` thin wrappers in `apps/chat/src/server-api/files.api.ts`, following the exact shape of the existing `renameFiles` wrapper
- [x] 5.4 Run `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client` — both must pass

## 6. Hook — onCopyFiles

- [x] 6.1 Add `isCopying` state and `onCopyFiles(items: DialCopiedItem[], destinationFolder: string)` `useCallback` to `useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`): map `DialCopiedItem[]` → `CopyItemDto[]` via `virtualPathToApiPath` (same resolution pattern as `onMoveToFiles`), call `copyFiles`
- [x] 6.2 On completion, invalidate the cache entries for source and destination parent folders of every copied item and increment `retryCounter` (mirror `onDeleteFiles`'s `affectedFolderKeys` computation)
- [x] 6.3 Show a single error toast on full failure (`DialFileManagerI18nKeys.CopyError`) or partial failure (`DialFileManagerI18nKeys.CopyPartialError`, with `{{count}}`); no toast on full success
- [x] 6.4 Add `cancelCopyMove` support: thread an `AbortController` per `onCopyFiles` call through the `copyFiles` server-api wrapper and generated client call
- [x] 6.5 Write unit tests for `onCopyFiles` in `apps/chat/src/hooks/files/tests/useDialFileManager.spec.tsx` (or the existing test file for this hook): success (cache invalidated, no toast), partial failure (toast shown with count), full failure (toast shown), cancel (abort clears `isCopying` with no toast)
- [x] 6.6 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 7. Hook — onMoveToFiles cross-folder move

- [x] 7.1 Add `isMoving` state to `useDialFileManager`, distinct from the existing `isRenaming`
- [x] 7.2 Extend `onMoveToFiles`: for each `DialCopiedItem`, compute the source and destination parent folder from `item.sourceUrl`/`item.destinationUrl`; partition items into a same-folder group (existing rename path, `RenameItemDto[]` → `renameFiles`, **unchanged**) and a cross-folder group (`MoveItemDto[]` → new `moveFiles` call)
- [x] 7.3 Run both groups when both are non-empty; merge failure counts from both into a single notification call, matching the existing `RenamePartialError`/`RenameError` toast copy pattern but using `MoveError`/`MovePartialError` keys for the move-only portion when the rename portion has no failures (design.md D3 — keep the merged-count behavior simple: report combined failed/total across both groups in one message)
- [x] 7.4 Invalidate cache entries for source and destination parent folders of every cross-folder-moved item (mirror `onDeleteFiles`); keep the existing rename-group invalidation logic unchanged
- [x] 7.5 Add `cancelCopyMove` abort wiring for the cross-folder-move branch (same `AbortController` mechanism as task 6.4; a single `cancelCopyMove` callback aborts whichever of copy/move is in flight, since only one runs at a time from the UI)
- [x] 7.6 Write unit tests for the extended `onMoveToFiles`: same-folder batch calls only `renameFiles` (regression test — must still pass unchanged), cross-folder batch calls only `moveFiles`, mixed batch calls both and merges the failure toast
- [x] 7.7 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 8. OperationLoaderModal component

- [x] 8.1 Create `apps/chat/src/components/DialFileManagerModal/OperationLoaderModal.tsx`: a memoized `FC<Props>` using ui-kit `DialPopup` + `DialSpinner`, props for `title`, `text`, `cancelLabel`, `onCancel` — modeled on the legacy `OperationLoaderModal` visual shape (spinner + title + text + cancel button) but rebuilt with current conventions (no Redux, no legacy `Translation`/`useTranslation` types — labels passed in as pre-translated strings, matching how `UploadProgressModal` receives its labels)
- [x] 8.2 Add a `tests/OperationLoaderModal.spec.tsx` covering: renders title/text, cancel button calls `onCancel`, `aria-live="polite"` present
- [x] 8.3 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 9. Shell wiring

- [x] 9.1 Pass `onCopyFiles`, `isCopying`, `isMoving`, `cancelCopyMove` from `useDialFileManager` result through to `DialFileManagerShell` (`apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`) and on to `DialFileManager`'s `onCopyFiles` prop
- [x] 9.2 Add `copyLabel`/`moveLabel`, `operationLoaderCopyTitle`/`operationLoaderMoveTitle`, `operationLoaderCancelLabel` to `DialFileManagerShellLabels` (`apps/chat/src/components/DialFileManagerShell/types/labels.ts`)
- [x] 9.3 Extend the shell's `actionLabels` computation to include `DialFileManagerActions.Copy`/`.Move` when present in the hook's `actionLabels` (mirror the existing `Rename` mapping in `DialFileManagerShell.tsx`)
- [x] 9.4 Render `OperationLoaderModal` in `DialFileManagerShell` when `isCopying || isMoving`, passing the copy- or move-specific title/text based on which flag is set and wiring `onCancel` to `cancelCopyMove`
- [x] 9.5 Run `npm exec nx lint chat` and `npm exec nx build chat` — both must pass

## 10. Standalone page and tab-action-matrix spec update

- [x] 10.1 Extend `useDialFileManager`'s `actionLabels` computation (`apps/chat/src/hooks/files/useDialFileManager.ts`) to include `DialFileManagerActions.Copy` and `DialFileManagerActions.Move` for `my_files` when `uploadEnabled` is `true`, alongside the existing `Rename` entry
- [x] 10.2 Verify `DialFileManagerPage` (`actionProfile: Browse`) surfaces Copy/Move consistently with Rename — no `actionProfile` change is required in this slice since Copy/Move are gated the same way as the already-shipped Rename action, not by `actionProfile=Full`
- [x] 10.3 Confirm the attach-modal flow (`actionProfile=Attach`) is unaffected — Copy/Move labels are added only under the `my_files`-tab branch already used by Rename, which the attach modal does not reach with `uploadEnabled` implications beyond what Rename already exercises today

## 11. i18n and RTL

- [x] 11.1 Add the eleven i18n keys listed in `specs/file-manager-copy-move/spec.md` (`copyAction`, `moveAction`, `copyingLabel`, `movingLabel`, `copyError`, `copyPartialError`, `moveError`, `movePartialError`, `operationLoaderCopyTitle`, `operationLoaderMoveTitle`, `operationLoaderCancelLabel`) to `apps/chat/src/i18n/locales/en.json`
- [x] 11.2 Add matching enum members to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`; replace any raw string literal keys introduced during earlier tasks with enum references
- [x] 11.3 RTL check: confirm `OperationLoaderModal` and the extended shell action labels use only ui-kit-owned chrome and existing logical-property patterns (no new physical-direction Tailwind classes); no directional icons are introduced by this change, so no icon-mirroring task is needed

## 12. Full verification and OpenSpec docs

- [x] 12.1 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all must pass
- [x] 12.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — all must pass
- [x] 12.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all must pass
