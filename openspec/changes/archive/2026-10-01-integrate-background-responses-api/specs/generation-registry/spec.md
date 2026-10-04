# Spec Delta

## MODIFIED Requirements

### Requirement: Active generations are bounded by a server-owned max-duration timeout, independent of client connection state

`ConversationGenerationService.register` SHALL start a timer for the new entry, in addition to the existing `AbortController`. If the entry is still running after `MAX_GENERATION_DURATION_MS` from registration, the timer SHALL set the entry's cancellation reason to max-duration and abort the entry's `AbortController`, and the owning worker SHALL finalize it as a non-user abort, releasing the registry entry the way any other non-user abort does. Settlement SHALL clear the entry's timer, so a generation that finishes normally never triggers it.

The timer SHALL resolve its target entry by the entry's internal operation identity, so a timer armed for one generation can never abort a later generation that occupies the same key — including one that reuses the same client-supplied `generationId`.

No path other than settlement SHALL clear this timer. In particular, stale handling SHALL NOT clear it, because the stale threshold is derived to be strictly greater than the configured maximum duration.

This bound is independent of the client's HTTP connection: it fires whether or not the originating browser connection is still open, and it is not affected by disconnect (which, per `backend-owned-generation-persistence`, has no effect on the generation). It is the traffic-independent bound on a running generation; stale handling is a backstop for entries this timer cannot cover, and is not a backstop for a process crash, which loses the timer and the registry together.

For a generation on the background path defined by `background-responses-generation`, the timer SHALL instead detach: it SHALL abort only the entry's relay of the DIAL Core stream, SHALL NOT cancel the Core job, SHALL NOT write the conversation (the message stays `pending`), SHALL end the client stream without a terminal event, and SHALL release the registry entry. The job then continues in DIAL Core, bounded by Core's background-job TTL, and is resumed through attach.

#### Scenario: A stalled generation is finalized without depending on client disconnect or the stale sweep

- **GIVEN** a generation is registered and actively streaming, and the client remains connected throughout
- **WHEN** the upstream stream produces no terminal event within `MAX_GENERATION_DURATION_MS`
- **THEN** the backend sets the cancellation reason to max-duration, aborts the generation's `AbortController`, persists the partial assistant message as a non-user abort, and releases the registry entry — without waiting for the stale sweep and without requiring the client to disconnect

#### Scenario: A normal-speed generation never triggers the timeout

- **WHEN** a generation reaches a terminal upstream event or an explicit Stop well within `MAX_GENERATION_DURATION_MS`
- **THEN** its max-duration timer is cleared by that settlement and never fires

#### Scenario: The timeout is unaffected by client disconnect

- **GIVEN** the client disconnects mid-generation
- **WHEN** the upstream subsequently reaches a terminal event before `MAX_GENERATION_DURATION_MS` elapses
- **THEN** the generation finalizes from that terminal event, and the max-duration timer — cleared by the same settlement — never fires

#### Scenario: A timer armed for an earlier generation cannot abort a later one on the same key

- **GIVEN** a generation was registered, settled, and a new generation was registered for the same owner and path, reusing the same client-supplied `generationId`
- **WHEN** the first generation's max-duration timer fires
- **THEN** it matches no entry by internal operation identity and aborts nothing

#### Scenario: A background generation is detached, not finalized, at the max duration

- **GIVEN** a background generation is still running when `MAX_GENERATION_DURATION_MS` elapses
- **WHEN** the timer fires
- **THEN** the relay is aborted and the registry entry released, no Core cancel is sent, no conversation write is made, and the message stays `pending`

### Requirement: Process shutdown has its own contract and promises nothing about storage

`onModuleDestroy` SHALL remain a distinct path from stale cancellation, and SHALL NOT be reused as the implementation of eviction. Because shutdown leaves no worker to await, it SHALL notify every attach subscriber with a `stopped` terminal event using the same isolated raw-listener delivery, release every entry's timer, listeners, registry key, and runtime tracking, and abort every entry's `AbortController`.

For an entry on the background path defined by `background-responses-generation`, shutdown SHALL detach instead of finishing it: the relay is aborted, the client's completion stream ends cleanly, the entry is released, and no Core cancel and no conversation write are made; the message stays `pending` for recovery on another instance.

Shutdown SHALL NOT be documented or reported as establishing any outcome for an in-flight persistence write. Neither process shutdown nor a process crash can establish whether a write that was already dispatched committed.

#### Scenario: Shutdown releases every subscriber and resource

- **GIVEN** several generations are registered, in any mix of lifecycle states, with multiple attach subscribers each and one subscriber that throws
- **WHEN** the module is destroyed
- **THEN** every subscriber receives exactly one `stopped` terminal event, the throwing subscriber is logged and does not prevent the others, and every timer, listener, registry entry, and runtime tracking release is performed

#### Scenario: Shutdown makes no persistence claim

- **WHEN** the module is destroyed while a terminal write is in flight
- **THEN** the shutdown path neither waits for that write nor reports its outcome, and the capability does not assert whether it committed

#### Scenario: Shutdown detaches a background generation

- **GIVEN** a background generation is running on the instance
- **WHEN** the module is destroyed
- **THEN** its relay is aborted and its entry released, no Core cancel is sent, no conversation write is made, and the message stays `pending`
