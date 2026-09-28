## Context

The backend already owns each generation. `ConversationController.streamCompletion` keeps consuming the generator after the browser disconnects, and the generation is saved regardless (`backend-owned-generation-persistence`). The frontend can already rejoin a running generation. `createResumeIfAwaitingGeneration` (`libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts:171`) attaches to `POST /completions/attach`, which sends a snapshot, then live chunks, then a terminal event. When attach returns 404 or ends early, it falls back to `POST /watch`. Today only `loadConversation` triggers it (`apps/chat/src/pages/Conversation/Conversation.tsx:479`).

What is missing is the link between "the live stream broke" and "rejoin". `useConversationStream`'s `onError` (`useConversationStream.ts:475`) handles every non-conflict, non-upstream, non-persistence error as terminal, and the host then renders the banner. A second gap is detection: after sleep, the socket can be dead without `reader.read()` ever rejecting, and `/completions` emits no keepalive to measure silence against.

Constraint: `libs/chat-hooks` must stay host-agnostic (AGENTS.md §Library isolation). All I/O goes through `ConversationStreamTransport`. `createChatStreamApi` receives its base path and CSRF from the host (`apps/chat/src/server-api/chat-stream.api.ts`).

## Goals / Non-Goals

**Goals:**
- A dropped or stalled completion stream becomes a typed `StreamInterruptedError` in the built-in transport.
- The hook recovers by checking the server copy and rejoining through the existing resume flow.
- The live buffer and Stop are kept throughout recovery.
- `/completions` emits a keepalive, so both the client watchdog and intermediaries see traffic.

**Non-Goals:**
- Detecting a clean EOF without `[DONE]`.
- Re-sending a request that never reached the backend.
- Cross-replica attach.
- Responses API background mode.
- New UI or copy.

## Decisions

### D1. The transport detects, the hook reacts

The transport owns the bytes, so it alone can see "no byte for N s" or a rejected `read()`. It emits `StreamInterruptedError`, and the hook's recovery branch matches only that class.

- A custom transport that never emits the class keeps today's behavior, which makes the change additive.
- *Alternative:* the hook inspects `TypeError` messages. Rejected: they are browser-specific (`Failed to fetch`, `Load failed`, `NetworkError when attempting…`) and unstable.
- *Alternative:* a `transport.onInterrupted` callback. Rejected: it adds a sixth transport method for something an error subclass already expresses.

The idle watchdog lives in `createChatStreamApi`:

- It uses a timer re-armed on every received chunk.
- It also checks eagerly on `visibilitychange`→visible, `online` and `pageshow`. Browsers freeze or throttle timers during sleep and in background tabs, so waking is the moment to check.
- On stall it calls `reader.cancel()` and sets a local `settled` flag. The resulting `read()` resolution or rejection is then ignored, and `onError(new StreamInterruptedError())` fires exactly once.
- The caller's `signal` is never aborted. That signal belongs to `GenerationContext`, and aborting it would read as a user or supersede abort.

`idleTimeoutMs` defaults to 45 s, three times the 15 s keepalive. That tolerates one lost or delayed keepalive plus jitter. A shorter value risks false positives on slow proxies, and a longer one delays wake detection when the timer path fires first. The eager wake checks make detection time after a long sleep roughly zero regardless of the value. These are DOM-standard globals, guarded with `typeof window/document !== 'undefined'`. They are not host integration knowledge, so the isolation rule holds.

### D2. Recovery re-checks the server copy before choosing a path

The hook never assumes the generation is alive. It fetches the conversation, then classifies the result by the placeholder index it streamed into (`messageIndex`):

| Server copy | Meaning | Action |
|---|---|---|
| last index == `messageIndex`, `isAwaitingGenerationResume` | still running, or a terminal save that failed silently | hand over to resume (attach, then watch) |
| last index == `messageIndex`, assistant, not awaiting | finished while we were away | apply it, as `onComplete` does |
| anything else / all fetches failed | request never landed, or offline | existing banner path |

The re-fetch retries on rejection with delays of 1, 2, 4, 8 and 16 s, six attempts over about 31 s. An `online` event skips the pending delay. This covers a laptop whose Wi-Fi rejoins a few seconds after wake.

- *Alternative:* call attach directly, without the fetch. Rejected: a 404 would push every "already finished" case into the watch fallback, which waits up to 5 minutes for an update that has already happened.
- *Alternative:* retry indefinitely. Rejected: the composer would stay blocked with no feedback.

### D3. Reuse `createResumeIfAwaitingGeneration` through an internal entry point

The factory gets an internal variant, with the same closure body, that takes `{ seedMessage?, onSettled?, skipDedupe? }`. The public `resumeIfAwaitingGeneration(id, conversation)` keeps its signature and calls the variant with no options.

- `seedMessage` initializes `resumedBuffer.message` from the local live buffer instead of the server's empty placeholder. Before the attach snapshot arrives, navigating back or `restoreBufferedGeneration` then shows the partial answer, not a blank one. `finish()`'s persistence-warning test (`hasGeneratedPayload(resumedBuffer.message)`) keeps its meaning.
- `onSettled` runs once, after `finish()` or when ownership is lost. The hook uses it for the settlement bookkeeping `onComplete`/`onError` normally do: `removeStreamingPath`, clearing the active or stoppable refs, `completeGeneration`, `notifyGenerationSettled`, and `notifyGenerationEnd` unless the user stopped. Resume today does none of that, because it never had a local generation.
- Dedupe: recovery adds the path to `resumingPathsRef` when it starts. A host `loadConversation` that races it is therefore a no-op, and recovery owns the path. The handover passes `skipDedupe` so its own entry does not block it.

*Alternative:* write a second attach loop in `useConversationStream`. Rejected: it would duplicate a tested state machine that covers the snapshot/chunk merge, persistence-failure terminal events and superseding.

### D4. Stop survives recovery

`activeGenerationIdRef`, `activeGenerationPathRef` and `stoppablePath` are not cleared on interruption. `handleStop` therefore keeps working, because it only calls the backend, and the backend's abort surfaces through attach as `stopped`, or through watch as an update. That differs from a page-load resume, which has no `generationId` and hides Stop (`generation-resume-on-refresh`). `stoppedGenerationIdsRef` still suppresses `notifyGenerationEnd`.

### D5. Keepalive on `/completions` without corrupting frames

The keepalive is a `setInterval` started inside the `onReadyToStream` wrapper, right after `startSseResponse(res)`, and cleared in `finally`. It writes `SSE_KEEPALIVE_PAYLOAD` only when two conditions hold:

- `responseState === Streaming`;
- the last byte written to `res` was `\n`.

The line-boundary guard matters because the Chat Completions relay yields raw upstream `Uint8Array` slices (`conversation-streaming.service.ts:316`), which can end mid-line. A comment injected there would merge with the partial line on the client. A comment between complete lines is valid SSE, and our line parsers skip it. The handler tracks the boundary with one boolean, updated from each chunk's last byte (a string or a `Uint8Array`).

- *Alternative:* keepalive from inside the generator. Rejected: the relay's `for await` over upstream bytes cannot yield while it waits on the upstream.
- *Alternative:* SSE `retry:` or `EventSource`. Not applicable: we POST through `fetch`.

### Host adapters

No app change is needed. `apps/chat/src/server-api/chat-stream.api.ts` already builds the transport through `createChatStreamApi`, and it may pass `idleTimeoutMs` if ever needed. `logConversationStreamError` already receives every error through `onStreamError`, including the new class.

## Risks / Trade-offs

- **[Risk]** A spurious interruption, for example a frontend deployed against an older BFF without keepalive during a silent phase longer than 45 s. → Recovery is lossless: it re-fetches, then attaches and continues. The cost is one extra `getConversation` plus an attach. Frontend and BFF ship in one deploy.
- **[Risk]** The placeholder is left by a failed terminal save, not by a live generation. → Attach returns 404 and watch waits up to `GENERATION_RESUME_WATCH_TIMEOUT_MS`, 5 minutes, before the final check shows the persistence warning. This is today's page-load resume behavior, accepted as rare.
- **[Risk]** Attach lands on a different BFF replica and returns 404, so it falls back to watch. → The watch sees the final save. The user sees no progressive chunks until it finishes. That matches the existing refresh behavior, and cross-replica attach is out of scope.
- **[Risk]** The session expired during sleep, so `getConversation` returns 401. → The host's API client handles re-auth. If it still rejects, retries exhaust and the banner is shown, the same as today.
- **[Trade-off]** The composer stays blocked for up to about 31 s while offline recovery retries. The typing indicator makes the state visible, and Stop works.
- **[Trade-off]** `pageshow` / `visibilitychange` listeners exist per open stream. There is at most one stream per conversation path, and they are removed on settle.

## Migration Plan

1. Backend keepalive (D5): independent and safe on its own.
2. Transport `StreamInterruptedError` and the watchdog (D1): on its own, it only changes which error class reaches today's banner path.
3. Resume internal entry point and hook recovery (D2 to D4).
4. Docs and README.

Rollback: revert step 3 to return to the banner, and revert step 1 to remove the keepalive. Neither needs a data migration.

## Open Questions

- Should recovery also cover a clean EOF without `[DONE]`? That needs the BFF to guarantee a terminal marker to the client for both adapters. It is tracked as a follow-up, not needed for #8959.
- Is 45 s the right default for `idleTimeoutMs` behind customer proxies with aggressive buffering? It is configurable per host, and the default can be revisited after telemetry from `onStreamError`.
