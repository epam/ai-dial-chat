## 1. BFF — Single-file rename

- [x] 1.1 Create `RenameItemNodeType` string enum and `RenameItemDto` / `RenameFilesDto` / `RenameItemResultDto` / `RenameFilesResponseDto` DTO classes in `apps/chat-api/src/files/dto/rename-files.dto.ts` with full class-validator decorators and `@ApiProperty` annotations
- [x] 1.2 Add `renameFileItem(bucket, sourcePath, destPath, at)` private method to `FilesService`: build `sourceUrl` / `destinationUrl` as `files/{bucket}/{encodedPath}`, call `this.client.moveResource({ headers, body: { sourceUrl, destinationUrl, overwrite: false } })`, map 409 → `"Conflict"`, 403 → `"Forbidden"`, 404 → `"Not found"`, other → `"Rename failed"`
- [x] 1.3 Add `renameFiles(items: RenameItemDto[], at: string): Promise<RenameFilesResponseDto>` public method to `FilesService` with structured `logger.log` at start and end (batchSize, successCount, failedCount)
- [x] 1.4 Add `@Post('rename') @HttpCode(200) @Throttle(...)` route to `FilesController` with full `@ApiOperation` / `@ApiResponse` Swagger decorators; delegate to `FilesService.renameFiles`
- [x] 1.5 Write unit tests for `renameFileItem`: success (200), conflict (409), forbidden (403), not found (404), unexpected error
- [x] 1.6 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 2. BFF — Folder rename

- [x] 2.1 Add `renameFolderItem(bucket, sourceFolderPath, destFolderPath, at)` private method to `FilesService`: normalise trailing `/`, call `expandFolderContents(bucket, srcPrefix, '', at)`, iterate expanded files computing `destChildPath = destPrefix + relative`, call `renameFileItem` per child sequentially; return `success: false, error: "Partial rename"` if any child fails
- [x] 2.2 Update `renameFiles` dispatch to route `nodeType === 'folder'` items through `renameFolderItem`
- [x] 2.3 Write unit tests for `renameFolderItem`: all-success (including `.dial_folder` marker), partial failure (one child 403), pagination (multiple pages via `nextToken`), empty folder (no children)
- [x] 2.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — both must pass

## 3. OpenAPI client regeneration and server-api wrapper

- [x] 3.1 Run `npm run openapi` to regenerate `libs/chat-api-client/` from the updated Swagger; verify `filesApi.renameFiles` method appears in the generated client
- [x] 3.2 Add `renameFiles(items: RenameItemDto[]): Promise<RenameFilesResponseDto>` thin wrapper in `apps/chat/src/server-api/files.api.ts` using the generated `filesApi.renameFiles` method
- [x] 3.3 Run `npm exec nx build chat-api` and `npm exec nx lint chat` — both must pass

## 4. Hook — onRenameValidate and onMoveToFiles

- [x] 4.1 Add `isRenaming` state and `onRenameValidate(value, item)` `useCallback` to `useDialFileManager`: validate empty name, `.dial_folder` reserved, `/`/`\` chars, length > 255, duplicate sibling (case-insensitive), and `forbiddenSymbolsRegExp`; return i18n error string or `null`
- [x] 4.2 Add `onMoveToFiles(items: DialCopiedItem[], sourceFolder, destinationFolder)` `useCallback` to `useDialFileManager`: map `DialCopiedItem[]` → `RenameItemDto[]` via `virtualPathToApiPath`, call `renameFiles`, set `isRenaming`, invalidate listing cache for source/dest parents, trigger `setRetryCounter`, show partial/total failure toasts, navigate to new virtual path if renamed folder is current path or ancestor
- [x] 4.3 Extend `isOperationInProgress` to include `isRenaming` so concurrent operations are blocked during rename
- [x] 4.4 Add i18n keys to `apps/chat/src/i18n/locales/en.json`: `dialFileManager.renamingLabel`, `dialFileManager.renameError`, `dialFileManager.renamePartialError`, `dialFileManager.renameReservedName`, `dialFileManager.renameInvalidChars`, `dialFileManager.renameNameTooLong`; add matching enum members to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`
- [x] 4.5 Write unit tests for `onRenameValidate`: each validation rule (empty, reserved, slash, length, duplicate, valid)
- [x] 4.6 Write unit tests for `onMoveToFiles`: success (cache invalidated, retry triggered), partial failure (toast shown), folder rename (path navigation)
- [x] 4.7 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 5. Modal wiring and UI

- [x] 5.1 Pass `onRenameValidate`, `onMoveToFiles`, `isRenaming`, and `renameValidationMessages` (memoised) from `useDialFileManager` to `DialFileManager` in `DialFileManagerModal`
- [x] 5.2 Set `isRenameFileAvailable={uploadEnabled}` and `forbiddenSymbolsRegExp` (reuse existing) on `DialFileManager`
- [x] 5.3 Add `DialFileManagerActions.Rename` to `actionLabels` on `my_files` tab only (when `uploadEnabled`); keep Rename absent on `shared` and `organization` tabs
- [x] 5.4 Add rename loading overlay (`isRenaming`) and rename error banner to `DialFileManagerModal` — match the z-index, `aria-live="polite"` / `role="alert"` pattern of the delete overlay; add `clearRenameError` dismiss handler
- [x] 5.5 Run `npm exec nx lint chat` and `npm exec nx build chat` — both must pass (pre-existing ai-dial-catalog typecheck failure unrelated to this change; chat app typechecks clean)

## 6. Tests and OpenSpec docs

- [x] 6.1 Add integration/e2e-style tests for the `POST /api/v1/files/rename` controller route (supertest): valid single file, valid folder, validation errors (empty items, >100 items), unauthenticated
- [x] 6.2 Run full affected test suite: `npm exec nx affected --target=test --base=origin/development-1.0` — all must pass
