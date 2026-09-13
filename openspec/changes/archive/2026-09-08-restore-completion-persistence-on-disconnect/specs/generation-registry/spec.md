## REMOVED Requirements

### Requirement: Registry entries are released promptly on client disconnect, not only by the stale sweep

**Reason**: This requirement, introduced by PR #8640, made `ConversationController.streamCompletion` abort the generation's `AbortController` and made `ConversationStreamingService.streamCompletion` finalize the generation as `Error`/`Stopped` whenever the downstream HTTP response closed. That contradicts the documented contract that a completion's backend-owned generation is independent of the originating browser connection (see `backend-owned-generation-persistence`'s "A closed downstream response does not alter generation persistence or outcome" and `app-level-generation-manager`). The original motivation — bounding how long a registry entry can occupy the registry without depending on the lazy 30-minute stale sweep — is still valid and is addressed by the new max-duration requirement below, without tying cleanup to client connection state.

**Migration**: Replaced by "Active generations are bounded by a server-owned max-duration timeout, independent of client connection state" below. `ConversationGenerationService.abortSignal()` (the method this requirement introduced) is removed; no other caller depended on it. `ConversationController.streamCompletion` no longer registers a disconnect handler that aborts the generation.

## ADDED Requirements

### Requirement: Active generations are bounded by a server-owned max-duration timeout, independent of client connection state

`ConversationGenerationService.register` SHALL start a timer for the new entry, in addition to the existing `AbortController`. If the entry has not reached a terminal status (`Done`, `Stopped`, or `Error`) within `MAX_GENERATION_DURATION_MS` of registration, the timer SHALL abort the entry's `AbortController` and finalize it as `Error`, releasing the registry entry the same way any other non-user abort does. `complete()`, `error()`, and `abort()` SHALL clear the entry's timer as part of their existing terminal transition, so a generation that finishes normally never triggers it.

This bound is independent of the client's HTTP connection: it fires whether or not the originating browser connection is still open, and it is not affected by disconnect (which, per `backend-owned-generation-persistence`, has no effect on the generation). It supplements, and does not replace, `evictStale`: `evictStale` remains the backstop for termination paths this timer cannot cover either, such as a process crash that loses the in-memory timer along with the rest of the registry.

#### Scenario: A stalled generation is finalized without depending on client disconnect or the stale sweep

- **GIVEN** a generation is registered and actively streaming, and the client remains connected throughout
- **WHEN** the upstream stream produces no terminal event (`[DONE]`, error) within `MAX_GENERATION_DURATION_MS`
- **THEN** the backend aborts the generation's `AbortController`, persists the partial assistant message as an `Error` outcome, and releases the registry entry — without waiting for `evictStale`'s 30-minute sweep and without requiring the client to disconnect

#### Scenario: A normal-speed generation never triggers the timeout

- **WHEN** a generation reaches `[DONE]`, an error, or an explicit Stop well within `MAX_GENERATION_DURATION_MS`
- **THEN** its max-duration timer is cleared as part of that terminal transition and never fires

#### Scenario: The timeout is unaffected by client disconnect

- **GIVEN** the client disconnects mid-generation (which, per `backend-owned-generation-persistence`, does not itself finalize the generation)
- **WHEN** the upstream subsequently reaches a terminal event before `MAX_GENERATION_DURATION_MS` elapses
- **THEN** the generation finalizes normally from that terminal event, and the max-duration timer — having been cleared by the same terminal transition — never fires
