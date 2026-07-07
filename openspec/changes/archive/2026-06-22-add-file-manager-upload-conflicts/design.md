## Context

`DialFileManagerModal` + `useDialFileManager` ship a validate-only collision check: `onValidateUpload` returns `{ valid: false }` for any name collision, blocking the upload entirely. The ui-kit (`@epam/ai-dial-ui-kit@0.11.0`) already ships a fully-functional `ConflictResolutionPopup` with Replace / Duplicate / Decide-for-each strategies, but it is never wired in the new modal. Legacy `FileManager` (on the `development` branch) has this fully working via `conflictResolutionPopupOptions`.

Filename sanitization is also absent. Uploading `my:file.pdf` sends the colon-bearing name to DIAL Core, which may store it with an encoded path or reject it. Legacy sanitizes via `prepareFileName` / `prepareEntityName` using the same symbol list that the ui-kit exposes as `NOT_ALLOWED_SYMBOLS_REGEXP`.

DIAL Core's `PUT /v1/files/{Bucket}/{path}` already supports typed `If-Match` / `If-None-Match` headers (confirmed in `@epam/ai-dial-typescript-sdk@0.1.0-dev.24` — `operations['uploadFile'].parameters.header` exposes both fields). The SDK `uploadFile` method accepts them via `init.headers`; the archived transfer-actions design (which deferred conditional headers in SDK `0.1.0-dev.24`) was incorrect — they were available all along at the openapi-fetch level.

---

## Goals / Non-Goals

**Goals:**
- Wire `conflictResolutionPopupOptions` on `DialFileManager` inside `DialFileManagerModal` (labels for single/multiple conflict popup, Replace/Duplicate/Cancel, Replace all / Duplicate all / Decide for each).
- Fix `onValidateUpload` so it does not block on name collisions — allow the ui-kit's internal conflict detection to drive the popup.
- Apply `prepareFileName` sanitization inside `onValidateUpload` (mutate `name` in-place on the `DialUploadFileItem` objects before the ui-kit does conflict detection).
- Pass `forbiddenSymbolsRegExp={NOT_ALLOWED_SYMBOLS_REGEXP}` and a tooltip to `DialFileManager` for rename / create-folder validation parity.
- Extend `POST /api/v1/files` BFF endpoint with optional `uploadMode: 'overwrite' | 'create-only'` (maps to no header / `If-None-Match: *`).
- Determine upload mode per file in `onUploadFiles`: check if the resolved name already exists in the cached listing → Replace (overwrite); otherwise → create-only (`If-None-Match: *`).
- Forward `If-None-Match: *` via the SDK's native `headers` support (no raw fetch needed).
- Add i18n keys for the conflict popup.
- Add unit tests: sanitization edge cases, hook conflict resolution paths, BFF header forwarding.
- Close gap matrix row #19.

**Non-Goals:**
- Upload archive (ZIP) — row #18.
- `autoSelectUploadedItems` — row #20.
- Folder conflict popup changes (already handled by `onCreateFolderValidate`).
- Tabs / browse UX.
- `sanitizeConversationName` or any other sanitization utility outside the upload pipeline.
- Frontend duplicate-name auto-numbering beyond what the ui-kit already produces.

---

## Decisions

### Decision 1: Sanitization in `onValidateUpload`, mutating `name` in-place

**Chosen:** Mutate `DialUploadFileItem.name` in-place inside `onValidateUpload` before returning.

**Rationale:** The ui-kit's `use-file-upload` uses the same `DialUploadFileItem` objects after `onValidateUpload` returns to detect collisions against `existingFiles`. By mutating `name` in this callback, the ui-kit's subsequent conflict detection sees sanitized names — so a file named `my:report.pdf` is renamed to `my_report.pdf` before the collision check, and if `my_report.pdf` already exists, the conflict popup fires correctly. This is the only hook point available without patching the ui-kit.

**Alternative considered:** Apply sanitization only in `onUploadFiles`. Rejected because the ui-kit performs conflict detection between `onValidateUpload` and `onUploadFiles` using the original names; sanitizing later means the popup might not detect the real collision (e.g. `my:report.pdf` → `my_report.pdf` where `my_report.pdf` already exists).

---

### Decision 2: Determine upload mode by checking the cached listing

**Chosen:** In `onUploadFiles`, for each file, check whether `file.name` exists (case-insensitive) in the current folder's cached item list:
- Name exists → **overwrite** (user chose Replace or file never conflicted at validation time due to cache staleness).
- Name absent → **create-only** (`If-None-Match: *`).

**Rationale:** The ui-kit does not expose per-file conflict decisions to `onUploadFiles`. Only the `DialUploadFileItem.name` is available. Checking against the cached listing is reliable:
- After Replace: name still in listing → overwrite.
- After Duplicate: ui-kit generates a suffix name (e.g. `notes (1).txt`) → absent from listing → create-only.
- Fresh non-conflicting upload: absent from listing → create-only (race-safe).

`If-None-Match: *` on a Duplicate or fresh path means concurrent uploads of the same new name return 412, surfaced as a file failure — acceptable and preferred over silent corruption.

**Alternative considered:** Thread `uploadMode` through new context or a ref that `onValidateUpload` sets per conflict decision. Rejected: requires coordinating state across two callbacks with async popup in between, and the cached-listing check achieves the same result without additional state.

---

### Decision 3: `uploadMode` as a multipart form field (not a header) in the BFF contract

**Chosen:** Add `uploadMode?: 'overwrite' | 'create-only'` to `FileParamsDto` as a string enum field sent in the multipart body (alongside `file`, `bucket`, `path`). The BFF maps it to the appropriate DIAL Core header.

**Rationale:** The `POST /api/v1/files` endpoint uses `multipart/form-data`. Custom request headers are sometimes stripped by reverse proxies or CORS preflight. Encoding the intent as a form field keeps the API surface entirely within the existing multipart contract, validated by `class-validator` on the DTO. The BFF owns the mapping to `If-None-Match: *` on the upstream DIAL Core call.

**Mapping:**
| `uploadMode` | DIAL Core header |
|---|---|
| `'overwrite'` (or absent) | Omit conditional headers (existing behavior, overwrites) |
| `'create-only'` | `If-None-Match: *` |

DIAL Core returns **412 Precondition Failed** when `If-None-Match: *` is sent and the file already exists. The BFF catches 412 and returns **409 Conflict** with a clear body so the frontend can surface it as an upload failure for that file.

**Alternative considered:** A custom `X-Upload-Mode` request header. Rejected: multipart fields are simpler to validate with class-validator and avoid potential CORS / proxy stripping issues.

---

### Decision 4: SDK supports `If-None-Match` — no raw fetch needed

**Confirmed:** `@epam/ai-dial-typescript-sdk@0.1.0-dev.24` types `If-None-Match` and `If-Match` on `operations['uploadFile'].parameters.header`. The SDK's `uploadFile(bucket, path, init)` accepts `init.headers['If-None-Match']`. The BFF passes it through to DIAL Core via the SDK client. **No raw fetch fallback required.**

The archived `2026-06-19-add-file-manager-transfer-actions` design noted that conditional headers were unavailable in the SDK — this was incorrect. The SDK wraps openapi-fetch which passes all `init.headers` verbatim; the type definitions confirm `If-None-Match` is recognized.

---

### Decision 5: `prepareFileName` ported to `apps/chat/src/utils/file-name.ts`

**Chosen:** Create `apps/chat/src/utils/file-name.ts` exporting:
- `sanitizeFileName(name: string): string` — trims whitespace, splits extension, applies `NOT_ALLOWED_SYMBOLS_REGEXP` (replacing matches with `_`) to the base name, trims trailing dots/spaces, re-attaches extension.
- Does **not** enforce UTF-8 byte limits (the legacy `getResourceMaxSegmentBytes` is server-side enforcement; DIAL Core handles it).

**Rationale:** Reuse `NOT_ALLOWED_SYMBOLS_REGEXP` from `@epam/ai-dial-ui-kit` (single source of truth for forbidden symbols). Keep the util in `apps/chat` (not a lib) because it depends on the app's upload pipeline contract.

**What is NOT ported:** `prepareEntityName`'s `forRenaming: true, trimEndDotsRequired: true` path. We port only the behavior needed for uploads — forbidden char replacement and trailing-dot trimming — and nothing from `sanitizeConversationName`.

---

## Risks / Trade-offs

**[Risk] `If-None-Match: *` on Duplicate/fresh paths could fail if cache is stale** → Mitigation: Surface the 412→409 mapped error as a per-file failure in `UploadProgressModal` (already shows `Failed` state). User can retry. This is preferable to silent overwrite. The folder listing is re-fetched after the batch settles, ensuring future uploads see the current state.

**[Risk] Sanitization mutates `DialUploadFileItem` objects in `onValidateUpload`** → Mitigation: `DialUploadFileItem` is a plain `{ fileContent: File; name: string }` object created by the ui-kit's `openFileDialog` handler. Mutation is safe in practice; there are no Object.freeze calls in the ui-kit. Document with a JSDoc comment explaining the side effect.

**[Risk] ui-kit's auto-generated Duplicate names (e.g. `notes (1).txt`) may not match our cached listing check** → The ui-kit generates suffix names at resolution time from the same `existingFiles` array it received during conflict detection. Since `existingFiles` comes from the same cached listing, the generated name is guaranteed absent from the cache. The create-only path is correct.

**[Risk] BFF rate limit (100 req/60s) on `POST /api/v1/files`** → No change. Concurrency remains `UPLOAD_CONCURRENCY = 3`. Unchanged.

**[Risk] XHR progress path (`uploadFileWithProgress`) needs to send `uploadMode` in FormData** → Mitigation: Add `uploadMode` field to the FormData construction in `upload-file-with-progress.ts`. This requires adding `uploadMode?: UploadMode` to `UploadFileWithProgressOptions`.

---

## Migration Plan

1. **Slice 1** — Sanitization util + hook integration (no BFF change). Verified by unit tests + manual upload of a file with `:` in the name.
2. **Slice 2** — Wire conflict popup: `conflictResolutionPopupOptions` on `DialFileManagerModal`; remove blocking return from `onValidateUpload`; add i18n keys. Verified by uploading a file whose name matches an existing file — popup appears.
3. **Slice 3** — BFF `uploadMode` field: `FileParamsDto`, `FilesService` conditional header, 412→409 mapping, OpenAPI regen, frontend adapter (`files.api.ts` + `upload-file-with-progress.ts`). Verified by Replace (file overwrites) and Duplicate (new name created, race returns 409).
4. **Slice 4** — Integration tests + gap matrix row #19 updated to ✅.

No feature flag needed. No data migration needed (existing uploads are unaffected). Rollback: revert Slice 3 BFF change independently; frontend gracefully degrades (upload still works, just without race protection).

---

## Open Questions

None — all design choices have been resolved above.
