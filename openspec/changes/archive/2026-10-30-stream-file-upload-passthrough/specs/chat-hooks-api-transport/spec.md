## MODIFIED Requirements

### Requirement: Upload-with-progress is a factory over an injected XHR factory and host capabilities

`@epam/ai-dial-chat-hooks` SHALL export `createUploadFileWithProgress(deps: { getCsrfToken: () => string | null; setCsrfToken: (token: string | null) => void; notifyUnauthorized: (url: string) => void; createUnauthorizedError: (url: string) => Error; uploadUrl: string; bodyEncoding?: UploadBodyEncoding; xhrFactory?: () => XMLHttpRequest })` (`libs/chat-hooks/src/files/create-upload-file-with-progress.ts`), returning an `UploadFileWithProgressFn` that `apps/chat/src/server-api/upload-file-with-progress.ts` composes with `uploadUrl: '/api/v1/files/content'` and `bodyEncoding: UploadBodyEncoding.Raw`, with this behavior: progress reporting, abort via `AbortSignal`, `overwrite`/`create-only` upload mode, JSON response parsing, CSRF header attachment and rotation, and unauthorized (401) handling. `xhrFactory` SHALL default to `() => new XMLHttpRequest()` when omitted.

`UploadBodyEncoding` SHALL be an exported string enum with members `Multipart = 'multipart'` and `Raw = 'raw'`; `bodyEncoding` SHALL default to `UploadBodyEncoding.Multipart`.

- `Multipart`: `POST` to `uploadUrl` with a `FormData` body carrying `file`, `bucket`, `path` and, when set, `uploadMode` (the behavior before this change).
- `Raw`: `PUT` to `uploadUrl` with the query parameters `bucket`, `path`, `uploadMode` (when set) and `contentType` (when `file.type` is non-empty), request header `Content-Type: application/octet-stream`, and the `File` itself as the body (`xhr.send(file)`), so the browser streams it with its own `Content-Length`.

The upload URL and the encoding are host-supplied values; the lib SHALL NOT hardcode either path.

#### Scenario: Progress events are reported during upload
- **WHEN** the returned function is called with an `onProgress` callback and the injected (or default) XHR reports upload progress events
- **THEN** `onProgress` is called with the same percentage values the pre-move implementation would report

#### Scenario: Abort signal aborts the underlying XHR
- **WHEN** the caller's `AbortSignal` is aborted while the upload is in flight
- **THEN** the underlying XHR request is aborted and the returned promise rejects, matching the pre-move behavior

#### Scenario: CSRF header is attached and rotation is captured
- **WHEN** `deps.getCsrfToken()` returns a token before the request is sent, and the response carries a rotated token
- **THEN** the request carries that token as a header and `deps.setCsrfToken` is called with the rotated value

#### Scenario: 401 response calls the injected unauthorized callback
- **WHEN** the upload response has status 401
- **THEN** `deps.notifyUnauthorized` is called and the returned promise rejects with the error built by `deps.createUnauthorizedError(url)`

#### Scenario: A custom `xhrFactory` is honored in tests
- **WHEN** `deps.xhrFactory` is supplied
- **THEN** the returned function uses the XHR instance that factory produces instead of constructing a global `XMLHttpRequest` directly

#### Scenario: Default encoding keeps the multipart request
- **WHEN** `deps.bodyEncoding` is omitted
- **THEN** the XHR is opened with `POST` on `uploadUrl` and sent a `FormData` containing `file`, `bucket`, `path` and, when set, `uploadMode`

#### Scenario: Raw encoding sends the file as the body
- **WHEN** `deps.bodyEncoding` is `UploadBodyEncoding.Raw` and a `File` of type `text/csv` is uploaded to `reports/q3.csv` in bucket `Abc123` with `uploadMode: 'create-only'`
- **THEN** the XHR is opened with `PUT` on `uploadUrl` with the query `bucket=Abc123&path=reports%2Fq3.csv&uploadMode=create-only&contentType=text%2Fcsv`
- **AND** the request header `Content-Type` is `application/octet-stream`
- **AND** `send` is called with that `File` object, not a `FormData`

#### Scenario: Raw encoding omits an empty content type
- **WHEN** `deps.bodyEncoding` is `UploadBodyEncoding.Raw` and `file.type` is an empty string
- **THEN** the query carries no `contentType` parameter
