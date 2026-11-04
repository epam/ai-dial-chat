## MODIFIED Requirements

### Requirement: In-memory generation registry keyed by principal and path

`ConversationGenerationService` (`apps/chat-api/src/conversations/generation/conversation-generation.service.ts`) SHALL track generations in an in-memory map keyed by `` `${ownerKey}::${path}` ``, where `ownerKey` is the caller's principal key as defined by `generation-principal-ownership` — the cookie session id for a cookie-authenticated caller, and the verified `providerId`+`sub` pair for a header-authenticated caller. The service SHALL accept that key as an opaque `ownerKey` parameter on the public, client-addressed operations `register`, `abort` and `attach`, and SHALL NOT itself inspect the authentication mode or derive the key. Worker-facing operations address their entry through the lease returned by `register` instead.

Each entry stores the client-supplied `generationId`, the internal operation identity, an `AbortController`, an explicit lifecycle state drawn from a named string enum, an optional cancellation reason, `startedAt`, the assembled message snapshot, its attach emitter, its max-duration timer, its runtime-tracking release, and its pre-rendered subject-free log label.

The lifecycle states SHALL be exactly the members of `GenerationLifecycleState`: `Active` (`'active'`, running); `CancelRequested` (`'cancel_requested'`); `Finalizing` (`'finalizing'`), entered when the terminal write is dispatched; `Settling` (`'settling'`), the retained state entered when that write has not settled within the finalization bound; and `Released` (`'released'`), meaning the entry is no longer in the map. Every state other than released denotes continuing ownership of the key.

The registry is not persisted; a pod restart clears it, and the registry is not a cross-pod coordination mechanism.

#### Scenario: Concurrent generation for the same path is rejected

- **WHEN** `register` is called for an `ownerKey + path` whose key is occupied by an entry in any state other than released
- **THEN** it throws `ConflictException` (HTTP 409)

#### Scenario: Completed generation frees the path

- **WHEN** a generation settles on successful completion
- **THEN** the entry is removed, so a later `register` for the same `ownerKey + path` succeeds

#### Scenario: Two different principals generate on the same path independently

- **WHEN** `register` is called for the same `path` under two different `ownerKey` values
- **THEN** both registrations succeed and produce separate entries, because the map key differs

#### Scenario: One principal's cancellation does not affect another's entry on the same path

- **GIVEN** two principals each own a generation on the same conversation path
- **WHEN** one of them is stopped, expires, times out, or settles
- **THEN** the other principal's entry keeps its state, its subscribers, its timer, and its runtime tracking, and its own registry key remains admissible to no one else
