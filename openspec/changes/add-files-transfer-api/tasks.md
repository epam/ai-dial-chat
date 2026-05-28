## 1. Environment & Configuration

- [x] 1.1 Add `FILE_UPLOAD_MAX_BYTES` (`@IsOptional`, `@Transform(parseInt)`, `@IsInt`, `@Min(1)`, default `52_428_800`) to `apps/chat-api/src/config/environment.config.ts`
- [x] 1.2 Add `FILE_TRANSFER_TIMEOUT_MS` (`@IsOptional`, `@Transform(parseInt)`, `@IsInt`, `@Min(1000)`, default `30_000`) to `apps/chat-api/src/config/environment.config.ts`
- [x] 1.3 Add placeholder entries for both variables to `.env.example`
- [x] 1.4 Document both variables in `apps/chat-api/README.md`

## 2. Error Handling Utilities

- [x] 2.1 Check `apps/chat-api/src/common/utils/dial-error.ts` — extend `handleDialError` to map HTTP 413 → `PayloadTooLargeException` and 429 → `TooManyRequestsException` if not already present

## 3. DTOs

- [x] 3.1 Create `apps/chat-api/src/files/dto/upload-file.dto.ts` with `UploadFileDto`: `bucket` (`@IsString`, `@IsNotEmpty`, `@Matches(/^[\w.\-]+$/)`, `@MaxLength(256)`, `@ApiProperty`) and `path` (`@IsString`, `@IsNotEmpty`, `@Matches(/^[\w.\-/]+$/)`, `@MaxLength(1024)`, `@ApiProperty`) — plus path-level validation rejecting values starting with `/` or containing `..`
- [x] 3.2 Create `apps/chat-api/src/files/dto/download-file.dto.ts` with `DownloadFileDto`: same `bucket` and `path` field definitions as above with `@ApiProperty` + `@ApiQuery`-compatible shape
- [x] 3.3 Create `apps/chat-api/src/files/dto/upload-file-response.dto.ts` with `FileUploadResponseDto`: `url: string` with `@IsString`, `@IsNotEmpty`, `@ApiProperty({ description: 'DIAL Core URL of the uploaded file', example: 'files/my-bucket/folder/file.pdf' })`

## 4. Files Service

- [x] 4.1 Create `apps/chat-api/src/files/files.service.ts` extending `AppService`; declare `private readonly logger = new Logger(FilesService.name)`
- [x] 4.2 Implement `uploadFile(bucket: string, path: string, file: Express.Multer.File, token: string): Promise<FileUploadResponseDto>` — build DIAL Core URL, create `AbortController` with `FILE_TRANSFER_TIMEOUT_MS` timeout, send `fetch` POST with `Content-Type` from multer `file.mimetype` and `file.buffer` as body, forwarding `Authorization: Bearer {token}`; parse response for `{ url }` and return `FileUploadResponseDto`; map errors via `handleDialError`
- [x] 4.3 Implement `downloadFile(bucket: string, path: string, token: string): Promise<{ stream: ReadableStream; headers: Record<string, string> }>` — build DIAL Core URL, create `AbortController` with `FILE_TRANSFER_TIMEOUT_MS` timeout, send `fetch` GET with `Authorization: Bearer {token}`; extract allowlisted response headers (`content-type`, `content-disposition`, `content-length`); return `response.body` stream and the allowlisted headers map; map non-2xx responses via `handleDialError`
- [x] 4.4 Define `SAFE_DOWNLOAD_HEADERS = ['content-type', 'content-disposition', 'content-length'] as const` in the service (or a sibling constants file) — used to filter DIAL Core response headers before forwarding

## 5. Files Controller

- [x] 5.1 Create `apps/chat-api/src/files/files.controller.ts` with `@ApiTags('files')`, `@Controller({ path: 'files', version: '1' })`; inject `FilesService`
- [x] 5.2 Implement `uploadFile` handler: `@Post()`, `@HttpCode(201)`, `@UseInterceptors(FileInterceptor('file'))`, `@Throttle({ default: { limit: 20, ttl: 60000 } })`, `@ApiConsumes('multipart/form-data')`, `@ApiBody({ schema: { type: 'object', required: ['file', 'bucket', 'path'], properties: { file: { type: 'string', format: 'binary' }, bucket: { type: 'string' }, path: { type: 'string' } } } })`, `@ApiResponse({ status: 201, type: FileUploadResponseDto })`, `@ApiResponse` for 400/401/403/413/429/502/503; accept `@UploadedFile() file: Express.Multer.File`, `@Body() body: UploadFileDto`, `@Req() req: Request`; extract `req.user.at` and delegate to service
- [x] 5.3 Implement `downloadFile` handler: `@Get('download')`, `@Throttle({ default: { limit: 60, ttl: 60000 } })`, `@ApiProduces('application/octet-stream')`, `@ApiResponse({ status: 200, description: 'Binary file content', schema: { type: 'string', format: 'binary' } })`, `@ApiResponse` for 400/401/403/404/429/502/503; accept `@Query() query: DownloadFileDto`, `@Req() req: Request`, `@Res() res: Response`; extract `req.user.at`, call service, set allowlisted headers on `res`, then `stream.pipeTo(res)` or equivalent Node.js streaming

## 6. Files Module & AppModule Registration

- [x] 6.1 Create `apps/chat-api/src/files/files.module.ts` with `@Module({ controllers: [FilesController], providers: [FilesService] })` exporting nothing
- [x] 6.2 Add `FilesModule` to the `imports` array in `apps/chat-api/src/app/app.module.ts`

## 7. Backend Tests

- [x] 7.1 Create `apps/chat-api/src/files/tests/files.controller.spec.ts` — unit tests for upload handler: happy path (201 + correct URL), invalid bucket (400), path traversal (400), unauthenticated (401), oversized file (413), DIAL Core 403 → 403, DIAL Core 429 → 429, DIAL Core unreachable → 503, DIAL Core 5xx → 502
- [x] 7.2 Create `apps/chat-api/src/files/tests/files.service.spec.ts` (or nest tests inside controller spec) — unit tests for download handler: happy path (200 + streamed body + forwarded headers), file not found → 404, unauthenticated → 401, invalid path (400), DIAL Core timeout → 503
- [x] 7.3 Create `apps/chat-api/src/files/tests/upload-file.dto.spec.ts` — validation unit tests: valid DTO passes, empty bucket rejects, path with `..` rejects, path starting with `/` rejects, extra fields stripped, bucket with slash rejects
- [x] 7.4 Mock `fetch` globally in test files (do not call live DIAL Core); mock multer `Express.Multer.File` objects with `buffer` and `mimetype` properties

## 8. Backend Verification (Slice 1)

- [x] 8.1 Run `npm exec nx test chat-api` — all tests pass
- [x] 8.2 Run `npm exec nx lint chat-api` — no lint errors
- [x] 8.3 Run `npm exec nx build chat-api` — build succeeds

## 9. OpenAPI Generation & Client Update

- [x] 9.1 Run `npm run openapi` — regenerates `@epam/chat-api-client` from the running Chat API Swagger spec; verify `FilesApi` class appears with `uploadFile` and `downloadFile` / `downloadFileRaw` methods
- [x] 9.2 Run `npm run openapi:check` — no schema drift detected
- [x] 9.3 Run `npm exec nx build chat-api-client -- --skip-nx-cache` — client builds without type errors
- [x] 9.4 Run `npm exec nx lint chat-api-client` — no lint errors in generated client

## 10. Frontend API Client

- [x] 10.1 Add `filesApi` singleton to `apps/chat/src/server-api/api-client.ts`: `import { FilesApi } from '@epam/chat-api-client'` and `export const filesApi = new FilesApi(config)`
- [x] 10.2 Create `apps/chat/src/server-api/files.api.ts` with `uploadFile(bucket: string, path: string, file: File): Promise<FileUploadResponseDto>` — delegates to `filesApi.uploadFile({ uploadFileDto: { bucket, path }, file })`
- [x] 10.3 In `apps/chat/src/server-api/files.api.ts` implement `downloadFile(bucket: string, path: string): Promise<Response>` — uses `filesApi.downloadFileRaw({ bucket, path })`, calls `.raw` on the result to get the native `fetch` `Response`; add inline comment documenting the `downloadFileRaw()` generator gap (binary response type is `Blob | void` in generated types; raw method preserves the stream)

## 11. Frontend Verification

- [x] 11.1 Run `npm exec nx lint chat` — no lint errors in `apps/chat`
- [x] 11.2 Run `npm exec nx typecheck chat` (or equivalent tsc check) — no TypeScript errors in `apps/chat`

## 12. Full Stack Verification

- [x] 12.1 Re-run `npm exec nx test chat-api` — confirm no regressions after all changes
- [x] 12.2 Re-run `npm exec nx lint chat-api` — clean
- [x] 12.3 Re-run `npm exec nx build chat-api` — clean
- [x] 12.4 Re-run `npm run openapi` — stable (no additional drift)
- [x] 12.5 Re-run `npm run openapi:check` — passes
- [x] 12.6 Re-run `npm exec nx build chat-api-client -- --skip-nx-cache` — clean
- [x] 12.7 Re-run `npm exec nx lint chat-api-client` — clean
