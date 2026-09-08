## Why

`ConversationController.streamCompletion` OOMs `apps/chat-api` pods gradually under normal traffic: when a client disconnects mid-stream (tab closed, navigation away, network drop), the controller's `for await` loop over `ConversationStreamingService.streamCompletion` exits early. JS injects a `.return()` into the async generator at its current `yield`, so the generator never reaches its post-loop `finalize()` call — `generationService.complete()`/`.error()` never fires. The `ConversationGenerationService.registry` entry (an `EventEmitter` with unbounded listeners plus the full assembled message text) is left `Active` and only reclaimed by the lazy 30-minute stale-entry sweep. Under sustained disconnect traffic, entries accumulate faster than that sweep reclaims them, causing the reported gradual, load-correlated memory growth (currently masked by giving pods more memory; each restart causes a brief blip, not a full outage).

## What Changes

- `ConversationController.streamCompletion` registers a `res.on('close', ...)` handler that aborts the request's `AbortController` on client disconnect, mirroring the existing pattern in `attachToGeneration`/`watchConversation`.
- `ConversationStreamingService.streamCompletion` guarantees its terminal cleanup (`finalize()` → `generationService.complete()`/`.error()`) runs even when the consuming `for await` exits early (client disconnect), not only when the relay loop completes normally — via a `try/finally` around the relay/yield loop inside the async generator.
- A disconnect mid-stream is finalized as an error/stopped outcome (partial assistant message persisted, registry entry released), consistent with how other abort paths are already handled by `finalize()`.

### Modified Capabilities

- `backend-owned-generation-persistence`: adds the requirement that a client disconnect mid-stream also finalizes and persists the partial conversation, not only an upstream `[DONE]`/socket-close/relay-abort.
- `generation-registry`: strengthens the existing stale-eviction backstop with a requirement that an entry is proactively released as soon as its owning request's client disconnects, instead of relying solely on the 30-minute TTL sweep.

## Impact

- `apps/chat-api/src/conversations/conversation.controller.ts` (`streamCompletion` handler)
- `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts` (`streamCompletion` async generator)
- `apps/chat-api/src/conversations/conversation-generation.service.ts` (no code change expected; behavior verified via existing `registry`/`evictStale` contract)
- No API contract change, no DTO change, no OpenAPI regeneration needed — purely internal cleanup-reliability fix.
