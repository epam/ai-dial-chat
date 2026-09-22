## ADDED Requirements

### Requirement: Terminal classification and partial-message reads belong to the finalizing generation

`ConversationStreamingService.streamCompletion` SHALL classify its own terminal outcome and read its own partial assistant message through the lease `register` returned to it, never by re-reading the registry by `ownerKey + path`. Specifically, the abort-outcome branch and the abandoned-generator cleanup branch SHALL obtain the cancellation state and the assembled message through lease-scoped accessors that resolve only an entry carrying that lease's internal operation identity.

A worker whose entry is no longer the one occupying its registry key SHALL read no cancellation state and no assembled message from the registry, and SHALL fall back to the assembled message it holds locally. It SHALL NOT read, mutate, remove, notify subscribers of, or release runtime tracking for whatever entry currently occupies that key.

The start-state write, the assembled-message updates, and the single terminal write SHALL all belong to the generation that holds the lease. Because `generation-registry` admits no replacement while an entry is owned, no replacement can exist for the key while any of those writes is outstanding.

#### Scenario: An old worker classifying a stop never reads a replacement's state

- **GIVEN** a generation is stopped and its worker is unwinding, and the registry key has since been released and re-registered by a new generation
- **WHEN** the old worker classifies its outcome and reads its partial message
- **THEN** it reads no state from the new entry, uses its own locally-held assembled message, persists its own partial answer, and neither delivers a terminal event to the new generation's subscribers nor removes the new generation's entry

#### Scenario: A replacement reusing the same client generation id is not mistaken for the old generation

- **GIVEN** an old worker is finalizing and a new generation for the same principal and path was registered with the same client-supplied `generationId`
- **WHEN** the old worker performs its terminal transition
- **THEN** the transition is a no-op against the new entry, and the new generation's status, assembled message, subscribers, and runtime tracking are unaffected

#### Scenario: A stale-cancelled generation persists a non-user abort, not a user stop

- **GIVEN** a generation was cancelled by stale expiry rather than by the Stop endpoint
- **WHEN** its worker finalizes
- **THEN** the persisted partial assistant message carries `streamErrorMessage: ''` and no `wasStoppedByUser`, matching the existing "aborted for any other reason" outcome row

### Requirement: Exactly one terminal write attempt, and cancellation never adds or replaces one

A generation SHALL attempt at most one terminal write. The worker SHALL record that the terminal write has been dispatched before awaiting it, and from that point:

- A cancellation request of any reason SHALL be recorded for logging and telemetry only. It SHALL NOT change the persisted outcome, SHALL NOT trigger a second write, and SHALL NOT cancel the dispatched write.
- A cancellation that arrives while the generation is still running SHALL set its reason before the worker's single classification read, so the worker's outcome reflects it.
- When a cancellation and a normal completion race, whichever reaches settlement first determines the outcome and the other is a no-op.

The pre-stream failure paths SHALL remain write-free: a failure resolving the deployment's generation capability, fetching the conversation, or building its history SHALL release the registry entry and rethrow **without** performing any conversation write. A preflight failure SHALL NOT invent a terminal save.

A failed or ambiguous terminal write SHALL continue to be logged and SHALL NOT abort the request, and the entry SHALL settle and release its key. A delivered terminal event, a released registry entry, and a recorded `dial.chat.completion.response.terminations` point SHALL NOT be treated as evidence that the conversation was durably persisted.

#### Scenario: Cancellation arriving after the terminal write was dispatched does not add a second write

- **GIVEN** a worker has dispatched its terminal write and is awaiting it
- **WHEN** a user Stop, a stale cancellation, or a max-duration timeout occurs
- **THEN** exactly one write was issued for that generation, the persisted outcome is the one the dispatched write carries, and the cancellation is recorded without changing it

#### Scenario: A pre-stream failure releases the entry without writing

- **WHEN** registration succeeds and the subsequent generation-capability resolution or `getConversation` throws
- **THEN** the backend releases the registry entry and rethrows, no `saveConversation` call is made on that path, and a retry is not rejected with 409

#### Scenario: A terminal write that is already dispatched cannot be fenced by an identity check

- **GIVEN** a worker checked its lease identity and then dispatched its terminal write
- **WHEN** that write is in flight
- **THEN** the capability makes no claim that the write can be prevented, cancelled, or proven uncommitted; safety instead rests on no replacement being admitted while the entry is owned

### Requirement: Fencing guarantees are process-local, and storage-side fencing is not claimed

This capability SHALL distinguish which guarantees are process-local from which would require a verified DIAL Core contract.

Process-local, and guaranteed: admission of at most one owner per `ownerKey + path`; internal operation identity; cancellation propagation through the entry's `AbortController`; single idempotent settlement; and the consequence that no second worker holds a key while an older write is outstanding.

Not guaranteed, and requiring a verified DIAL Core contract to ever be guaranteed: that a write already handed to the persistence adapter has not committed and will not commit. In particular, a lease or generation-id check placed before awaiting the write does not fence a write that has already been issued; racing the write against a timeout does not cancel it; and aborting the underlying HTTP request would not prove the storage server has neither committed nor will commit it. The generation registry is process-local and is not a cross-pod coordination mechanism.

`ConversationPersistencePort` exposes no cancellation parameter and no conditional-write parameter, and this change SHALL NOT add one. The DIAL Core conversation-save contract declared by the installed `@epam/ai-dial-typescript-sdk` does accept `If-Match`/`If-None-Match` preconditions and can answer `412`, and returns an `ETag` on both save and read — but that is a contract declaration, not verified deployment behaviour, so no storage-side fencing guarantee SHALL be asserted on its basis.

Unrelated writers to the same conversation path SHALL be named explicitly rather than assumed absent. `ConversationPersistenceService.saveConversation` performs an awaited display-name-preservation read before its write, and then fire-and-forget schedules `ConversationNamingService.maybeRenameAfterFirstReply`, which is an independent asynchronous writer that can write after a generation has released ownership. It writes only the conversation's display name and its naming-done marker, so it does not overwrite assistant message content and is not part of the overlap this capability fences; it would, however, have to be brought into any future conditional-write chain.

#### Scenario: The asynchronous naming writer can write after ownership is released

- **GIVEN** a generation settled and released its registry key, and a naming write it scheduled is still in flight
- **WHEN** that naming write completes
- **THEN** it updates only the conversation's display name and naming-done marker, and does not overwrite the assistant message content persisted by any generation

#### Scenario: No storage-side fencing is asserted

- **WHEN** a terminal write is performed
- **THEN** it is issued without a conditional-write precondition, and the capability documents that correctness rests on process-local admission rather than on storage-side fencing

## MODIFIED Requirements

### Requirement: A pre-stream failure releases the registry entry

If any step between registering the generation and opening the upstream stream fails — resolving the deployment's generation capability, fetching the conversation, or building its history — the backend SHALL release the registry entry before rethrowing, so a transient failure does not lock the conversation.

Releasing on this path SHALL NOT perform a conversation write of any kind: nothing has been assembled, and a preflight failure must not invent a terminal save. Release SHALL be the entry's single settlement, so its max-duration timer, its attach listeners, its registry key, and its runtime generation tracking are all released exactly once.

Because `generation-registry` no longer removes or replaces an owned entry on `register`, this release is the only thing that frees the key after a preflight failure. A retry therefore succeeds immediately rather than waiting for any sweep.

#### Scenario: Conversation fetch fails after registration

- **WHEN** registration succeeds but the subsequent `getConversation` throws
- **THEN** the backend releases the entry — clearing its timer, listeners, registry key, and runtime tracking — and rethrows, performing no conversation write, so a retry is not rejected with 409

#### Scenario: A generation-capability resolution failure releases the entry without writing

- **WHEN** registration succeeds but resolving the deployment's generation API throws
- **THEN** the backend releases the entry and rethrows with no `saveConversation` call made, and the failure reaches the exception filter before any SSE response is opened
