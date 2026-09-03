## Context

`backend-owned-generation-persistence` already makes `ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) the sole owner of conversation persistence: it saves a start-state placeholder, assembles the assistant message chunk-by-chunk via `applyChunkToMessage` as it relays the upstream model response, and saves the final/partial state in `finalize()` regardless of whether the original HTTP request that started the generation is still connected. `ConversationController.streamCompletion` has no `res.on('close', ...)` handler (unlike its sibling `watchConversation`), so a closed tab does not stop generation or persistence.

`ConversationGenerationService` (`apps/chat-api/src/conversations/conversation-generation.service.ts`) tracks one in-memory registry entry per active generation, keyed by `${sessionId}::${path}`, holding only `{ generationId, abortController, status, startedAt }`. It answers "is a generation active for this path" (used for the 409 conflict check and `/completions/stop`), but not "what has it produced so far."

On the frontend, `chat-hooks-conversation-stream`'s `resumeIfAwaitingGeneration` (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` + `generation-resume.ts`) detects an unresolved assistant placeholder on load and subscribes to `POST /api/v1/conversations/watch` — a generic DIAL-Core resource-update SSE proxy also used for LLM-title-rename detection. On every `UPDATE` event it re-fetches the whole conversation via `transport.getConversation` and checks whether the placeholder resolved. Nothing about the in-flight content is ever surfaced: the user sees a typing indicator, then a jump straight to the finished message.

This design adds the buffering and multicast the prior resume-after-refresh design explicitly deferred ("would require the backend to buffer and multicast an in-flight completion to late subscribers — a materially bigger backend change, left for a future proposal if ever needed").

## Goals / Non-Goals

**Goals:**

- A client that opens a conversation mid-generation sees the assistant message populate progressively, not just a typing indicator until the terminal save.
- Support more than one late subscriber for the same generation (two tabs of the same login both open on the conversation).
- Zero behavior change to the generation owner's own stream, to persistence timing/shape (`backend-owned-generation-persistence` is untouched), or to the final "reload via `getConversation`, never trust the local stream" invariant.
- Graceful degradation: if the attach mechanism is unavailable for any reason (older backend during a rollout, no active generation, a transient error), the existing watch-then-refetch behavior is the fallback, unchanged.

**Non-Goals (explicitly deferred, per the proposal):**

- Optimistic concurrency / ETag-style conflict detection on `ConversationPersistenceService.saveConversation`.
- Changing `ConversationGenerationService`'s registry key from `sessionId::path` to a purely path-scoped key (so a different login session, e.g. a share-link viewer, cannot attach to someone else's generation) — attach reuses the exact same session-scoped lookup `abort()` already uses.
- Wiring in the dead `ChatCompletionsAdapter` / removing the duplicated `relayModelCompletion` — only touched if the multicast hook naturally lands inside that method; not a required outcome.
- Any new UI: a resumed view is visually indistinguishable from a locally-started stream. No new components, i18n keys, or RTL-relevant markup.

## Decisions

### 1. Buffer the assembled message and multicast chunks from `ConversationGenerationService`'s existing registry entry

Extend `GenerationEntry` with:

- `assembledMessage: ConversationMessageDto` — the same object `finalize()` already builds incrementally as `applyChunkToMessage` runs; kept up to date on every chunk instead of only read at the end.
- `emitter: EventEmitter` (Node's built-in `node:events`, no new dependency) — `relayModelCompletion`/`ResponsesAdapter.stream`'s existing per-chunk loop in `conversation-streaming.service.ts` emits each outgoing raw chunk payload on this emitter (`emitter.emit('chunk', payload)`) in addition to yielding it to the original request's response. `finalize()` emits a terminal event (`'done' | 'error' | 'stopped'`) before the registry entry is deleted.

Alternatives considered: a separate `GenerationSnapshotService`/dedicated pub-sub module. Rejected — the registry already is the single source of truth for "is this generation active," and splitting live state into a second service reintroduces the exact race the registry was built to avoid (two places that can disagree about whether a generation is still active).

### 2. New dedicated endpoint, not an overload of `/watch`

Add `POST /api/v1/conversations/completions/attach` (SSE), living in `ConversationController`/`ConversationStreamingService` alongside `/completions` and `/completions/stop`, rather than extending `watchConversation`. `watchConversation` is a generic DIAL-Core resource-event proxy with no knowledge of generation internals; folding generation-replay logic into it would blur a single-purpose controller method into two unrelated concerns. `AttachGenerationDto` request body carries only `{ path }` (mirroring `WatchConversationBodyDto`) — the resuming client does not have a `generationId` to send, only the path (see Decision 3).

Wire protocol on the SSE response (one JSON object per `data:` line, consistent with this app's existing "data:{json} lines" convention rather than named SSE `event:` fields):

```
{ "type": "snapshot", "message": <ConversationMessageDto> }   // sent once, immediately on attach
{ "type": "chunk", ...<same fields chat.completion.chunk carries today> }
{ "type": "done" } | { "type": "error", "message"?: string } | { "type": "stopped" }
```

The `snapshot` message is the full `ConversationMessageDto` as currently assembled — including any merged `custom_content.stages` — not just plain text, so a late subscriber's initial render is indistinguishable from having received every prior chunk live.

### 3. Lookup by path through the existing session-scoped key, not by `generationId`

A resuming client only knows the conversation path — the `generationId` lives solely in the tab that started the stream. The attach handler resolves the caller's `sessionId` from the session cookie (same as `abort()` does) and looks up `buildKey(sessionId, path)` in the registry. This means only the same login session that could stop a generation can attach to replay it — no new access-control surface is introduced. (A different session viewing the same path — e.g. two independent logins, or the known "session-scoped registry" gap — gets a 404 exactly as if no generation were active; that gap is out of scope here, see Non-Goals.)

If no entry exists for the key, respond 404. The frontend treats a 404 (or any attach failure — network error, older backend without the route, unexpected shape) identically: fall back to today's `transport.watchConversation` + refetch loop. This makes the rollout order-independent — a new frontend against an old backend (no `/attach` route yet) degrades to exactly today's behavior with no special-casing needed.

### 4. Synchronous snapshot-then-subscribe to avoid a lost-chunk race

Node is single-threaded; as long as capturing `entry.assembledMessage` and calling `entry.emitter.on('chunk', handler)` happen in the same synchronous block (no `await` between them), no chunk emitted by the generation loop can land in the gap between "read the snapshot" and "start listening." The attach handler is written to do exactly that — read, then attach, synchronously — before any response headers are flushed.

### 5. Frontend: attach first, existing watch-then-refetch as the fallback, reload-after-terminal unchanged

`resumeIfAwaitingGeneration` tries `transport.attachToGeneration(path, signal)` first. On the `snapshot` event, it seeds the per-path buffered message (the same buffer `restoreBufferedGeneration`/`bufferedGenerationsRef` already maintains for a locally-started stream) and displays it immediately if the path is shown. Each `chunk` event runs through the exact same `applyChunkToMessage` merge path `startStream`'s `onChunk` uses today — no parallel implementation. A terminal event (`done`/`error`/`stopped`) triggers the same `transport.getConversation` reload the normal completion/error path already performs — `chat-hooks-conversation-stream`'s "reload-after-complete, never trust the local stream" requirement is preserved unchanged: the attach stream only makes the *interim* view richer, the final content is still only ever taken from the backend's own save. If attach fails outright (404, network error, or a malformed/unexpected response) or the attach stream ends without a terminal event before `GENERATION_RESUME_WATCH_TIMEOUT_MS` elapses, the hook falls back to exactly today's `watchConversation`-based loop, unchanged.

New surface on `ConversationStreamTransport` (`libs/chat-hooks`): `attachToGeneration(path: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>>`, mirroring `watchConversation`'s existing shape (raw stream, parsed by the hook) rather than a callback-based API — this keeps the transport interface's existing pattern (thin, host-agnostic, no parsing logic baked into the interface itself) instead of introducing a second style alongside it. The concrete implementation (`apps/chat/src/utils/conversation-stream-transport.ts`, `apps/chat/src/server-api/chat-stream.api.ts`) does a raw `fetch POST` against `${ApiEndpoints.CONVERSATIONS}/completions/attach`, matching `watchConversation`'s existing implementation shape.

### 6. Attach subscribers detect client disconnect; the generation owner's stream still does not

Unlike `ConversationController.streamCompletion` (deliberately has no `res.on('close', ...)` — the whole point of backend-owned persistence is that closing the tab must not stop generation), the new attach endpoint **does** register `res.on('close', ...)` and unsubscribes its emitter listener on disconnect, exactly like `watchConversation` does today. An attach subscriber is a read-only late observer, not the generation's owner; leaving its listener attached after the client disconnects would leak emitter listeners for the lifetime of the generation.

## Risks / Trade-offs

- **[Risk]** Many late subscribers on one generation could accumulate `EventEmitter` listeners past Node's default max-listeners warning threshold (10). → **Mitigation**: call `emitter.setMaxListeners(0)` (unlimited) on creation; each subscriber removes its own listener on terminal event or client disconnect, so steady-state listener count tracks concurrently-open tabs, not cumulative history.
- **[Risk]** A generation that fails to finalize cleanly (an unexpected exception bypassing `finalize()`) would leave an attach subscriber waiting forever. → **Mitigation**: reuse the existing `GENERATION_RESUME_WATCH_TIMEOUT_MS` constant as a client-side backstop for the attach path too — on timeout, abort and fall back to `finalCheck`/`getConversation`, identical to today's behavior for the watch path.
- **[Risk]** Duplicating "how to interpret a chunk" logic between the original stream's `onChunk` and the attach path's chunk handling. → **Mitigation**: explicitly reuse the same `applyChunkToMessage`/merge function for both — the attach path is a new *source* of chunks, not a new *interpretation* of them.
- **[Trade-off]** The snapshot+multicast buffer is purely in-memory and tied to the existing registry entry's lifetime — it is not persisted, so a backend process restart mid-generation loses replay capability exactly as it already loses the registry entry itself today (a pre-existing, unchanged characteristic of the in-memory registry design). No new durability guarantee is introduced or implied.

## Migration Plan

Purely additive: a new endpoint, an extended (not restructured) registry entry shape, and a new transport method with a client-side fallback to unchanged existing behavior. No data migration, no schema change to persisted conversations. Rollback is a plain revert — the in-memory registry holds no state that outlives a process restart, so there is nothing to clean up. Backend and frontend can deploy in either order without a compatibility window: an old frontend never calls the new endpoint; a new frontend against an old backend gets a 404/route-not-found and falls back to the pre-existing watch behavior automatically.

## Open Questions

- Should a share-link viewer (different session/bucket than the generation owner) ever see live replay? Today's answer is no (session-scoped lookup, consistent with the existing `abort()` boundary) — confirm this matches product expectations, since it means a shared conversation's live-in-progress view still only shows a typing indicator to anyone but the original session.
- Whether to eventually collapse this endpoint and `watchConversation`'s display-name-update use case behind one generic "conversation activity" channel is left for a future change, not this one — the two archived changes already accepted running two independent `/watch`-shaped subscriptions concurrently as a known, non-deduplicated pattern.
