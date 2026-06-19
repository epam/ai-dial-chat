## 1. Backend DTO

- [x] 1.1 Create `apps/chat-api/src/files/dto/get-file-metadata.dto.ts` — `GetFileMetadataQueryDto` with `bucket` (`@IsString`, `@IsNotEmpty`, `@Matches(/^[\w.-]+$/)`, `@MaxLength(256)`, `@ApiProperty`) and `path` (`@IsString`, `@IsNotEmpty`, `@IsValidFilePath()`, `@Matches` rejecting trailing `/`, `@MaxLength(1024)`, `@ApiProperty`)
- [x] 1.2 Create `apps/chat-api/src/files/dto/file-metadata-response.dto.ts` — `FileMetadataResponseDto` with all optional DIAL Core scalar file fields: `name`, `nodeType`, `bucket`, `parentPath`, `url`, `resourceType`, `etag`, `contentLength`, `contentType`, `createdAt`, `updatedAt`, `permissions` (`string[]`), `author`; annotate every field with `@ApiPropertyOptional`
- [x] 1.3 Verify: `npm exec nx lint chat-api` and `npm exec nx build chat-api` pass with no errors

## 2. Backend Service Method

- [x] 2.1 Add `getFileMetadata(bucket: string, path: string, token: string): Promise<FileMetadataResponseDto>` to `apps/chat-api/src/files/files.service.ts` — call `this.client.getFileMetadata(bucket, path, { headers: getBearerAuthHeaders(token), signal: AbortSignal.timeout(this.getTimeoutMs()) })` passing `path` exactly as received (no trailing `/` normalisation); map errors with `handleDialError`; log at `debug` on success, `warn` on upstream error, `error` on caught exception
- [x] 2.2 Verify: `npm exec nx lint chat-api` and `npm exec nx build chat-api` pass

## 3. Backend Controller Handler

- [x] 3.1 Add `@Get('metadata')` handler named `getFileMetadata` to `apps/chat-api/src/files/files.controller.ts`; decorate with `@Throttle({ default: { limit: 60, ttl: 60000 } })`, `@ApiOperation({ summary: 'Get file metadata', description: 'Returns metadata for a single named file from DIAL Core. Path must not end with /.' })`, `@ApiResponse({ status: 200, type: FileMetadataResponseDto })`, and `@ApiResponse` entries for 400, 401, 403, 404, 429, 502, 503; accept `@Query() query: GetFileMetadataQueryDto` and `@Req() req: Request`; extract `at` from `req.user` and delegate to `this.filesService.getFileMetadata(query.bucket, query.path, at)`
- [x] 3.2 Verify: `npm exec nx lint chat-api`, `npm exec nx build chat-api`, and `npm exec nx test chat-api` all pass

## 4. Backend Unit Tests — Service

- [x] 4.1 Create `apps/chat-api/src/files/tests/files.service.spec.ts` (or extend existing spec if present) with unit tests for `FilesService.getFileMetadata`:
  - returns `FileMetadataResponseDto` when SDK succeeds
  - passes `path` to SDK without appending `/` (path traversal test)
  - throws `NotFoundException` when SDK returns 404
  - throws `ForbiddenException` when SDK returns 403
  - throws `HttpException` (429) when SDK returns 429
  - throws `BadGatewayException` when SDK returns 5xx
  - throws `ServiceUnavailableException` on network failure / timeout
- [x] 4.2 Verify: `npm exec nx test chat-api` passes

## 5. Backend Integration Tests — Controller

- [x] 5.1 Create `apps/chat-api/src/files/tests/files.controller.spec.ts` (or extend) with supertest integration tests for `GET /api/v1/files/metadata`:
  - 200 with `FileMetadataResponseDto` for a valid request
  - 400 when `bucket` is missing or invalid
  - 400 when `path` is empty or absent
  - 400 when `path` ends with `/`
  - 400 when `path` contains `..` (path traversal)
  - 401 when no session is present
  - 403 when service throws `ForbiddenException`
  - 404 when service throws `NotFoundException`
  - 502 when service throws `BadGatewayException`
  - 503 when service throws `ServiceUnavailableException`
- [x] 5.2 Verify: `npm exec nx test chat-api` passes

## 6. Swagger / OpenAPI Regeneration

- [x] 6.1 Confirm the new handler appears in `GET /api/v1/files/metadata` in the running Swagger UI (or via `npm run openapi`) with `operationId: getFileMetadata` and a `200` response typed as `FileMetadataResponseDto`
- [x] 6.2 Run `npm run openapi` to regenerate `libs/chat-api-client/src/generated` — do not hand-edit any generated file
- [x] 6.3 Run `npm run openapi:check` to verify the generated output is consistent
- [x] 6.4 Run `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client` — both must pass
- [x] 6.5 Confirm `libs/chat-api-client/src/generated/src/apis/FilesApi.ts` (or equivalent) exposes `getFileMetadata` with typed request (`{ bucket, path }`) and response (`FileMetadataResponseDto`)

## 7. Frontend Server-API Wrapper

- [x] 7.1 Add `export const getFileMetadata = (params: { bucket: string; path: string }): Promise<FileMetadataResponseDto> => filesApi.getFileMetadata(params)` to `apps/chat/src/server-api/files.api.ts`; import `FileMetadataResponseDto` from `@epam/chat-api-client`
- [x] 7.2 Verify: `npm exec nx lint chat` and `npm exec nx build chat` pass (or typecheck via `npm exec nx affected --target=typecheck --base=origin/development-1.0`)

## 8. Frontend Server-API Tests

- [x] 8.1 Add unit tests for `getFileMetadata` in `apps/chat/src/server-api/` (co-located test or in an existing spec for `files.api.ts`):
  - delegates to `filesApi.getFileMetadata` with the correct params
  - returns the resolved `FileMetadataResponseDto`
- [x] 8.2 Verify: `npm exec nx test chat` passes

## 9. Final Affected Verification

- [x] 9.1 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — no new lint errors
- [x] 9.2 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all tests pass
- [x] 9.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` — builds succeed
