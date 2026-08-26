## MODIFIED Requirements

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

### Requirement: OpenAPI and generated client

`npm run openapi && npm run openapi:check` SHALL generate the aggregate prompt response, ownership fields, and optional owner-bucket parameters. The normal generated methods remain `listPrompts`, `getPrompt`, `updatePrompt`, and `movePrompt`; frontend wrappers SHALL use those methods rather than direct `fetch` or hand-authored DTOs.

#### Scenario: Generated client matches the aggregate contract

- **WHEN** OpenAPI generation completes
- **THEN** `PromptListResponseDto` includes public arrays, `PromptResponseDto` includes ownership/permission fields, and the shared-resource operations accept optional `bucket`
