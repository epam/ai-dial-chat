## Why

PR #8640 ("fix(chat-api): release generation registry entry on client disconnect") fixed a real registry leak, but applied client-channel disconnect semantics to the wrong SSE lifecycle. `POST /api/v1/conversations/completions` owns a durable backend generation that is contractually independent of the browser connection that started it — `app-level-generation-manager` requires an in-progress completion to survive navigation, and the archived `generation-live-replay` spec explicitly documents `ConversationController.streamCompletion` as having "no client-disconnect handling, by design, so a closed tab does not stop generation." #8640's `res.on('close', ...)` handler now calls `ConversationGenerationService.abortSignal()`, which aborts the upstream DIAL Core request and persists the partial message as an `Error` outcome the moment the browser tab closes, refreshes, or navigates away — silently truncating answers that would otherwise have completed normally. `openspec/specs/generation-live-replay/spec.md` was left unchanged by #8640 and still states the opposite of what `backend-owned-generation-persistence` and `generation-registry` now require, so the canonical specs currently contradict each other.

## What Changes

- `ConversationController.streamCompletion` no longer aborts the generation or breaks its consuming loop when the downstream HTTP response closes. It marks the response detached and suppresses further `res.write` calls, but keeps draining the completion generator to its natural terminal outcome.
- `ConversationGenerationService.abortSignal()` (added by #8640, now unused) is removed. Client-driven abort remains exclusively `abort()`, invoked only by explicit `POST /conversations/completions/stop`.
- `ConversationStreamingService.streamCompletion`'s `finally` branch — which currently treats every abandoned consumer as a disconnect-triggered error — is narrowed to remain a defensive backstop for a consumer that is abandoned for reasons other than the downstream response closing (an unexpected exception unwinding the generator early). A closed response no longer causes the consuming loop to be abandoned at all, so this path is not reached on ordinary disconnect/navigation/refresh.
- On a normal upstream terminal event (`[DONE]`, provider error, or explicit Stop), persistence and registry release behave exactly as before — this change does not touch the `finalize()`/outcome-table semantics themselves.
- A new server-owned bound is added so a generation that a client can no longer act on (disconnected, and the tab never comes back) cannot run upstream indefinitely: a max-duration timeout, independent of the client connection, forces the generation to a terminal `Error` state and releases the registry entry if the upstream never reaches `[DONE]`/error within that window. This replaces disconnect-triggered abort as the mechanism that keeps `ConversationGenerationService`'s registry bounded under sustained disconnect traffic, which was #8640's original motivation.
- `POST /api/v1/client-channel/subscribe` (`ClientChannelController`) is unchanged — it already aborts its upstream reader/fetch on browser disconnect, correctly, because that stream has no independent backend-owned lifecycle.
- `completions.integration.spec.ts`'s test asserting `abortSignal` is called on disconnect is replaced with a regression test that destroys a real client socket mid-stream and asserts the upstream generation keeps running to completion, persists the full assistant response, and releases the registry entry as `Done`.
- `openspec/specs/generation-registry/spec.md` and `openspec/specs/backend-owned-generation-persistence/spec.md` are corrected to remove the disconnect-aborts-generation requirements #8640 introduced, and to document the max-duration bound as the (non-connection-based) mechanism that keeps the registry from growing unbounded.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `backend-owned-generation-persistence`: removes the requirement that a client disconnect mid-stream finalizes the generation as `Error`/`Stopped`; a disconnect now has no effect on generation outcome. Removes disconnect from the terminal-outcome table entirely. Documents that suppressing writes to a closed response is a transport concern, not a persistence outcome.
- `generation-registry`: removes the requirement that `streamCompletion` registers a disconnect handler that aborts the generation's `AbortController`, and removes the requirement that an abandoned consuming loop triggers immediate registry release. Adds a new requirement for a server-owned max-generation-duration bound that releases a stalled entry independent of client connection state.

## Impact

- `apps/chat-api/src/conversations/conversation.controller.ts` — `streamCompletion` handler's disconnect handling.
- `apps/chat-api/src/conversations/conversation-generation.service.ts` — remove `abortSignal()`; add the max-duration timeout mechanism.
- `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts` — narrow the `finally` abandonment branch's applicability; no change to `finalize()`'s outcome table.
- `apps/chat-api/src/conversations/tests/completions.integration.spec.ts` — replace the disconnect-aborts test with a disconnect-does-not-abort regression test.
- `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts` — update/replace the abandonment test added by #8640 to reflect that a closed response alone no longer triggers the `finally` branch.
- `apps/chat-api/src/conversations/conversation-generation.service.spec.ts`, `apps/chat-api/src/conversations/tests/conversation-generation.service.spec.ts` — remove `abortSignal` coverage, add max-duration timeout coverage.
- `openspec/specs/generation-registry/spec.md`, `openspec/specs/backend-owned-generation-persistence/spec.md` — spec corrections described above.
- No API contract, DTO, UI, i18n, or feature-flag changes. `openspec/specs/client-channel-protocol/spec.md`, `openspec/specs/app-level-generation-manager/spec.md`, and `openspec/specs/generation-live-replay/spec.md` require no changes — this change brings the implementation back into line with what they already specify.
