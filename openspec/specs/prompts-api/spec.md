# prompts-api Specification

## Purpose

The personal and organisation prompt endpoints, the prompt data model, and the generated client for both.

## Requirements

### Requirement: Prompt entity data model

A **Prompt** SHALL be represented by the following shape in all API responses (`PromptResponseDto`):

```
{
  "id":          "<string — DIAL Core relative path, e.g. Work/AI/my-prompt>",
  "name":        "<string — display name>",
  "description": "<string | undefined — optional description>",
  "content":     "<string — prompt text; may contain {{variableName}} placeholders>",
  "folderId":    "<string — parent folder path; empty string means root>",
  "createdAt":   "<number — Unix ms timestamp>",
  "updatedAt":   "<number — Unix ms timestamp>"
}
```

`id` equals the user-relative path (everything after `prompts/{bucket}/` in the full DIAL
resource URL). The `folderId` is derived from `id` by dropping the last path segment.
`createdAt` and `updatedAt` come from DIAL Core resource metadata; they are not fields written
into the prompt payload.

#### Scenario: id encodes the folder hierarchy

- **WHEN** a prompt has DIAL resource URL `prompts/{bucket}/Work/AI/my-prompt`
- **THEN** the API response contains `id: "Work/AI/my-prompt"` and `folderId: "Work/AI"`

#### Scenario: Root-level prompt has empty folderId

- **WHEN** a prompt has DIAL resource URL `prompts/{bucket}/my-prompt`
- **THEN** the API response contains `id: "my-prompt"` and `folderId: ""`

---

### Requirement: GET /api/v1/prompts lists personal prompts

The backend SHALL expose `GET /api/v1/prompts` in `PromptController` (`version: '1'`, `@ApiTags('prompts')`). The endpoint requires an authenticated session (handled by the global `SessionGuard`). It returns HTTP 200 with `PromptListResponseDto`:

```
{
  "prompts": PromptResponseDto[],
  "folders": PromptFolderResponseDto[]
}
```

`PromptFolderResponseDto`:
```
{
  "id":   "<string — folder path, e.g. Work/AI>",
  "name": "<string — last segment of the path>"
}
```

The service recursively lists prompt metadata from the root of the session bucket, filters out
`.folder` sentinel resources, reads prompt payloads, and merges them with Core metadata into
`PromptResponseDto`. It derives `PromptFolderResponseDto` entries from distinct relative path
prefixes present in the result set.

Additionally, prompts shared with the current user SHALL be included in a separate `sharedWithMe` field:

```
{
  "prompts":     PromptResponseDto[],
  "folders":     PromptFolderResponseDto[],
  "sharedWithMe": PromptResponseDto[]
}
```

Rate limiting: inherits the global default (100 req/min).

Error codes:
- `401 Unauthorized` — missing or invalid session
- `502 Bad Gateway` — DIAL Core unreachable or returned an error
- `500 Internal Server Error` — unexpected failure

#### Scenario: Empty library returns empty arrays

- **WHEN** `GET /api/v1/prompts` is called by a user with no prompts
- **THEN** the response is 200 with `{ "prompts": [], "folders": [], "sharedWithMe": [] }`

#### Scenario: Flat listing returns all personal prompts with folder metadata

- **WHEN** a user has prompts stored at `root-prompt`, `Work/work-prompt`, and `Work/AI/ai-prompt`
- **THEN** `GET /api/v1/prompts` returns all three items in `prompts` and folders `["Work", "Work/AI"]` in `folders`

---

### Requirement: POST /api/v1/prompts creates a personal prompt

The backend SHALL expose `POST /api/v1/prompts`. The endpoint accepts `CreatePromptDto`:

```
{
  "name":         "<string @IsString @MinLength(1) @MaxLength(256) @Matches(/^[^/]+$/)>",
  "description":  "<string | undefined @IsString @MaxLength(2000) @IsOptional>",
  "content":      "<string @IsString @MaxLength(50000)>",
  "folderId":     "<string | undefined @IsString @Matches(/^[a-zA-Z0-9 _.\-/]*$/) @IsOptional>"
}
```

`name` MUST NOT contain a `/` (names with slashes would corrupt the path).

On success, the service:
1. Derives the storage path as `{folderId ? folderId + '/' : ''}{name}`.
2. Rejects with 409 if a prompt at that path already exists.
3. Creates the DIAL prompt resource `prompts/{sessionBucket}/{path}` via the SDK using a
   create-only precondition.
4. Reads the resulting Core metadata for `createdAt` and `updatedAt`.
5. Returns HTTP 201 with `PromptResponseDto`.

Rate limiting: `@Throttle({ default: { limit: 30, ttl: 60000 } })`.

Error codes:
- `400 Bad Request` — DTO validation fails
- `401 Unauthorized` — missing or invalid session
- `409 Conflict` — a prompt with the same name already exists at the given `folderId`
- `502 Bad Gateway` — DIAL Core write failed
- `500 Internal Server Error` — unexpected failure

#### Scenario: Creating a root-level prompt returns 201

- **WHEN** `POST /api/v1/prompts` is called with `{ "name": "greeting", "content": "You are a helpful assistant." }`
- **THEN** the response status is 201 and the body contains `id: "greeting"`, `folderId: ""`, `content: "You are a helpful assistant."`

#### Scenario: Creating a prompt in a subfolder returns 201

- **WHEN** `POST /api/v1/prompts` is called with `{ "name": "ai-prompt", "content": "...", "folderId": "Work/AI" }`
- **THEN** the response status is 201 and `id: "Work/AI/ai-prompt"`, `folderId: "Work/AI"`

#### Scenario: Duplicate prompt returns 409

- **WHEN** `POST /api/v1/prompts` is called with a name/folderId combination that already exists
- **THEN** the response status is 409

#### Scenario: Name containing slash returns 400

- **WHEN** `POST /api/v1/prompts` is called with `{ "name": "bad/name", "content": "..." }`
- **THEN** the response status is 400

#### Scenario: Content exceeding 50000 chars returns 400

- **WHEN** `POST /api/v1/prompts` is called with `content` of length 50001
- **THEN** the response status is 400

---

### Requirement: GET /api/v1/prompts/item?path= retrieves a specific personal prompt

The backend SHALL expose `GET /api/v1/prompts/item` with a required `path` query parameter (`RequiredPromptPathDto: { path: string @IsString @MinLength(1) @MaxLength(2048) @Matches(safe path allowlist) }`). The endpoint returns the single prompt at that path. The path allowlist rejects traversal segments (`.` and `..`), backslashes, absolute paths, and empty segments.

On success, the service reads DIAL resource `prompts/{sessionBucket}/{path}` and its metadata,
then returns HTTP 200 with `PromptResponseDto`.

Error codes:
- `400 Bad Request` — `path` fails DTO validation
- `401 Unauthorized` — missing or invalid session
- `404 Not Found` — no prompt exists at the given path
- `502 Bad Gateway` — DIAL Core read failed
- `500 Internal Server Error` — unexpected failure

#### Scenario: Existing prompt is returned

- **WHEN** `GET /api/v1/prompts/item?path=Work/AI/my-prompt` is called and that prompt exists
- **THEN** the response is 200 with the full `PromptResponseDto`

#### Scenario: Non-existent prompt returns 404

- **WHEN** `GET /api/v1/prompts/item?path=nonexistent` is called and no prompt exists there
- **THEN** the response status is 404

---

### Requirement: PUT /api/v1/prompts?path= updates a personal prompt

The backend SHALL expose `PUT /api/v1/prompts` with a required `path` query parameter. The body is `UpdatePromptDto`:

```
{
  "name":        "<string | undefined @IsString @MinLength(1) @MaxLength(256) @Matches(/^[^/]+$/) @IsOptional>",
  "description": "<string | undefined @IsString @MaxLength(2000) @IsOptional>",
  "content":     "<string | undefined @IsString @MaxLength(50000) @IsOptional>"
}
```

If `name` is provided and differs from the current path's last segment, the service writes to
the new path and then deletes the old path. Any failed step is returned as an upstream error;
the endpoint MUST NOT report success after a failed source deletion. The response uses
`createdAt` and `updatedAt` from DIAL Core metadata. Returns HTTP 200 with updated
`PromptResponseDto`.

Error codes:
- `400 Bad Request` — DTO validation fails
- `401 Unauthorized` — missing or invalid session
- `404 Not Found` — no prompt at the given path
- `409 Conflict` — rename target already exists
- `502 Bad Gateway` — DIAL Core operation failed
- `500 Internal Server Error` — unexpected failure

#### Scenario: Updating content only preserves name and folderId

- **WHEN** `PUT /api/v1/prompts?path=Work/greeting` is called with `{ "content": "New content" }`
- **THEN** the response is 200, `content` reflects the update, `id` and `folderId` are unchanged

#### Scenario: Renaming a prompt moves it to the new path

- **WHEN** `PUT /api/v1/prompts?path=old-name` is called with `{ "name": "new-name" }`
- **THEN** the response is 200, `id` is `"new-name"`, the old path is deleted from DIAL Core

#### Scenario: Rename conflict returns 409

- **WHEN** `PUT /api/v1/prompts?path=old-name` is called with `{ "name": "existing-name" }` and `existing-name` already exists
- **THEN** the response status is 409

---

### Requirement: DELETE /api/v1/prompts?path= deletes a personal prompt

The backend SHALL expose `DELETE /api/v1/prompts` with a required `path` query parameter. The
service deletes DIAL resource `prompts/{sessionBucket}/{path}` and returns HTTP 204 No Content.
If the resource does not exist, returns 404.

Error codes:
- `400 Bad Request` — `path` fails DTO validation
- `401 Unauthorized` — missing or invalid session
- `404 Not Found` — no prompt at the given path
- `502 Bad Gateway` — DIAL Core delete failed
- `500 Internal Server Error` — unexpected failure

#### Scenario: Existing prompt is deleted

- **WHEN** `DELETE /api/v1/prompts?path=Work/greeting` is called and that prompt exists
- **THEN** the response is 204 and the file is removed from DIAL Core

#### Scenario: Deleting non-existent prompt returns 404

- **WHEN** `DELETE /api/v1/prompts?path=nonexistent` is called
- **THEN** the response is 404

---

### Requirement: GET /api/v1/prompts/public lists organisation prompts

The backend SHALL expose `GET /api/v1/prompts/public`. The endpoint reads prompt resources
from the root of the `public` DIAL Core bucket (`prompts/public/{path}`) and returns
`PublicPromptListResponseDto` (without `sharedWithMe`). This endpoint is read-only; no
create/update/delete is exposed on the public namespace.

Rate limiting: inherits the global default.

Error codes:
- `401 Unauthorized` — missing or invalid session
- `502 Bad Gateway` — DIAL Core unreachable
- `500 Internal Server Error` — unexpected failure

#### Scenario: Organisation prompts are returned

- **WHEN** `GET /api/v1/prompts/public` is called by any authenticated user
- **THEN** the response is 200 with prompts from the `prompts/public/` resource namespace

#### Scenario: Empty organisation bucket returns empty lists

- **WHEN** no prompts exist in the public bucket
- **THEN** the response is 200 with `{ "prompts": [], "folders": [] }`

---

### Requirement: GET /api/v1/prompts/public/item retrieves an organisation prompt

The backend SHALL expose `GET /api/v1/prompts/public/item?path=<path>` as a distinct
OpenAPI operation returning `PromptResponseDto`. The required path uses the same safe
allowlist as personal prompt paths. It reads DIAL resource `prompts/public/{path}`.

#### Scenario: Existing organisation prompt is returned

- **WHEN** `GET /api/v1/prompts/public/item?path=Work/org-prompt` is called
- **THEN** the response is 200 with the matching `PromptResponseDto`

---

### Requirement: OpenAPI and generated client

After implementation the developer SHALL run `npm run openapi && npm run openapi:check`. The generated `@epam/chat-api-client` MUST expose the following SDK methods (operationId → method name mapping):

| HTTP | Path | operationId | Generated SDK method |
|------|------|-------------|----------------------|
| GET | /api/v1/prompts | `listPrompts` | `listPrompts` |
| POST | /api/v1/prompts | `createPrompt` | `createPrompt` |
| GET | /api/v1/prompts/item (+ path param) | `getPrompt` | `getPrompt` |
| PUT | /api/v1/prompts (+ path param) | `updatePrompt` | `updatePrompt` |
| DELETE | /api/v1/prompts (+ path param) | `deletePrompt` | `deletePrompt` |
| GET | /api/v1/prompts/public | `listPublicPrompts` | `listPublicPrompts` |
| GET | /api/v1/prompts/public/item (+ path param) | `getPublicPrompt` | `getPublicPrompt` |

#### Scenario: Prompt operations are available in the generated client

- **WHEN** `npm run openapi && npm run openapi:check` completes from the implemented Swagger document
- **THEN** `@epam/chat-api-client` exposes all seven SDK methods in the table above without schema drift

Feature flag gating: none — the prompts API is always enabled once deployed.
RTL / direction impact: none (backend only).
Observability: log `WARN` on any DIAL Core error with the resolved bucket and path for traceability. No new metrics or analytics events required at this stage.
