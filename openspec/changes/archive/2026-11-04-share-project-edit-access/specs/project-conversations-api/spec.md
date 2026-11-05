## RENAMED Requirements

FROM: ### Requirement: Project conversation endpoints are flag-gated and owner-writable
TO: ### Requirement: Project conversation endpoints are flag-gated and writable by project editors

## MODIFIED Requirements

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

  `ProjectConversationsService.assertCanWrite` delegates to it, and the controller's `resolveWritableLocator` awaits it before resolving the body path.
- **Equal rights for editors.** Every caller who passes the check may write every conversation of the project, including one another caller started: Core grants `WRITE` to the whole project and records no per-conversation rule. A write stores the file in the project's bucket, with the caller's token.
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
| `403` | The flag is off, the caller may not write to the project (writes; `canEdit: false`), or Core denied access. |
| `404` | No such project or conversation. |
| `409` | Save or rename met a pending background message, or a persistent conflict. |
| `413` | `project-storage-full`. |
| `429` / `502` / `503` | Upstream, including a failed permission lookup on a write. |

**Generated-client impact:** `ProjectsApi.createProjectConversation`, `getProjectConversation`, `saveProjectConversation`, `renameProjectConversation` and `deleteProjectConversation`, all normal methods. None changes shape.

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
