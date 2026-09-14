## RENAMED Requirements

FROM: ### Requirement: In-memory generation registry keyed by session and path
TO: ### Requirement: In-memory generation registry keyed by principal and path

## MODIFIED Requirements

### Requirement: In-memory generation registry keyed by principal and path

`ConversationGenerationService` (`apps/chat-api/src/conversations/conversation-generation.service.ts`) SHALL track active generations in an in-memory map keyed by `` `${ownerKey}::${path}` ``, where `ownerKey` is the caller's principal key as defined by `generation-principal-ownership` — the cookie session id for a cookie-authenticated caller, and the verified `providerId`+`sub` pair for a header-authenticated caller. The service SHALL accept that key as an opaque `ownerKey` parameter on `register`, `seedAssembledMessage`, `applyChunk`, `attach`, `abort`, `getStatus`, `complete` and `error`, and SHALL NOT itself inspect the authentication mode or derive the key. Each entry stores the `generationId`, an `AbortController`, a status (`active | stopped | done | error`), and `startedAt`. The registry is not persisted; a pod restart clears it.

#### Scenario: Concurrent generation for the same path is rejected

- **WHEN** `register` is called for an `ownerKey + path` that already has an `active` entry
- **THEN** it throws `ConflictException` (HTTP 409)

#### Scenario: Completed generation frees the path

- **WHEN** `complete` is called for an entry
- **THEN** the entry is removed, so a later `register` for the same `ownerKey + path` succeeds

#### Scenario: Two different principals generate on the same path independently

- **WHEN** `register` is called for the same `path` under two different `ownerKey` values
- **THEN** both registrations succeed and produce separate entries, because the map key differs

### Requirement: Stop validates the generation id

`abort(ownerKey, path, generationId)` SHALL only abort when the stored entry is `active` and its `generationId` matches the supplied id; otherwise it returns `false`.

#### Scenario: Abort with a stale generation id is a no-op

- **WHEN** `abort` is called with a `generationId` that does not match the active entry
- **THEN** it returns `false` and does not abort the running generation

#### Scenario: Abort under another principal's key is a no-op

- **WHEN** `abort` is called with the correct `path` and `generationId` but an `ownerKey` that does not own the entry
- **THEN** it returns `false` and does not abort the running generation
