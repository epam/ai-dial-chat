## Context

`ConversationController.streamCompletion` (apps/chat-api/src/conversations/conversation.controller.ts) drains an async generator, `ConversationStreamingService.streamCompletion`, with a plain `for await (const chunk of stream) { res.write(chunk); }`. Every other SSE-shaped handler in this controller (`attachToGeneration`, `watchConversation`) registers `res.on('close', handleClose)` to react to an early client disconnect; `streamCompletion` does not.

The generator's terminal bookkeeping — persisting the final/partial conversation and releasing the `ConversationGenerationService.registry` entry via `finalize()` — lives entirely *after* its internal relay loop (`while (!next.done) { yield next.value; ... }`, conversation-streaming.service.ts:651-655). When the controller's `for await` is abandoned early (the only way that happens today: the HTTP response closes, `res.write` throws, or the request handler's promise is otherwise torn down), the JS runtime calls `.return()` on the generator at its current `yield`. An async generator's `.return()` unwinds the generator function as if a `return` statement executed at that point — it does **not** resume execution after the loop, so every line after `while (!next.done) { ... }` is skipped, including `finalize()`.

This leaves the registry entry `Active` forever (until the 30-minute `evictStale` sweep), holding an `EventEmitter` (intentionally `setMaxListeners(0)`) and the full assembled message. This is the confirmed root cause of the reported gradual chat-api pod OOM: registry entries accumulate under normal disconnect traffic (tab closes, navigation, flaky networks) faster than the 30-minute sweep reclaims them.

## Goals / Non-Goals

**Goals:**
- Guarantee `finalize()` (and therefore `generationService.complete()`/`.error()`) runs exactly once for every generation, including when the client disconnects before the upstream relay finishes.
- Guarantee the upstream DIAL Core request is promptly aborted when the client disconnects, instead of continuing to completion for an abandoned response.
- Keep the persisted-conversation semantics already specified in `backend-owned-generation-persistence` (partial message with `streamErrorMessage` on any non-`[DONE]` termination) — a disconnect is just another abort path into the existing `finalize()`.

**Non-Goals:**
- Changing the 30-minute `evictStale` TTL sweep in `ConversationGenerationService` — it remains as the backstop for cases this fix cannot cover (e.g. an unhandled exception that kills the process before `finally` runs).
- Any change to the SSE wire format, DTOs, or the `/api/v1/conversations/completions` contract — this is an internal reliability fix, not an API change.
- Deduplicating the `res.on('close', ...)` disconnect pattern across the three SSE handlers into a shared helper — out of scope for this fix; each handler's loop shape differs enough (plain relay vs. keepalive-timer vs. dual-emitter) that forcing one abstraction now would risk the fix itself. Worth a follow-up if a fourth handler appears.

## Decisions

**1. Wrap the generator's relay loop in `try/finally`, not the controller's `for await`.**

The controller cannot force the generator to run its cleanup — `.return()` unwinds the generator itself, so the fix has to live inside `ConversationStreamingService.streamCompletion`: put the existing `while (!next.done) { yield next.value; next = await relayIterator.next(); }` loop and the `switch (relayResult.outcome)` block that follows it inside a `try`, and call `finalize()` from a `finally` when the loop was abandoned early (i.e. `next.done` never became `true` through normal completion).

Concretely: track whether the relay finished normally (`next.done === true` reached), and in `finally`, if it did not, treat it the same as today's `'aborted'` outcome — reuse the existing `getStatus(...) === Stopped` check to distinguish a user-initiated stop from a bare disconnect, and call `finalize(GenerationStatus.Stopped | GenerationStatus.Error, partialMsg)` with whatever `assembledMessage` snapshot is available at that point (the same value already threaded through `publishChunk`/`applyChunk` — no new state needed since it is kept current on every chunk).

*Alternative considered:* catch the abandonment in the controller and call a new `ConversationService`-level "force finalize" method. Rejected — it would need to duplicate `finalize()`'s persistence/registry logic (or expose internals across the service boundary) and still couldn't distinguish stop/error the way the generator's own `finally` naturally can, since only the generator holds `relayResult`/`assembledMessage` state at the point of abandonment.

**2. Add `res.on('close', ...)` to `streamCompletion`, aborting the same `AbortController` the generator already uses.**

Mirror `attachToGeneration`/`watchConversation`'s existing pattern exactly: register `handleClose` before entering the `for await`, have it call `abortController.abort()` (the same controller `ConversationGenerationService.register` already returns and that feeds `relayModelCompletion`'s `signal`), and deregister it in a `finally` in the controller alongside the existing `res.end()` guard.

This is what actually stops the upstream DIAL Core request promptly; decision 1 alone would only ensure bookkeeping happens once the generator unwinds; it would not, on its own, cancel the in-flight `fetch`/reader against DIAL Core (which decision 1's `finally` reaches because the same abandonment path already flows through the generator's cleanup) or prevent the wasted upstream traffic and socket usage for a response nobody will read.

**3. A disconnect is finalized as `Error` (or `Stopped`, if the user had already pressed Stop), never introduces a new `GenerationStatus`.**

No new terminal state, no new persisted marker. This keeps `backend-owned-generation-persistence`'s existing outcome table intact — a disconnect just becomes one more way to reach the already-specified "aborted for any other reason" row (`streamErrorMessage: ''`).

## Risks / Trade-offs

- **[Risk]** A `finally` that fires on *every* abandonment path (including the already-handled `'aborted'`/`'rejected'`/`'error'`/`'completed'` outcomes reached via normal loop completion) could double-call `finalize()`. → **Mitigation**: guard the `finally` with the same "did the loop complete normally" flag; `finalize()` itself is also naturally idempotent against a missing registry entry (`generationService.complete`/`.error` both no-op via their `entry?.generationId === generationId` guard), so even a residual race is inert, not a second persistence write with stale data — but the flag keeps the intended behavior explicit rather than relying on that guard alone.
- **[Risk]** Persisting a partial conversation on every disconnect (rather than leaving it silently active) changes observable behavior for flaky-network users: a page refresh mid-stream will now show a "stopped"/error-marked partial message instead of an empty placeholder that a resume could still complete into. → **Mitigation**: this matches the `generation-resume-on-refresh` capability's existing contract for other abort paths (stop/error already behave this way); disconnect was the one path inconsistently exempted, so this removes an inconsistency rather than introducing new user-facing behavior. Flag for QA verification during apply.
- **[Trade-off]** The fix only closes the leak for the "controller loop abandoned" path. A process-level crash mid-generation (OOM itself, uncaught exception outside this generator) still relies on the 30-minute TTL sweep — accepted as a Non-Goal; the TTL sweep already exists precisely for that residual case.

## Migration Plan

No data migration. Deploy as a normal chat-api release. Rollback is a plain revert — the change touches only in-process control flow, no persisted schema or API contract.

## Open Questions

None — the fix direction reuses existing `finalize()`/`abort()` semantics with no new state machine.
