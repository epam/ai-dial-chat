Slicing strategy: **contract-first, then risk-first on the BFF**. The endpoint
contract (DTO + Swagger + generated client) lands first. Then the BFF
pass-through is proven end to end with supertest (stream intact, exact
`Content-Length`, no temp file). That is the highest-risk part. Then the lib
option and the host switch. Each group is independently verifiable.
`POST /api/v1/files` is not touched.

## 1. Contract: query DTO, handler skeleton, OpenAPI

- [x] 1.1 Add `UploadFileContentQueryDto extends UploadFileDto` with optional `contentType` (`@IsOptional`, `@IsString`, `@MaxLength(255)`, `@Matches(/^[\w.+-]+\/[\w.+-]+$/)`, `@ApiPropertyOptional`) in `apps/chat-api/src/files/dto/upload-file-content.dto.ts`; unit spec `apps/chat-api/src/files/tests/upload-file-content.dto.spec.ts` (next to `upload-file.dto.spec.ts`) covers a valid query, an invalid `contentType` (`text/csv; charset=x`, CR/LF), inherited `bucket`/`path`/`uploadMode` rejections, and an undeclared field.
  - Verification: `npm run test:file -- apps/chat-api/src/files/tests/upload-file-content.dto.spec.ts`
- [x] 1.2 Add the `uploadFileContent` handler to `apps/chat-api/src/files/files.controller.ts`: `@Put('content')`, `@HttpCode(201)`, `@ApiConsumes('application/octet-stream')`, `@ApiBody({ schema: { type: 'string', format: 'binary' } })`, `@ApiDialCoreErrors()`, and `@ApiResponse` for 201 (`FileUploadResponseDto`), 400, 401, 403, 409, 411, 413, 415, 502, 503. Bind `@Query() query: UploadFileContentQueryDto` and `@Req()`. Delegate to `FilesService.uploadFileContent` (stub in this task). Follow the thin-controller rules in `apps/chat-api/AGENTS.md` §3.
  - Verification: `npm run test:file -- apps/chat-api/src/files/tests/files.controller.spec.ts`
- [x] 1.3 Run `npm run openapi` and `npm run openapi:check`. Confirm that `libs/chat-api-client/openapi.json` has `uploadFileContent` with the octet-stream body and the typed query. Build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Do not hand-edit generated files. `apps/chat/src/server-api/api-client.ts` needs no change, because the existing `filesApi` singleton exposes the new method and no frontend code calls it (design D7).
  - Verification: `npm run openapi:check`

## 2. BFF pass-through (risk-first)

- [x] 2.1 In `apps/chat-api/src/files/upload/files-upload.service.ts`, add a `StreamedUploadFile { stream: Readable; size: number; mimetype: string; originalname?: string }` member to the `UploadedFile` union. Extend `readUploadedFile` and `getUploadedFileSize` for it. Add a byte-counting step that errors when the stream ends with a count different from `size` (design D4). `uploadFile` accepts an optional external `AbortSignal`, combined with the watchdog signal through `AbortSignal.any` (design D5). Keep the existing staged and buffered paths byte-for-byte unchanged.
  - Verification: `npm run test:file -- apps/chat-api/src/files/tests/upload/files-upload.service.spec.ts`
- [x] 2.2 Unit tests in `apps/chat-api/src/files/tests/upload/files-upload.service.spec.ts` for a streamed source:
  - the forwarded `Content-Length` is preamble + N + epilogue, with no chunked encoding;
  - the body bytes reach the fetch body in order;
  - a short stream errors and aborts the request;
  - an external abort aborts the fetch;
  - a stall trips `Stalled` → 503 with the existing message;
  - 412 → 409, 413 → 413, 5xx → 502.
  - Verification: `npm run test:file -- apps/chat-api/src/files/tests/upload/files-upload.service.spec.ts`
- [x] 2.3 Implement `FilesService.uploadFileContent` in `apps/chat-api/src/files/files.service.ts`. Implement the handler checks in `files.controller.ts`, in this order:
  - request `Content-Type` other than `application/octet-stream` → `415`;
  - missing or non-integer `Content-Length` → `411`;
  - `Content-Length` > `FILE_UPLOAD_MAX_BYTES` → `413 File too large`, before reading.

  Then wire the client disconnect (`req` `close` with `!req.complete`) into the abort signal and log it at `warn`. On an early upstream response, set `Connection: close` (design D6). Read `FILE_UPLOAD_MAX_BYTES` through `ConfigService`. Use typed exceptions only (§4 and §6 of `apps/chat-api/AGENTS.md`).
  - Verification: `npm run test:file -- apps/chat-api/src/files/tests/files.controller.spec.ts`
- [x] 2.4 Supertest integration tests for `PUT /api/v1/files/content` in `apps/chat-api/src/files/tests/files.controller.spec.ts` (it already drives the controller through supertest), with DIAL Core stubbed:
  - 201 with `{ url }` for a multi-MB body;
  - the stub receives the exact bytes and `Content-Length`;
  - no new file appears under `os.tmpdir()` (snapshot the directory before and after);
  - a `.json`-typed file sent as octet-stream arrives intact, proving the JSON body parser did not consume it (design D3);
  - status mapping: 400 (bad query and undeclared param), 401, 411, 413 (declared size, and Core 413), 415, 409 (Core 412);
  - client abort mid-body aborts the stub request;
  - `POST /api/v1/files` still stages to `os.tmpdir()` (regression guard).
  - Verification: `npm run test:file -- apps/chat-api/src/files/tests/files.controller.spec.ts`
- [x] 2.5 Slice check: `npm run verify:changed`.

## 3. Lib: `bodyEncoding` in `createUploadFileWithProgress`

- [x] 3.1 Add the exported string enum `UploadBodyEncoding { Multipart = 'multipart', Raw = 'raw' }` and the optional `bodyEncoding` dep (default `Multipart`) to `libs/chat-hooks/src/files/create-upload-file-with-progress.ts`. For `Raw`:
  - `xhr.open('PUT', `${uploadUrl}?${URLSearchParams}`)` with `bucket`, `path`, `uploadMode` when set, and `contentType` when `file.type` is non-empty;
  - set the header `Content-Type: application/octet-stream`;
  - call `xhr.send(file)`.

  Progress, CSRF, 401, JSON and abort handling stay shared. Export the enum from `libs/chat-hooks/src/index.ts`. Add JSDoc to the new enum and the new dep.
  - Verification: `npm run test:file -- libs/chat-hooks/src/files/tests/create-upload-file-with-progress.spec.ts`
- [x] 3.2 Extend the lib spec (`libs/chat-hooks/src/files/tests/create-upload-file-with-progress.spec.ts`) with:
  - the default still uses `POST` + `FormData` with the same fields;
  - `Raw` uses `PUT`, the expected query string, the octet-stream header, and `send` with the `File` itself;
  - an empty `file.type` omits `contentType`;
  - progress, 401, CSRF rotation and abort behave identically under `Raw`.
  - Verification: `npm run test:file -- libs/chat-hooks/src/files/tests/create-upload-file-with-progress.spec.ts`
- [x] 3.3 Architecture guard: confirm the `libs/chat-hooks` diff adds no `/api` literal, no generated-client import, and no host config. `uploadUrl` and `bodyEncoding` stay host-supplied. Run `npm exec nx lint @epam/ai-dial-chat-hooks`, which enforces module boundaries.
  - Verification: `npm exec nx lint @epam/ai-dial-chat-hooks`

## 4. Host switch

- [x] 4.1 In `apps/chat/src/server-api/upload-file-with-progress.ts`, set `uploadUrl: '/api/v1/files/content'` and `bodyEncoding: UploadBodyEncoding.Raw`. Extend `apps/chat/src/server-api/tests/upload-file-with-progress.spec.ts`, asserting the composed function issues a `PUT` to that URL. If the failure-reason tests for `libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts` enumerate statuses, add `411`/`415` cases there (they resolve to the existing unknown reason, with no new strings).
  - Verification: `npm run test:file -- apps/chat/src/server-api/tests/upload-file-with-progress.spec.ts`
- [x] 4.2 Slice check: `npm run verify:changed`.

## 5. Docs

- [x] 5.1 `apps/chat-api/README.md`: document `PUT /api/v1/files/content` in the files endpoint section. Update the `FILE_UPLOAD_MAX_BYTES` and `FILE_TRANSFER_TIMEOUT_MS` rows in every copy of the table (the README repeats its body): file-manager uploads are streamed without staging; only `POST /api/v1/files` stages to the OS temp dir. Add the ingress note to turn off request buffering for the route.
- [x] 5.2 `libs/chat-hooks/README.md`: `createUploadFileWithProgress` section — the `bodyEncoding` dep, the `UploadBodyEncoding` enum and its members, and a `Raw` example with all required deps.
- [x] 5.3 `docs/architecture.md`: in the files row of the `ApiEndpoints` / controller table, mention the streamed `PUT /api/v1/files/content` alongside the multipart upload.
- [x] 5.4 Run `npm run validate:docs` and `npm run validate:specs`.

## 6. Close

- [ ] 6.1 `npm run verify:full`.

## 7. Follow-ups (out of scope, record only)

- [ ] 7.1 Open an issue to move conversation attachments (`useAttachmentUpload`), audio transcription and conversation import to the streamed endpoint. This needs a fetch-based raw upload in `createFilesApiClient`, since these callers use the generated client without progress. After that, consider retiring disk staging in `POST /api/v1/files`.
