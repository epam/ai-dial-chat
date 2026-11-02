## Why

The conversation panel renders an unread dot only for scheduled-task runs. For a regular chat the user cannot tell that an answer finished while they were on another page (for example: send a message, open the catalog, come back later). Scheduled runs already use a "viewed ids" file in DIAL Core client data; regular chats should follow the same storage idea so the product has one read/unread story.

## Problem

- `ConversationListingService` sets `isUnread` only when the item is a scheduler run (`apps/chat-api/src/conversations/listing/conversation-listing.service.ts:244`, viewed ids from `ScheduledTaskUnreadService.getViewedIds` at `:157`). Regular chats never carry `isUnread`.
- `ConversationsContext.markConversationViewed` ignores non-scheduled chats (`apps/chat/src/context/ConversationsContext.tsx:425`).
- A viewed set cannot be reused as is: every pre-existing regular chat is absent from it, so the whole history would turn unread on rollout.

## What Changes

- Add a one-time **read-before baseline** (`readBefore`, epoch ms) in a new client-data file `.client_data/.conversations-read-baseline.json`. It is written lazily by the first conversation list request that finds the file missing (there is no backend login hook). Every chat last updated at or before the baseline is read by condition; nothing is migrated.
- Add a **viewed set for regular chats** in a new `.client_data/.viewed-conversations.json`. The scheduled-task viewed file is untouched; merging the two files is a later change.
- A regular chat is unread iff `updatedAt > readBefore` and its id is not in the viewed set. The list endpoint returns `isUnread: true` for such chats (it stays omitted otherwise, as today); scheduled runs are unchanged.
- `PATCH /api/v1/conversations/viewed` writes the id to the file that matches its kind (scheduled run vs regular chat).
- When a generation starts (`POST /api/v1/conversations/completions`, covering send, regenerate and edit), the server removes the conversation id from the viewed set.
- When the user renames a chat that was read before the write, the server keeps it read (adds it to the viewed set). An already-unread chat stays unread.
- Client: `startStream` marks the row unread locally; the conversation page marks an open regular chat viewed once it has loaded and no generation is running (checked through `isStreaming`, and only after the conversation shown belongs to the open route), so returning to a generating chat writes nothing until the stream ends; scheduled runs keep the panel's active-conversation sync; the panel never shows the dot on the active conversation; regular chats carry `isUnread` into panel items without becoming task rows.
- Selectively revert the earlier uncommitted "unread set" draft at apply time: `.client_data/.unread-conversations.json`, `getUnreadIds`/`markUnread`, the listing `unreadSet` branch, `markUnreadAfterAbsentClient` in the controller with its tests, `ConversationService.markConversationUnread`, and the `useActiveConversationSync` retrigger. Keep the `useConversationPanelItems` regular-chat unread pass-through and the `markConversationViewed` generalization.
- No new user-visible strings (the existing `unreadIndicatorLabel` is reused).

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Viewed set only, no baseline | Rejected: all existing chats become unread. |
| Unread set written by the server when a generation finishes with no client attached (the uncommitted draft) | Correct and bounded, but inconsistent with the scheduled-task storage and needs server-side "client was away" detection. Replaced at the user's request. |
| Baseline + viewed set, with a one-shot migration of existing ids into the viewed file | Rejected: N writes and a large file for no benefit; the baseline already makes old chats read. |
| Baseline + viewed set with client-only un-view (new endpoint) | Rejected: extra API method and round trip per send; the server already sees the completion start. |
| **Baseline + viewed set, server un-view at completion start (chosen)** | Consistent with scheduled tasks; no migration; no away detection. |

## Capabilities

### New Capabilities
- `regular-conversation-read-state`: baseline and viewed-set storage, the unread rule for regular chats, un-view on generation start, rename behavior, and the client send/finish/open/active-row behavior.

### Modified Capabilities
- `conversations-api`: the list endpoint sets `isUnread` for regular chats; `PATCH /viewed` routes by kind; completions un-view; rename preserves read state.
- `conversation-history-panel`: the dot is shown for regular chats and hidden for the active conversation.
- `chat-hooks-conversation-panel-controller`: `useConversationPanelItems` passes `isUnread` for regular chats (kind stays Chat); `useActiveConversationSync` is unchanged and stays generic (the panel hands it a callback that only marks scheduler runs).
- `scheduled-task-unread-tracking`: `PATCH /api/v1/conversations/viewed` routes to the file matching the conversation kind; the "viewed is monotonic" rule applies to scheduled runs only.

## Non-goals

- Migrating or merging the two viewed files, or applying the baseline to scheduled runs.
- Server-side detection of "the client was away", polling, or push events for list updates.
- Showing the dot only after the answer finishes (the dot appears as soon as the user leaves a generating chat).
- Cross-tab consistency beyond last-writer-wins on the viewed file.

## Acceptance criteria

- A chat last updated before the baseline never shows a dot until a new answer is generated.
- Send a message and stay on the chat: no dot while streaming and none after it finishes; after reload the chat is still read.
- Send a message and leave mid-stream: the dot shows right away and stays after the answer finishes and after a page reload, until the chat is opened.
- Return to a generating chat: streaming resumes live and the dot is hidden; when it finishes the chat is read.
- Renaming a read chat leaves it read; renaming an unread chat leaves it unread.
- Scheduled-task unread behavior and files are unchanged.
- A failed baseline read (not 404) shows no dots and writes nothing.

## Risks, rollback and compatibility

- Not breaking: `isUnread` already exists on `ConversationListItemDto`; the added `true` values are additive. Clients that ignore it are unaffected.
- Cost: roughly two viewed-file read-modify-writes per message turn; the file grows with chats used after the baseline; two tabs can lose an update (false dot).
- `updatedAt` also moves on rating, duplicate, import and saves from another device; those may show a dot until opened (accepted).
- Rollback: stop reading both new files (the list falls back to no regular-chat `isUnread`) and ignore the client changes; the two JSON files can stay in client data harmlessly or be deleted.

## Impact

- Backend (`apps/chat-api`): `scheduled-task-unread` service (new baseline and viewed-conversations reads/writes, closest model: `scheduled-task-unread.service.ts`), `conversation-listing.service.ts`, `conversation.controller.ts` completions path, `conversation-lifecycle.service.ts` rename, `conversation.service.ts` facade. OpenAPI description text and generated `libs/chat-api-client` regenerated (`npm run openapi`, `npm run openapi:check`).
- Frontend (`apps/chat`): `ConversationsContext.tsx`, `pages/Conversation/Conversation.tsx` (`startStream`, stream-finish effect), `ConversationPanelView.tsx` (active-row suppression).
- Shared lib `libs/chat-hooks` (scope flag): `useConversationPanelItems` (only this hook changes). The lib stays host-agnostic: it only reads `ConversationListItemDto.isUnread`; the file paths, baseline and API calls live in `apps/chat-api` and the app context.
- `libs/conversation-panel` is unchanged (it already renders `isUnread`).
- Docs/specs: `openspec/specs/conversation-history-panel/spec.md` (the draft edit made earlier is reworded), `conversations-api`, `navigation-sidebar` unread wording if affected, `npm run validate:specs`, `npm run validate:docs`.
- State ownership: no new context; `ConversationsContext` already owns list state and viewed writes.
