## Slice 1 — Backend DTO, Mapper, Unit Tests

### 1.1 Create `ListFilesQueryDto` and response DTOs

Create `apps/chat-api/src/files/dto/list-files.dto.ts` with three classes:

**`ListFilesQueryDto`** (query params):
- `bucket`: `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[\w.-]+$/)`, `@MaxLength(256)`, `@ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })`
- `path`: `@IsOptional()`, `@IsString()`, `@Matches(/^[\w.\-/]*$/)`, `@IsValidFilePath()`, `@MaxLength(1024)`, `@ApiPropertyOptional({ description: 'Folder path within bucket (no leading slash, no ..)', example: 'reports/' })`
- `token`: `@IsOptional()`, `@IsString()`, `@MaxLength(1024)`, `@ApiPropertyOptional({ description: 'Pagination token from previous response' })`
- `limit`: `@IsOptional()`, `@Transform(({ value }) => parseInt(value, 10))`, `@IsInt()`, `@Min(1)`, `@Max(1000)`, `@ApiPropertyOptional({ description: 'Max items to return', example: 100 })`
- `recursive`: `@IsOptional()`, `@Transform(({ value }) => value === 'true' || value === true)`, `@IsBoolean()`, `@ApiPropertyOptional({ description: 'Return items recursively', default: false })`
- `permissions`: `@IsOptional()`, `@Transform(({ value }) => value !== 'false' && value !== false)`, `@IsBoolean()`, `@ApiPropertyOptional({ description: 'Include item permissions', default: true })`

**`ListFilesItemDto`** (nested response item):
- `name`: `@ApiProperty()` `string`
- `path`: `@ApiProperty()` `string`
- `folderId`: `@ApiProperty()` `string`
- `nodeType`: `@ApiProperty({ enum: ['item', 'folder'] })` `string`
- `bucket`: `@ApiProperty()` `string`
- `parentPath`: `@ApiPropertyOptional()` `string | undefined`
- `url`: `@ApiPropertyOptional()` `string | undefined`
- `contentLength`: `@ApiPropertyOptional()` `number | undefined`
- `contentType`: `@ApiPropertyOptional()` `string | undefined`
- `updatedAt`: `@ApiPropertyOptional({ description: 'Unix timestamp ms' })` `number | undefined`
- `permissions`: `@ApiPropertyOptional({ type: [String] })` `string[] | undefined`
- `resourceType`: `@ApiPropertyOptional()` `string | undefined`
- `author`: `@ApiPropertyOptional()` `string | undefined`

**`ListFilesResponseDto`**:
- `bucket`: `@ApiProperty()` `string`
- `path`: `@ApiProperty()` `string`
- `items`: `@ApiProperty({ type: [ListFilesItemDto] })` `ListFilesItemDto[]`
- `nextToken`: `@ApiPropertyOptional()` `string | undefined`

### 1.2 Create mapper utility

Create `apps/chat-api/src/files/normalize-file-item.ts` with a pure function `normalizeFileItem(item, bucket): ListFilesItemDto` that implements the normalization rules from the design:
- Lowercase `nodeType` (`"ITEM"` → `"item"`, `"FOLDER"` → `"folder"`)
- For folders: ensure trailing `/` on `path`; set `folderId = "${bucket}:${normalizedPath}"`; omit `contentLength` / `contentType`
- For files: `folderId = "${bucket}:${item.parentPath ?? ""}"`
- Propagate `bucket` from the query parameter

### 1.3 Unit tests for DTO validation

Create `apps/chat-api/src/files/tests/list-files.dto.spec.ts`:
- Valid query: `bucket=my-bucket` passes; empty `path` passes; all optional fields absent passes
- `bucket` with slash rejected (`400`)
- `path` with `..` rejected (`400`)
- `path` with leading `/` rejected (`400`)
- `limit=0` rejected; `limit=1001` rejected; `limit=100` passes
- Extra fields stripped by `ValidationPipe`

### 1.4 Unit tests for mapper

Create `apps/chat-api/src/files/tests/normalize-file-item.spec.ts`:
- DIAL `nodeType: "FOLDER"` → `"folder"` (lowercase)
- DIAL `nodeType: "ITEM"` → `"item"` (lowercase)
- Folder item: path gets trailing `/`; `folderId` = `"${bucket}:${path}/"`; no `contentLength`; no `contentType`
- File item: `folderId` = `"${bucket}:${parentPath}"`
- `bucket` propagated from caller; `updatedAt` passed through as number

### 1.5 Verify slice 1

```sh
npm exec nx test chat-api
npm exec nx lint chat-api
```

---

## Slice 2 — Service SDK Call + Normalization Tests

### 2.1 Extend `FilesService` with `listFiles`

In `apps/chat-api/src/files/files.service.ts` add:

```ts
async listFiles(
  bucket: string,
  path: string | undefined,
  query: { token?: string; limit?: number; recursive?: boolean; permissions?: boolean },
  at: string,
): Promise<ListFilesResponseDto>
```

Implementation:
1. Normalize `path`: if non-empty and not ending with `/`, append `/`. If undefined, use `""`.
2. Call `this.client.getFileMetadata(bucket, normalizedPath, { headers: getBearerAuthHeaders(at), query: { token: query.token, limit: query.limit, recursive: query.recursive ?? false, permissions: query.permissions ?? true }, signal: AbortSignal.timeout(this.getTimeoutMs()) })`.
3. If `error != null`, call `handleDialError({ status: response.status })`.
4. Cast: `const dialData = data as typeof data & { nextToken?: string }`.
5. Map each item in `dialData.items ?? []` through `normalizeFileItem(item, bucket)`.
6. Return `{ bucket, path: normalizedPath, items: mappedItems, nextToken: dialData.nextToken }`.
7. Catch network/abort errors and call `handleDialError(err)`.
8. Log debug on success; log warn on DIAL error (no tokens, no full paths in log).

### 2.2 Integration tests for service

Create `apps/chat-api/src/files/tests/files.service.spec.ts` (or extend existing file) with `listFiles` test cases:
- Happy path: SDK returns items with `"FOLDER"` and `"ITEM"` nodeTypes; normalized items returned with lowercase `nodeType`
- SDK returns `nextToken`; response includes `nextToken`
- SDK returns no items for empty folder; response `items: []`, no `nextToken`
- DIAL returns `403` → `ForbiddenException`
- DIAL returns `404` → `NotFoundException`
- DIAL returns `429` → `TooManyRequestsException`
- DIAL returns `5xx` → `BadGatewayException`
- SDK throws `AbortError` (timeout) → `ServiceUnavailableException`
- `path=undefined` normalized to `""` before SDK call
- `path="reports"` (no trailing slash) normalized to `"reports/"` before SDK call

All tests mock `this.client.getFileMetadata`; never call live DIAL Core.

### 2.3 Verify slice 2

```sh
npm exec nx test chat-api
npm exec nx lint chat-api
```

---

## Slice 3 — Controller, Swagger, Supertest Integration Tests

### 3.1 Add `listFiles` handler to `FilesController`

In `apps/chat-api/src/files/files.controller.ts` add:

```ts
@Get('list')
@Throttle({ default: { limit: 60, ttl: 60000 } })
@ApiOperation({ summary: 'List files and folders', description: 'Returns a page of file and folder items from DIAL Core storage, normalized for FileManager compatibility.' })
@ApiResponse({ status: 200, type: ListFilesResponseDto, description: 'Paginated list of files and folders' })
@ApiResponse({ status: 400, description: 'Invalid bucket, path, or query parameter' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 403, description: 'Forbidden — user does not own the bucket' })
@ApiResponse({ status: 404, description: 'Bucket or path not found' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async listFiles(
  @Query() query: ListFilesQueryDto,
  @Req() req: Request,
): Promise<ListFilesResponseDto> {
  const { at } = req.user as SessionUser;
  return this.filesService.listFiles(query.bucket, query.path, {
    token: query.token,
    limit: query.limit,
    recursive: query.recursive,
    permissions: query.permissions,
  }, at);
}
```

Handler name MUST be `listFiles` (not `list`, `getFiles`, or any other variant) to produce the correct operationId.

### 3.2 Supertest integration tests

Create `apps/chat-api/src/files/tests/files.controller.spec.ts` (extend existing or create new test for `listFiles`) with:
- `GET /api/v1/files/list?bucket=my-bucket` → `200` with `ListFilesResponseDto` shape
- `GET /api/v1/files/list?bucket=my-bucket&path=folder/&limit=10` → `200`; `items` array present
- `GET /api/v1/files/list` (missing `bucket`) → `400`
- `GET /api/v1/files/list?bucket=my/bucket` → `400`
- `GET /api/v1/files/list?bucket=my-bucket&path=../../etc` → `400`
- `GET /api/v1/files/list?bucket=my-bucket&limit=0` → `400`
- `GET /api/v1/files/list?bucket=my-bucket&limit=1001` → `400`
- Service throws `ForbiddenException` → response `403`
- Service throws `NotFoundException` → response `404`
- Service throws `TooManyRequestsException` → response `429`
- Service throws `BadGatewayException` → response `502`
- Service throws `ServiceUnavailableException` → response `503`
- Unauthenticated (mock session guard absent) → `401`

Architecture guard: verify `files.controller.ts` does not import `@epam/ai-dial-ui-kit`, `@epam/chat-api-client`, `server-api`, or any app-level adapter.

### 3.3 Verify slice 3

```sh
npm exec nx test chat-api
npm exec nx lint chat-api
npm exec nx build chat-api
```

---

## Slice 4 — OpenAPI Generation and Client Update

### 4.1 Run OpenAPI generation

```sh
npm run openapi
npm run openapi:check
```

Verify in `libs/chat-api-client/src/generated/src/apis/FilesApi.ts`:
- Method `listFiles(requestParameters: ListFilesRequest): Promise<ListFilesResponseDto>` exists.
- No `any` in parameter or return types.
- `ListFilesItemDto` and `ListFilesResponseDto` appear in `libs/chat-api-client/src/generated/src/models/`.

If the generated method name is not `listFiles`, check that the handler method in `FilesController` is spelled exactly `listFiles` — the `operationIdFactory` uses the handler name.

### 4.2 Build and lint the generated client

```sh
npm exec nx build chat-api-client -- --skip-nx-cache
npm exec nx lint chat-api-client
```

### 4.3 Architecture guard for generated client

`libs/chat-api-client/` is the generated-client exception. Do not hand-edit any file under `libs/chat-api-client/src/generated/`; re-run `npm run openapi` if changes are needed.

---

## Slice 5 — Frontend Server-API Wrapper and Tests

### 5.1 Add `listFiles` to `files.api.ts`

In `apps/chat/src/server-api/files.api.ts` add:

```ts
import type { ListFilesResponseDto } from '@epam/chat-api-client';

export const listFiles = (params: {
  bucket: string;
  path?: string;
  token?: string;
  limit?: number;
  recursive?: boolean;
  permissions?: boolean;
}): Promise<ListFilesResponseDto> =>
  filesApi.listFiles(params);
```

The `filesApi` singleton is already exported from `apps/chat/src/server-api/api-client.ts`; no changes to `api-client.ts` are required unless it was not exported before.

No `base.ts` helpers — the generated client handles the request directly. Document any gap only if the generator emits a missing or incorrect method signature (not expected for a JSON endpoint).

Architecture guard: `files.api.ts` must not import `@epam/ai-dial-ui-kit`, raw `fetch`, env vars, session/cookie utilities, or routing helpers.

### 5.2 Unit tests for frontend wrapper

Create `apps/chat/src/server-api/tests/files.api.spec.ts`:
- `listFiles({ bucket: 'my-bucket' })` calls `filesApi.listFiles` with the correct params and resolves to `ListFilesResponseDto`
- `listFiles({ bucket: 'my-bucket', path: 'folder/', limit: 10 })` passes optional params through
- When `filesApi.listFiles` rejects (e.g. `401`), the rejection propagates to the caller

Mock `filesApi` in tests; never hit live BFF.

### 5.3 Verify slice 5

```sh
npm exec nx lint chat
npm exec nx typecheck chat
npm exec nx test chat
```

---

## Slice 6 — Final Full-Stack Verification

Run the complete affected set after all slices are done:

```sh
npm exec nx test  chat-api
npm exec nx lint  chat-api
npm exec nx build chat-api

npm run openapi
npm run openapi:check

npm exec nx build chat-api-client -- --skip-nx-cache
npm exec nx lint  chat-api-client

npm exec nx lint  chat
npm exec nx typecheck chat
npm exec nx test  chat

npm exec nx affected --target=lint   --base=origin/development-1.0
npm exec nx affected --target=test   --base=origin/development-1.0
npm exec nx affected --target=build  --base=origin/development-1.0
```

No slice is complete while any of these is red for a project it touches.
