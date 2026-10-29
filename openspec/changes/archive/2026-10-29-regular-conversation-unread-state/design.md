## Context

See `proposal.md` for motivation and acceptance criteria; the observable contract is in the delta specs (`regular-conversation-read-state`, `conversations-api`, `scheduled-task-unread-tracking`, `conversation-history-panel`, `chat-hooks-conversation-panel-controller`).

Current state that shapes the approach:

- `ConversationListingService.listConversations` already fans out in one `Promise.all` and decorates scheduler runs with `isUnread` from `ScheduledTaskUnreadService.getViewedIds` (viewed ids file in `.client_data`). Read/modify/write of one JSON file with a 404-only-means-empty rule is the proven storage idiom here (`apps/chat-api/src/scheduled-task-unread/scheduled-task-unread.service.ts`); the same idiom exists in `UserConfigService`.
- Generation is backend-owned: `ConversationController.streamCompletion` keeps consuming the generation after the browser disconnects, and the placeholder save bumps the conversation's DIAL Core `updatedAt` at generation start. The list's `updatedAt` is DIAL Core metadata, not a field the client writes.
- The client already has one funnel for every generation (`startStream` in `apps/chat/src/pages/Conversation/Conversation.tsx`), an `isStreaming` flag from `useConversationStream`, and an in-app resume path (`restoreBufferedGeneration`, `resumeIfAwaitingGeneration`).
- `ConversationsContext` owns the list and the viewed write queue; `useActiveConversationSync` (`libs/chat-hooks`) marks the active chat viewed once per active identity through an injected callback; `libs/conversation-panel` already renders any `ConversationItem.isUnread` and is not touched.
- Constraint: `libs/*` must not know endpoint paths, files or auth. The hooks keep receiving `markConversationViewed` as a callback and only read `ConversationListItemDto.isUnread`.

## Goals / Non-Goals

**Goals:**
- One read/unread story across scheduled runs and regular chats, stored the same way (viewed ids in client data).
- No migration of existing history and no server-side detection of "the client was away".
- Keep every new write best effort so a read-state failure never breaks list, completion, rename or viewed requests.

**Non-Goals:**
- Merging the two viewed files or applying the baseline to scheduled runs (later change; the schemas are deliberately identical so a merge is a file concat).
- Real-time push of list changes. The dot appears from local state at the moment of leaving and from the next list load otherwise.
- Strong consistency between tabs.

## Decisions

### D1. Baseline + viewed set, not an unread set

Unread = `updatedAt > readBefore && id not in viewed`.

- Why: consistent with the scheduled-task model, no per-generation "away" detection, and old chats are read by condition. Chosen by the product owner over the uncommitted unread-set draft.
- Alternatives: viewed set alone (whole history turns unread); unread set written by the controller when the response was closed (bounded and exact, but a second storage model and server-side away detection); one-shot migration of existing ids into viewed (large file, no benefit over a baseline).

### D2. Un-view on the server at completion start, mark-view on the client

The completions controller removes the id from viewed once, before streaming (best effort, skipped for scheduler paths and for requests that fail before generation starts, e.g. a 409). The client never sends an "un-view" call.

- Why: the server already sees every send, regenerate and edit, including other clients; no new endpoint, no extra round trip, and the un-view and the `updatedAt` bump belong to the same moment.
- Alternative: a new `PATCH .../unviewed` endpoint called from `startStream` (rejected: new API surface, a separate failure mode, misses non-browser clients).
- The wait for the un-view write before the first relayed chunk overlaps the model's own start, so it costs nothing in practice. It has no timeout: a hung DIAL Core client-data call would hold the first chunk back. Accepted (decided in review): that DIAL Core would normally break the chat itself, and a bound would only trade it for a false dot.
- The controller change replaces the earlier `markUnreadAfterAbsentClient` hook (reverted at apply); the `hasGenerationFinished` bookkeeping goes with it.

### D3. Lazy baseline in the list request

`readBefore` is created by the first list request that finds the file missing, using server `Date.now()`. There is no backend login hook; the list is the first thing any session calls, and existing users are covered on deploy.

- A non-404 failure, malformed JSON or a failed first write means "treat all regular chats as read, write nothing" for that request (fail closed). The next request retries the lazy init after a transient failure (5xx, failed first write). A malformed baseline file is not rewritten, so that user sees no regular-chat dots until the file is removed.
- Concurrency: two simultaneous first lists may both write; the second timestamp is only a few milliseconds later, which is harmless. A conditional write is not required.
- Alternative: write in the auth callback (rejected: puts DIAL Core I/O in the auth path and misses already-logged-in users).

### D4. Read state lives in `ScheduledTaskUnreadService`'s neighbour, as a small generic store

Add a read-state service in `apps/chat-api/src/scheduled-task-unread/` (renaming the module is out of scope) exposing: `getRegularReadState(token, bucket)` returning the baseline and viewed ids (creating the baseline when missing), `unview(id)`, and the regular-chat branch of `markViewed`. The download/upload plumbing (404-only-missing, `FormData` upload) is extracted from the existing service into a private helper parameterized by path so the three files share one code path, with the existing service's log and error-context strings unchanged to keep its spec green. The list uses the result when decorating items from the user's own bucket only.

- `markViewed(fullId)` decides the target file by path: a scheduler run goes to the scheduled viewed file, anything else to `.viewed-conversations.json`. The controller and `ConversationService` facade keep their signatures, so the OpenAPI contract of `PATCH /viewed` does not change except its description text. `npm run openapi` and `npm run openapi:check` are still run.
- Alternative: leave the existing service untouched and copy it (rejected: three near-identical read/write blocks).

### D5. Rename keeps a read chat read

The rename path reads the chat's DIAL Core metadata `updatedAt` (via the existing `getConversationMetadata` in the listing service) and the read state before the conditional write, evaluates "was read" (`updatedAt <= readBefore || in viewed`), and after a successful save adds the id to viewed. The body `updatedAt` is not used because the list compares DIAL metadata time. All of it is best effort.

- Cost: one metadata call and the read-state read per rename, which is rare.
- Alternative: have the client mark viewed after rename (rejected by the product owner: server owns it; also the normal "only when unread" guard would skip it).

### D6. Client state: optimistic unread on send, page-owned view, active row hidden

All in `apps/chat` plus tiny `libs/chat-hooks` edits, no new context:

- `ConversationsContext` gains `markConversationUnread(id)` (local-only: sets `isUnread: true` for a regular chat row, no-op for scheduler runs, no API call). `markConversationViewed` stops being scheduled-only; viewed state stays monotonic (`viewedIdsRef`) only for scheduler runs, because a regular chat turns unread again after the next answer. The failure path for a regular chat keeps it read locally and does not retry on its own.
- The conversation page owns marking a regular chat viewed. One effect marks the open chat when the conversation shown has been applied for the open route (a `loadedConversationId` state set at the end of the load, after any resume; `isFetching` alone is false in the first commit after the route changes while the previous chat is still shown), its row is a regular chat reported unread, and no generation is running. "Running" is the hook's `isStreaming`: coming back to a generating chat (or reloading during a generation) resumes it in the same synchronous batch that applies the loaded conversation (`resumeIfAwaitingGeneration` calls `addStreamingPath`), so no loaded render has the generation running but unflagged. The effect re-runs when the generation ends and when a later list reports the open chat unread. Nothing is written while a generation runs, so returning to a generating chat cannot add it to the viewed ids and a second departure still shows the dot.
- The panel's active-conversation sync keeps marking scheduler runs only: `ConversationPanelView` passes it a callback that ignores regular chats, because the panel cannot know whether the chat is generating.
- `Conversation.tsx`: the `startStream` wrapper calls `markConversationUnread` next to `bumpConversationActivity`.
- `ConversationPanelView.tsx`: after `useConversationPanelItems`, a memoized pass clears `isUnread` on the row whose id equals `panelActiveConversationId`. Without it the sent-and-watching chat would flash a dot while streaming.
- `libs/chat-hooks`: `useConversationPanelItems` passes `isUnread: true` for a regular DTO (kind stays Chat, `leadingIcon: undefined`); `useActiveConversationSync` is unchanged and stays generic.
- Alternative considered: a forced mark when `isStreaming` goes true to false, with the panel sync still marking regular chats. Rejected: the sync fires on every re-entry into the chat and wrote the id to the viewed ids while the stream was still running, so the dot never reappeared (found after the first implementation).
- Alternative considered: also treating an active entry in the app generation registry (`getGeneration`) or a pending-answer conversation shape as "generating". Rejected: the registry is not reactive, so an entry still active when `isStreaming` flips to false would leave the effect without a re-run and the chat stuck unread while open; and the shape check never clears for an empty answer.

### D7. Dot timing is "early"

The row is unread from the moment of send and hidden only while open, so leaving a generating chat shows the dot immediately. Hiding it until completion would need the listing to know about pending generations (a pending background message) or a completion event; deferred as a non-goal.

## Risks / Trade-offs

- [Two viewed-file read-modify-writes per message turn: un-view at start, view at finish] → files are small JSON, writes are best effort and serialized per provider on the client; revisit by merging into one file or a map if profiling shows cost.
- [Viewed file grows with chats used after the baseline] → one id per chat; acceptable for the expected volume, and a later change can prune ids whose chat was deleted (existing viewed file has the same property).
- [Lost update across tabs/instances shows one false dot or hides one dot] → last-writer-wins accepted, same as scheduler viewed ids.
- [`updatedAt` moves on rating, duplicate, import, other-device saves, so an old never-opened chat can show a dot] → accepted by the product owner; rename is handled explicitly (D5). Opening the chat clears it.
- [A stale list response overwrites the local unread (or local read)] → the existing request-ordering guard (`appliedListRequestIdRef`) rejects responses older than the last applied one; a response that started before the send and lands after can briefly flip the row back until the next list load. Acceptable; no extra state.
- [The server un-view fails but the client set unread locally] → the next list load reports the chat read and the dot disappears; low impact.
- [Baseline lazily written by a list request on a user who has never used regular chats] → harmless; the file only affects regular-chat unread.

## Migration Plan

1. Ship backend and frontend together; no data migration. The first list request after deploy writes `.client_data/.conversations-read-baseline.json`, so nothing is unread at rollout.
2. Revert the uncommitted unread-set draft at the start of apply (see `tasks.md`): `.client_data/.unread-conversations.json` was only ever written on a developer machine and is not read by any shipped code, so it needs no cleanup.
3. Rollback: stop reading the baseline and `.viewed-conversations.json` in the listing (regular chats lose `isUnread`) and revert the client pass-through; the two files may remain in client data harmlessly. The scheduled-task flow is unaffected throughout.

## Open Questions

- None blocking. Whether to prune viewed ids of deleted chats can be decided once the file size is observed in practice.
