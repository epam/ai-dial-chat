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
