## ADDED Requirements

### Requirement: `promptsApi` is registered in the shared generated-client registry

`apps/chat/src/server-api/api-client.ts` SHALL import `PromptsApi` from `@epam/ai-dial-chat-api-client` and export a `promptsApi = new PromptsApi(config)` singleton built from the same `createApiConfiguration()` instance used by every other API. It therefore inherits the CSRF, unauthorized-retry, and telemetry middleware without any per-domain code.

No new `base.ts` get/post/put/del helper SHALL be added for prompts, and no component or hook SHALL call `fetch` for a prompt endpoint — there is no generated-client gap to work around.

#### Scenario: Prompt mutations carry the CSRF token

- **WHEN** any non-GET prompt request is dispatched through `promptsApi`
- **THEN** the shared `csrfMiddleware` sets the `X-CSRF-Token` header, and a rotated token in the response is stored

#### Scenario: A 401 on a prompt request triggers the shared unauthorized path

- **WHEN** a prompt request responds `401`
- **THEN** `notifyUnauthorized` fires and an `UnauthorizedError` is thrown, identically to every other domain

---

### Requirement: `prompts.api.ts` wraps every generated prompt operation

`apps/chat/src/server-api/prompts.api.ts` SHALL export one thin arrow-function wrapper per generated `PromptsApi` method, in the shape of `apps/chat/src/server-api/toolsets.ts`. Each wrapper uses the normal (non-`Raw`) generated method and adds no logic beyond argument shaping.

| Wrapper | Generated method | Request | Response |
| --- | --- | --- | --- |
| `listPrompts()` | `listPrompts` | — | `PromptListResponseDto` |
| `getPrompt(path, bucket?)` | `getPrompt` | `{ path, bucket }` | `PromptResponseDto` |
| `createPrompt(body)` | `createPrompt` | `{ createPromptDto }` | `PromptResponseDto` |
| `updatePrompt(path, body, bucket?)` | `updatePrompt` | `{ path, updatePromptDto, bucket }` | `PromptResponseDto` |
| `deletePrompt(path)` | `deletePrompt` | `{ path }` | `void` |
| `listPublicPrompts()` | `listPublicPrompts` | — | `PublicPromptListResponseDto` |
| `getPublicPrompt(path)` | `getPublicPrompt` | `{ path }` | `PromptResponseDto` |
| `createPromptFolder(body)` | `createPromptFolder` | `{ createPromptFolderDto }` | `PromptFolderResponseDto` |
| `renamePromptFolder(path, body)` | `renamePromptFolder` | `{ path, renamePromptFolderDto }` | `PromptFolderResponseDto` |
| `deletePromptFolder(path)` | `deletePromptFolder` | `{ path }` | `void` |
| `movePrompt(path, body, bucket?)` | `movePrompt` | `{ path, movePromptDto, bucket }` | `PromptResponseDto` |

All DTO types SHALL be imported as `import type { … } from '@epam/ai-dial-chat-api-client'`. No prompt DTO SHALL be re-declared in `apps/chat`.

Every wrapper used by the catalog or editor MUST have a production caller. `listPublicPrompts()` remains only as a backward-compatible wrapper over the still-supported organisation-only endpoint; `PromptsContext` MUST NOT call it because `listPrompts()` now carries every namespace.

#### Scenario: Listing every prompt namespace

- **WHEN** `listPrompts()` is called
- **THEN** it resolves `GET /api/v1/prompts`'s `PromptListResponseDto` with `prompts`, `folders`, `sharedWithMe`, `publicPrompts`, and `publicFolders` arrays

Example response:

```json
{
  "prompts": [
    {
      "id": "Work/AI/summarize",
      "name": "summarize",
      "description": "Summarize a document",
      "content": "Summarize the following text:",
      "folderId": "Work/AI",
      "createdAt": 1700000000000,
      "updatedAt": 1700000001000
    }
  ],
  "folders": [
    { "id": "Work", "name": "Work" },
    { "id": "Work/AI", "name": "AI" }
  ],
  "sharedWithMe": [],
  "publicPrompts": [],
  "publicFolders": []
}
```

#### Scenario: Loading a shared prompt keeps the owner bucket

- **WHEN** `getPrompt('Work/AI/summarize', 'owner-bucket')` is called
- **THEN** it dispatches `GET /api/v1/prompts/item?path=Work%2FAI%2Fsummarize&bucket=owner-bucket`

#### Scenario: Updating a writable shared prompt keeps the owner bucket

- **WHEN** `updatePrompt('Work/AI/summarize', body, 'owner-bucket')` is called
- **THEN** it dispatches `PUT /api/v1/prompts?path=Work%2FAI%2Fsummarize&bucket=owner-bucket`

#### Scenario: Creating a prompt in a subfolder

- **WHEN** `createPrompt({ name: 'summarize', description: 'Summarize a document', content: 'Summarize the following text:', folderId: 'Work/AI' })` is called
- **THEN** it dispatches `POST /api/v1/prompts` and resolves the created `PromptResponseDto` with `id: 'Work/AI/summarize'` and HTTP 201

#### Scenario: Updating only a prompt's content

- **WHEN** `updatePrompt('Work/AI/summarize', { content: 'Summarize in three bullets:' })` is called
- **THEN** it dispatches `PUT /api/v1/prompts?path=Work%2FAI%2Fsummarize` and resolves the updated DTO with `name` and `folderId` preserved

#### Scenario: Deleting a prompt resolves void

- **WHEN** `deletePrompt('Work/AI/summarize')` is called and the backend returns 204
- **THEN** the promise resolves with no value and does not throw

#### Scenario: Moving a prompt to root

- **WHEN** `movePrompt('Work/AI/summarize', { targetFolderId: '' })` is called
- **THEN** it dispatches `POST /api/v1/prompts/move?path=Work%2FAI%2Fsummarize` with body `{ "targetFolderId": "" }` and resolves the moved DTO with `id: 'summarize'` and `folderId: ''`

#### Scenario: Renaming a folder

- **WHEN** `renamePromptFolder('Work/AI', { name: 'Machine Learning' })` is called
- **THEN** it dispatches `PUT /api/v1/prompts/folders?path=Work%2FAI` and resolves `{ "id": "Work/Machine Learning", "name": "Machine Learning" }`

#### Scenario: Listing organisation prompts

- **WHEN** `listPublicPrompts()` is called
- **THEN** it resolves `PublicPromptListResponseDto` with `prompts` and `folders` and no `sharedWithMe` field

---

### Requirement: Prompt API errors surface through the shared error-detail path

Wrappers SHALL NOT swallow or remap rejections. Callers extract the trace id with the existing `getApiErrorDetails` helper from `apps/chat/src/server-api/api-error.ts` and surface a notification, exactly as `CatalogView`'s toolset and application handlers do today.

The status codes callers MUST handle for prompt operations are: `400` (validation — name contains `/`, content over 50 000 characters, malformed path), `401` (unauthorized), `404` (prompt or folder not found), `409` (duplicate path on create, conflict on rename/move), and `502` (DIAL Core error).

#### Scenario: Validation error keeps its status for the caller

- **WHEN** `createPrompt` is called with a name containing `/` and the backend responds `400`
- **THEN** the wrapper's promise rejects
- **AND** the caller's `getApiErrorDetails` yields the trace id used in the error notification

#### Scenario: Duplicate create surfaces as a conflict

- **WHEN** `createPrompt` targets a path that already exists and the backend responds `409`
- **THEN** the wrapper rejects and the calling form renders an inline "already exists" field error rather than a generic failure toast

#### Scenario: Wrapper adds no retry or fallback

- **WHEN** any prompt wrapper's underlying request rejects
- **THEN** the wrapper does not retry, does not resolve a default value, and does not log

---

### Requirement: Aggregate and owner-bucket contracts are generated from OpenAPI

The prompt DTO and endpoint changes SHALL be declared in NestJS Swagger and regenerated into `libs/chat-api-client/openapi.json` and `@epam/chat-api-client`. `PromptListResponseDto` SHALL expose the organisation arrays; `PromptResponseDto` SHALL expose ownership, editability, sharing, and permissions metadata; and the generated `getPrompt`, `updatePrompt`, and `movePrompt` request types SHALL accept the optional owner `bucket`.

#### Scenario: OpenAPI check stays green

- **WHEN** `npm run openapi:check` runs after this capability is implemented
- **THEN** it reports no drift, proving the generated client matches the changed endpoint contract

#### Scenario: Generated client exposes aggregate and owner-bucket fields

- **WHEN** the generated `PromptsApi` and models are inspected
- **THEN** the aggregate response fields and optional owner-bucket request fields are present without hand-written edits under `libs/chat-api-client/src/generated/`
