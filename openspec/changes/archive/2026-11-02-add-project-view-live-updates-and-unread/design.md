## Context

The project view page (#9621) loads its data once:

- `useProject` (`libs/chat-hooks/src/project/use-project.ts`) loads the details.
- `useProjectConversations` (`libs/chat-hooks/src/project/use-project-conversations.ts`) loads the Chats list. `ProjectConversationsSection` calls it today.

The Projects page (#9596) already keeps a list current through `POST /api/v1/projects/watch`. In `useProjects` (`libs/chat-hooks/src/project/use-projects.ts`) the connect / read / backoff loop is a private closure.

Regular chats already track unread state:

- `ConversationReadStateService` keeps a read-before baseline and a viewed-id set in `.client_data/.viewed-conversations.json`.
- The BFF removes the id when a completion starts (`ConversationCompletionsResponder`, `isUnreadTracked`).
- `ConversationPage` marks the open chat viewed once nothing is generating.

Project chats have none of this. `ConversationPage`'s check looks the open chat up in `ConversationsContext`, where project chats never appear.

Facts from the code that shaped the decisions:

- **Shared projects.** Project completions are owner-only (`ProjectConversationsService.assertOwner`), but the list and reads work for any reader Core allows. Read state lives in each reader's own bucket, and the BFF cannot write another user's bucket.
- **DIAL Core** (`ai-dial-core`, `ComplexResourceService`, `ResourceService`):
  - A project write is copy-on-write of a version folder. Unchanged files keep their blob metadata, so their `updatedAt` stays.
  - A move or copy of a project (`copyResource` → `copyResourceLocked`) rewrites the user metadata with the etag only, so every file's `updatedAt` falls back to the copy time and `author` is lost.
  - The folder listing (`storageToResourceMetadata`) returns `updatedAt` and `author`, never a per-file etag.
- **The BFF's version token** for a project conversation is `"sha256:{hex}"` of the stored bytes (`ProjectConversationStore`, `contentHash`). The title resolution of the listing already reads each body on a cache miss, and the cache entry is keyed by `updatedAt`.
- **`ProjectDetailsDto.etag`** is the aggregate etag, which changes on every write, conversation writes included. `ProjectWatchEventDto` carries the same aggregate `etag` on `UPDATE`.

Stakeholders: project owners and share recipients, and the BFF's DIAL Core load (one SSE subscription per open view page).

## Goals / Non-Goals

**Goals:**

- The open view page reflects remote edits, chat changes and deletion without a reload, with no spinner and no lost UI state.
- Every reader sees which project chats changed since they last viewed them, persisted across reloads and devices.
- Host knowledge stays out of `libs/projects` and `libs/chat-hooks`, and the reconnect policy has one implementation.

**Non-Goals:**

- Live updates on the edit or chat pages.
- Unread badges on project cards.
- Pruning other users' read state.
- Changing regular-chat read state.

## Decisions

### D1. Store the content version last viewed, not a viewed-id set

`projectConversationIds[projectId][conversationId] = contentHash`. A chat is unread when `updatedAt > readBefore` and its current hash differs from the stored one (or there is none).

| Option | Owner | Share recipient | Project rename | Cost per list |
| --- | --- | --- | --- | --- |
| Id set + unview on generation start (issue) | ✓ | ✗ once viewed, never unread again | ✓ with re-keying | 0 |
| `viewedAt` timestamp vs `updatedAt` | ✓ | ✓ | ✗ the move resets every `updatedAt`, so all chats turn unread | 0 |
| DIAL Core per-file etag | ✓ | ✓ | ✓ | ✗ N metadata calls, since the listing has no etag |
| **BFF content hash (chosen)** | ✓ | ✓ | ✓, hash unchanged by a move | 0 on a cache hit, and the existing title read on a miss |

The hash comes from the same body read that resolves the title, so `CachedTitle` gains `version`. Because the state compares versions, a "mark unviewed" write on generation start is unnecessary. The project completion path keeps `isUnreadTracked: false`, and no un-view endpoint exists.

The `updatedAt > readBefore` guard keeps chats that predate the feature read, as for regular chats. After a project rename their `updatedAt` resets, which only matters for chats the reader never opened: they turn unread once (see Risks).

The field keeps the issue's name, `projectConversationIds`. Its keys are full locators, as the user chose. A map value replaces the issue's array.

### D2. The viewed endpoint reads the version on the server

`PATCH …/:conversationName/viewed` has no body. The BFF reads the conversation with `readConversationWithEtag`, which also gives `404` and enforces Core READ, and stores that hash.

- **Alternative:** the client sends the version it rendered. Rejected: neither `ConversationResponseDto` nor the list exposes it, adding it widens two public DTOs, and a client-supplied value would need its own validation.
- **Cost:** one body download per mark, the same as the open itself.

**Authorization:** any caller with project READ (`FeatureGuard` on `ProjectsEnabled`, then Core's check on the read). It writes only to the caller's bucket, so it is not owner-only.

### D3. Extend `ConversationReadStateService`, not a new service

The project field lives in the same file, and every write of that file must carry both fields. One owner of the file avoids two read-modify-write paths clobbering each other.

The service gains the following:

- `getProjectReadState(projectId, at, bucket): Promise<{ readBefore; versions: ReadonlyMap<string, string> } | null>`, which fails closed.
- `markProjectConversationViewed(projectId, id, version, at, bucket)`.
- `removeProjectConversation(projectId, id, …)`.
- `removeProject(projectId, …)`.
- `renameProject(oldId, newId, …)`.
- `isProjectConversationUnread(state, id, updatedAt, version)`, a pure function next to `isRegularConversationUnread`.

`parseViewedConversations` normalises the new field, and `addViewed` / `removeViewed` spread the parsed object, so they keep it.

The module wiring needs a check: `ProjectsModule` must import the module that provides `ConversationReadStateService` (`ScheduledTaskUnreadModule`). There must be no cycle with `ConversationModule`. Today `ConversationModule` (`apps/chat-api/src/conversations/conversation.module.ts`) imports it and `ProjectsModule` imports `ConversationModule`, so `ProjectsModule` adds `ScheduledTaskUnreadModule` to its own `imports` directly.

### D4. One watch helper, a separate `useProjectWatch` hook

The loop of `useProjects` (connect, `readSseEvents`, schedule the reconnect, mark the watch unavailable) moves into an internal function, `runProjectWatch({ watchProjects, ids, signal, onEvent, onReconnected })`, in `libs/chat-hooks/src/project/project-watch-stream.ts`. It answers a promise that settles when the watch gives up or the signal aborts. `useProjects` keeps its behaviour, and its spec suite is the regression net.

`useProjectWatch(client, projectId, { etag, onChange, onDelete })`:

- **Refs for options:** `etag`, `onChange` and `onDelete` are kept in refs, so the effect depends only on `client.watchProjects` and `projectId` (plus a "loaded" boolean, so the watch opens only after the first snapshot).
- **Coalescing gate:** `inFlight: Promise | null` plus `isPending: boolean`. `trigger()` sets `isPending` when a refresh runs, and otherwise starts `onChange()`. In `finally`, it re-triggers when `isPending` is set. Both the event path and `onReconnected` use the gate.
- **Etag skip:** compare `event.etag` with `etagRef.current`. Refreshing updates the ref through the page's re-render.
- **Delete:** on `DELETE`, abort, clear `isPending`, and call `onDelete` once.

**Alternatives:**

- Fold the watch into `useProject`. Rejected: it would couple the details hook to the conversation list and to page navigation.
- An app-level effect. Rejected: it duplicates the reconnect loop, and DIAL-Core-backed hooks belong in `libs/chat-hooks` (AGENTS.md).

### D5. The page owns both refreshes; the section becomes presentational for the list

`ProjectViewPage` calls `useProjectConversations(projectId)` and passes the result to `ProjectConversationsSection` as `conversations`. `onChange` runs `Promise.all([refreshProject(), conversations.refresh()])`. A `NotFound` outcome from `refreshProject` follows the same path as `onDelete`.

- **Alternative:** a revision counter prop into the section. Rejected: the gate needs to know when the refresh finished, and a counter cannot report completion.
- **Alternative:** an imperative ref handle. Rejected as un-idiomatic in this codebase.

**Silent refresh in `useProject`:** a separate `refreshControllerRef`, as in `useProjects.refreshSilently`. On success it calls `setResult((current) => current?.key === key ? { ...current, project } : current)`, so the reload-token logic is untouched.

**Silent refresh in `useProjectConversations`:** it reads from offset `0` in pages of at most 100 (the DTO maximum) until it covers `max(items.length, 50)` rows. It sets `items` and `hasMore` in one `setState`. A `loadMore` that settles after a refresh started is dropped (`listVersionRef`), so pages never interleave; its request is not aborted, because it shares the list's page controller.

### D6. Marking read: list activation plus `ConversationPage` through `listSync`

The user chose activation plus the end of a generation.

- **Shared queue:** `createSerializedKeyedWriter(write)` is a new pure helper in `libs/chat-hooks/src/shared/serialized-writer.ts`. It provides `enqueue(id)` (deduplicated), `drop(id)`, and serial execution. The app creates one instance in `projects-client.ts`, so `ProjectViewPage` and `ProjectChatPage` share it across route changes. It mirrors `viewedWriteQueueRef` in `ConversationsContext`.
- **List activation:** `useProjectConversations.markViewed(id)` clears the row at once and enqueues the write. Navigation does not wait. The hook remembers `{ id → updatedAt at mark }`, so a refresh already in flight cannot restore the dot.
- **Chat page:** the project `ConversationDataSource.listSync` sets `markViewed` to enqueue, `markUnread` to `drop`, and `shouldMarkOpenChatViewed: true`. In `ConversationPage`, `isOpenChatUnread` becomes `listSync.shouldMarkOpenChatViewed || <existing lookup>`. The existing effect then marks on load with no generation running, and again when `isStreaming` turns false. Leaving mid-stream marks nothing.
- **Alternative:** only activation. Rejected by the user, because a chat the owner watched to the end would come back unread.
- **Alternative:** pass `isUnread` through router state to the chat page. Rejected: it is lost on a reload or a direct link, and a no-op write is cheap (`markProjectConversationViewed` skips the upload when the version is equal).

### D7. Unread UI lives in `libs/projects`, mirroring `libs/conversation-panel`

`ProjectConversationList`'s row is its own component. `libs/projects` does not depend on `libs/conversation-panel`, and adding that dependency would grow the host's install set (`.claude/rules/libs.md`). The row therefore copies the visual contract:

- `typography.unreadRowTitleClassName` (default `dial-body-semi-text`);
- a `7.11px` dot coloured by `--pcl-unread-dot` from a new `ProjectConversationList.module.scss`, set through a `colors` prop with `buildCssVars`;
- a visually hidden `labels.unreadLabel`.

The issue's text points at `ConversationRow` in `libs/conversation-panel`. That disagreement is recorded here: the list in question never renders that component.

**Accessible name:** the row button's `aria-label` is `openLabel(title, author)`, which would hide a nested `sr-only` span. The unread state is therefore attached with `aria-describedby`, and the name stays stable.

**Host-agnostic boundary:**

| Concern | Carried by |
| --- | --- |
| REST call | `ProjectsApiClient.markProjectConversationViewed` (injected; `projects-client.ts`) |
| Watch stream | `ProjectsApiClient.watchProjects` (injected) |
| Toast, pin cleanup, navigation | `onDelete` callback from `ProjectViewPage` |
| Strings | `ProjectConversationListLabels.unreadLabel`, `t()` in `useProjectConversationsPanelLabels` |
| Colour | `ProjectConversationListColors.unreadDot` |

### D8. Cleanup is caller-only and best effort

Cleanup runs after the committed Core write, in the same places the pin side effects run:

- delete conversation: `ProjectConversationsService.deleteConversation`;
- delete project: after `removePinQuietly`;
- rename project: after `migratePinQuietly`;
- title rename: compute "was read" before the save, and store the new hash after.

Each step is wrapped, logged at `warn`, and never fails the request. Other readers' files are out of reach by design. Their stale keys are inert, because they are never listed.

### States

The page keeps its existing loading, error, not-found and loaded states:

| Situation | What the page does |
| --- | --- |
| A refresh fails | Keeps the loaded state; no error UI. |
| The watch is unavailable | Silent; the page is the same as today. |
| A refresh finds the project gone (`404`) | Leaves through the delete path with its toast. |
| The Chats list is empty after a refresh | Shows the existing empty state. |

## Risks / Trade-offs

- **[Risk] SSE load:** one Core subscription per open view page, on top of the Projects page's. → The subscription is per tab, closes on unmount, and is counted by `SseSubscriptionKind.ProjectsWatch`. Project pages are flag-gated.
- **[Risk] Refresh storms during generation:** a background generation saves often, and each save produces an `UPDATE`. → The coalescing gate allows one refresh in flight plus one trailing. The title cache absorbs unchanged chats. Only changed chats cost a body read.
- **[Risk] Mark-viewed reads a whole body:** one extra read per open and per finished generation. → Accepted: the same size as the page's own read, and idempotent with no upload.
- **[Trade-off] A project rename turns never-opened, pre-baseline chats unread once for every reader,** because Core resets `updatedAt` on a move. → Chats the reader had viewed keep their hash and stay read. Accepted and documented. A follow-up could ask Core to preserve `updatedAt` on copy.
- **[Trade-off] A title rename turns the chat unread for other readers** who had viewed it, since the hash changes. → Accepted, because it is a change to the chat. The renamer keeps it read (D8).
- **[Trade-off] Last-writer-wins** on `.viewed-conversations.json` across tabs. → As for regular chats, this costs at most one false dot.
- **[Risk] A regular-chat write drops project state if the parser is wrong.** → A dedicated unit test asserts that `addViewed` / `removeViewed` keep `projectConversationIds`. The parser and the field ship together.
- **[Risk] `ConversationPage` regression for regular chats.** → `shouldMarkOpenChatViewed` is optional and unset for the regular data source. The existing regular-chat read-state tests must pass unchanged.

## Migration Plan

1. The BFF ships the parser, service methods, list field and endpoint. The schema change is additive, and old files parse with `{}`.
2. Regenerate `libs/chat-api-client` (`npm run openapi`, `npm run openapi:check`).
3. The frontend ships the hooks, lib UI and page wiring in the same release. There is no feature flag beyond `ProjectsEnabled`.
4. **Rollback:** revert the change. The old parser ignores `projectConversationIds`, and its next regular write drops it, so project read state is lost and chats show as unread once a later version returns. No other data is affected.

## Open Questions

- Should DIAL Core preserve `updatedAt` and `author` on a project move or copy? That would remove the rename trade-off, both here and for the list's author display. It is out of this change's scope; raise it with the Core team.
- Does a view-only share give the recipient READ on `conversations/`? The code assumes yes, because `GET …/conversations` already works for any Core reader. If Core restricts it, the list answers `403`, the Chats section shows its error state, and unread simply does not apply. No code change is needed either way.
