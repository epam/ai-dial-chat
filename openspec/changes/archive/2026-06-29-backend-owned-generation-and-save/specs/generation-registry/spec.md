## ADDED Requirements

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
