## Why

`DialFileManagerModal` supports uploading, creating folders, and downloading but has no delete capability, leaving users unable to remove files or folders without leaving the modal. The legacy `FileManagerModal` (pre-BFF era) wired delete through Redux; this change brings full parity to the new modal using the same BFF-pattern established by the upload, folder-create, and download-archive endpoints.

## What Changes

- **New BFF endpoint** `POST /api/v1/files/delete` — batch-deletes files and folders; for folders, recursively expands contents then deletes each item via the DIAL Core SDK, then removes the `.dial_folder` marker; returns per-item results and surfaces partial failures.
- **OpenAPI regeneration** — new `DeleteFilesDto` / `DeleteFilesResponseDto` added to Swagger; `npm run openapi` produces `filesApi.deleteFiles(...)` in `@epam/chat-api-client`.
- **`files.api.ts` wrapper** — thin `deleteFiles(items)` function wrapping the generated client method.
- **`useDialFileManager` hook extension** — adds `onDeleteFiles(items, sourceFolder)` matching the ui-kit signature, `isDeleting` state, `deleteError` / `clearDeleteError`, WRITE-permission gating, cache invalidation for affected paths, and navigation to parent when the current folder is deleted.
- **`DialFileManagerModal` wiring** — passes `onDeleteFiles`, `deleteConfirmationOptions`, and `DialFileManagerActions.Delete` label strings to the `DialFileManager` component's `gridOptions.actionLabels`, `treeOptions.actionLabels`, and `bulkActionsToolbarOptions.actionLabels`; adds a loading overlay and dismissible error banner for delete, mirroring the download UX.
- **i18n** — new keys under `dialFileManager.*` for delete labels, confirmation title/body (single vs. multiple items), error messages.
- **RTL** — logical Tailwind classes throughout; no new physical-direction classes.

## Capabilities

### New Capabilities

- `file-manager-delete-api`: BFF `POST /api/v1/files/delete` endpoint — request/response contract, folder-expansion strategy, partial-failure semantics, auth, validation, throttle, Swagger, supertest tests.
- `file-manager-delete-ui`: `useDialFileManager.onDeleteFiles`, `DialFileManagerModal` wiring, confirmation UX, loading overlay, error banner, i18n, RTL.

### Modified Capabilities

- `dial-file-system-picker`: The spec previously noted that `onDeleteFiles` was absent. Update the spec to document that delete is now wired when the `add-file-manager-delete` change ships — no requirement-level change, but the spec sync note must be added.

## Impact

- **`apps/chat-api/src/files/`** — new `dto/delete-files.dto.ts`, additions to `files.controller.ts`, `files.service.ts`, `files.module.ts`; new controller and service test coverage.
- **`libs/chat-api-client/`** — regenerated via `npm run openapi`; do not hand-edit.
- **`apps/chat/src/server-api/files.api.ts`** — new `deleteFiles` export.
- **`apps/chat/src/hooks/files/useDialFileManager.ts`** and `useDialFileManager.spec.tsx`.
- **`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`** — new props for delete labels and confirmation, updated `gridOptions`, `treeOptions`, `bulkActionsToolbarOptions`; updated `DialFileManagerModal.spec.tsx`.
- **`apps/chat/src/i18n/locales/en.json`** — new `dialFileManager.*` keys.
- **No changes** to `libs/*` (ui-kit boundary respected; all integration in app-layer hook and modal).
- **Alternatives considered**: `DELETE /api/v1/files` with body — rejected because HTTP DELETE with a body is not universally supported by proxies; `POST /api/v1/files/delete` follows the same pattern as `POST /api/v1/files/download-archive`.
- **Rollback**: The new endpoint is additive; removing it requires only deleting the DTO/controller/service additions and regenerating the client. Frontend callers are isolated in `files.api.ts` and `useDialFileManager`, so removal does not affect other hooks or components.
- **Breaking**: No. New endpoint, new props (all optional in the ui-kit), new i18n keys.
- **i18n impact**: Yes — 8–10 new translation keys (see design.md for the full table).
- **Scope creep flag**: No `libs/*` are touched. `DialFileManagerModal` is an `apps/chat` component. All BFF knowledge (endpoint paths, DTO shapes) stays in `apps/chat-api` and the `apps/chat/src/server-api/` adapter layer.
