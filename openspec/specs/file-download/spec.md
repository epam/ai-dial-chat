# file-download Specification

## Purpose

Downloading a file from DIAL Core through the BFF, with query DTO validation, a generated-client frontend wrapper, and resolving DIAL file ids embedded in assistant markdown to download URLs.

## Requirements

### Requirement: Download file from DIAL Core via BFF
The system SHALL expose `GET /api/v1/files/download` accepting `bucket` and `path` query parameters, validate all inputs, proxy the request to DIAL Core `GET /v1/files/{bucket}/{path}` under the authenticated user's session, and stream the binary response back to the browser.

The handler SHALL forward an explicit allowlist of safe response headers from the DIAL Core response: `content-type`, `content-disposition`, `content-length`. All other headers SHALL be stripped. The endpoint SHALL not buffer the response body — it SHALL pipe the DIAL Core `fetch` response body stream directly to the NestJS `Response` object.

- **Rate limit**: `@Throttle({ default: { limit: 60, ttl: 60000 } })`.
- **HTTP method**: `GET`
- **Route**: `/api/v1/files/download` (query-param shape chosen over path params; see design.md Decision 3)
- **operationId**: `downloadFile` → generated SDK method `filesApi.downloadFile(...)` / `filesApi.downloadFileRaw(...)`.
- **Response content-type**: `application/octet-stream` (or whatever DIAL Core returns, forwarded verbatim from the allowlist).

**Query parameters:**
| Parameter | Type   | Validation |
|-----------|--------|------------|
| `bucket`  | string | Required; `@Matches(/^[\w.\-]+$/)` |
| `path`    | string | Required; `@Matches(/^[\w.\-/]+$/)` — must not contain `..`; must not start with `/` |

**Success response (200):** Binary stream. Swagger annotated as `@ApiProduces('application/octet-stream')` with `@ApiResponse({ status: 200, description: 'Binary file content', schema: { type: 'string', format: 'binary' } })`.

**Error codes:** 400, 401, 403, 404, 429, 502, 503, 500.

**OpenAPI generator gap:** The generator emits `Blob | void` for binary responses, which loses stream semantics. The `files.api.ts` wrapper SHALL use `filesApi.downloadFileRaw()` to obtain the raw `fetch` `Response` object, document this as a generator gap, and expose a typed helper. This pattern mirrors `auth.api.ts`:`getCurrentUserRaw()`.

#### Scenario: Successful file download
- **WHEN** an authenticated user sends `GET /api/v1/files/download?bucket=my-bucket&path=folder/file.pdf`
- **THEN** the system returns `200 OK` with the binary file content and the forwarded `Content-Type`, `Content-Disposition`, and `Content-Length` headers from DIAL Core

#### Scenario: Downloaded file headers forwarded correctly
- **WHEN** DIAL Core responds with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="report.pdf"`, and `Content-Length: 204800`
- **THEN** the BFF response includes exactly those three headers and no additional DIAL Core headers

#### Scenario: Unauthenticated download attempt
- **WHEN** the request carries no valid session cookie
- **THEN** the system returns `401 Unauthorized` without forwarding the request to DIAL Core

#### Scenario: Invalid path — traversal attempt
- **WHEN** the `path` query parameter contains `..` or `%2E%2E`
- **THEN** the system returns `400 Bad Request` and does not forward the request to DIAL Core

#### Scenario: Invalid bucket format
- **WHEN** the `bucket` query parameter contains a slash or colon
- **THEN** the system returns `400 Bad Request`

#### Scenario: File not found in DIAL Core
- **WHEN** DIAL Core returns `404 Not Found`
- **THEN** the system returns `404 Not Found` to the browser

#### Scenario: User lacks permission for the file
- **WHEN** DIAL Core returns `403 Forbidden`
- **THEN** the system returns `403 Forbidden` to the browser

#### Scenario: DIAL Core rate-limits the request
- **WHEN** DIAL Core returns `429 Too Many Requests`
- **THEN** the system returns `429 Too Many Requests` to the browser

#### Scenario: DIAL Core download times out
- **WHEN** the fetch to DIAL Core exceeds `FILE_TRANSFER_TIMEOUT_MS`
- **THEN** the system aborts the connection and returns `503 Service Unavailable`

#### Scenario: DIAL Core returns unexpected 5xx
- **WHEN** DIAL Core returns a 5xx response
- **THEN** the system logs the error and returns `502 Bad Gateway`

---

### Requirement: Download query DTO validation
The system SHALL parse and validate the `bucket` and `path` query parameters through a `DownloadFileDto` class decorated with `class-validator` and `@ApiProperty`. The global `ValidationPipe` MUST reject undeclared query params.

The `DownloadFileDto` SHALL be defined at `apps/chat-api/src/files/dto/download-file.dto.ts`.

- `bucket`: `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[\w.\-]+$/)`, `@MaxLength(256)`
- `path`: `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[\w.\-/]+$/)`, `@MaxLength(1024)`, and validation rejecting values starting with `/` or containing `..`

#### Scenario: Valid DTO passes validation
- **WHEN** `bucket` is `user-bucket-01` and `path` is `reports/q1.pdf`
- **THEN** the DTO instantiates successfully and the service receives the validated object

#### Scenario: Missing required parameter
- **WHEN** the `path` query parameter is omitted
- **THEN** `ValidationPipe` returns `400 Bad Request` identifying the missing `path` field

---

### Requirement: Generated-client frontend wrapper for download
The system SHALL provide a typed frontend wrapper in `apps/chat/src/server-api/files.api.ts` that uses `filesApi.downloadFileRaw()` from `@epam/chat-api-client` to obtain the raw `fetch` `Response`. The wrapper SHALL document the generator gap inline and expose the `Response` to callers so they can read `response.body` as a `ReadableStream` or call `response.blob()`.

The `filesApi` singleton SHALL be exported from `apps/chat/src/server-api/api-client.ts` using the shared `Configuration` instance (with CSRF, unauthorized, and telemetry middleware already wired).

- **Cache TTL**: No cache — file content is not cached at the BFF or frontend layer.
- **i18n**: No new user-visible strings introduced by this capability; error display is the caller's responsibility.

#### Scenario: Frontend wrapper returns raw Response for streaming
- **WHEN** `downloadFile({ bucket, path })` is called in the frontend wrapper
- **THEN** the function calls `filesApi.downloadFileRaw(...)` and resolves to the raw `fetch` `Response` object with status `200` and a non-null `body` stream

#### Scenario: Frontend wrapper propagates 404 error
- **WHEN** the server returns `404 Not Found`
- **THEN** the `downloadFileRaw()` promise rejects and the caller can catch and handle the error

---

### Requirement: Assistant markdown resolves DIAL file ids to download URLs

Assistant message content rendered by `MarkdownRenderer`/`MDMessageViewer` (`libs/chat-shared/src/components/MarkdownRenderer/`) SHALL accept an optional `urlTransform` prop: a function applied to every markdown/raw-HTML `href`/`src` value before react-markdown's own protocol-safety check (`defaultUrlTransform`) runs. `MDMessageViewer`, `MessageBubble`/`AssistantMessageBubble` (`libs/conversation-messages/`) SHALL forward this prop through as `urlTransform`/`markdownUrlTransform` respectively, defaulting to no extra rewrite when omitted.

`apps/chat` SHALL supply `resolveMarkdownUrl` (`apps/chat/src/utils/dial-file.ts`) as this transform for assistant messages (`ConversationMessageItem.tsx`), converting a DIAL file id embedded inline in markdown (`files/{bucket}/{path}`) to the BFF download URL `/api/v1/files/download?bucket={bucket}&path={encoded path}` via the existing `resolveDialFileDownloadUrl`. This is the mechanism that lets an assistant reply embed a code-interpreter-generated chart as `![alt](files/{bucket}/{path})` and have it render as a real `<img>` instead of a broken image (the literal `files/...` id is not itself a resolvable URL).

Values that are not DIAL file ids (e.g. `https://` URLs) SHALL be passed through unchanged. The host transform's output SHALL still be passed through react-markdown's own `defaultUrlTransform`, so an unsafe protocol (e.g. `javascript:`) returned by a host transform is still stripped.

#### Scenario: Markdown image src is rewritten to a download URL
- **GIVEN** assistant markdown content `![Silver Lake chart](files/9gRuhxHb/appdata/applications/public/pg/chart.png)`
- **WHEN** the message is rendered
- **THEN** the rendered `<img>` has `src="/api/v1/files/download?bucket=9gRuhxHb&path=appdata%2Fapplications%2Fpublic%2Fpg%2Fchart.png"`

#### Scenario: Markdown link href is rewritten to a download URL
- **GIVEN** assistant markdown content `[report](files/bucket/report.pdf)` and a host `urlTransform`
- **WHEN** the message is rendered
- **THEN** the rendered `<a>` has `href` equal to the transform's output for that DIAL file id

#### Scenario: Non-file URLs are left unchanged
- **GIVEN** assistant markdown content `![logo](https://example.com/logo.png)`
- **WHEN** the message is rendered
- **THEN** the rendered `<img src>` is `https://example.com/logo.png`, unmodified

#### Scenario: `urlTransform` is omitted
- **GIVEN** a `MarkdownRenderer`/`MDMessageViewer` consumer that does not pass `urlTransform`
- **WHEN** content contains `![chart](files/bucket/chart.png)`
- **THEN** the rendered `<img src>` is the raw, unresolved `files/bucket/chart.png`

#### Scenario: A host transform cannot reintroduce an unsafe protocol
- **GIVEN** a host `urlTransform` that returns `javascript:alert(1)` for a given link
- **WHEN** the message is rendered
- **THEN** the rendered `<a href>` is empty (stripped by react-markdown's `defaultUrlTransform`), not the unsafe value
