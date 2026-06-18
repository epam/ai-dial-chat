## Context

This design adds a single read-only `listFiles` handler to the existing `files` domain in `apps/chat-api`. All NestJS conventions (URI versioning, thin controllers, validated DTOs with allowlist `@Matches`, typed HTTP exceptions, Logger + ConfigService, `@epam/ai-dial-typescript-sdk` preferred) are governed by `apps/chat-api/AGENTS.md` and are not repeated here. This document covers only the decisions specific to the file-list endpoint.

---

## Endpoint Contract

```
GET /api/v1/files/list
```

**Query parameters:**

| Parameter     | Type    | Required | Default | Constraints |
|---------------|---------|----------|---------|-------------|
| `bucket`      | string  | yes      | —       | `@Matches(/^[\w.-]+$/)`, `@MaxLength(256)` |
| `path`        | string  | no       | `""`    | `@IsOptional()`, `@Matches(/^[\w.\-/]*$/)`, custom validator: no leading `/`, no `..`, `@MaxLength(1024)` |
| `token`       | string  | no       | —       | `@IsOptional()`, `@IsString()`, `@MaxLength(1024)` |
| `limit`       | number  | no       | —       | `@IsOptional()`, `@Transform(parseInt)`, `@IsInt()`, `@Min(1)`, `@Max(1000)` |
| `recursive`   | boolean | no       | `false` | `@IsOptional()`, `@Transform(parseBool)`, `@IsBoolean()` |
| `permissions` | boolean | no       | `true`  | `@IsOptional()`, `@Transform(parseBool)`, `@IsBoolean()` |

`path` allows empty string (root listing). The `@Matches` regex uses `*` (not `+`) to permit the empty case. The custom `@IsValidFilePath` validator (already used in `FileParamsDto`) rejects values starting with `/` or containing `..`.

**Success response (200):** `ListFilesResponseDto`

```json
{
  "bucket": "user-bucket",
  "path": "folder/",
  "items": [
    {
      "name": "subfolder",
      "path": "folder/subfolder/",
      "folderId": "user-bucket:folder/subfolder/",
      "nodeType": "folder",
      "bucket": "user-bucket",
      "parentPath": "folder/",
      "url": "files/user-bucket/folder/subfolder/",
      "updatedAt": 1710000000000
    },
    {
      "name": "report.pdf",
      "path": "folder/report.pdf",
      "folderId": "user-bucket:folder/",
      "nodeType": "item",
      "bucket": "user-bucket",
      "parentPath": "folder/",
      "url": "files/user-bucket/folder/report.pdf",
      "contentLength": 12345,
      "contentType": "application/pdf",
      "updatedAt": 1710000000000,
      "permissions": ["READ", "WRITE"]
    }
  ],
  "nextToken": "opaque-pagination-cursor"
}
```

**Error codes:** `400`, `401`, `403`, `404`, `429`, `502`, `503`, `500`.

---

## DTO Mapping — DIAL Metadata → FileManager-Compatible Nodes

The DIAL SDK `getFileMetadata` 200 response for a folder path returns an object with an `items` array and an undocumented `nextToken` field at the top level. The SDK TypeScript interface omits `nextToken` from its types (it is mentioned only in JSDoc), so the service casts to access it:

```ts
const dialData = data as typeof data & { nextToken?: string };
```

### Decision 1 — SDK for listing (not raw fetch)

`getFileMetadata` is a standard JSON metadata endpoint — no streaming or multipart proxying is required. The SDK is the correct choice per AGENTS.md §4. Raw fetch was used for upload/download (Decision 1 in the archived design) specifically because those endpoints require stream proxying, which is not a concern here.

### `ListFilesItemDto` field normalization

| DTO field       | DIAL source            | Rule |
|-----------------|------------------------|------|
| `name`          | `item.name`            | Pass-through; default `""` if absent |
| `path`          | `item.url`             | Folders: ensure trailing `/`; files: use as-is. If `url` is absent, reconstruct from `parentPath + "/" + name` |
| `folderId`      | Computed               | Folders: `${bucket}:${path}` (where `path` has trailing `/`); files: `${bucket}:${item.parentPath ?? ""}` |
| `nodeType`      | `item.nodeType`        | Lowercase: `"ITEM"` → `"item"`, `"FOLDER"` → `"folder"` |
| `bucket`        | Query param            | Propagated from the request; DIAL items may omit it |
| `parentPath`    | `item.parentPath`      | Pass-through; optional |
| `url`           | `item.url`             | Pass-through; optional |
| `contentLength` | `item.contentLength`   | Omit for folders (leave undefined) |
| `contentType`   | `item.contentType`     | Omit for folders (leave undefined) |
| `updatedAt`     | `item.updatedAt`       | Pass-through as number (DIAL uses Unix ms). **Type note:** `DialModifiedEntity.updatedAt` is typed as `string` in `@epam/ai-dial-ui-kit`, but DIAL returns a number. The JSON wire format is compatible; callers consuming the TypeScript type may need to cast. |
| `permissions`   | `item.permissions`     | Pass-through `string[]`; omit if absent |
| `resourceType`  | `item.resourceType`    | Pass-through; optional |
| `author`        | `item.author`          | Pass-through; optional |

---

## Virtual Folder Strategy for S3 / No-Folder Buckets

DIAL Core object storage may have no physical folder entities. Folder paths are virtual prefixes: a folder `a/b/` exists only as a prefix shared by object keys `a/b/c.txt` and `a/b/d.pdf`. The list API MUST work when storage has only object keys containing `/`, without physical folder entities.

**Rule:**
- Any item returned by DIAL with `nodeType` resolving to `"folder"` (case-insensitive) is treated as a virtual folder entry and normalized as above.
- The service does not make additional requests to verify whether a folder path exists as a physical object.
- `path` for virtual folders is normalized to always end with `/` — DIAL may or may not include it.
- `folderId` for a virtual folder is `${bucket}:${normalizedPath}` — stable across requests as long as bucket and path are consistent.

The endpoint also supports listing the root folder: when `path` is `""` or omitted, DIAL returns the bucket root. The service passes `path ?? ""` to the SDK.

---

## SDK Usage Plan

```ts
const { data, error, response } = await this.client.getFileMetadata(
  bucket,
  path ?? '',
  {
    headers: getBearerAuthHeaders(token),
    query: {
      token: paginationToken ?? undefined,
      limit: limit ?? undefined,
      recursive: recursive ?? false,
      permissions: permissions ?? true,
    },
    signal: AbortSignal.timeout(this.getTimeoutMs()),
  },
);
```

- `bucket` and `path` come from the validated `ListFilesQueryDto`.
- Folder paths passed to DIAL must end with `/` when non-empty; the service normalizes `path` before passing to the SDK: if non-empty and not ending with `/`, append `/`.
- `paginationToken` is the `token` query param (renamed to avoid shadowing the session `at` variable).
- `getTimeoutMs()` reuses the existing `FILE_TRANSFER_TIMEOUT_MS` env var (already in `EnvironmentVariables`).
- `nextToken` is read via the cast: `(data as any).nextToken`.

---

## Auth / Token Forwarding

Session pattern is unchanged: `req.user` is populated by the existing session guard. `req.user.at` (access token) is forwarded to DIAL Core as `Authorization: Bearer {at}` via `getBearerAuthHeaders(at)` — identical to `uploadFile` and `downloadFile`. No new middleware or guards are required.

**Authorization:** Any authenticated user may call this endpoint. DIAL Core enforces bucket-level ownership and returns `403 Forbidden` if the user does not own the requested bucket.

---

## Error Mapping

Reuse `handleDialError` from `apps/chat-api/src/common/utils/dial-error.ts`. The mapping is identical to the existing file-transfer error table:

| DIAL Core status      | NestJS exception                |
|-----------------------|---------------------------------|
| `400`                 | `BadRequestException`           |
| `401`                 | `UnauthorizedException`         |
| `403`                 | `ForbiddenException`            |
| `404`                 | `NotFoundException`             |
| `429`                 | `TooManyRequestsException`      |
| `5xx`                 | `BadGatewayException`           |
| Network timeout       | `ServiceUnavailableException`   |
| Unexpected            | `InternalServerErrorException` (log first) |

---

## Rate Limiting

```ts
@Throttle({ default: { limit: 60, ttl: 60000 } })
```

60 req/min — same limit as the download endpoint. File listing is a read-only metadata call and produces less server load than upload (20/min). The global throttler default of 100/min is left untouched for other handlers.

---

## Cache Decision

No cache. File listings change on user upload and delete actions. A cached listing would show phantom files or hide new uploads with no reliable invalidation event available at the BFF layer. No TTL can be safely justified without a push notification from DIAL Core.

---

## Generated Client Impact

The handler method is named `listFiles` so the OpenAPI `operationIdFactory` emits `filesApi.listFiles(...)`. No generator gap is expected: the endpoint returns `application/json` with a fully typed `ListFilesResponseDto`, so the generated method has a strong return type without the `downloadFileRaw()` workaround needed for binary responses.

After running `npm run openapi`, inspect `libs/chat-api-client/src/generated/src/apis/FilesApi.ts` to confirm:
- `listFiles(requestParameters: ListFilesRequest): Promise<ListFilesResponseDto>` exists.
- No `any` in parameter or return types.
- `ListFilesItemDto` and `ListFilesResponseDto` appear in the generated models.

---

## Library Isolation

No hand-authored lib under `libs/*` is modified. FileManager compatibility is achieved through JSON DTO field alignment — the backend never imports `@epam/ai-dial-ui-kit`. The only lib touched is `libs/chat-api-client/` (the generated OpenAPI client exception): it receives a new `listFiles` method after OpenAPI regeneration.

Future: if a FileManager context or hook in `apps/chat` consumes the list response, it receives the DTO as a plain object. The lib component accepts `DialFile[]` props; the app-level adapter maps `ListFilesItemDto` → `DialFile` at the context/hook boundary, not inside the lib.
