## Why

The Chat frontend currently has no way to upload files to DIAL Core storage or retrieve binary file content through the BFF layer. All browser traffic must route through Chat API to keep DIAL Core credentials server-side, so a dedicated files-transfer API is needed to fill this gap and unblock attachment-heavy workflows.

## What Changes

- Add `POST /api/v1/files` — multipart/form-data upload proxied to DIAL Core Files API.
- Add `GET /api/v1/files/download` — streaming binary download proxied from DIAL Core Files API, with safe response headers forwarded to the browser.
- Add `src/files/` domain in `apps/chat-api` (controller, service, module, DTOs, tests).
- Register `FilesModule` in `AppModule`.
- Regenerate `@epam/chat-api-client` to expose `FilesApi` with `uploadFile` and `downloadFile` methods.
- Add `apps/chat/src/server-api/files.api.ts` wrapper around the generated client.
- Document any OpenAPI generator gaps (multipart or binary responses) with a narrowly scoped `base.ts` exception if required.

## Capabilities

### New Capabilities

- `file-upload`: Accept a multipart/form-data file from the browser, validate the destination path and bucket, and proxy the upload to DIAL Core `POST /v1/files/{bucket}/{path}` under the authenticated user's session.
- `file-download`: Accept a validated file path, proxy the request to DIAL Core `GET /v1/files/{bucket}/{path}`, stream the binary response back to the browser, and forward safe headers (`Content-Type`, `Content-Disposition`, `Content-Length`).

### Modified Capabilities

*(none — no existing spec-level requirements change)*

## Impact

- **apps/chat-api**: New `src/files/` domain; `AppModule` gains `FilesModule` import.
- **Generated client**: `@epam/chat-api-client` regenerated; `FilesApi` class added.
- **apps/chat**: New `src/server-api/files.api.ts`; existing `api-client.ts` exports `filesApi` singleton.
- **Security surface**: All user-controlled path segments and bucket IDs validated with allowlist regex to block path traversal, SSRF, and header injection.
- **No breaking changes** to existing endpoints.
