# project-conversations-api Specification

## Purpose

The BFF side of chats stored inside a project: the `projects/{bucket}/{path}/conversations/{name}` locator, `ProjectConversationStore` behind `ConversationPersistenceService`, the flag-gated endpoints under `/api/v1/projects/:id/conversations`, writable by the owner and by recipients with `WRITE`, completions through the regular generation pipeline, and the `x-project-id` header that is the only project context a model call carries.

## Requirements

### Requirement: A project conversation is a file in the project's conversations folder

A project conversation SHALL be stored as the file `conversations/{name}` inside the DIAL Core complex resource `projects/{bucket}/{projectPath}`, next to `PROJECT.md` and `context/`:

- **Body:** the same JSON body as a top-level conversation (`ConversationResponseDto`).
- **Name:** the file-name convention of a top-level conversation, `{deploymentKey}__{title}__{uuid}` (`CONVERSATION_NAME_SEPARATOR`, `getConversationName`, `prepareEntityName` in `apps/chat-api/src/conversations/utils/conversation.utils.ts`), where `deploymentKey` is `toProjectConversationDeploymentKey(deploymentId)` (`apps/chat-api/src/projects/utils/project-conversation-id.util.ts`): `/`, `\` and `%` become `_` and runs of `_` collapse. A custom application's id is a versioned path (`applications/{bucket}/{name}__{version}`), and the file must stay one segment directly in `conversations/` with no `__` inside the key; the body's `model.id` keeps the real deployment id. A title can therefore be derived from the name with `getConversationTitleFromName`, as for the sidebar.
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

### Requirement: Project conversation endpoints are flag-gated and writable by project editors

`ProjectConversationsController` (`apps/chat-api/src/projects/conversations/project-conversations.controller.ts`) SHALL be registered by `ProjectsModule`, which imports `ConversationModule` (and `ConversationModule` exports `ConversationService` for it):

- **Gating.** The controller is `@Controller({ path: 'projects', version: '1' })` with `@UseGuards(FeatureGuard)` and `@RequireFeature(FeatureKey.ProjectsEnabled)` (`PROJECTS_ENABLED`). With the flag off, every route is `403`.
- **Path params.**
  - `:id` is validated by `ProjectIdParamDto`.
  - `:conversationName` is validated by `ProjectConversationParamDto` (`apps/chat-api/src/projects/conversations/dto/project-conversation-param.dto.ts`), which uses `IsSafeDialPathSegment` and a `DIAL_PATH_SEGMENT_MAX_BYTES` (1024-byte) UTF-8 cap. The entity-name rule does not fit a stored file name: it wraps a title of up to 255 bytes in the deployment id, which may contain `:`, and a UUID, so a chat started with a long message has a longer name.
  - The BFF builds the locator from both.
- **Completion bodies.** The `path` in completion, stop and attach bodies SHALL equal the locator without its leading `projects/`, i.e. `{bucket}/{projectPath}/conversations/{name}`, which is the path the app's stream hook derives from the conversation id. The BFF re-prefixes it and requires the result to parse as a locator under `:id`, otherwise `400`. The path is also the generation-registry key, so stop and attach find the generation.
- **Writes.** Create, save, rename, delete, completions, stop and attach SHALL first await `ProjectAccessService.assertCanWrite(project, sessionBucket, accessToken)` (see the `project-detail-api` capability). That is the same rule as `canEdit` in `GET /api/v1/projects/:id`:
  - the owner passes with no Core call;
  - an organization project is `403` with no Core call;
  - a shared project passes only when the caller holds `WRITE`; without it the answer is `403` after the one `getSharedResources` lookup, before any conversation write or model call;
  - a failed lookup is the mapped upstream error, never `403`.

  `ProjectConversationsService` calls it first in each write, and the controller's `resolveWritableLocator` awaits it before resolving the body path. The lookup has its own deadline (see the `project-detail-api` capability), because these routes pass no signal and the completion check runs before the generation's preparation deadline starts.
- **Equal rights for editors.** Every caller who passes the check may write every conversation of the project, including one another caller started: Core grants `WRITE` to the whole project and records no per-conversation rule. A write stores the file in the project's bucket, with the caller's token. An editor MAY therefore also stop a generation another editor started, through the generation's stored marker (`foreground-generation-lock`). Attach stays scoped to the principal that started the generation.
- **Concurrent writers are serialized in storage.** A generation in a project conversation holds it through its `foregroundGeneration` marker or its pending background marker, written conditionally as `foreground-generation-lock` and `background-responses-generation` define. A second caller's completion is therefore refused with `409` on any instance while the first generation runs, and the first generation's terminal write applies only to its own message. Each conditional write uses `ProjectConversationStore.saveConversationIfMatch`, at a cost of 3 Core calls per attempt:
  - the project metadata for its aggregate `ETag`;
  - the file for its content hash;
  - the write with `If-Match` on the aggregate `ETag`.

  Because Core checks `If-Match` against the whole project, a write to another file of the project between the read and the write also causes a repeat, up to `PROJECT_CONVERSATION_WRITE_ATTEMPTS`.
- **Reads.** List and get go to Core with the caller's token, so a shared or organization project's conversations can be read. Marking a conversation viewed stays open to every reader (see the `project-conversation-read-state` capability).
- **Only entry point.** The regular conversation routes SHALL refuse a project conversation locator with `400`, so the gating and the access check above cannot be bypassed. `IsNotProjectConversationLocator` (`apps/chat-api/src/conversations/dto/not-project-conversation-locator.validator.ts`) sits on the `path` of `ConversationPathDto` (and so of every query DTO extending it), `SendCompletionDto`, `StopCompletionDto`, `AttachGenerationDto` and `WatchConversationBodyDto`. A project completion body carries the locator without `projects/`, so it passes.
- **OpenAPI.** Every route documents every status with `@ApiResponse`, and success responses name a DTO class.

#### Scenario: Flag off

- **WHEN** `projectsEnabled` is false and `GET /api/v1/projects/{id}/conversations` is called
- **THEN** the response is `403`

#### Scenario: Writing to a view-only shared project

- **WHEN** a user whose bucket is `a1b2c3` calls `POST /api/v1/projects/projects%2Fz9y8x7%2Fresearch/conversations`, and `getSharedResources` lists the project with `permissions: ['READ']`
- **THEN** the response is `403`, the only Core call is `getSharedResources`, and no `uploadProjectFile` call is made

#### Scenario: An editor creates a conversation in a shared project

- **WHEN** the same call is made, and `getSharedResources` lists the project with `permissions: ['READ', 'WRITE']`
- **THEN** the response is `201`, and `uploadProjectFile` is called with bucket `z9y8x7` and the caller's token

#### Scenario: Two editors send into one project conversation at the same time

- **GIVEN** the owner and an editor both open the same project conversation on a non-background model
- **WHEN** both post a completion at the same time
- **THEN** exactly one generation streams, the other request receives `409` before SSE headers, and after a reload the stored conversation holds the streaming caller's question and answer

#### Scenario: Writing to an organization project

- **WHEN** a user calls `POST /api/v1/projects/projects%2Fpublic%2Fhandbook/conversations`
- **THEN** the response is `403`, and no Core call is made

#### Scenario: Path outside the addressed project

- **WHEN** `POST /api/v1/projects/projects%2Fa1b2c3%2Fq4/conversations/completions` carries `path: 'a1b2c3/other/conversations/x'`
- **THEN** the response is `400`

#### Scenario: A regular route is given a project locator

- **WHEN** `POST /api/v1/conversations/completions` carries `path: 'projects/a1b2c3/q4/conversations/x'`
- **THEN** the response is `400`, and no Core call is made

#### Scenario: Traversal in the conversation name

- **WHEN** `GET /api/v1/projects/{id}/conversations/..%2Fcontext%2Ftickets.csv` is called
- **THEN** the response is `400`, and no Core call is made

### Requirement: GET /api/v1/projects/:id/conversations lists a project's conversations

`listProjectConversations` (`ProjectConversationsListService`, `apps/chat-api/src/projects/conversations/project-conversations-list.service.ts`) SHALL page through `listProjectFileMetadata(bucket, path, 'conversations/')` (non-recursive, following `nextToken` with `limit: 1000`). It then:

1. keeps file items that are direct children of `conversations/`;
2. sorts them by `updatedAt`, newest first, then by name;
3. returns all of them. DIAL Core cannot page the folder in this order, so the endpoint takes no `limit` or `offset` and has no `hasMore`; the client pages the list locally.

**Published projects.** Publishing copies the project's files and stamps each copy with the time of the copy, so for a project in the organization bucket (`ProjectSource.Organization`, read-only for every user) the file `updatedAt` no longer tells which chat was active last. The listing of such a project therefore:

- reads every body, not only the 20 newest, so no item carries `isTitlePending`;
- orders the items by the newest `timestamp` among the body's messages (`getLastMessageTime`, `apps/chat-api/src/projects/utils/project-conversation-activity.util.ts`), newest first, then by name;
- puts an item without a dated message, or whose body cannot be read, last, in name order.

The items' `updatedAt`, `isUnread` and the personal and shared listings are unchanged. The title cache entry also holds `lastMessageAt` and `hasActivity`; an entry cached without them is read once more for a published project.

**Titles.** Every returned item's `title` is the conversation's display name, resolved for the 20 newest items and for any item whose title is cached:

- An LLM- or user-renamed conversation keeps its file name, so the title is read from the body's `name`.
- The read is cached in the in-memory cache manager:
  - key: `projects:conversation-title:{locator}`;
  - value: `{ updatedAt, title }`;
  - TTL: 10 minutes.
- A cache entry is used only while its `updatedAt` equals the listing's.
- A miss, or a different `updatedAt`, reads the file through `ProjectConversationStore`, at most 4 reads at a time.
- Save, rename and delete through these endpoints evict the key, which is the invalidation event.
- A failed read falls back to `getConversationTitleFromName(name)`.
- Past the 20 newest, an item without a usable cache entry is not read: its `title` is `getConversationTitleFromName(name)`, `isUnread` is `false`, and it carries `isTitlePending: true`, which `POST /api/v1/projects/:id/conversations/titles` resolves.

**Response.** `ProjectConversationListResponseDto { items: ProjectConversationItemDto[] }`, where each `ProjectConversationItemDto` is `{ id: string (locator); name: string (file name); title: string; author?: string; updatedAt?: number; isUnread: boolean; isTitlePending?: true }`. `author` is Core's file `author`, the writer's display name. The response carries `Cache-Control: private, no-store`.

Example request:

```http
GET /api/v1/projects/projects%2Fa1b2c3%2Fsupport-quality/conversations HTTP/1.1
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
      "updatedAt": 1793000000000,
      "isUnread": false
    },
    {
      "id": "projects/a1b2c3/support-quality/conversations/gpt-4o__Billing reply template__91aa",
      "name": "gpt-4o__Billing reply template__91aa",
      "title": "Billing reply template",
      "updatedAt": 1792000000000,
      "isUnread": false,
      "isTitlePending": true
    }
  ]
}
```

Status codes:

| Status | When |
| --- | --- |
| `200` | Listed. A project with no `conversations/` folder lists `items: []`. |
| `400` | Invalid `:id`. |
| `401` | No valid session. |
| `403` | The flag is off, or Core denied read access. |
| `404` | No such project. |
| `429` / `502` / `503` | Upstream, through `handleDialSdkError`. |

**Generated-client impact:** operationId `listProjectConversations`, so `ProjectsApi.listProjectConversations({ id })` returns `ProjectConversationListResponseDto`. Callers use the normal method. The former `limit`/`offset` query and `hasMore` field are removed; the only caller is `apps/chat` through `libs/chat-hooks`, which changes in the same commit.

#### Scenario: Newest first with titles

- **WHEN** the project holds two conversations updated at `t1 < t2`
- **THEN** the item updated at `t2` is first, and each `title` is the body's `name`

#### Scenario: Cached title is reused until the file changes

- **WHEN** the list is requested twice and no conversation changed in between
- **THEN** the second request makes no `downloadProjectFile` call

#### Scenario: Every conversation is listed, past the 20 newest pending

- **WHEN** the project holds 22 conversations and none of their titles is cached
- **THEN** the response holds all 22, the bodies of the 20 newest are read, and the two oldest carry `isTitlePending: true` with their file-name titles

#### Scenario: A published project is ordered by its last message

- **WHEN** a project in the organization bucket holds files that all carry the time of the copy, and their bodies' newest message times differ
- **THEN** the response lists every conversation with its title read, newest last message first, regardless of the files' `updatedAt`

#### Scenario: A personal or shared project keeps the file order

- **WHEN** a personal project, or one shared by another user, is listed
- **THEN** the items stay in the order of the files' `updatedAt`, and only the 20 newest bodies are read

#### Scenario: Empty project

- **WHEN** Core answers the listing with `404` for `conversations/` on an existing project
- **THEN** the response is `200` with `items: []`

### Requirement: POST /api/v1/projects/:id/conversations/titles resolves pending titles

`getProjectConversationTitles` (`ProjectConversationsController`, served by `ProjectConversationsListService.resolveProjectConversations`) SHALL resolve the titles and read state of the named conversations, for the client's See more:

- **Request.** `POST /api/v1/projects/:id/conversations/titles` with `ProjectConversationTitlesBodyDto { names: string[] }` (`apps/chat-api/src/projects/conversations/dto/project-conversation-titles.dto.ts`): 1 to 100 file names under `conversations/`, each a safe DIAL path segment (no traversal, separator, `%` or control character) of at most 1024 UTF-8 bytes. Any reader of the project may call it.
- **Behaviour.** It lists the folder once, the same way as `GET`, for each file's `updatedAt` and `author`. It then resolves each listed name through the same title cache and body read, at most 4 reads at a time. A resolved title is cached, so a later `GET` lists it without `isTitlePending`. Duplicate names are resolved once; names the project does not hold are omitted.
- **Response.** `200` with `ProjectConversationTitlesResponseDto { items: ProjectConversationItemDto[] }`, in request order, without `isTitlePending`, and `Cache-Control: private, no-store`.

Example request:

```http
POST /api/v1/projects/projects%2Fa1b2c3%2Fsupport-quality/conversations/titles HTTP/1.1
Cookie: <session cookie>
Content-Type: application/json

{ "names": ["gpt-4o__Billing reply template__91aa"] }
```

Status codes:

| Status | When |
| --- | --- |
| `200` | Resolved; unknown names are omitted. |
| `400` | Invalid `:id`, an empty or over-long `names`, an unsafe name, or an unknown body field. |
| `401` | No valid session. |
| `403` | The flag is off, or Core denied read access. |
| `404` | No such project. |
| `429` / `502` / `503` | Upstream, through `handleDialSdkError`. |

**Generated-client impact:** operationId `getProjectConversationTitles`, so `ProjectsApi.getProjectConversationTitles({ id, projectConversationTitlesBodyDto: { names } })` returns `ProjectConversationTitlesResponseDto`.

#### Scenario: Pending titles are resolved in request order

- **WHEN** the titles of two listed conversations and one unknown name are requested
- **THEN** the response holds the two listed ones in request order with their body titles, and omits the unknown name

#### Scenario: An unsafe name is rejected

- **WHEN** `names` holds `..`
- **THEN** the response is `400`, and no Core call is made

### Requirement: Project conversations can be created, read, saved, renamed and deleted

`ProjectConversationsController` SHALL expose these routes. Every write goes through `ConversationPersistenceService` with the locator, except delete, which calls `ProjectConversationStore.delete`.

| Method and path | operationId | Request | Response |
| --- | --- | --- | --- |
| `POST /api/v1/projects/:id/conversations` | `createProjectConversation` | `CreateConversationDto` (as `POST /api/v1/conversations`) | `201` `ConversationResponseDto` |
| `GET /api/v1/projects/:id/conversations/:conversationName` | `getProjectConversation` | – | `200` `ConversationResponseDto` |
| `PUT /api/v1/projects/:id/conversations/:conversationName` | `saveProjectConversation` | `SaveConversationBodyDto` | `200` `ConversationResponseDto` |
| `PATCH /api/v1/projects/:id/conversations/:conversationName` | `renameProjectConversation` | `RenameConversationBodyDto` (`newTitle`) | `200` `RenameConversationResponseDto` |
| `POST /api/v1/projects/:id/conversations/:conversationName/generate-title` | `generateProjectConversationTitle` | none | `200` `GenerateTitleResponseDto` (`name`; not persisted) |
| `DELETE /api/v1/projects/:id/conversations/:conversationName` | `deleteProjectConversation` | – | `204` |

- **Create** builds the name as `ConversationLifecycleService` does for a top-level conversation, in the project's `conversations/`. It writes with `If-Match: *`, because the trailing UUID makes a collision negligible, and returns the stored body.
- **Save** uses `updateConversationUnlessPending`, so a client save never overwrites a pending background message. This is the semantics of `PUT /api/v1/conversations`.
- **Generate title** awaits `assertCanWrite`, then suggests a title with the same utility model and naming prompt as `POST /api/v1/conversations/generate-title`, which itself rejects project locators. It saves nothing.
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
| `403` | The flag is off, the caller may not write to the project (writes; `canEdit: false`), or Core denied access. |
| `404` | No such project or conversation. |
| `409` | Save or rename met a pending background message, or a persistent conflict. |
| `413` | `project-storage-full`. |
| `429` / `502` / `503` | Upstream, including a failed permission lookup on a write. |

**Generated-client impact:** `ProjectsApi.createProjectConversation`, `getProjectConversation`, `saveProjectConversation`, `renameProjectConversation`, `generateProjectConversationTitle` and `deleteProjectConversation`, all normal methods. None changes shape.

#### Scenario: Create from the first message

- **WHEN** the owner creates a conversation in `projects/a1b2c3/support-quality`
- **THEN** `uploadProjectFile` is called for `conversations/{deployment}__{title}__{uuid}` with `If-Match: *`, and the response's `id` is that locator

#### Scenario: Rename keeps the file name

- **WHEN** the owner renames a project conversation to `Login article`
- **THEN** the stored body's `name` is `Login article`, and no file is created or deleted

#### Scenario: An editor deletes a chat the owner started

- **WHEN** a recipient with `WRITE` deletes `projects/z9y8x7/research/conversations/x`, which the owner created
- **THEN** `deleteProjectFile` is called with bucket `z9y8x7`, and the response is `204`

#### Scenario: Delete a missing conversation

- **WHEN** Core answers `deleteProjectFile` with `404`
- **THEN** the response is `404`

### Requirement: Completions of a project conversation reuse the generation pipeline

`ProjectConversationsController` SHALL expose:

- `POST /api/v1/projects/:id/conversations/completions` (`streamProjectCompletion`, body `SendCompletionDto`, SSE);
- `POST /api/v1/projects/:id/conversations/completions/stop` (`stopProjectCompletion`, body `StopCompletionDto`);
- `POST /api/v1/projects/:id/conversations/completions/attach` (`attachToProjectGeneration`, body `AttachGenerationDto`, SSE).

Each handler first awaits the write-access check, then checks the path, then calls the same `ConversationService` method as the `/api/v1/conversations/completions…` handler, with the locator as the path. The SSE framing, the `onReady` flush, client-disconnect handling, hidden-model checks, background generation, stop and attach therefore behave exactly as for a top-level conversation. A refused check answers before the SSE stream opens.

Watching (`POST /api/v1/conversations/watch`) is not offered for project conversations: Core resource subscriptions for a file inside a complex resource are not verified.

**Generated-client impact:** these three are streaming endpoints. The app calls them through `createChatStreamApi({ completionsBasePath })` (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts`), not through generated methods. They are still documented in OpenAPI, with `text/event-stream` success responses.

#### Scenario: Stop finds the project generation

- **WHEN** a completion is streaming with `path: 'a1b2c3/q4/conversations/x'`, and stop is called with the same path
- **THEN** the generation registered under that path is stopped

#### Scenario: Completion on a view-only project

- **WHEN** a user whose bucket is `a1b2c3` posts a completion for `projects/z9y8x7/research`, and `getSharedResources` lists the project with `permissions: ['READ']`
- **THEN** the response is `403`, no model is called, and no Core write is made

#### Scenario: An editor's completion streams

- **WHEN** the listed permissions are `['READ', 'WRITE']`
- **THEN** the completion streams as for the owner, and the answer is saved into `projects/z9y8x7/research/conversations/{name}`

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

### Requirement: Project conversation list items carry isUnread

`ProjectConversationItemDto` (`apps/chat-api/src/projects/conversations/dto/project-conversation-list-response.dto.ts`) SHALL gain a required `isUnread: boolean` (`@ApiProperty`, `@IsBoolean`). It is computed for the caller by the rule of the `project-conversation-read-state` capability, and is present on every item.

`ProjectConversationsListService` (`apps/chat-api/src/projects/conversations/project-conversations-list.service.ts`) SHALL:

- read the caller's project read state once per request, in parallel with Core's file listing, through `ConversationReadStateService.getProjectReadState(projectId, at, bucket)`. That method answers `{ readBefore, versions }` or `null`, and `null` fails closed;
- take each item's content version from the same body read that resolves its title. The `CachedTitle` entry (`projects:conversation-title:{locator}`, TTL 10 minutes) gains `version: string`. It stays valid only while the listing's `updatedAt` is unchanged, and the write endpoints still evict it. A cache hit therefore costs no extra read, and a miss costs the read the title already needs;
- when the title read fails (the file-name title fallback), leave the version unknown and report `isUnread: false`.

The response stays `200` with `Cache-Control: private, no-store`, and logs still carry counts only. The generated client's `ProjectConversationItemDto` gains `isUnread`. `toListItems` in `libs/chat-hooks/src/project/use-project-conversations.ts` maps it to `ProjectConversationListItem.isUnread`.

**Example response:**

```json
{
  "items": [
    {
      "id": "projects/a1b2c3/q4-launch/conversations/gpt-4o__Summary__7c1d",
      "name": "gpt-4o__Summary__7c1d",
      "title": "Weekly support health summary",
      "author": "Valery Tester",
      "updatedAt": 1793000000000,
      "isUnread": true
    }
  ]
}
```

#### Scenario: Unread item in the list

- **GIVEN** a conversation updated after the caller's baseline, whose version differs from the caller's stored one
- **WHEN** `GET /api/v1/projects/:id/conversations` is called
- **THEN** that item has `isUnread: true`

#### Scenario: Cached title supplies the version

- **GIVEN** the title cache holds `{ updatedAt: 1793000000000, title, version: 'sha256:2' }` and the listing reports the same `updatedAt`
- **WHEN** the list is requested
- **THEN** the conversation body is not downloaded, and `isUnread` is computed from `sha256:2`

#### Scenario: Read state unavailable

- **WHEN** `getProjectReadState` answers `null`
- **THEN** every item has `isUnread: false`, and the response is `200`
