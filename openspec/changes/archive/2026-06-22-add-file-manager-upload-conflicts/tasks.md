## 1. Filename Sanitization Util + Hook Integration

- [x] 1.1 Create `apps/chat/src/utils/file-name.ts` exporting `sanitizeFileName(name: string): string` — splits on last `.`, applies `NOT_ALLOWED_SYMBOLS_REGEXP` (imported from `@epam/ai-dial-ui-kit`) to the base name replacing each match with `_`, trims trailing dots/whitespace from base name, re-attaches extension; returns original if sanitized base is empty
- [x] 1.2 Add unit tests for `sanitizeFileName` in `apps/chat/src/utils/tests/file-name.spec.ts` covering: forbidden chars replaced, extension preserved, trailing dot trimmed, no-extension file, empty-base fallback, clean name unchanged
- [x] 1.3 Update `useDialFileManager.onValidateUpload` to call `sanitizeFileName` on each `DialUploadFileItem.name` in-place before returning; remove the `{ valid: false }` return path for name collisions (return `{ valid: true }` instead)
- [x] 1.4 Add `dialFileManager.forbiddenSymbolsTooltip` i18n key to `apps/chat/src/i18n/locales/en.json`
- [x] 1.5 Pass `forbiddenSymbolsRegExp={NOT_ALLOWED_SYMBOLS_REGEXP}` and `forbiddenSymbolsTooltip={t('dialFileManager.forbiddenSymbolsTooltip')}` to `DialFileManager` in `DialFileManagerModal`
- [x] 1.6 Run `npm exec nx test chat` — all hook and util tests pass; run `npm exec nx lint chat` — no new errors

## 2. Conflict Resolution Popup Wiring

- [x] 2.1 Add conflict popup i18n keys to `apps/chat/src/i18n/locales/en.json`: `dialFileManager.conflictSingleTitle`, `dialFileManager.conflictMultipleTitle`, `dialFileManager.conflictReplace`, `dialFileManager.conflictDuplicate`, `dialFileManager.conflictDecideForEach`, `dialFileManager.conflictReplaceAll`, `dialFileManager.conflictDuplicateAll`
- [x] 2.2 Add `DialFileManagerConflictResolutionPopupOptions` import from `@epam/ai-dial-ui-kit` and `DialFileManagerConflictActions`, `DialFileManagerConflictStrategies` constants
- [x] 2.3 Build `conflictResolutionPopupOptions` object in `DialFileManagerModal` (wrapped in `useMemo`) using the new i18n keys; include `singleFileTitle`, `multipleFilesTitle`, `actionLabels`, `strategyLabels`, `confirmLabel`, `cancelLabel`
- [x] 2.4 Pass `conflictResolutionPopupOptions` to `DialFileManager` in `DialFileManagerModal`
- [x] 2.5 Add test in `apps/chat/src/components/DialFileManagerModal/tests/` verifying `conflictResolutionPopupOptions` is passed to `DialFileManager`
- [x] 2.6 Run `npm exec nx test chat` and `npm exec nx lint chat` — no errors

## 3. Upload Mode: BFF `uploadMode` Field

- [x] 3.1 Add `uploadMode` field to `apps/chat-api/src/files/dto/file-params.dto.ts` (or extend from `FileParamsDto`): `@IsOptional() @IsIn(['overwrite', 'create-only']) uploadMode?: 'overwrite' | 'create-only'`; update `@ApiBody` schema in `FilesController.uploadFile` to include `uploadMode`
- [x] 3.2 Update `FilesService.uploadFile` signature to accept `uploadMode?: 'overwrite' | 'create-only'`; when `uploadMode === 'create-only'` add `'If-None-Match': '*'` to the `headers` passed to `this.client.uploadFile`; when DIAL Core returns 412 map to `HttpException(409, 'File already exists at this path')`
- [x] 3.3 Update `FilesController.uploadFile` to extract `uploadMode` from body and pass to `FilesService.uploadFile`
- [x] 3.4 Add BFF unit tests in `apps/chat-api/src/files/tests/` for: overwrite path (no If-None-Match), create-only path (If-None-Match: * sent), 412→409 mapping
- [x] 3.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` — all pass
- [x] 3.6 Regenerate `@epam/chat-api-client`: run the OpenAPI generation script (see `apps/chat-api/AGENTS.md` for the regen command); verify `filesApi.uploadFile` request type includes `uploadMode?`
- [x] 3.7 Run `npm exec nx build chat-api` — successful

## 4. Frontend Upload Mode Adapter

- [x] 4.1 Add `uploadMode?: 'overwrite' | 'create-only'` to `UploadFileWithProgressOptions` in `apps/chat/src/server-api/upload-file-with-progress.ts`; append `uploadMode` to `FormData` when provided
- [x] 4.2 Update `uploadFile` in `apps/chat/src/server-api/files.api.ts` to accept and pass through `uploadMode` in both the generated-client path and the XHR progress path
- [x] 4.3 Update `useDialFileManager.onUploadFiles` to determine `uploadMode` per file: if `file.name` (case-insensitive) exists in the current folder's cached listing → `'overwrite'`; otherwise → `'create-only'`; pass `uploadMode` into `uploadFile` call
- [x] 4.4 Add hook tests verifying: overwrite mode selected when name matches cache, create-only mode selected when name absent from cache
- [x] 4.5 Run `npm exec nx test chat` and `npm exec nx lint chat` — all pass; run `npm exec nx build chat` — successful

## 5. Integration Tests and Gap Matrix Update

- [x] 5.1 Add end-to-end scenario tests (or integration tests) in `apps/chat/src/hooks/files/tests/` covering: full replace flow (sanitize → conflict popup → upload with overwrite mode), full duplicate flow (sanitize → conflict popup → upload with create-only mode), cancel flow (conflicting files skipped, non-conflicting proceed)
- [x] 5.2 Update `docs/dial-file-manager-legacy-modal-gap-matrix.md` row #19 (Upload conflict UI) from ⚠️ to ✅ with a note referencing this change
- [x] 5.3 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all affected tests pass
- [x] 5.4 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — no lint errors (2 pre-existing errors in unrelated files not introduced by this change)
- [x] 5.5 Run `npm exec nx affected --target=build --base=origin/development-1.0` — build succeeds
