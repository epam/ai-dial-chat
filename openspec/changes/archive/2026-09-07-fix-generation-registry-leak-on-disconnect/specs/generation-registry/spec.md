## ADDED Requirements

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
