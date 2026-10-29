# project-conversations-api Specification

## Purpose

The BFF side of chats stored inside a project: the `projects/{bucket}/{path}/conversations/{name}` locator, `ProjectConversationStore` behind `ConversationPersistenceService`, the flag-gated owner-writable endpoints under `/api/v1/projects/:id/conversations`, completions through the regular generation pipeline, and the `x-project-id` header that is the only project context a model call carries.

## Requirements

### Requirement: A project conversation is a file in the project's conversations folder

A project conversation SHALL be stored as the file `conversations/{name}` inside the DIAL Core complex resource `projects/{bucket}/{projectPath}`, next to `PROJECT.md` and `context/`:

- **Body:** the same JSON body as a top-level conversation (`ConversationResponseDto`).
- **Name:** the same file-name convention as a top-level conversation, `{deploymentId}__{title}__{uuid}` (`CONVERSATION_NAME_SEPARATOR`, `getConversationName`, `prepareEntityName` in `apps/chat-api/src/conversations/utils/conversation.utils.ts`). A title can therefore be derived from the name with `getConversationTitleFromName`, as for the sidebar.
- **Folder:** `conversations/` is flat. A nested path under it is not a project conversation (the snapshot keeps it in `otherEntries`).
- **Ids:**
  - The **locator** `projects/{bucket}/{projectPath}/conversations/{name}` is the conversation's id. It is stored in the body's `id`, and the body's `folderId` is the project id.
  - The locator is sent to Core as `X-CONVERSATION-ID`, so analytics can tell project chats apart.
  - It is the persistence path every conversation service receives.
- **Parser:** `parseProjectConversationLocator(value)` in `apps/chat-api/src/projects/utils/project-conversation-id.util.ts` returns `{ project: ParsedProjectId, name, filePath: 'conversations/{name}' }`, or `null`.
  - The second-to-last segment must be `conversations`.
  - Everything before it must pass `parseProjectId`.
  - `name` must pass `isValidDialEntityName`.
  - So no empty, `.` or `..` segment, control character or backslash reaches Core.
- **Isolation:** a project conversation is never a `conversations/{bucket}/…` resource. The sidebar listing, conversation search, the title-cache key (`parseConversationResourceId`), bulk delete and conversation pins never see it.

#### Scenario: Locator round trip

- **WHEN** `parseProjectConversationLocator('projects/a1b2c3/marketing/q4/conversations/gpt-4o__Summary__1b2c')` is called
- **THEN** it returns the project `projects/a1b2c3/marketing/q4`, `name: 'gpt-4o__Summary__1b2c'` and `filePath: 'conversations/gpt-4o__Summary__1b2c'`

#### Scenario: Nested conversation path is rejected

- **WHEN** the locator is `projects/a1b2c3/q4/conversations/a/b`
- **THEN** the parser returns `null`, because `conversations/a` names a sub-folder, not a project path followed by `conversations`

#### Scenario: Traversal is rejected

- **WHEN** the locator is `projects/a1b2c3/q4/conversations/..`
- **THEN** the parser returns `null`

### Requirement: ConversationPersistenceService routes project locators to ProjectConversationStore

`ConversationPersistenceService` (`apps/chat-api/src/conversations/persistence/conversation-persistence.service.ts`) SHALL delegate every method to `ProjectConversationStore` (`apps/chat-api/src/conversations/persistence/project-conversation.store.ts`) when the conversation path is a project locator. The methods are `getConversation`, `getConversationWithStoredVersion`, `getStoredConversation`, `saveConversation`, `readConversationWithEtag`, `saveConversationIfMatch` and `updateConversation`. Its `bucket` argument is then ignored: the bucket comes from the locator, because shared and organization projects live in other buckets.

- Streaming, background generation, naming and `updateConversation` therefore work for project conversations unforked.
- `qualifySessionConversationPath` and `resolveConversationLocation` (`apps/chat-api/src/conversations/utils/conversation.utils.ts`) SHALL return a project locator unchanged instead of prefixing the session bucket.
- `ConversationModule` never imports `ProjectsModule`. The store uses only the global `DialClientService` and the pure utilities in `apps/chat-api/src/projects/utils/`, so there is no module cycle.

`ProjectConversationStore` SHALL call the SDK with `(project.bucket, encodeDialResourcePath(project.path), encodeDialResourcePath(filePath))`:

- **Read:** `downloadProjectFile`, parsed as JSON.
  - A Core `404` is "not found": `readConversationWithEtag` resolves `null`, and the get methods throw `NotFoundException`.
  - A body that is not a JSON object is `502`.
  - The display name is derived exactly as for a top-level conversation (`getConversationWithStoredVersion`).
- **Version token.** Core's `If-Match` on a project file checks the project's aggregate ETag, not the file's. So the token the store returns as a conversation's `etag` is a content hash of the file bytes, `"sha256:{hex}"`, never Core's ETag. A write to another file in the project does not change it.
- **Conditional save (`saveConversationIfMatch(…, etag)`).** Each attempt:
  1. reads the project's aggregate ETag from its metadata (`listProjectMetadata`). The file download's own `ETag` header is the file's, not the one Core's `If-Match` checks, so it is never used;
  2. re-reads the file and compares its content hash with `etag`. On a mismatch it resolves `{ isSaved: false }` without writing;
  3. calls `uploadProjectFile` with `If-Match: <aggregate ETag>`. Because the ETag was read before the file, any write after it fails the condition; a Core `412` means another file in the project changed in between, so the store tries again.

  At most `PROJECT_CONVERSATION_WRITE_ATTEMPTS` (5) attempts are made, then it resolves `{ isSaved: false }`. Callers re-read through `updateConversation` (`CONDITIONAL_WRITE_ATTEMPTS`), as today.
- **Unconditional save** (`saveConversation`, create): `uploadProjectFile` with `If-Match: *`.
- **Errors:**
  - A Core `413` on a write (the project's file-size or total-size limit) is `413` with `code: 'project-storage-full'`.
  - Core `403` is `403`.
  - Other failures go through `handleDialSdkError` with context `projects.conversations.*`.
- **Logging:** logs carry the outcome and byte counts, never a project name, conversation name or content.

#### Scenario: A write to another conversation does not conflict

- **WHEN** a background generation saves conversation A with its content hash, while a save of conversation B in the same project landed first, so Core answers the first `uploadProjectFile` with `412`
- **THEN** the store re-reads A, finds its hash unchanged, writes again with the fresh aggregate ETag, and resolves `{ isSaved: true }`

#### Scenario: A real conflict on the same conversation

- **WHEN** the re-read bytes of conversation A hash differently from the `etag` the caller holds
- **THEN** the store resolves `{ isSaved: false }` without calling `uploadProjectFile`

#### Scenario: Shared project conversation is read from its own bucket

- **WHEN** a user whose session bucket is `a1b2c3` reads `projects/z9y8x7/research/conversations/x`
- **THEN** `downloadProjectFile` is called with bucket `z9y8x7`

#### Scenario: Project storage full

- **WHEN** Core answers `uploadProjectFile` with `413`
- **THEN** the request fails with `413` and `code: 'project-storage-full'`

### Requirement: Project conversation endpoints are flag-gated and owner-writable

`ProjectConversationsController` (`apps/chat-api/src/projects/conversations/project-conversations.controller.ts`) SHALL be registered by `ProjectsModule`, which imports `ConversationModule` (and `ConversationModule` exports `ConversationService` for it):

- **Gating.** The controller is `@Controller({ path: 'projects', version: '1' })` with `@UseGuards(FeatureGuard)` and `@RequireFeature(FeatureKey.ProjectsEnabled)` (`PROJECTS_ENABLED`). With the flag off, every route is `403`.
- **Path params.**
  - `:id` is validated by `ProjectIdParamDto`.
  - `:conversationName` is validated by `ProjectConversationParamDto` (`apps/chat-api/src/projects/conversations/dto/project-conversation-param.dto.ts`), which uses `IsDialEntityName` and a 255-byte UTF-8 cap.
  - The BFF builds the locator from both.
- **Completion bodies.** The `path` in completion, stop and attach bodies SHALL equal the locator without its leading `projects/`, i.e. `{bucket}/{projectPath}/conversations/{name}`, which is the path the app's stream hook derives from the conversation id. The BFF re-prefixes it and requires the result to parse as a locator under `:id`, otherwise `400`. The path is also the generation-registry key, so stop and attach find the generation.
- **Writes.** Create, save, rename, delete and completions SHALL be refused with `403` before any Core call when the project's bucket is not the session bucket, matching `canEdit` in `GET /api/v1/projects/:id`.
- **Reads.** List and get go to Core with the caller's token, so a shared or organization project's conversations can be read.
- **OpenAPI.** Every route documents every status with `@ApiResponse`, and success responses name a DTO class.

#### Scenario: Flag off

- **WHEN** `projectsEnabled` is false and `GET /api/v1/projects/{id}/conversations` is called
- **THEN** the response is `403`

#### Scenario: Writing to a shared project

- **WHEN** a user whose bucket is `a1b2c3` calls `POST /api/v1/projects/projects%2Fz9y8x7%2Fresearch/conversations`
- **THEN** the response is `403`, and no Core call is made

#### Scenario: Path outside the addressed project

- **WHEN** `POST /api/v1/projects/projects%2Fa1b2c3%2Fq4/conversations/completions` carries `path: 'a1b2c3/other/conversations/x'`
- **THEN** the response is `400`

#### Scenario: Traversal in the conversation name

- **WHEN** `GET /api/v1/projects/{id}/conversations/..%2Fcontext%2Ftickets.csv` is called
- **THEN** the response is `400`, and no Core call is made

### Requirement: GET /api/v1/projects/:id/conversations lists a project's conversations

`listProjectConversations` (`ProjectConversationsListService`, `apps/chat-api/src/projects/conversations/project-conversations-list.service.ts`) SHALL page through `listProjectFileMetadata(bucket, path, 'conversations/')` (non-recursive, following `nextToken`). It then:

1. keeps file items that are direct children of `conversations/`;
2. sorts them by `updatedAt`, newest first, then by name;
3. returns the first `limit` items (query, default 50, `1..100`), with `hasMore` when more exist.

**Titles.** Every returned item's `title` is the conversation's display name:

- An LLM- or user-renamed conversation keeps its file name, so the title is read from the body's `name`.
- The read is cached in the in-memory cache manager:
  - key: `projects:conversation-title:{locator}`;
  - value: `{ updatedAt, title }`;
  - TTL: 10 minutes.
- A cache entry is used only while its `updatedAt` equals the listing's.
- A miss, or a different `updatedAt`, reads the file through `ProjectConversationStore`, at most 4 reads at a time.
- Save, rename and delete through these endpoints evict the key, which is the invalidation event.
- A failed read falls back to `getConversationTitleFromName(name)`.

**Response.** `ProjectConversationListResponseDto { items: ProjectConversationItemDto[]; hasMore: boolean }`, where each `ProjectConversationItemDto` is `{ id: string (locator); name: string (file name); title: string; author?: string; updatedAt?: number }`. `author` is Core's file `author`, the writer's display name. The response carries `Cache-Control: private, no-store`.

Example request:

```http
GET /api/v1/projects/projects%2Fa1b2c3%2Fsupport-quality/conversations?limit=50 HTTP/1.1
Cookie: <session cookie>
```

Example `200` response:

```json
{
  "items": [
    {
      "id": "projects/a1b2c3/support-quality/conversations/gpt-4o__Weekly support health summary__7c1d",
      "name": "gpt-4o__Weekly support health summary__7c1d",
      "title": "Write a weekly support health summary for the VP of Customer Success.",
      "author": "Valery Tester",
      "updatedAt": 1793000000000
    }
  ],
  "hasMore": false
}
```

Status codes:

| Status | When |
| --- | --- |
| `200` | Listed. A project with no `conversations/` folder lists `items: []`. |
| `400` | Invalid `:id` or `limit`. |
| `401` | No valid session. |
| `403` | The flag is off, or Core denied read access. |
| `404` | No such project. |
| `429` / `502` / `503` | Upstream, through `handleDialSdkError`. |

**Generated-client impact:** operationId `listProjectConversations`, so `ProjectsApi.listProjectConversations({ id, limit })` returns `ProjectConversationListResponseDto`. Callers use the normal method.

#### Scenario: Newest first with titles

- **WHEN** the project holds two conversations updated at `t1 < t2`
- **THEN** the item updated at `t2` is first, and each `title` is the body's `name`

#### Scenario: Cached title is reused until the file changes

- **WHEN** the list is requested twice and no conversation changed in between
- **THEN** the second request makes no `downloadProjectFile` call

#### Scenario: Empty project

- **WHEN** Core answers the listing with `404` for `conversations/` on an existing project
- **THEN** the response is `200` with `items: []` and `hasMore: false`

### Requirement: Project conversations can be created, read, saved, renamed and deleted

`ProjectConversationsController` SHALL expose these routes. Every write goes through `ConversationPersistenceService` with the locator, except delete, which calls `ProjectConversationStore.delete`.

| Method and path | operationId | Request | Response |
| --- | --- | --- | --- |
| `POST /api/v1/projects/:id/conversations` | `createProjectConversation` | `CreateConversationDto` (as `POST /api/v1/conversations`) | `201` `ConversationResponseDto` |
| `GET /api/v1/projects/:id/conversations/:conversationName` | `getProjectConversation` | – | `200` `ConversationResponseDto` |
| `PUT /api/v1/projects/:id/conversations/:conversationName` | `saveProjectConversation` | `SaveConversationBodyDto` | `200` `ConversationResponseDto` |
| `PATCH /api/v1/projects/:id/conversations/:conversationName` | `renameProjectConversation` | `RenameConversationBodyDto` (`newTitle`) | `200` `RenameConversationResponseDto` |
| `DELETE /api/v1/projects/:id/conversations/:conversationName` | `deleteProjectConversation` | – | `204` |

- **Create** builds the name as `ConversationLifecycleService` does for a top-level conversation, in the project's `conversations/`. It writes with `If-Match: *`, because the trailing UUID makes a collision negligible, and returns the stored body.
- **Save** uses `updateConversationUnlessPending`, so a client save never overwrites a pending background message. This is the semantics of `PUT /api/v1/conversations`.
- **Rename** rewrites the body's `name` (with `llmNamingDone: true`) at the same file name, as a top-level rename does: Core cannot move a file inside a complex resource.
- **Delete** calls `deleteProjectFile` with `If-Match: *`. A missing file is `404`.

Example create request and response:

```http
POST /api/v1/projects/projects%2Fa1b2c3%2Fsupport-quality/conversations HTTP/1.1
Content-Type: application/json

{ "message": "Draft a help center article for the most common login issue.", "deploymentId": "gpt-4o" }
```

```json
{
  "id": "projects/a1b2c3/support-quality/conversations/gpt-4o__Draft a help center article__3f9a",
  "folderId": "projects/a1b2c3/support-quality",
  "name": "Draft a help center article",
  "model": { "id": "gpt-4o" },
  "messages": [{ "role": "user", "content": "Draft a help center article for the most common login issue." }]
}
```

Status codes:

| Status | When |
| --- | --- |
| `200` / `201` / `204` | Success. |
| `400` | Invalid `:id`, `:conversationName` or body. |
| `401` | No valid session. |
| `403` | The flag is off, the project is not in the caller's own bucket (writes), or Core denied access. |
| `404` | No such project or conversation. |
| `409` | Save or rename met a pending background message, or a persistent conflict. |
| `413` | `project-storage-full`. |
| `429` / `502` / `503` | Upstream. |

**Generated-client impact:** `ProjectsApi.createProjectConversation`, `getProjectConversation`, `saveProjectConversation`, `renameProjectConversation` and `deleteProjectConversation`, all normal methods.

#### Scenario: Create from the first message

- **WHEN** the owner creates a conversation in `projects/a1b2c3/support-quality`
- **THEN** `uploadProjectFile` is called for `conversations/{deployment}__{title}__{uuid}` with `If-Match: *`, and the response's `id` is that locator

#### Scenario: Rename keeps the file name

- **WHEN** the owner renames a project conversation to `Login article`
- **THEN** the stored body's `name` is `Login article`, and no file is created or deleted

#### Scenario: Delete a missing conversation

- **WHEN** Core answers `deleteProjectFile` with `404`
- **THEN** the response is `404`

### Requirement: Completions of a project conversation reuse the generation pipeline

`ProjectConversationsController` SHALL expose:

- `POST /api/v1/projects/:id/conversations/completions` (`streamProjectCompletion`, body `SendCompletionDto`, SSE);
- `POST /api/v1/projects/:id/conversations/completions/stop` (`stopProjectCompletion`, body `StopCompletionDto`);
- `POST /api/v1/projects/:id/conversations/completions/attach` (`attachToProjectGeneration`, body `AttachGenerationDto`, SSE).

Each handler checks access and the path, then calls the same `ConversationService` method as the `/api/v1/conversations/completions…` handler, with the locator as the path. The SSE framing, the `onReady` flush, client-disconnect handling, hidden-model checks, background generation, stop and attach therefore behave exactly as for a top-level conversation.

Watching (`POST /api/v1/conversations/watch`) is not offered for project conversations: Core resource subscriptions for a file inside a complex resource are not verified.

**Generated-client impact:** these three are streaming endpoints. The app calls them through `createChatStreamApi({ completionsBasePath })` (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts`), not through generated methods. They are still documented in OpenAPI, with `text/event-stream` success responses.

#### Scenario: Stop finds the project generation

- **WHEN** a completion is streaming with `path: 'a1b2c3/q4/conversations/x'`, and stop is called with the same path
- **THEN** the generation registered under that path is stopped

#### Scenario: Completion on a read-only project

- **WHEN** a user whose bucket is `a1b2c3` posts a completion for `projects/z9y8x7/research`
- **THEN** the response is `403`, and no Core call is made

### Requirement: Project completions carry only the project id

When the conversation path is a project locator, every Core call that runs the model SHALL carry `x-project-id: <encodeHeaderValue(projectId)>`, where the project id is parsed from the locator itself:

- `sendChatCompletionRequest`;
- `createResponse`;
- the background replay (`replayEvents`).

`buildProjectIdHeaders(projectId)` sits next to `buildConversationIdHeaders` in `apps/chat-api/src/common/utils/header-value.ts`, with `PROJECT_ID_HEADER = 'x-project-id'`; `buildProjectHeadersForPath(conversationPath)` in `apps/chat-api/src/conversations/utils/conversation.utils.ts` derives it from a conversation path. DIAL Core forwards request headers to the deployment on both Chat Completions and Responses, so the header reaches the deployment with no Core change, and the deployment resolves the project's instructions and context from it.

The BFF SHALL NOT add anything else to a project completion: no system message from `PROJECT.md`, no attachment for a context file, and no project file read before the model call. Apart from the header, a project completion's request body is the one a top-level conversation with the same messages and settings would send. Top-level conversations get no header, and their requests are byte-for-byte unchanged.

#### Scenario: Only the header is added

- **WHEN** a completion runs in `projects/a1b2c3/support-quality`, whose conversation prompt is `Answer in English.`
- **THEN** the Core request carries `x-project-id: projects/a1b2c3/support-quality`, its first message is the system message `Answer in English.`, and its user message has no attachment
- **AND** neither `downloadProjectFile` nor `listProjectFileMetadata` is called

#### Scenario: Top-level conversation is unchanged

- **WHEN** a completion runs for `conversations/a1b2c3/x`
- **THEN** no `x-project-id` header is sent

#### Scenario: Background replay carries the header

- **WHEN** a pending background generation of a project conversation is attached
- **THEN** the Core replay request carries `x-project-id` for that project
