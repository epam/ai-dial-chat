## Purpose

In-memory tracking of active generations per session+path, enforcing one active generation per conversation and supporting stop, complete, and error transitions.

## Requirements

### Requirement: In-memory generation registry keyed by session and path

`ConversationGenerationService` (`apps/chat-api/src/conversations/conversation-generation.service.ts`) SHALL track active generations in an in-memory map keyed by `` `${sessionId}::${path}` ``. Each entry stores the `generationId`, an `AbortController`, a status (`active | stopped | done | error`), and `startedAt`. The registry is not persisted; a pod restart clears it.

#### Scenario: Concurrent generation for the same path is rejected

- **WHEN** `register` is called for a `sessionId + path` that already has an `active` entry
- **THEN** it throws `ConflictException` (HTTP 409)

#### Scenario: Completed generation frees the path

- **WHEN** `complete` is called for an entry
- **THEN** the entry is removed, so a later `register` for the same `sessionId + path` succeeds

### Requirement: Stop validates the generation id

`abort(sessionId, path, generationId)` SHALL only abort when the stored entry is `active` and its `generationId` matches the supplied id; otherwise it returns `false`.

#### Scenario: Abort with a stale generation id is a no-op

- **WHEN** `abort` is called with a `generationId` that does not match the active entry
- **THEN** it returns `false` and does not abort the running generation

### Requirement: Stale entries are evicted

On each `register`, entries older than 30 minutes SHALL be evicted to prevent unbounded growth if a terminal handler was never reached.

#### Scenario: Old entry evicted on next registration

- **WHEN** `register` runs and an existing entry is older than the stale threshold
- **THEN** the stale entry is removed before the new one is created

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
