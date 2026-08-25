# prompts-api Specification

## Purpose

The personal and organisation prompt endpoints, the prompt data model, and the generated client for both.

## Requirements

### Requirement: Prompt entity data model

A prompt SHALL be represented by `PromptResponseDto` with its bucket-relative identity and content fields plus ownership information applicable to the requestor:

```json
{
  "id": "Work/AI/summarize",
  "bucket": "owner-bucket",
  "name": "summarize",
  "description": "Summarize a document",
  "content": "Summarize the following text:",
  "folderId": "Work/AI",
  "author": "owner@example.com",
  "createdAt": 1700000000000,
  "updatedAt": 1700000001000,
  "isMy": false,
  "canEdit": true,
  "sharedWithMe": true,
  "permissions": ["READ", "WRITE"]
}
```

`id` remains relative to `bucket`; `folderId` is derived by dropping the last path segment. `isMy`, `canEdit`, and `sharedWithMe` are requestor-relative flags. `permissions` carries the upstream READ/WRITE/SHARE values when available. An organisation prompt SHALL always return `isMy: false`, `canEdit: false`, and `sharedWithMe: false`, even if upstream metadata unexpectedly includes `WRITE`.

#### Scenario: Writable shared prompt reports its owner and permissions

- **WHEN** another user shares `prompts/owner-bucket/Work/AI/summarize` with `READ` and `WRITE`
- **THEN** its response contains `bucket: 'owner-bucket'`, `isMy: false`, `canEdit: true`, `sharedWithMe: true`, and both permissions

#### Scenario: Organisation prompt is always read-only

- **WHEN** organisation prompt metadata contains `WRITE`
- **THEN** the BFF response still contains `canEdit: false`

---

### Requirement: GET /api/v1/prompts lists personal prompts

`GET /api/v1/prompts` SHALL be the aggregate catalog listing for an authenticated requestor. It returns `PromptListResponseDto` with personal, shared, and organisation namespaces in one response:

```json
{
  "prompts": [],
  "folders": [],
  "sharedWithMe": [],
  "publicPrompts": [],
  "publicFolders": []
}
```

The personal and organisation metadata listings SHALL request `permissions=true`. Personal prompt editability SHALL be derived from `WRITE` when permissions are returned. Shared prompt editability SHALL be derived from the permissions returned by `getSharedResources`. Organisation prompts SHALL be forced read-only.

The BFF SHALL collect personal/shared and organisation namespaces concurrently. If one namespace rejects, it SHALL log a warning and return the other with the failed namespace empty. If both reject, the endpoint SHALL propagate an upstream error. Rate limiting remains the global default.

#### Scenario: One browser request receives all namespaces

- **WHEN** an authenticated client calls `GET /api/v1/prompts`
- **THEN** no second public-list request is needed to populate the catalog

#### Scenario: Organisation listing fails independently

- **WHEN** personal/shared listing succeeds and organisation listing fails
- **THEN** the response is 200 with personal/shared values and empty `publicPrompts`/`publicFolders`

#### Scenario: Both upstream listings fail

- **WHEN** both personal/shared and organisation listings reject
- **THEN** the endpoint returns the mapped upstream failure rather than a successful empty catalog

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

`GET /api/v1/prompts/item` SHALL accept required `path` and optional `bucket` query parameters. With no `bucket`, it reads `prompts/{sessionBucket}/{path}`. With `bucket`, it reads `prompts/{bucket}/{path}` and relies on DIAL Core to authorize access, enabling a qualified shared prompt to be fetched without rewriting its owner namespace.

Error codes remain `400`, `401`, `404`, `502`, and `500` as defined by the base prompts API.

#### Scenario: Personal prompt uses the session bucket

- **WHEN** `GET /api/v1/prompts/item?path=Work/AI/summarize` is called
- **THEN** the service reads the path from the caller's session bucket

#### Scenario: Shared prompt uses its owner bucket

- **WHEN** `GET /api/v1/prompts/item?path=Work/AI/summarize&bucket=owner-bucket` is called
- **THEN** the service reads `prompts/owner-bucket/Work/AI/summarize`

#### Scenario: Non-existent prompt returns 404

- **WHEN** the resolved prompt does not exist
- **THEN** the response status is 404

---

### Requirement: PUT /api/v1/prompts?path= updates a personal prompt

`PUT /api/v1/prompts` SHALL accept required `path`, optional owner `bucket`, and `UpdatePromptDto`. With no `bucket`, it updates the caller's prompt. With `bucket`, it updates that owner namespace only when DIAL Core grants the requestor `WRITE`. Rename keeps the existing write-new/delete-old behavior and conflict/error semantics.

#### Scenario: Updating a personal prompt

- **WHEN** `PUT /api/v1/prompts?path=Work/greeting` is called without `bucket`
- **THEN** the caller's session bucket is used

#### Scenario: Updating a writable shared prompt

- **WHEN** `PUT /api/v1/prompts?path=Work/greeting&bucket=owner-bucket` is called by a requestor with `WRITE`
- **THEN** the prompt in `owner-bucket` is updated and the response is 200

#### Scenario: Shared write is not granted

- **WHEN** the same requestor has only `READ`
- **THEN** DIAL Core rejects the mutation and the BFF does not reinterpret the resource as personal

#### Scenario: Rename conflict returns 409

- **WHEN** a rename targets an existing prompt path
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

`npm run openapi && npm run openapi:check` SHALL generate the aggregate prompt response, ownership fields, and optional owner-bucket parameters. The normal generated methods remain `listPrompts`, `getPrompt`, `updatePrompt`, and `movePrompt`; frontend wrappers SHALL use those methods rather than direct `fetch` or hand-authored DTOs.

#### Scenario: Generated client matches the aggregate contract

- **WHEN** OpenAPI generation completes
- **THEN** `PromptListResponseDto` includes public arrays, `PromptResponseDto` includes ownership/permission fields, and the shared-resource operations accept optional `bucket`
