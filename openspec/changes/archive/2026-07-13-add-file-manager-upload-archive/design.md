## Context

`FilesService.uploadFile(bucket, path, file, token, uploadMode?)` (`apps/chat-api/src/files/files.service.ts:217`) already exists and already supports conflict detection: `uploadMode: 'create-only'` sends `If-None-Match: '*'` to DIAL Core, and a Core `412` is mapped to a `409 Conflict` HTTP exception (confirmed by reading the current implementation). `POST /api/v1/files` (the existing single-file upload route, `apps/chat-api/src/files/files.controller.ts:54-104`) already establishes the multipart pattern this change reuses: `@UseInterceptors(FileInterceptor('file'))`, `@ApiConsumes('multipart/form-data')`, an explicit `@ApiBody` schema (Swagger cannot infer multipart shapes from a DTO class alone), delegating to the service.

`archiver` (already a direct dependency, used by `FilesService.downloadArchive` per the codebase-verification pass) creates ZIPs — it has no read/extract API. `adm-zip` appears in `package-lock.json` only as a transitive, dev-only dependency of `@module-federation/dts-plugin` (four instances, all `dev: true`) — it is not usable as-is without adding it as a direct dependency, and even if added, its API (`new AdmZip(buffer).getEntries()`) reads the whole archive into memory and decompresses per-entry without a running byte-count hook the caller can check mid-stream, which is precisely the property needed to defend against a zip bomb (a small archive that decompresses to gigabytes). No other zip library (`jszip`, `yauzl`, `unzipper`) is present anywhere in the repo's `package.json` files today.

Environment variables already exist for the **download**-archive direction (`ARCHIVE_MAX_ITEMS`, `ARCHIVE_MAX_FILES`, `ARCHIVE_MAX_UNCOMPRESSED_BYTES`, `ARCHIVE_TIMEOUT_MS`, `ARCHIVE_DOWNLOAD_CONCURRENCY` — confirmed in `apps/chat-api/src/config/environment.config.ts`). Those bound a ZIP the BFF *builds itself* from files the caller already has read access to (a much lower-risk operation — the "attacker" would have to already own/have-access-to whatever they're zipping). Upload-archive bounds a ZIP *received from the client*, which is attacker-controlled input in the general case (any authenticated user can upload any bytes). Reusing the download-side vars would couple two different threat models to one limit, and an operator who wants to raise the download concurrency limit would inadvertently also raise the upload zip-bomb tolerance. This design introduces separate, upload-specific env vars.

## Goals / Non-Goals

**Goals:**
- `POST /api/v1/files/upload-archive` — multipart ZIP upload, streaming extraction via `yauzl`, per-entry upload through the existing `uploadFile('create-only')` path, aggregated `results[]` response.
- Zip-slip protection (path traversal via `..`, absolute paths, drive letters, backslash separators).
- Bounded resource usage: max entry count, max total uncompressed bytes (checked incrementally during extraction, not just from the archive's declared/central-directory sizes, which can be forged), max archive upload size (reusing multipart body-size limits the same way ordinary upload does), and a timeout.
- `useDialFileManager.onUploadArchive` wired to the new endpoint, reusing the existing upload-progress state shape.
- Toolbar `uploadArchive` new-action, standalone-only, `Full`-profile-gated.
- The final task in this change's roadmap: switch `DialFileManagerPage` to `actionProfile=Full`, since this is the last of the three sequential #7504 changes.

**Non-Goals:**
- Entry-level progress reporting — the BFF processes the whole archive in one request/response cycle and returns one aggregated result; no SSE/WebSocket per-entry progress channel is introduced.
- True mid-extraction cancellation propagated to the server (same posture as the existing `cancelCopyMove`: the frontend can abort the HTTP request, but the BFF has no cooperative cancellation threaded into the `yauzl` read loop in this change).
- Attach-modal archive upload — off by default per the parent proposal; not requested by product for this change.
- Nested archives (a ZIP inside the uploaded ZIP) — nested archive entries are uploaded as opaque files, not recursively extracted.
- `EMAIL`-style resumable/chunked upload for very large archives — the existing multipart body-size ceiling (`ARCHIVE_UPLOAD_MAX_BYTES`) applies to the whole request the same way ordinary file upload's `FILE_UPLOAD_MAX_BYTES` does today.

## Decisions

### D1 — BFF extracts (server-side), not the client

**Decision**: The ZIP is uploaded whole to the BFF, which extracts and uploads each entry to DIAL Core server-side.

**Rationale**: Client-side extraction (unzip in the browser, then call the existing per-file `uploadFile` endpoint once per entry) was evaluated and rejected because: (a) it moves zip-bomb/decompression risk into the browser tab, where a maliciously crafted archive can hang or crash the tab before any validation happens; (b) it would require N separate HTTP requests for an N-entry archive instead of one, multiplying round-trips and losing the existing batch/rate-limit posture used by every other multi-item file-manager operation (`copy`/`move`/`delete`/`rename` are all single-request batches); (c) it duplicates path-safety validation that already needs to exist server-side anyway (the BFF cannot trust a client-side "this path is safe" claim for any upload, archive or not), so client-side extraction would still require full server-side re-validation per entry, gaining nothing.

**Alternative considered**: client-side extraction with existing `uploadFile` calls — rejected per the above; documented as the alternative the proposal explicitly asked to evaluate.

### D2 — `yauzl` over `adm-zip` or a new `archiver`-adjacent write-only library

**Decision**: add `yauzl` (+ `@types/yauzl`) as a direct dependency of `apps/chat-api`.

**Rationale**: `yauzl` reads ZIP central directory entries lazily and exposes a per-entry readable stream; the extraction loop can track cumulative decompressed bytes as data flows through and abort (destroy the stream, throw) the moment `ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES` is exceeded — mid-decompression, not just after-the-fact from a (forgeable) declared size field. `adm-zip`'s buffer-oriented, whole-entry-at-once API does not offer an equivalent incremental hook without reimplementing inflate-stream handling on top of it, which would just be reinventing what `yauzl` already provides. `archiver` has no read path at all. No other zip-reading library is already present in the dependency tree as a viable candidate.

**Alternative considered**: `unzipper` (also stream-based) — a reasonable alternative with similar streaming properties; `yauzl` is chosen as the more established, widely-audited option (used by VS Code's extension host for untrusted-archive handling) with a smaller, more auditable API surface for this security-sensitive path. Either would satisfy the streaming requirement; `yauzl` is the concrete pick.

### D3 — New upload-specific env vars, not reuse of the download-archive vars

**Decision**: add to `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`), each `@IsOptional @IsInt @Min(1)` with `@Transform(({value}) => parseInt(value, 10))`, matching the existing numeric-env-var pattern:

| Var | Default | Purpose |
|---|---|---|
| `ARCHIVE_UPLOAD_MAX_BYTES` | `536_870_912` (512 MB, matching `FILE_UPLOAD_MAX_BYTES`'s default) | Max size of the uploaded ZIP request body itself |
| `ARCHIVE_UPLOAD_MAX_FILES` | `1000` | Max number of non-directory entries extracted from one archive |
| `ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES` | `2_147_483_648` (2 GB) | Max cumulative decompressed bytes across all entries, checked incrementally during extraction |
| `ARCHIVE_UPLOAD_TIMEOUT_MS` | `300_000` (5 min) | Wall-clock budget for the whole extract-and-upload operation |

**Rationale**: see Context — reusing `ARCHIVE_MAX_FILES`/`ARCHIVE_MAX_UNCOMPRESSED_BYTES`/`ARCHIVE_TIMEOUT_MS` (download-side) would let an operator's download-bundling tuning silently change upload zip-bomb tolerance, and vice versa. Distinct names let each direction be tuned independently, matching how `FILE_UPLOAD_MAX_BYTES` (upload) and the archive-download vars are already independently named today.

### D4 — Zip-slip defense: allowlist-normalize every entry path before extraction

**Decision**: for each `yauzl` entry, before extraction: reject the entry if its raw `fileName` (a) is an absolute path (starts with `/` or a Windows drive letter like `C:`), (b) contains `..` as a path segment after normalization, (c) contains a backslash (`\`) — DIAL Core paths are always forward-slash; a backslash in an entry name from a Windows-built ZIP is either a literal filename character (rare, and safely rejected rather than guessed at) or an attempted Windows-style traversal, and this design treats both the same way: reject the entry, record it as a failed result, continue with the rest of the archive. Directory entries (`fileName` ending in `/`, or `yauzl`'s own directory-entry flag) are skipped silently (not extracted, not reported as failures) — they have no corresponding DIAL Core "create empty folder" equivalent needed here, since uploading any file under a nested path implicitly creates the folder chain the same way ordinary nested-path upload already does.

**Rationale**: matches the copy/move/rename family's existing allowlist-first posture (`@IsValidFilePath()`, `BUCKET_NAME_PATTERN`) rather than a denylist of "known bad" patterns, which is the standard defense against path-traversal (denylists are bypassable by encoding variants; allowlists are not).

### D5 — Conflict handling: reuse `uploadFile('create-only')` per entry, no interactive per-entry resolution

**Decision**: each valid, extracted entry is uploaded via the existing `FilesService.uploadFile(bucket, destPath, entryFile, token, 'create-only')`. A Core `412`/mapped `409` for one entry is recorded as a failed result for that entry (`error: "Conflict"`); extraction continues for the remaining entries. The response is `{ results: UploadArchiveEntryResultDto[] }` — one entry per extracted (non-directory, path-safe) file, `{ path, success, error? }` — matching the partial-failure shape already established by `/copy`, `/move`, `/rename`, `/delete`.

**Rationale**: the ui-kit's existing interactive conflict-resolution popup (`conflictResolutionPopupOptions`, used by ordinary multi-file upload) is a synchronous, one-decision-at-a-time UI flow; wiring it to resolve N server-side-discovered conflicts one-by-one after a single archive-extraction round-trip would require a second request per resolved conflict and a materially larger state machine than this change's scope. Reusing the existing per-item batch/partial-failure convention (already understood by users from copy/move/delete) is simpler, consistent, and lets the user retry conflicting entries individually (rename the extracted archive's conflicting file locally and re-upload, or delete the conflicting destination file first) using capabilities the file manager already has.

**Alternative considered**: reuse the ordinary upload conflict-resolution popup end-to-end (fail extraction, surface each conflicting entry to the popup, let the user choose replace/duplicate/skip per entry, then re-request) — rejected for this change as materially larger scope than the `create-only`-and-report-failures approach; flagged as a possible fast-follow if user feedback finds the current per-entry-failure UX too coarse.

### D6 — Frontend progress: reuse `uploadBatchState`, no new progress UI

**Decision**: `onUploadArchive` sets the hook's existing `uploadBatchState` (used today for ordinary multi-file upload progress) to an indeterminate/single-item "uploading archive" state for the duration of the request, and clears it (or reports failure) when the response arrives. No per-entry progress bar is built, since the BFF does not stream per-entry events back (Non-Goals).

**Rationale**: matches the Non-Goal above and avoids promising progress granularity the transport doesn't provide, consistent with the guidance in the parent proposal ("do not promise entry-level progress unless implemented").

### D7 — Toolbar wiring: standalone-only, `Full`-profile-gated; attach modal excluded by default

**Decision**: `toolbarOptions.newActions.uploadArchive` is populated only when `variant === Standalone` and `actionProfile === Full`. The attach modal (`variant === Attach`, `actionProfile === Attach`) never receives this new-action entry, per the parent proposal's default-off stance on attach-modal archive upload.

### D8 — Final `Full`-profile switch happens in this change

**Decision**: since upload-archive is the last of the three sequential #7504 changes (sharing, metadata, upload-archive), the task list for this change includes switching `DialFileManagerPage`'s `actionProfile` from `Browse` to `Full` — by this point, Share/Unshare/Remove access (change 1), Info (change 2), and upload-archive (this change) all have working handlers, so `Full` no longer exposes any unimplemented action.

**Rationale**: completes the migration roadmap item explicitly called out in `add-file-manager-sharing`'s design D7 ("the switch is deferred until every `Full`-gated action... has a working handler").

### D9 — NestJS conventions

All backend implementation follows `apps/chat-api/AGENTS.md` (URI versioning, thin controllers, `Logger` + `ConfigService`, validated DTOs, typed HTTP exceptions) and the multipart pattern already established by `POST /api/v1/files`.

## Risks / Trade-offs

**Zip-bomb risk despite incremental checking (D2/D3)** → a maliciously crafted archive could still consume significant CPU decompressing before the cumulative-byte check trips, if individual entries are very large relative to the check granularity. Mitigation: check cumulative bytes at a fine granularity (per chunk read from the decompression stream, not just per completed entry), and bound wall-clock time via `ARCHIVE_UPLOAD_TIMEOUT_MS` as a backstop independent of the byte-count check.

**No per-entry interactive conflict resolution (D5)** → a user extracting an archive into a folder with many pre-existing same-named files gets a batch of failed-conflict results instead of a guided resolve-each-conflict flow. Mitigation: documented explicitly as a scoped-down MVP choice; the existing Delete-then-retry or rename-and-retry workflows remain available, and this can be revisited as a fast-follow if requested.

**New direct dependency (`yauzl`)** → adds a new third-party package to the security-sensitive file-handling path. Mitigation: `yauzl` is a long-established, minimal-surface library specifically for this use case (untrusted ZIP reading) with a track record in security-conscious contexts (e.g., VS Code); dependency addition follows normal `npm audit`/lockfile review as part of the PR.

**Single-request extraction with no server-side cancellation (D6/Non-Goals)** → a very large archive already accepted by `ARCHIVE_UPLOAD_MAX_BYTES` could still take close to `ARCHIVE_UPLOAD_TIMEOUT_MS` to fully extract-and-upload, during which the user has no way to stop server-side work (only abort their own HTTP wait). Mitigation: same posture already accepted for copy/move's `cancelCopyMove` (design.md D7 in `add-file-manager-copy-move`, archived) — frontend-abort-only, documented as a known limitation, not a regression specific to this change.

## Migration Plan

1. Add `yauzl`/`@types/yauzl` to `apps/chat-api/package.json`.
2. Add `ARCHIVE_UPLOAD_MAX_BYTES`/`ARCHIVE_UPLOAD_MAX_FILES`/`ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES`/`ARCHIVE_UPLOAD_TIMEOUT_MS` to `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) and `.env.example`.
3. Add `UploadArchiveDto`/`UploadArchiveEntryResultDto`/`UploadArchiveResponseDto` (`apps/chat-api/src/files/dto/upload-archive.dto.ts`).
4. Add `FilesService.uploadArchive(bucket, destinationPath, archiveFile, token)`: open with `yauzl`, iterate entries, apply D4's path-safety checks, enforce D3's limits incrementally, call `this.uploadFile(bucket, destPath, entryFile, token, 'create-only')` per valid entry, aggregate `results[]`; structured start/end logging (entryCount, success/fail counts — no file names or archive contents logged).
5. Add `POST /api/v1/files/upload-archive` route to `FilesController`, mirroring the existing `POST /api/v1/files` multipart pattern (`FileInterceptor('file')`, explicit `@ApiBody` schema with `file`/`bucket`/`destinationPath` fields).
6. Run `npm run openapi`; add `uploadArchive` wrapper to `apps/chat/src/server-api/files.api.ts`.
7. Extend `useDialFileManager`: `onUploadArchive`, reusing `uploadBatchState` for progress (D6).
8. Wire `toolbarOptions.newActions.uploadArchive` in `DialFileManagerShell`, gated per D7.
9. Add i18n keys (toolbar label, error/partial-failure notification).
10. Switch `DialFileManagerPage`'s `actionProfile` to `Full` (D8).
11. Update `file-manager-tabs` capability spec (toolbar entry + profile switch).

**Rollback**: remove the new controller route, revert hook/shell changes, and revert the `actionProfile` switch back to `Browse` (a one-line change, since `Full` is a strict superset of `Browse` built entirely in the three #7504 changes — reverting to `Browse` immediately hides Share/Unshare/Remove access/Info/upload-archive without touching their underlying implementations). Remove the `yauzl` dependency if fully rolling back. Already-extracted/uploaded files from prior successful archive uploads are not reverted (matches every prior file-manager change's rollback posture).

## Open Questions

- **Fine-grained cumulative-byte check interval**: exact chunk size for the incremental decompressed-byte check is an implementation detail to tune against `yauzl`'s stream chunk sizes during implementation; not fixed by this design beyond "checked incrementally, not just from declared sizes."
- **Nested archive entries**: confirmed as a Non-Goal (uploaded as opaque files), but should product feedback later want recursive extraction, that is a separate follow-up given the added complexity (recursion depth limits, combined size accounting across nesting levels).
