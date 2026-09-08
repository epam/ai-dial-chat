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

### Requirement: Registry entries are released promptly on client disconnect, not only by the stale sweep

`ConversationController.streamCompletion` (`apps/chat-api/src/conversations/conversation.controller.ts`) SHALL register a client-disconnect handler (`res.on('close', ...)`) that aborts the generation's `AbortController` — the same instance returned by `ConversationGenerationService.register` — as soon as the client's HTTP connection closes, mirroring the existing `attachToGeneration`/`watchConversation` disconnect handling in the same controller.

`ConversationStreamingService.streamCompletion` SHALL treat an abandoned consuming loop (the controller's `for await` exits before the relay reaches a terminal outcome) the same as any other abort path: it SHALL still call `generationService.complete()`/`generationService.error()` so the corresponding `registry` entry (`apps/chat-api/src/conversations/conversation-generation.service.ts`) is removed immediately, instead of remaining `Active` until the 30-minute `evictStale` sweep on the next `register` call.

This requirement supplements, and does not replace, the existing stale-entry eviction: `evictStale` remains the backstop for any termination path that bypasses this cleanup (e.g. a process crash).

#### Scenario: Client disconnect aborts the upstream request

- **WHEN** a client's HTTP connection to `POST /api/v1/conversations/completions` closes while a generation is actively streaming
- **THEN** the request's `AbortController` is aborted immediately, stopping the upstream DIAL Core read loop rather than letting it run to completion for an abandoned response

#### Scenario: Registry entry is removed immediately, not after 30 minutes

- **GIVEN** a generation is registered as `Active` for a `sessionId + path`
- **WHEN** the client disconnects mid-stream before the generation reaches `[DONE]`, stop, or error
- **THEN** the registry entry for that `sessionId + path` is removed as part of handling the disconnect, and a subsequent `register` call for the same `sessionId + path` succeeds immediately without waiting for `evictStale`
