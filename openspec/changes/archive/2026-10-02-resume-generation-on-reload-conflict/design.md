## Context

`ConversationPage.loadConversation` (`apps/chat/src/pages/Conversation/Conversation.tsx:478-516`) branches on the loaded conversation's last message:

- **User message:** it appends a local assistant placeholder and auto-starts a `ContinueLastUser` stream. The only duplicate guard is client-local: `autoStartedPathsRef` and `getGeneration(path)?.status`.
- **Unresolved assistant placeholder:** it calls `resumeIfAwaitingGeneration`, which attaches, falls back to watch, and finishes with a final `getConversation` (`libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts`).

The backend saves its start state (user + empty placeholder) only after registering the generation, resolving the deployment and reading the conversation (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts:549-662`). For a new conversation, storage holds a user-last conversation for that window. `ConversationRoute` saved it before navigating.

A reload in that window takes the user-last branch. The backend still has generation A registered for the same principal: cookie `sid` survives reload, and there is one pod. So `register` throws `409`, and the transport raises `GenerationConflictError` before any SSE byte is sent. `useConversationStream.onError` then goes to `settleAsFailed`. That path writes `generationConflictMessage` onto the placeholder, releases the streaming state, and never re-reads the conversation. A's answer is persisted but never shown. Regenerate, rate or delete from that stale UI can then replace or clobber it.

The hook already has the pattern this needs. `recoverInterruptedStream` handles `StreamInterruptedError` this way:

1. Keep the path streaming.
2. Re-fetch with `fetchConversationForRecovery`, using the `RECOVERY_REFETCH_DELAYS_MS` backoff.
3. Classify the result as still generating (hand over to the resume flow), finished (apply the server copy), or not recoverable (settle as failed).

## Goals / Non-Goals

**Goals:**

- A load-time auto-start that hits `409` ends on the persisted answer of the generation that is already running.
- This works whether the server copy is still user-last (pre-start) or already holds the placeholder.
- A user-initiated send that hits `409` keeps today's conflict message (#8688).
- The hook does not hang on a watch update that landed before its subscription opened.

**Non-Goals:**

- `If-Match` or other optimistic concurrency for client conversation `PUT`s.
- Multi-pod registry behaviour.
- Exposing Stop for the joined generation.
- Any backend or API change.

## Decisions

### D1. Opt-in per start: `startStream(..., options?: { resumeOnConflict?: boolean })`

The flag is a trailing optional argument. It mirrors the existing optional `generationId` and `mode` arguments, so every current call site compiles unchanged. `UseConversationStreamResult.startStream` and `ConversationStreamStarter` gain the same optional parameter. The options object is exported as `StartStreamOptions`.

The app decides when a conflict means "join". `ConversationPage`'s load-time auto-start passes `{ resumeOnConflict: true }`; nothing else does.

- *Alternative: key off `mode === ContinueLastUser`.* Rejected. `AppPreviewChat` also uses `ContinueLastUser` for a user-initiated submit, and the meaning would be implicit.
- *Alternative: resume on every conflict.* Rejected. It would drop a second tab's freshly typed message (#8688).

**Library isolation:** the lib receives a resolved boolean. It still talks only to the injected `ConversationStreamTransport` and learns nothing about routes, storage or app state.

### D2. Conflict handover reuses the recovery classification, waiting out the pre-start window

When `onError` receives a `GenerationConflictError` for a non-superseded start with `resumeOnConflict`:

1. **Report, don't settle.** Call `onStreamError` once. Do not write `streamErrorMessage`. Keep the path in `streamingPaths`. Clear `stoppablePath` for this generation: its `generationId` was rejected, so Stop has nothing to target. Add the path to `resumingPathsRef` so a concurrent `resumeIfAwaitingGeneration` is a no-op.
2. **Re-fetch** with `transport.getConversation`, on the same `RECOVERY_REFETCH_DELAYS_MS` schedule as recovery. A result counts as pending, and is retried on that schedule, while the server copy is in the pre-start shape: `messages.length === messageIndex` and the last message is a user message. The backend has not saved its start state yet. A rejected fetch is retried as today. The total bound is about 31 s. The pre-start window is a few DIAL Core round trips.
3. **Classify** the first non-pending result exactly as recovery does:
   - **Still generating:** placeholder at `messageIndex`, or a pending background message. Hand over to the resume flow with the server copy. Settlement bookkeeping runs when the resume settles.
   - **Finished:** assistant message at `messageIndex`, not awaiting. Apply the server copy and clear the buffer.
   - **Not recoverable:** any other shape, retries exhausted, or still pre-start at the bound. Settle through the existing conflict path, writing `generationConflictMessage`. This is today's behaviour, now reached only after the server copy has been consulted.

`fetchConversationForRecovery` gains an optional `isPending(conversation)` predicate. A pending result is treated like a rejection for scheduling purposes. Recovery passes none, so its behaviour is unchanged.

- *Alternative: hand over immediately, seeding the resume with the local placeholder and attaching while the server copy is still user-last.* Rejected. It needs a new resume entry shape with its own terminal rules for a user-last result. The only gain is roughly one second of earlier progressive display.
- *Alternative: probe `attachToGeneration` before every load-time auto-start.* Rejected. It adds a round trip, and it still needs the `409` path for the race between the probe and the start.

### D3. Resume watch re-checks once its subscription is open

`runWatch` currently only reacts to `UPDATE` events that arrive after it subscribes. A handover whose attach misses the generation can therefore wait the full `GENERATION_RESUME_WATCH_TIMEOUT_MS` (5 min) for an update that already happened. That is the case where A finished between the re-fetch and the attach request.

After `transport.watchConversation` resolves, `runWatch` performs one `getConversation`. If that copy is no longer awaiting resume, it finishes immediately. Otherwise it keeps watching as today. Subscribe-then-check closes the lost-update gap for the refresh flow and the recovery handover too. It adds one `GET` only on the attach-fallback path.

### D4. Stale-PUT exposure is closed by state, not by a new save guard

During the handover the path stays in `streamingPaths`. The existing `isStreaming` guards keep Regenerate, Edit and starters inert (`generation-resume-on-refresh`). The handover ends by applying the server copy. So rate and delete never act on a conflict placeholder in this scenario.

Implementation must verify that rate and delete controls are unavailable for the in-flight message while the path is streaming. If either is reachable, it must get the same `isStreaming` no-op guard. General `If-Match` client saves stay out of scope.

## Risks / Trade-offs

- **A dies before saving its start state.** The server copy stays user-last until the bound, then the hook settles with the conflict message, which is today's outcome. → Acceptable. It is a pre-existing failure mode, now reached after about 31 s of typing indicator instead of immediately.
- **Typing indicator with no Stop for up to about 31 s.** Rare: only a reload inside a sub-second window. → It matches the existing "no Stop while resuming without a local generation id" rule.
- **A real second-tab conflict on a load-time auto-start.** Two tabs open the same fresh conversation and both auto-start. The second tab joins the first one's generation. → This is the desired result: both tabs end on the one answer, and no user message is lost, because the auto-start sends no new text.
- **D3 adds one `GET` on the attach-fallback path.** → Negligible. It runs only when attach is unavailable.

## Migration Plan

Additive and non-breaking. Deploy with the frontend. Rollback is a revert of the commit, with no persisted data, DTO or wire format involved. Hosts that do not pass `resumeOnConflict` see no change, except D3's extra check on the watch-fallback path.

## Open Questions

- Should the QA scenario be reproduced before implementation? Reproduction steps: hold the backend before its start-state save, for example with a breakpoint after `register`, then reload. That would confirm this is the path QA hit. The fix is correct regardless.
