# Design

## Context

See proposal.md (Why) for the motivation and specs/ for the required behavior.

Current state that shapes the approach:

- **Backend failure path.** `finalize` in `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts` catches the rejected terminal write and settles the registry entry (`persistenceFailed` in `apps/chat-api/src/conversations/conversation-generation.service.ts`). It then yields `{ error: GENERATION_PERSISTENCE_ERROR }`, a constant in `apps/chat-api/src/conversations/generation/persistence-error.ts`.
  - The caught error is already a Nest `HttpException`. `handleDialSdkError` maps a DIAL Core `401` to `UnauthorizedException`, and an unreachable DIAL Core to `503`.
  - The registry entry is released before the frame is sent, so a client save of the same path is not rejected as "already generating".
- **Client failure path.** `createChatStreamApi` (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts`) maps an error chunk whose `error.type` is `conversation_save_failed` to `new GenerationPersistenceError()`. `settleAsFailed` in `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` then:
  - writes the host warning into the buffered message,
  - releases the generation,
  - restores the buffer into the displayed conversation, when the conversation is displayed and the generation was not superseded.
- **The client save already exists.** It is `PUT /api/v1/conversations?path=…`: `saveConversation` in `apps/chat/src/server-api/conversations.api.ts`, handled by `saveClientConversation` in `conversation-streaming.service.ts`.
  - It merges client messages with the stored copy, and neutralizes foreign pending background messages.
  - Like every protected request, it passes the cookie session strategy, which refreshes an access token that is close to expiry. That is why it can succeed where the terminal save, which holds the token captured at stream start, did not.
  - Its body is bounded by `CONVERSATION_BODY_SIZE_LIMIT_BYTES` (`apps/chat-api/src/main.ts`).
- **The SSE frame is not in the OpenAPI document.** `libs/chat-api-client/openapi.json` has no `conversation_save_failed` schema, so adding a field needs no client regeneration.

## Goals / Non-Goals

**Goals:**

- Add one recovery write, limited to the `401` persistence-failure branch, that cannot affect the normal completion path or any other failure.

**Non-Goals:**

- No retry loop, no backoff, and no user-initiated retry.
- No new error type, flag, or wire field beyond the one `status` number.

## Decisions

### D1: Carry the cause as the HTTP status on the existing error envelope

In `finalize`'s `catch`, record the status only when the terminal status is `Done`: `status === GenerationStatus.Done && err instanceof HttpException ? err.getStatus() : undefined`. A stopped, aborted, or failed answer is written with markers the client buffer never receives (`wasStoppedByUser`, `streamErrorMessage: ''` for an abort, or the upstream error text). A client copy of such an answer would silently drop them, saving a cut-off answer as complete, so those outcomes keep today's warning. Emit it as `status` next to the constant's `type` and `message`. Build the envelope with a small helper next to `GENERATION_PERSISTENCE_ERROR`, so the constant stays the single source of `type` and `message`. Attach events and the background path are untouched: they never trigger a client save.

*Alternatives:*

- **A string reason enum** (for example `reason: 'unauthorized'`). It adds a taxonomy to maintain, for one value, so it was rejected. A status code is self-describing, and it carries no upstream detail.
- **No field at all.** The client cannot then limit the retry to `401`, so it was rejected (see the proposal's alternatives).

### D2: Parse `status` locally in `createChatStreamApi`

`GenerationPersistenceError` gains an optional, readonly `status?: number`, set by its constructor. The parser reads `error.status` only for a `conversation_save_failed` chunk, and only when `typeof status === 'number'`.

The shared `StreamChunk` type in `libs/chat-shared/src/models/chat.ts` is **not** changed. Its `error` shape describes DIAL Core's in-band errors. The parser narrows the one extra field locally, so the change stays inside `libs/chat-hooks` and does not touch a third package.

The hook compares the status against a module-level `401` constant in `useConversationStream.ts`. It mirrors how `create-chat-stream-api.ts` keeps `GENERATION_CONFLICT_STATUS`, and does not widen the public API.

### D3: Run the recovery from `settleAsFailed`, in the `startStream` closure only

The closure already holds everything the recovery needs:

- the generation id and the path,
- the conversation id,
- `isSuperseded`, `isPathDisplayed` and the mounted ref,
- the captured buffer.

Attach and resume flows (`generation-resume.ts`) are not touched, so a second tab watching the same generation never writes. A small local helper starts the recovery with `void`. It handles its own errors, so nothing is left unhandled.

A short block comment at the branch states the case it covers, and why only `401`: the write was refused, so it cannot have been committed.

### D4: Defer the warning, and reuse the existing warning code for the failure

When the recovery applies, `settleAsFailed` does everything it does today **except** writing the warning text:

- it releases the generation,
- it keeps the buffer.

It does not re-apply the buffer to the displayed conversation: `onError` has already flushed the frame scheduler, and `onChunk` has already displayed every chunk.

The code that writes the warning (into the buffered message, and into the displayed message when the conversation is still displayed and the generation was not superseded) is extracted into one local function. It is called immediately on the unchanged path, and by the recovery on failure. The failure path therefore stays identical to today's warning, just later.

*Alternative:* show the warning first and clear it on success. Rejected: it flashes for up to a couple of seconds on every successful recovery.

### D5: Read the stored conversation, restore the buffer, then save

The recovery calls `transport.getConversation(safeDecodeURI(currentConversationId))`, exactly as `reloadConversation` does. It then applies `restoreBufferedMessage(stored, buffered)` and calls `transport.saveConversation(conversationPath, merged)`.

Because the warning was never written (D4), the buffered message is saved exactly as received.

*Alternative:* save `conversationRef.current`. Rejected:

- it holds a different conversation once the user has navigated away;
- it may miss server-side fields of the stored copy.

### D6: Guard every await against ownership changes

After the read and after the save, the recovery stops changing state when any of these is true:

- the hook is unmounted,
- the generation was superseded,
- the path's buffer is no longer the captured one.

When the conversation is not displayed, the save still proceeds, but no displayed state is changed.

On success, the recovery deletes the buffer, if it is still the captured one. If the conversation is displayed and the generation was not superseded, it also sets the returned saved conversation as the displayed state, and updates `conversationRef`.

### D7: Optional transport method, implemented by the existing app adapter

```ts
saveConversation?(path: string, conversation: Conversation): Promise<Conversation>;
```

`apps/chat/src/utils/conversation-stream-transport.ts` implements it by delegating to `saveConversation` in `apps/chat/src/server-api/conversations.api.ts`, with the same `Conversation` / `ConversationResponseDto` casts its `getConversation` already uses. The lib still names no endpoint and holds no client (AGENTS.md "Library isolation"). There is no new endpoint, no generated-client change, and no new authorization: the existing save endpoint already requires the caller's session.

## Risks / Trade-offs

- **[Risk] The session itself is gone** (the user logged out, or the refresh token expired), so the recovery also gets `401`. → Today's warning is shown, just after a short delay.
- **[Risk] The user sends the next message, or reloads, while the recovery runs** (about a second). → The previous answer can be missing from history, which is exactly today's outcome. The recovery never overwrites the newer generation (D6).
- **[Risk] The tab is closed before the stream ends.** → No client recovery is possible. This is accepted as out of scope.
- **[Risk] A very large conversation exceeds `CONVERSATION_BODY_SIZE_LIMIT_BYTES`.** → The save is rejected and today's warning is shown.
- **[Risk] The stored conversation is not this turn's start state.** For example, the start-state save also failed, so storage still holds the pre-edit conversation, or the conversation was changed elsewhere. → The recovery reuses the terminal reload's check (the answer's index is the last message and is still the unsaved placeholder, `isAwaitingGenerationResume`). Any other stored copy is not saved over, and today's warning is shown.
- **[Limitation] The conversation-level citation pool is not updated.**
  - The backend's terminal write also merges the answer's `html_tag` citation annotations into `customViewState.annotations` (`mergeHtmlTagAnnotationsIntoViewState`). The client save does not.
  - The recovered answer's own citations still resolve, because they are stored on the message.
  - What is lost: a **later** answer that cites `<cit data-id>` from the recovered answer, without repeating the annotation, will not resolve through the fallback pool that `apps/chat/src/hooks/conversation/useConversationAnnotationPool.ts` reads.
  - Accepted as a rare, cross-turn agent case. A follow-up could apply the same merge in `saveClientConversation`.
- **[Assumption] A `401` from DIAL Core means nothing was stored.** Authentication happens before the write is processed. In the production failures, the read that precedes the write was rejected the same way, with `Bad Authorization header`.
- **[Trade-off] No user-visible signal while the recovery runs.** → This is accepted, because the answer stays displayed, and a failure ends in the same warning as today.

## Migration Plan

Ship the backend field, the lib, and the app adapter together; there is no data migration. Mixed versions are safe:

- an old client ignores `status`;
- a new client with an old backend sees no `status` and keeps today's behavior.

Rollback is a plain revert.
