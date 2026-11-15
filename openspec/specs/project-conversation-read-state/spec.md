# project-conversation-read-state Specification

## Purpose

Per-reader unread state of project chats: the content version each user last viewed, stored under `projectConversationIds` in their own `.client_data/.viewed-conversations.json`, the unread rule against the shared read-before baseline, `PATCH /api/v1/projects/:id/conversations/:conversationName/viewed`, cleanup on delete and rename, and the app's serialized mark-viewed flow from the Chats list and `ConversationPage`.

## Requirements

### Requirement: Project read state is stored per user, keyed by project id, as the version last viewed

`ConversationReadStateService` (`apps/chat-api/src/scheduled-task-unread/conversation-read-state.service.ts`) SHALL persist project chat read state in the caller's own `.client_data/.viewed-conversations.json`, in a new field next to `conversationIds`:

```ts
interface ViewedConversations {
  version: 1;
  conversationIds: string[];
  /** projectId → (conversation id → content version last viewed). */
  projectConversationIds: Record<string, Record<string, string>>;
}
```

```json
{
  "version": 1,
  "conversationIds": ["conversations/a1b2c3/gpt-4o__Hello__1a2b"],
  "projectConversationIds": {
    "projects/a1b2c3/q4-launch": {
      "projects/a1b2c3/q4-launch/conversations/gpt-4o__Summary__7c1d": "sha256:9f2c41…"
    }
  }
}
```

- Keys are the project id (`projects/{bucket}/{path}`) and the full conversation locator (`projects/{bucket}/{path}/conversations/{name}`), compared URI-decoded, as `conversationIds` are.
- Values are the conversation's content version: the `"sha256:{hex}"` `contentHash` that `ProjectConversationStore.readConversationWithEtag` (`apps/chat-api/src/conversations/persistence/project-conversation.store.ts`) returns as `etag`.
- `parseViewedConversations` (`apps/chat-api/src/scheduled-task-unread/dto/viewed-conversations.dto.ts`) SHALL read a missing field, a non-object value, a non-object project entry, or a non-string version as absent. The affected part becomes `{}` and the rest is kept, so existing files stay valid. `DEFAULT_VIEWED_CONVERSATIONS` gains `projectConversationIds: {}`.
- Every write of the file, for regular chats included, SHALL carry the parsed `projectConversationIds` through unchanged. A regular `addViewed` / `removeViewed` never drops project state, and a project write never drops `conversationIds`.
- Writing an unchanged value, or removing an absent entry, issues no upload.
- A project key whose map becomes empty is removed.
- A non-`404` read failure surfaces as a failed read and is never written back as empty, as for `conversationIds`.

The read-before baseline (`.client_data/.conversations-read-baseline.json`) is shared with regular chats: the first read of project read state that finds no baseline creates it, as `getReadState` does.

**Owner of the state:** the BFF, per user (the session bucket). No frontend cache. Concurrency is last-writer-wins, as for regular chats.

#### Scenario: Existing file without the field

- **GIVEN** the file is `{ "version": 1, "conversationIds": ["conversations/x"] }`
- **WHEN** project read state is read
- **THEN** it is `{}`, and a later project write keeps `conversationIds: ["conversations/x"]`

#### Scenario: Malformed project entry

- **GIVEN** `projectConversationIds` is `{ "projects/a/p": ["not-a-map"], "projects/a/q": { "projects/a/q/conversations/c": "sha256:1" } }`
- **WHEN** it is parsed
- **THEN** `projects/a/p` is dropped, and `projects/a/q` is kept

#### Scenario: A regular write keeps project state

- **WHEN** a regular chat is marked viewed
- **THEN** the uploaded file still holds the previous `projectConversationIds`

### Requirement: A project chat is unread when it changed after the baseline and since the user last viewed it

For each listed project conversation, the BFF SHALL compute:

```
isUnread = updatedAt > readBefore
        && version != null
        && projectConversationIds[projectId]?.[id] !== version
```

- `updatedAt` comes from DIAL Core's file listing, `readBefore` from the baseline, and `version` from the conversation's content hash (see the `project-conversations-api` capability).
- A conversation without `updatedAt`, or whose version could not be read, is read (`false`).
- The rule applies to every caller who can list the project's conversations: the owner, share recipients, and readers of a published project. Each caller's state lives in their own bucket, and a new answer changes the content hash, so it turns unread for every reader, not only for the one who generated it.
- No "mark unviewed" write is made when a generation starts. The project completion path keeps `isUnreadTracked: false` in `ConversationCompletionsResponder` (`apps/chat-api/src/conversations/streaming/conversation-completions.responder.ts`).

#### Scenario: Owner's new answer for a recipient

- **GIVEN** a recipient viewed chat C at version `sha256:1`, and the owner then generates an answer, so C is at version `sha256:2` with `updatedAt` after the baseline
- **WHEN** the recipient lists the project's chats
- **THEN** C has `isUnread: true`

#### Scenario: Chat older than the baseline

- **GIVEN** chat C was last updated before `readBefore`, and the user never opened it
- **WHEN** the list is requested
- **THEN** C has `isUnread: false`

#### Scenario: Viewed at the current version

- **GIVEN** the stored version of C equals its current content hash
- **WHEN** the list is requested
- **THEN** C has `isUnread: false`

### Requirement: Reading the project read state fails closed

When the baseline or `.viewed-conversations.json` cannot be read (any non-`404` failure, or a malformed baseline), or the lazy baseline write fails, the list SHALL report `isUnread: false` for every conversation. It logs one `warn` without ids, and still answers `200`. The read never fails the list request.

#### Scenario: Core fails the viewed-file read

- **WHEN** downloading `.viewed-conversations.json` answers `503`
- **THEN** the list answers `200`, and every item has `isUnread: false`

### Requirement: PATCH /api/v1/projects/:id/conversations/:conversationName/viewed records the current version

`ProjectConversationsController` (`apps/chat-api/src/projects/conversations/project-conversations.controller.ts`) SHALL expose:

| Field | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/projects/:id/conversations/:conversationName/viewed` |
| Handler / operationId | `markProjectConversationViewed` |
| Params | `ProjectConversationParamDto` (`id` and `conversationName`, URL-encoded, with the existing allowlist and traversal checks) |
| Body | none |
| Auth | global `SessionGuard` + `CsrfGuard`, plus the controller's `FeatureGuard` with `@RequireFeature(FeatureKey.ProjectsEnabled)`. Any caller DIAL Core lets read the project, not only the owner, because the state is written to the caller's own bucket |
| Success | `204` with no body |

**Example:**

```http
PATCH /api/v1/projects/projects%2Fa1b2c3%2Fq4-launch/conversations/gpt-4o__Summary__7c1d/viewed
X-CSRF-Token: …

HTTP/1.1 204 No Content
```

**Behaviour:**

1. Read the conversation with `ProjectConversationStore.readConversationWithEtag(locator, at)`. This also enforces Core read access.
2. `null` → `404`.
3. Otherwise call `ConversationReadStateService.markProjectConversationViewed(projectId, locator, etag, at, bucket)`, which sets `projectConversationIds[projectId][locator] = etag` (no upload when it is already equal).

**Errors** (each with `@ApiResponse`):

| Status | When |
| --- | --- |
| `400` | Invalid `id` or `conversationName` (including `..` traversal and an encoded `/`) |
| `401` | No valid session |
| `403` | The feature is off for the caller, or Core denies read access |
| `404` | The project or the conversation does not exist |
| `502` | Core answered an unexpected error reading the conversation or writing the file |
| `503` | Core is unreachable |

**Generated client:** operationId `markProjectConversationViewed`, request `{ id: string; conversationName: string }`, no request DTO and no response DTO (`void`). The frontend calls the normal (non-`Raw`) method `projectsApi.markProjectConversationViewed` through a new `markProjectConversationViewed(conversationId)` in `apps/chat/src/server-api/project-conversations.api.ts`. `ProjectsApiClient` (`libs/chat-hooks/src/project/projects-api-client.ts`) declares it as an optional `markProjectConversationViewed?: (conversationId: string) => Promise<void>`. `ProjectsConfiguredClient` and `createProjectsApiClient` add the matching member, and `apps/chat/src/hooks/projects/projects-client.ts` forwards it.

Logs carry the outcome only, never ids, names or versions.

#### Scenario: Happy path

- **WHEN** a recipient of `projects/a1b2c3/q4-launch` calls the endpoint for an existing conversation at version `sha256:2`
- **THEN** the response is `204`, and the recipient's file maps that locator to `sha256:2`

#### Scenario: Unknown conversation

- **WHEN** the conversation file does not exist
- **THEN** the response is `404`, and nothing is written

#### Scenario: Traversal is refused

- **WHEN** `conversationName` is `..%2F..%2Fsecret`
- **THEN** the response is `400`, and DIAL Core is not called

#### Scenario: Idempotent

- **WHEN** the endpoint is called twice at the same version
- **THEN** the second call issues no upload

### Requirement: Deleting and renaming a project conversation keep the caller's state consistent

`ProjectConversationsService` (`apps/chat-api/src/projects/conversations/project-conversations.service.ts`) SHALL, as a best effort after the Core write committed (a failure is logged at `warn` and never fails the request):

- **Delete:** after `deleteConversation`, remove `projectConversationIds[projectId][locator]` from the caller's file.
- **Rename (title only; the file name does not change):** before the rename, compute whether the conversation is read for the caller under the unread rule. If it was, store its new content hash after the save, so the user's own rename does not turn their chat unread. A chat that was unread stays unread.

- **Background display name:** when `ConversationNamingService` (`apps/chat-api/src/conversations/naming/conversation-naming.service.ts`) writes the LLM title of a project chat after its first answer, `ConversationReadStateService.carryProjectConversationViewed` moves the caller's stored version from the version before that write to the one after it. Nothing is written when the caller had viewed another version, or none. So an owner who watched the first answer does not find the chat unread once it has been named.

Only the caller's own file is changed. Other readers keep their entries:

- An entry for a deleted conversation is never listed again and is harmless.
- A title rename changes the content hash, so the chat shows as unread for other readers who had viewed it. This is accepted, because a rename is a change to the chat.

#### Scenario: Delete removes the entry

- **WHEN** the owner deletes conversation C of project P
- **THEN** the owner's file no longer holds `projectConversationIds[P][C]`

#### Scenario: The LLM title does not unread a watched chat

- **GIVEN** the owner viewed chat C at version `sha256:1` when its first answer ended
- **WHEN** the background naming writes C's title, so C is at `sha256:2`
- **THEN** the owner's file maps C to `sha256:2`, and C is read

#### Scenario: Rename keeps a read chat read

- **GIVEN** chat C is read for the owner
- **WHEN** the owner renames it
- **THEN** C is still read for the owner in the next list

### Requirement: The project pages mark chats viewed through one serialized queue

The app SHALL create one module-level serialized writer for project viewed marks, in `apps/chat/src/hooks/projects/projects-client.ts`, built with a new pure helper `createSerializedKeyedWriter` in `libs/chat-hooks/src/shared/serialized-writer.ts`:

- At most one write runs at a time, in call order, and a write for an id already queued is not queued twice.
- `drop(id)` removes a queued (not yet started) write for that id.
- A failed write rejects only its own caller, and the queue continues.
- `subscribe(listener)` calls `listener` with the key of every write that succeeded, before that write's callers resume, and returns the function that removes it.

It mirrors the `viewedWriteQueueRef` serialization of `markConversationViewed` in `apps/chat/src/context/ConversationsContext.tsx`. `projectsClient.markProjectConversationViewed` goes through it, so `ProjectViewPage` and `ProjectChatPage` share one queue across route changes.

**Opening from the Chats list.** Activating a row SHALL:

1. call `useProjectConversations().markViewed(id)`, which sets that item's `isUnread` to `false` at once and fires `client.markProjectConversationViewed(id)` without awaiting it. A failure is swallowed: the row stays read locally, and the next list read reports the truth.
2. then navigate to the chat.

A silent refresh that started before the mark does not bring the dot back: `markViewed` records the id, and the refresh's result applies `isUnread: false` to it until a later read reports a version newer than the mark. The hook tracks this as the `updatedAt` the item had when it was marked.

**On `ProjectChatPage`.** The project `ConversationDataSource` (`apps/chat/src/utils/project-conversation-data-source.ts`) SHALL supply a `listSync` with:

- `markViewed(id)`: the queued write;
- `markUnread(id)`: `drop(id)`;
- `shouldMarkOpenChatViewed: true`;
- the other members as `NO_CONVERSATION_LIST_SYNC`.

`ConversationListSync` (`libs/chat-hooks/src/conversation/conversation-data-source.ts`, exported from `@epam/ai-dial-chat-hooks/conversation`) gains the optional `shouldMarkOpenChatViewed?: boolean`. When it is `true`, `ConversationPage` (`apps/chat/src/pages/Conversation/Conversation.tsx`) treats the open chat as unread-tracked without looking it up in `ConversationsContext`. Its existing effect therefore calls `listSync.markViewed(conversationId)`:

- once when the conversation has loaded with no generation running and no failed recovery;
- again when a generation ends while the chat is still open.

Leaving before a generation ends does not mark it. The regular data source leaves `shouldMarkOpenChatViewed` unset, so regular chats behave exactly as today.

#### Scenario: Opening an unread chat from the list

- **WHEN** the user activates an unread row
- **THEN** the row loses its unread style before navigation, and one `PATCH …/viewed` is sent

#### Scenario: Watching an answer to the end

- **GIVEN** the owner sends a message on `ProjectChatPage` and stays until the answer ends
- **WHEN** they go back to the project view
- **THEN** the chat is read

#### Scenario: Leaving mid-generation

- **GIVEN** the owner sends a message and returns to the project view before the answer ends
- **WHEN** the answer finishes and the list is read again (a live `UPDATE`)
- **THEN** the chat is unread

#### Scenario: A queued mark does not outlive a new generation

- **GIVEN** a viewed write for chat C is queued behind a slow write for chat B
- **WHEN** a generation starts in C before the queue reaches it
- **THEN** C's write is dropped

### Requirement: Project read state adds no flag and reuses the unread label

Project read state SHALL meet the following cross-cutting contract.

- **Gating:** everything is behind `FeatureKey.ProjectsEnabled` (`PROJECTS_ENABLED`, `PROJECTS_ENABLED_ROLES`). There is no separate flag, and regular-chat read state stays ungated.
- **i18n:** the unread row label reuses `conversationPanel.unreadIndicatorLabel` ("Unread"). No key is added for read state.
- **Telemetry:** no new metric. `MetricsInterceptor` covers the new route.
- **Caching:** the read state is not cached. The per-conversation content hash rides on the existing title cache (see the `project-conversations-api` capability).
- **Accepted races:** they are last-writer-wins, as for regular chats. A mark that lands after a newer answer was saved hides that answer's dot once. Two tabs writing at once may lose one mark, which shows as at most one false dot.

#### Scenario: Flag off

- **WHEN** `projectsEnabled` is off for the caller
- **THEN** `PATCH …/viewed` answers `403`

### Requirement: Successful project viewed writes notify app listeners

`apps/chat/src/hooks/projects/projects-client.ts` SHALL export `subscribeProjectConversationViewed(listener: (conversationId: string) => void): () => void`, which is `projectViewedWriter.subscribe`. `projectsClient.markProjectConversationViewed(id)` SHALL await `projectViewedWriter.enqueue(id)`, and a successful write calls every subscribed listener with `id`. The returned function removes the listener.

- A failed write notifies no listener and still rejects its own caller, as before.
- A write dropped by `drop(id)` notifies no listener.
- A listener that throws does not stop the others, nor the caller's promise.
- The listener registry belongs to the writer: `createSerializedKeyedWriter` in `libs/chat-hooks/src/shared/serialized-writer.ts` keeps it, and the app owns only the module-level writer instance. `createProjectConversationDataSource` takes only the writer's `enqueue` and `drop`.

The sidebar's pinned-project tree subscribes (see the `sidebar-pinned-project-chats` capability), so a chat marked viewed by `ProjectChatPage` or by the project view's Chats list loses its dot in the sidebar too.

#### Scenario: A mark from the project chat page reaches the sidebar

- **GIVEN** a listener is subscribed
- **WHEN** `ProjectChatPage` marks chat C viewed and the `PATCH …/viewed` succeeds
- **THEN** the listener is called once with C

#### Scenario: A failed write notifies nobody

- **WHEN** the `PATCH …/viewed` for C fails
- **THEN** no listener is called, and the caller's promise rejects

#### Scenario: Unsubscribing

- **WHEN** the function returned by `subscribeProjectConversationViewed` is called and C is then marked viewed
- **THEN** the removed listener is not called
