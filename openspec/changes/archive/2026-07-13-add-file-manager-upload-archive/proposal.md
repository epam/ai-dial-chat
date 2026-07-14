## Why

The standalone DIAL File Manager has no way to upload a ZIP archive and have its contents extracted into the destination folder — today's `POST /api/v1/files` only accepts a single ordinary file, and `POST /api/v1/files/download-archive` (shipped earlier) bundles existing files **into** a ZIP for download, which is the opposite direction. Legacy (`origin/development`) exposed a toolbar "Upload archive" action (`newActions.uploadArchive`, `apps/chat/src/components/FileManager/hooks/useFileManager.tsx:260-262`) that posted to `/api/files/upload-archive?destination=...`. The installed `@epam/ai-dial-ui-kit` already defines `toolbarOptions.newActions.uploadArchive: NewAction` and the `onUploadArchive(file: File, name: string, destinationFolder: string) => void` callback on `DialFileManager` (confirmed via MCP `getEntityDetails` and the installed `.d.ts`) — nothing in `apps/chat` wires them. This is step 15 of the #7504 migration roadmap (GitHub #7504 row 31), the last of the three sequential #7504 changes.

## What Changes

- **New BFF endpoint** `POST /api/v1/files/upload-archive` (multipart, mirroring the existing `POST /api/v1/files` upload route's `FileInterceptor('file')` + `@ApiConsumes('multipart/form-data')` pattern) that validates and streams-extracts a ZIP archive's entries and uploads each one via the **existing** `FilesService.uploadFile(bucket, path, file, token, 'create-only')` — reusing the same per-entry conflict detection (`create-only` → 412 from Core mapped to 409) that ordinary single-file upload already has, rather than inventing new conflict logic.
- **New direct dependency**: `yauzl` (streaming ZIP reader) added to `apps/chat-api/package.json`. `archiver` (already a direct dependency) is write-only — it creates ZIPs for download, it cannot read/extract one. `adm-zip` (present only as a transitive, dev-only dependency of `@module-federation/dts-plugin`, confirmed by codebase verification) is rejected because it is not stream-based: it loads the archive's central directory and inflates entries without an incremental byte-count hook, making bounded zip-bomb defense (abort once decompressed bytes exceed a limit, mid-extraction) significantly harder to implement correctly.
- **`FilesService`** gains `uploadArchive(bucket, destinationPath, archiveFile, token)`: opens the ZIP with `yauzl` in streaming mode, rejects entries whose normalized path escapes the destination (zip-slip: absolute paths, `..`, drive letters, backslash traversal), skips directory entries, enforces `ARCHIVE_UPLOAD_MAX_FILES`/`ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES`/`ARCHIVE_UPLOAD_TIMEOUT_MS` (new env vars, distinct from the existing download-archive vars — an uploaded ZIP is attacker-controlled input with a different threat model than a download bundle of already-approved files), and uploads each valid entry via the existing `uploadFile` with `uploadMode: 'create-only'`, aggregating a per-entry `results[]` array (same partial-failure shape as `/copy`, `/move`, `/rename`, `/delete`).
- **OpenAPI regeneration** — `uploadArchive()` added to `@epam/chat-api-client`, with a matching thin wrapper in `apps/chat/src/server-api/files.api.ts`.
- **`useDialFileManager` hook**: adds `onUploadArchive(file, name, destinationFolder)` wired to ui-kit's `DialFileManager.onUploadArchive` prop, calling the new server-api wrapper and reusing the hook's existing upload-progress state pattern (`uploadBatchState`) rather than inventing a new progress UI, since the BFF does not stream back per-entry progress (only a final aggregated result).
- **`DialFileManagerShell`** wires `toolbarOptions.newActions.uploadArchive` (label + icon) for the standalone page only, gated on `actionProfile === Full`.
- **`file-manager-tabs`** capability: the toolbar's `uploadArchive` new-action entry is documented as `my_files`-only, WRITE-gated, and `Full`-profile-only — completing the `Full` profile's action set alongside Share/Unshare/Remove access (`add-file-manager-sharing`) and Info (`add-file-manager-metadata-ui`). Once this change lands, a final task switches `DialFileManagerPage` from `Browse` to `Full`.

**Non-breaking**: additive endpoint, dependency, hook field, and toolbar entry. `Browse`/`Attach` action matrices are untouched until the final profile-switch task, which is itself additive (widens what `my_files` on the standalone page exposes; does not remove or change any existing action).

## Capabilities

### New Capabilities

- `file-manager-upload-archive`: BFF `POST /api/v1/files/upload-archive` contract (multipart request, streaming ZIP extraction, zip-slip/zip-bomb defenses, new env vars, per-entry conflict semantics via `create-only`, partial-failure response shape), hook wiring (`onUploadArchive`), and toolbar wiring.

### Modified Capabilities

- `file-manager-tabs`: documents the `uploadArchive` toolbar new-action's gating and finalizes the switch of `DialFileManagerPage` from `actionProfile=Browse` to `actionProfile=Full`, since this is the last of the three #7504 changes.

## Impact

- **Backend**: `apps/chat-api/src/files/` — one new controller route, one new DTO file (`upload-archive.dto.ts`), one new `FilesService` method, four new env vars in `apps/chat-api/src/config/environment.config.ts` (`ARCHIVE_UPLOAD_MAX_BYTES`, `ARCHIVE_UPLOAD_MAX_FILES`, `ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES`, `ARCHIVE_UPLOAD_TIMEOUT_MS`).
- **Dependency**: new direct dependency `yauzl` (+ `@types/yauzl` dev dependency) in `apps/chat-api/package.json`.
- **Generated client**: `libs/chat-api-client/` regenerated after Swagger update (`npm run openapi`, `npm run openapi:check`).
- **Frontend**: `apps/chat/src/server-api/files.api.ts` (new `uploadArchive` wrapper), `useDialFileManager` hook, `DialFileManagerShell`, `DialFileManagerPage` (final `actionProfile` switch), i18n keys.
- **Docs**: OpenSpec capability spec documents the endpoint and its security constraints; `file-manager-tabs` spec gains the toolbar entry and the `Browse`→`Full` switch.
- **Out of scope**: attach-modal archive upload (default off unless explicitly requested — not requested here), entry-level upload progress reporting (BFF returns one aggregated result, not a stream of per-entry events), client-side ZIP extraction (rejected — see design.md D1).
