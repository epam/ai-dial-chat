## Why

Projects are shared, and their content keeps changing while someone has the project view page open: a background generation finishes, a collaborator edits the instructions or the context files, or the owner deletes the project. Today `/projects/view/:bucket/*` shows the state from the moment it was opened until a manual reload, and the Chats list gives no hint of which chats got answers the user has not seen yet (issue #9681, a follow-up to #9621 and #9596).

## What Changes

**1. Live updates on the project view page**

- `ProjectViewPage` subscribes to its one project through the existing `POST /api/v1/projects/watch` stream (`watchProjects`). The BFF endpoint does not change.
- The subscription is a new headless hook in `libs/chat-hooks` (`useProjectWatch`). The hook takes the injected `ProjectsApiClient`. The reconnect loop now inside `useProjects` (`libs/chat-hooks/src/project/use-projects.ts:121-188`) moves into one internal helper, so both hooks share it.
- On an `UPDATE` whose `etag` differs from the loaded snapshot's `etag`, the page refreshes silently: no spinner, and the search query, scroll position and open menus stay as they are. It re-reads `GET /api/v1/projects/:id` and the Chats list (`GET /api/v1/projects/:id/conversations`, every page already shown).
- Refreshes are coalesced: at most one runs at a time, followed by one trailing refresh if more events arrived meanwhile.
- On `DELETE`, the page shows the toast "This project was deleted" and navigates to `ROUTES.Projects`.
- A dropped stream reconnects with the same bounded backoff as `useProjects`, then refreshes once.
- A watch that cannot be opened (`400` on a Core release without project events, or `403`) is not retried during the visit.
- The watch closes on unmount and when the project id changes.
- `useProject` gains `refresh()`, and `useProjectConversations` gains `refresh()` and `markViewed()`. `useProjectConversations` moves from `ProjectConversationsSection` up to `ProjectViewPage`, so the page can refresh the list. The section receives the hook's state as props.

**2. Unread project chats**

- A project chat is **unread** when its `updatedAt` is after the user's existing read-before baseline (`.client_data/.conversations-read-baseline.json`) and its current version differs from the version the user last viewed.
  - The version is the BFF's `sha256:{hex}` content hash of the stored body: `ProjectConversationStore.readConversationWithEtag`, `apps/chat-api/src/conversations/persistence/project-conversation.store.ts:138`.
  - This differs from the issue's id set, for reasons recorded in design D1. Only the owner generates in a project, so an id set stored in each reader's own bucket would never turn unread again for a share recipient. A version per id needs no "un-view" write, and it survives a project rename, because DIAL Core resets `updatedAt` on a move but the content hash stays the same.
- The read state stays in the user's own `.client_data/.viewed-conversations.json`, in a new field keyed by project id. A missing or malformed field reads as `{}`, so existing files stay valid:

  ```json
  {
    "version": 1,
    "conversationIds": ["conversations/…"],
    "projectConversationIds": {
      "projects/a1b2c3/q4-launch": {
        "projects/a1b2c3/q4-launch/conversations/gpt-4o__Summary__7c1d": "sha256:9f2c…"
      }
    }
  }
  ```

- **BFF**
  - `GET /api/v1/projects/:id/conversations` returns `isUnread: boolean` on every `ProjectConversationItemDto`. The per-conversation version comes from the title read the listing already makes, and its cache entry now holds the hash too. A failed read of the read state fails closed: every chat is read.
  - New `PATCH /api/v1/projects/:id/conversations/:conversationName/viewed` (`markProjectConversationViewed`, `204`) stores the conversation's current version for the caller.
    - Any caller who can read the project may call it, behind the same `FeatureGuard`.
    - `:id` and `:conversationName` are validated with the existing `ProjectConversationParamDto` allowlist and traversal checks.
    - The client is regenerated (`npm run openapi`, `npm run openapi:check`).
- **Cleanup** in the caller's own file:
  - Deleting a project conversation removes its entry.
  - Deleting a project removes the project key.
  - Renaming (moving) a project re-keys the entry and rewrites the ids.
  - Renaming a chat that was read before keeps it read for the renamer.
- **Marking read** follows the closest existing pattern, `markConversationViewed` (`apps/chat/src/context/ConversationsContext.tsx:499`). Writes go through one serialized queue shared by both project pages.
  - Activating a row in the Chats list clears its unread state at once and queues the write.
  - `ProjectChatPage` marks the chat viewed once it has loaded with no generation running, and again when a generation ends with the chat still open. This mirrors `isOpenChatUnread` in `apps/chat/src/pages/Conversation/Conversation.tsx:483`, through the project data source's `ConversationListSync`.
  - Starting a generation drops a viewed write still queued for that chat.
  - No server-side "mark unviewed" is needed: the answer changes the version.
- **UI:** `ProjectConversationList` (`libs/projects`) gains `isUnread` on its items. An unread row shows the semibold title, an unread dot and a screen-reader description (`labels.unreadLabel`). These mirror `ConversationRow` in `libs/conversation-panel`, which `libs/projects` cannot import. A live `UPDATE` that makes a chat unread updates its row without a reload.

## Capabilities

### New Capabilities

- `project-view-live-updates`: the watch subscription of the project view page (`useProjectWatch`), etag skip, coalesced silent refresh, delete toast and redirect, reconnect, the unavailable-watch fallback, and the watch's lifecycle.
- `project-conversation-read-state`: the per-user project read state in `.viewed-conversations.json`, the unread rule, `PATCH …/conversations/:conversationName/viewed`, cleanup on conversation delete and rename, and the frontend mark-read flow (list activation, `ProjectChatPage`, the serialized queue).

### Modified Capabilities

- `project-conversations-api`: list items carry `isUnread`, and the title cache also holds the content hash.
- `project-detail-api`: `DELETE` and the rename in `PUT /api/v1/projects/:id` keep the caller's project read state consistent.
- `project-conversations-ui`: `ProjectConversationList` items get `isUnread` with an unread style, dot, label and colour. `useProjectConversations` is owned by `ProjectViewPage`, refreshes silently, and marks rows viewed.
- `project-view-ui`: `useProject` gains a silent `refresh()`, and its cited location is corrected to `libs/chat-hooks` with the app adapter.
- `projects-watch-sse`: the parsed `ProjectWatchEvent` keeps the optional `etag`, and the reconnect loop is shared by `useProjects` and `useProjectWatch`.

## Non-goals

- Live updates on the project edit page, which keeps its `contentVersion` conflict handling from #9621.
- Live updates on the project conversation page.
- An unread indicator on project cards on the Projects page.
- Cleaning up other users' read state: delete and rename tidy only the caller's own file. A recipient's stale entries are harmless and are not pruned.
- Any change to regular-chat read state (`conversationIds`, `PATCH /api/v1/conversations/viewed`).

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. Viewed-id set per project, as in the issue (baseline + `markUnviewed` on generation start)** | Rejected. Correct for the owner only. A recipient who opened a chat once never sees a new answer as unread, because the owner's completion can only remove the id from the owner's own file. |
| **B. `id → viewedAt` timestamp, unread when `updatedAt > max(baseline, viewedAt)`** | Rejected. DIAL Core's move (`copyResource`) resets `updatedAt` and `author` of every file, so a project rename would turn every chat unread for every reader. |
| **C. `id → DIAL Core per-file etag`** | Rejected. Core's folder listing (`storageToResourceMetadata`) does not return per-file etags, so every list request would need N extra metadata calls. |
| **D. `id → BFF content hash` (chosen)** | Correct for every reader and stable across a rename. The hash comes from the body read the listing already makes for titles (cached by `updatedAt`), so a cached listing costs nothing extra. |
| Watch: extend `useProject` instead of a new hook | Rejected. It would couple the details hook to the conversation list and to navigation. A separate hook with callbacks keeps each hook single-purpose. |
| Watch: an app-level effect in `ProjectViewPage` | Rejected. It would duplicate the reconnect logic of `useProjects`, and AGENTS.md puts DIAL-Core-backed hooks in `libs/chat-hooks`. |

## Acceptance criteria

The acceptance criteria are those of issue #9681. Option D changes two of them:

- "Starting a generation in a project chat makes it unread again after the answer" holds because the answer changes the content hash. No unviewed write is sent.
- "`projectConversationIds` stays consistent" means the caller's own file.

Specifically:

- An edit of `PROJECT.md` or `context/` from another tab or user appears on an open view page without a reload.
- New, renamed, deleted and newly answered chats update the Chats list without a reload.
- A live refresh shows no spinner, and it keeps the context search query and the scroll position.
- An event whose `etag` equals the loaded snapshot's is skipped. A burst of events causes at most one refresh in flight plus one trailing refresh.
- `DELETE` shows the toast, which the kit `LiveRegion` of `NotificationContainer` announces, and navigates to `/projects`.
- A dropped stream reconnects with backoff and refreshes once. When the watch is unavailable, the page still works without live updates.
- The watch closes on unmount and on a project id change.
- A chat updated after the baseline and not viewed in its current version is unread. Opening it marks it read across reloads and devices. A share recipient sees the owner's new answers as unread.
- Deleting a conversation or a project, and renaming a project or a chat, keep the caller's `projectConversationIds` consistent.
- An existing `.viewed-conversations.json` without the field works. A failed read shows every chat as read.
- BFF unit and integration tests and frontend tests cover every item above.
- `npm run validate:docs` and `npm run validate:specs` pass.

## Impact

- **Backend (`apps/chat-api`):**
  - `scheduled-task-unread/conversation-read-state.service.ts` and `dto/viewed-conversations.dto.ts` change.
  - So do `projects/conversations/*` (list service, service, controller), `projects/projects.service.ts` (delete) and `projects/update/projects-update.service.ts` (rename).
  - There is one new endpoint and one new DTO field, and the generated `libs/chat-api-client` is regenerated.
- **Shared libs (scope flag):**
  - `libs/chat-hooks`: new `useProjectWatch`, a shared internal watch-stream helper, and `refresh`/`markViewed` on the project hooks. `ProjectsApiClient` gains an optional `markProjectConversationViewed`.
  - `libs/projects`: `ProjectConversationList` gets `isUnread`, a new `unreadLabel` label, a `colors` prop and its first `.module.scss` under that component.
  - Host knowledge stays outside both libs. The REST call goes through the injected client (`apps/chat/src/hooks/projects/projects-client.ts`), navigation and the toast through page callbacks, and strings through `*Labels` props.
- **App (`apps/chat`):** `ProjectViewPage`, `ProjectConversationsSection`, `ProjectChatPage`'s data source (`utils/project-conversation-data-source.ts`), `ConversationPage`'s unread check, `server-api/project-conversations.api.ts`, `projects-client.ts` and `models/conversation-data-source.ts`.
- **i18n:**
  - One new key, `projects.view.deletedElsewhere` ("This project was deleted").
  - The unread row label reuses `conversationPanel.unreadIndicatorLabel` ("Unread") rather than duplicating the value (`.claude/rules/all-ts.md`).
- **Docs:** `docs/architecture.md` (new endpoint), `apps/chat-api/README.md`, and the READMEs of `libs/chat-hooks` and `libs/projects`.
- **Flags:** everything stays behind `FeatureKey.ProjectsEnabled` (`PROJECTS_ENABLED`, `PROJECTS_ENABLED_ROLES`).
- **Rollback and compatibility:** nothing is breaking. The new JSON field is additive, and older code that rewrites the file keeps unknown fields only if it spreads them.
  - `addViewed` spreads only the parsed object, so the old parser would drop `projectConversationIds`. The parser change therefore ships in the same release as the field. A rollback loses at most the recorded project read state, which shows as unread dots.
  - To revert, revert the change. The extra JSON field is ignored by the old code.
