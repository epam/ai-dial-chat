# Tasks: Add File Manager Transfer Actions

> Follow the incremental-implementation skill: each slice must be independently verifiable before the next begins.
> After each slice run: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api` (when applicable), and the equivalent for `chat` where frontend files are touched.

## Progress

- [x] Slice 1 — Research & Confirmation
- [x] Slice 2 — Backend: Folder Creation Endpoint
- [x] Slice 3 — Backend: Archive Download Endpoint
- [x] Slice 4 — Regenerate and Verify Generated Client
- [x] Slice 5 — Frontend Server-API Wrappers
- [x] Slice 6 — Extend `useDialFileManager` — Upload State
- [x] Slice 7 — Extend `useDialFileManager` — Folder Creation and Download State
- [x] Slice 8 — Add `UploadProgressModal` Component
- [x] Slice 9 — Wire `DialFileManagerModal` with New Actions
- [x] Slice 10 — i18n Keys
- [x] Slice 11 — RTL, Responsive, and Accessibility Verification
- [x] Slice 12 — Final Affected Verification

---

## Slice 1 — Research & Confirmation ✓

**Goal:** Confirm SDK capabilities, folder persistence strategy, `archiver` compatibility, and ui-kit callback signatures before writing code.

**Tasks:**

1. **Confirm SDK `uploadFile` accepts `AbortSignal` in `initOverrides`**
   - File: `node_modules/@epam/ai-dial-typescript-sdk/dist/index.js`
   - Verify `uploadFile(bucket, path, init)` passes `init` to the underlying `openapi-fetch` `client.PUT`, which forwards it to native `fetch`.
   - Document result in a comment in `apps/chat-api/src/files/files.service.ts` adjacent to future `createFolder` logic.

2. **Confirm `archiver` version to install**
   - Check `npm info archiver versions` for the latest stable `5.x` or `7.x`.
   - Record the version in a task note for Slice 3.

3. **Confirm `DialFileManager` callback signatures match the design**
   - Source: `node_modules/@epam/ai-dial-ui-kit/dist/components-manifest.json`
   - Verify: `onUploadFiles`, `onValidateUpload`, `onCreateFolder`, `onCreateFolderValidate`, `onDownloadFiles`, `toolbarOptions.newActions.uploadFiles/newFolder`, `bulkActionsToolbarOptions.actionLabels[DialFileManagerActions.Download]`.
   - Update `design.md §2` if any signature differs.

**Verification:** No code changes — slice complete when research is documented.

---

## Slice 2 — Backend: Folder Creation Endpoint ✓

**Goal:** Add `POST /api/v1/files/folders` to the existing `files` domain.

**Files to create/modify:**

1. **`apps/chat-api/src/files/files.constants.ts`** (new)
   - Export `MARKER_NAME = HIDDEN_FILE` (`.dial_folder` from `@epam/ai-dial-chat-shared`).
   - Export `FOLDER_NODE_TYPE = 'folder'` for use in `CreateFolderResponseDto`.

2. **`apps/chat-api/src/files/dto/create-folder.dto.ts`** (new)
   - `CreateFolderDto`: `bucket`, `parentPath?` (optional, defaults to `''`), `name`.
   - `CreateFolderResponseDto`: `name`, `path`, `parentPath`, `bucket`, `nodeType`, `folderId`.
   - All fields have `@ApiProperty` / `@ApiPropertyOptional`.
   - `name` validated with `@Matches(/^[^/\\.\0][^/\\\0]{0,253}$/)` and a custom `@IsNotReservedMarkerName()` validator.

3. **`apps/chat-api/src/files/files.service.ts`** (modify)
   - Add `async createFolder(bucket, parentPath, name, at)` method.
   - Probe marker via `getFileMetadata`; `markerMetadataMatches` → `409 ConflictException`; false-positive probe → upload.
   - Upload zero-byte marker via `client.uploadFile`.
   - Return `CreateFolderResponseDto` with full resource paths (`files/{bucket}/...`).

4. **`apps/chat-api/src/files/files.service.ts`** (modify)
   - Extend `listFiles` with `resolveListingPermissions` (marker permissions promoted to `response.permissions`).
   - Marker items remain in listing results (not filtered).

5. **`apps/chat-api/src/files/files.controller.ts`** (modify)
   - Add `@Post('folders')` handler `createFolder` with `@Body() body: CreateFolderDto`.
   - `@Throttle({ default: { limit: 10, ttl: 60000 } })`.
   - Full `@ApiResponse` for 201, 400, 401, 403, 404, 409, 429, 502, 503.
   - Follow `ThemeController` pattern.

6. **`apps/chat-api/src/files/tests/files.controller.spec.ts`** (modify) and **`apps/chat-api/src/files/tests/files.service.spec.ts`** (modify)
   - Integration tests (supertest): happy path 201, duplicate conflict 409, invalid name 400, unauthenticated 401.
   - Unit tests for `createFolder` service method: verified marker → 409, parent-marker false positive → upload, DIAL 403 → ForbiddenException, DIAL upload succeeds → correct DTO.
   - Unit test for `listFiles`: marker item included in result; permissions resolved from marker.

**Architecture guard:** No `@epam/ai-dial-ui-kit` types; no REST paths hardcoded in library code; marker name owned by `files.constants.ts` on the server.

**Verification:**
```sh
npm exec nx test  chat-api
npm exec nx lint  chat-api
npm exec nx build chat-api
```

---

## Slice 3 — Backend: Archive Download Endpoint ✓

**Goal:** Add `POST /api/v1/files/download-archive` streaming ZIP endpoint.

**Files to create/modify:**

1. **`apps/chat-api/package.json`** (or root `package.json` if workspace-level)
   - Add `archiver` (e.g. `"archiver": "^7.0.0"`) to `dependencies`.
   - Add `@types/archiver` to `devDependencies`.
   - Run `npm install`.

2. **`apps/chat-api/src/config/environment.config.ts`** (modify)
   - Add `ARCHIVE_MAX_ITEMS`, `ARCHIVE_MAX_FILES`, `ARCHIVE_MAX_UNCOMPRESSED_BYTES`, `ARCHIVE_TIMEOUT_MS` with defaults and `class-validator` decorators.
   - Document in `apps/chat-api/README.md`.
   - Add placeholders to `.env.example`.

3. **`apps/chat-api/src/files/dto/download-archive.dto.ts`** (new)
   - `ArchiveItemDto`: `bucket`, `path`, `name`, `nodeType` (`'item' | 'folder'`).
   - `DownloadArchiveDto`: `items: ArchiveItemDto[]` with `@ArrayMinSize(1)`, `@ArrayMaxSize(100)`.

4. **`apps/chat-api/src/files/files.service.ts`** (modify)
   - Add `async expandFolderContents(bucket, path, at): Promise<ExpandedFile[]>` — recursive listing with `nextToken` pagination (includes marker files).
   - Add `buildArchivePath(baseName, relativePath): string` — ZIP-slip prevention logic.
   - Add `async downloadArchive(dto, at, req, res)` method — expand → validate limits → commit headers → stream via `archiver`.

5. **`apps/chat-api/src/files/files.controller.ts`** (modify)
   - Add `@Post('download-archive')` handler `downloadArchive`.
   - `@Throttle({ default: { limit: 5, ttl: 60000 } })`.
   - `@ApiProduces('application/zip')`.
   - Full `@ApiResponse` for 200 (binary), 400, 401, 403, 404, 413, 429, 502, 503.
   - Use `@Res() res: Response` and `@Req() req: Request`.

6. **`apps/chat-api/src/files/tests/files.service.spec.ts`** (modify) and **`apps/chat-api/src/files/tests/files.controller.spec.ts`** (modify)
   - Unit tests: expansion deduplication, ZIP-slip rejection, marker inclusion, limit enforcement.
   - Integration tests (supertest): happy path 200 with streamed ZIP, 400 invalid input, 404 missing item, 413 limit exceeded.

**Architecture guard:** `archiver` and DIAL SDK calls remain in `apps/chat-api/src/files/files.service.ts`; no archive logic in libraries.

**Verification:**
```sh
npm exec nx test  chat-api
npm exec nx lint  chat-api
npm exec nx build chat-api
```

---

## Slice 4 — Regenerate and Verify Generated Client ✓

**Goal:** Expose `createFolder` and `downloadArchive` / `downloadArchiveRaw` in `@epam/chat-api-client`.

**Files to modify:**

1. **No hand-edits to `libs/chat-api-client/src/generated/`** — run generation only.

```sh
npm run openapi
npm run openapi:check
npm exec nx build chat-api-client -- --skip-nx-cache
npm exec nx lint  chat-api-client
```

2. **Verify generated `FilesApi.ts`** at `libs/chat-api-client/src/generated/src/apis/FilesApi.ts`:
   - `createFolder(...)` method present, returns `CreateFolderResponseDto`.
   - `downloadArchiveRaw(...)` method present (binary response → use Raw variant).
   - No `any` return types on `createFolder`.
   - Method names are clean (e.g. `createFolder`, not `FilesController_createFolder_v1`).

**Verification:**
```sh
npm exec nx build chat-api-client -- --skip-nx-cache
npm exec nx lint  chat-api-client
```

---

## Slice 5 — Frontend Server-API Wrappers

**Goal:** Add `createFolder` and `downloadArchive` thin wrappers in `apps/chat/src/server-api/files.api.ts`.

**Files to modify:**

1. **`apps/chat/src/server-api/files.api.ts`** (modify)
   - Add `createFolder(params)` → `filesApi.createFolder(params)`.
   - Add `downloadArchive(items)` using `filesApi.downloadArchiveRaw(...)` (generator gap — binary response); return raw `Response`.
   - Add inline comment documenting the generator gap for `downloadArchive` (mirrors existing `downloadFile` comment at line 26).

**Architecture guard:** No hardcoded paths; no app context or auth logic inside the wrappers; pure delegation to generated client.

**Verification:**
```sh
npm exec nx typecheck chat
npm exec nx lint chat
```

---

## Slice 6 — Extend `useDialFileManager` — Upload State

**Goal:** Add upload orchestration and state to `useDialFileManager`.

**Files to create/modify:**

1. **`apps/chat/src/hooks/files/useDialFileManager.ts`** (modify)
   - Add `FileUploadStatus` enum and `FileUploadEntry` / `FileUploadBatchState` interfaces (co-located or extracted to `apps/chat/src/components/DialFileManagerModal/types/`).
   - Add `uploadBatchState`, `uploadAbortControllerRef` state.
   - Implement `onUploadFiles(files, destinationFolder)`:
     - Strip virtual root prefix → `destinationApiPath`.
     - Set batch state with all entries `Queued`.
     - Process with `UPLOAD_CONCURRENCY = 3`.
     - Call `uploadFile(bucket, path, file.fileContent, signal)`.
     - Transition statuses.
     - Invalidate destination folder cache after batch settles.
   - Implement `onValidateUpload(files, existingFiles, destinationFolder)` — name conflict check.
   - Implement `cancelUpload()` — abort controller abort.
   - Expose `uploadBatchState`, `cancelUpload` in `UseDialFileManagerResult`.

2. **`apps/chat/src/hooks/files/tests/useDialFileManager.spec.ts`** (new or modify)
   - Tests: single upload success, batch concurrency (3 at a time), partial failure, cancellation mid-batch, conflict validation, cache invalidation after upload.

**Architecture guard:** No `@epam/chat-api-client` paths hardcoded; no app routing knowledge; DIAL path construction is in the hook (app-edge), not in any library.

**Verification:**
```sh
npm exec nx test  chat
npm exec nx lint  chat
npm exec nx typecheck chat
```

---

## Slice 7 — Extend `useDialFileManager` — Folder Creation and Download State

**Goal:** Add `onCreateFolder`, `onCreateFolderValidate`, and `onDownloadFiles` to `useDialFileManager`.

**Files to modify:**

1. **`apps/chat/src/hooks/files/useDialFileManager.ts`** (modify)
   - Add `isCreatingFolder` state.
   - Implement `onCreateFolder(file, folderPath, fileId)`:
     - Strip virtual root prefix → `parentApiPath` and `name` from `file.name`.
     - Call `createFolder({ bucket, parentPath: parentApiPath, name })`.
     - Invalidate parent folder cache.
   - Implement `onCreateFolderValidate(name, parentFolder)` — synchronous rules (empty, slashes, starts with dot, reserved, too long, sibling conflict).
   - Add `isDownloading` state.
   - Implement `onDownloadFiles(items)`:
     - Single `item` → `downloadFile` via `filesApi.downloadFileRaw` → blob → browser download.
     - Folder or multiple items → `downloadArchive` → blob → browser download.
     - `triggerBrowserDownload` / `triggerBlobDownload` helpers in `apps/chat/src/utils/download.ts` (or `apps/chat/src/utils/file-download.ts`).
   - Expose `isCreatingFolder`, `isDownloading`, `onCreateFolder`, `onCreateFolderValidate`, `onDownloadFiles` in `UseDialFileManagerResult`.

2. **`apps/chat/src/hooks/files/tests/useDialFileManager.spec.ts`** (modify)
   - Tests: successful folder creation, 409 conflict from BFF, invalid names (each validation rule), download single file, download folder as archive, client-side deduplication of items before archive call, download error.

3. **`apps/chat/src/utils/download.ts`** (new) — `triggerBlobDownload(blob, filename)` and `triggerBrowserDownload(response, fallbackName)`.

**Verification:**
```sh
npm exec nx test  chat
npm exec nx lint  chat
npm exec nx typecheck chat
```

---

## Slice 8 — Add `UploadProgressModal` Component

**Goal:** Implement the upload status modal shown during/after an upload batch.

**Files to create:**

1. **`apps/chat/src/components/DialFileManagerModal/UploadProgressModal.tsx`** (new)
   - Legacy `FilesUploadingModal` layout: fixed width, title + summary, per-file progress bar when `percent` is set, single Cancel footer.
   - All strings passed as props (no `useTranslation` inside; lib boundary pattern).
   - `data-qa="uploading-indicator"` / `data-qa="uploading-items-count"`.
   - `export default memo(UploadProgressModal)`.

2. **`apps/chat/src/components/DialFileManagerModal/tests/UploadProgressModal.spec.tsx`** (new)
   - Tests: progress bar, summary text, Cancel action.

**Architecture guard:** No `useTranslation` inside `UploadProgressModal` — all strings passed as props. No imports from `server-api` or generated client.

**Verification:**
```sh
npm exec nx test  chat
npm exec nx lint  chat
npm exec nx typecheck chat
```

---

## Slice 9 — Wire `DialFileManagerModal` with New Actions

**Goal:** Pass new callbacks and labels from `DialFileManagerModal` to `DialFileManager` and `UploadProgressModal`.

**Files to modify:**

1. **`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`** (modify)
   - Add new props to `Props`: upload/folder/download labels (see `proposal.md §i18n Impact`).
   - Pass `uploadEnabled={true}`.
   - Pass `toolbarOptions.newActions.uploadFiles` and `toolbarOptions.newActions.newFolder`.
   - Pass `bulkActionsToolbarOptions.actionLabels[DialFileManagerActions.Download]`.
   - Pass `onUploadFiles`, `onValidateUpload`, `onCreateFolder`, `onCreateFolderValidate`, `onDownloadFiles` from `useDialFileManager`.
   - Disable "Attach" and toolbar actions while `isDownloading || isCreatingFolder || uploadBatchState != null`.
   - Render `<UploadProgressModal>` as a sibling when `uploadBatchState != null`.

2. **`apps/chat/src/components/DialFileManagerModal/tests/DialFileManagerModal.spec.tsx`** (modify)
   - Add tests: upload action triggers `onUploadFiles`, new folder triggers `onCreateFolder`, download triggers `onDownloadFiles`, `UploadProgressModal` shown when `uploadBatchState` set, Attach disabled while uploading.
   - Existing tests must continue to pass.

**Verification:**
```sh
npm exec nx test  chat
npm exec nx lint  chat
npm exec nx typecheck chat
```

---

## Slice 10 — i18n Keys

**Goal:** Add all new i18n keys to the English locale.

**Files to modify:**

1. **`apps/chat/src/i18n/locales/en.json`** (modify)
   - Add all keys from `proposal.md §i18n Impact` and the three specs.
   - Keys: `dialFileManager.upload`, `dialFileManager.newFolder`, `dialFileManager.download`, `dialFileManager.uploadProgressTitle`, `dialFileManager.uploadProgressSummary`, `dialFileManager.uploadConflict`, `dialFileManager.downloadError`, `dialFileManager.folderCreateError`, `dialFileManager.folderConflict`, `dialFileManager.folderNameEmpty`, `dialFileManager.folderNameInvalidChars`, `dialFileManager.folderNameHidden`, `dialFileManager.folderNameReserved`, `dialFileManager.folderNameTooLong`. Reuse `buttons.cancel` for the upload modal footer.

2. **Caller sites** (wherever `DialFileManagerModal` is rendered in `apps/chat`) — pass the new label props via `t()`.

**Verification:**
```sh
npm exec nx lint  chat
npm exec nx typecheck chat
```

---

## Slice 11 — RTL, Responsive, and Accessibility Verification

**Goal:** Confirm all new UI satisfies RTL, responsive, and accessibility requirements.

**Files to review/modify:**

1. **`UploadProgressModal.tsx`** — verify:
   - All directional Tailwind classes are logical (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`).
   - No `left-*` / `right-*` physical classes.
   - `role="log"` + `aria-live="polite"` on file list.
   - `role="alert"` on failure rows.
   - All icon buttons (if any) have `aria-label` via prop (not hardcoded English).
   - Component renders correctly at mobile width (no overflow, no truncated buttons).

2. **`DialFileManagerModal.tsx`** — verify:
   - No new physical directional classes introduced.
   - Disabled states during upload/download are keyboard-accessible (native button `disabled` attribute).

3. **Toolbar icons** (if `DialFileManager` exposes icon-only actions for upload/new-folder/download):
   - Confirm ui-kit handles RTL mirroring internally for these actions.

**Verification:**
```sh
npm exec nx test  chat
npm exec nx lint  chat
```

---

## Slice 12 — Final Affected Verification

**Goal:** Run the full affected set to confirm nothing regressed.

```sh
npm exec nx affected --target=test      --base=origin/development-1.0
npm exec nx affected --target=lint      --base=origin/development-1.0
npm exec nx affected --target=typecheck --base=origin/development-1.0
npm exec nx affected --target=build     --base=origin/development-1.0
```

All targets must be green before marking this change complete.
