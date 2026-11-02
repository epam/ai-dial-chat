## MODIFIED Requirements

### Requirement: Uploads go through the injected `DialFilesApi` port

`useDialFileUploadBatch` SHALL perform every upload through the injected `DialFilesApi` port (`libs/chat-hooks/src/files/dial-files-api.ts`), calling `filesApi.uploadFile(bucket, path, file, { signal, uploadMode, onProgress })`. It SHALL NOT import app server-api modules. The app wires the port in `apps/chat/src/server-api/dial-files-api.adapter.ts` to the `uploadFile`/`uploadArchive` exports of `apps/chat/src/server-api/files.api.ts`. Those come from `createFilesApiClient(filesApi, uploadFileWithProgress)` (`libs/chat-hooks/src/files/create-files-api.ts`). When `onProgress` is supplied, `uploadFile` uses the app's `uploadFileWithProgress` (`apps/chat/src/server-api/upload-file-with-progress.ts`), because fetch exposes no upload progress. That function is built by `createUploadFileWithProgress` from `@epam/ai-dial-chat-hooks`, with the app's CSRF and unauthorized handlers, `uploadUrl: '/api/v1/files/content'` and `bodyEncoding: UploadBodyEncoding.Raw`. It sends an `XMLHttpRequest` `PUT` whose body is the file itself and whose query carries `bucket`, `path`, `uploadMode` when one is set, and `contentType` when the file has a type; the BFF streams that body to DIAL Core without staging it (see `file-upload`, "Stream a raw-body upload to DIAL Core without staging"). Otherwise it calls the generated `filesApi.uploadFile({ bucket, path, file, uploadMode })`, which still uses the multipart `POST /api/v1/files`. Both paths accept an `AbortSignal` and return `{ url: string }`.

The failure reasons and messages the batch derives from upload errors are unchanged; the new `411` and `415` statuses map to the existing unknown/mixed failure reason.

#### Scenario: Progress uploads use the XHR transport

- **WHEN** the hook uploads a file with an `onProgress` callback
- **THEN** the request is sent by `uploadFileWithProgress`, and each progress event updates that entry's `percent`

#### Scenario: Progress uploads stream the raw file

- **WHEN** the app's file manager uploads a file
- **THEN** the request is a `PUT` to `/api/v1/files/content` with `Content-Type: application/octet-stream` and the file as its body

#### Scenario: The lib never reaches the app's server-api

- **WHEN** `libs/chat-hooks` is type-checked
- **THEN** `useDialFileUploadBatch` depends only on the `DialFilesApi` port, not on `apps/chat/src/server-api`
