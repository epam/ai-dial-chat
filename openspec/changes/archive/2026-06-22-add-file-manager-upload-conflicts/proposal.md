## Why

`DialFileManagerModal` + `useDialFileManager` currently block uploads entirely when a filename collision is detected, instead of presenting a Replace / Duplicate / Cancel flow like the legacy `FileManager`. This is gap matrix row #19 (P1 upload follow-up), and it also leaves forbidden-character filename sanitization unimplemented — files with `:;,=/{}%&\"` in their names upload with raw names that DIAL Core may reject or store incorrectly.

## What Changes

- **Filename sanitization**: port `prepareFileName` / `prepareEntityName` logic from legacy `apps/chat/src/utils/app/file.ts` and `common.ts` into `apps/chat/src/utils/`; apply before conflict detection and before `POST /api/v1/files`.
- **Conflict resolution popup**: wire `conflictResolutionPopupOptions` on `DialFileManagerModal` / `DialFileManager` (ui-kit built-in popup); change `onValidateUpload` to return conflict info instead of blocking with `valid: false`.
- **Upload mode headers**: extend `POST /api/v1/files` BFF endpoint to accept `uploadMode: 'overwrite' | 'create-only'` (mapped to `If-Match: *` / `If-None-Match: *` forwarded to DIAL Core); generate duplicate sibling names client-side for Duplicate action.
- **i18n keys**: add `dialFileManager.conflict.*` keys for popup labels; pass `forbiddenSymbolsRegExp` + tooltip to `DialFileManager`.
- **Tests**: unit tests for sanitization edge cases; hook tests for conflict resolution paths; BFF controller + service tests for conditional-header forwarding.

## Capabilities

### New Capabilities

- `file-manager-upload-conflicts`: Replace / Duplicate / Cancel conflict resolution popup, duplicate sibling name generation, and conditional-header upload mode for `DialFileManagerModal` + `useDialFileManager`.
- `file-manager-filename-sanitization`: Forbidden-character sanitization of upload filenames (`NOT_ALLOWED_SYMBOLS_REGEXP` → `_`) applied in the upload pipeline before conflict detection.

### Modified Capabilities

- `file-manager-upload`: `onValidateUpload` return type changes to expose conflict info (not a blocking `valid: false`); `onUploadFiles` path construction changes to use sanitized names and accept upload-mode intent; `POST /api/v1/files` gains optional `uploadMode` field. Spec-level behavior changes in all three areas.
- `file-upload`: BFF `uploadFile` endpoint gains `uploadMode` request field and forwards `If-Match` / `If-None-Match` to DIAL Core; 412 responses are mapped. Spec-level API contract change.

## Impact

- **Frontend**: `apps/chat/src/hooks/files/useDialFileManager.ts`, `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`, new `apps/chat/src/utils/file-name.ts` (sanitization), `apps/chat/src/server-api/files.api.ts`, `apps/chat/src/i18n/locales/en.json`.
- **Backend**: `apps/chat-api/src/files/` (controller DTO, service header forwarding), OpenAPI spec → regenerate `@epam/chat-api-client`.
- **Ui-kit**: consumes existing `conflictResolutionPopupOptions`, `forbiddenSymbolsRegExp`, `NOT_ALLOWED_SYMBOLS_REGEXP` — no ui-kit changes required.
- **DIAL Core**: relies on existing `If-Match` / `If-None-Match` support on `PUT/POST /v1/files/{Bucket}/{path}`.
- **Gap matrix**: row #19 → ✅ after this change.
