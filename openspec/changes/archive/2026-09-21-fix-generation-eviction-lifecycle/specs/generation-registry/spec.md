## ADDED Requirements

### Requirement: Each admitted generation has an internal operation identity distinct from the client generation id

`ConversationGenerationService.register` SHALL mint a process-local internal operation identity for every admitted entry and SHALL return it to the caller together with the entry's `AbortController` as an opaque lease value. The lease SHALL be the only way a worker addresses its own entry.

Every worker-facing method — seeding the assembled message, applying a chunk, reading the entry's cancellation state, reading the entry's assembled message, and the `complete`/`error` terminal transitions — SHALL match on the lease's internal operation identity, and SHALL be a no-op when the entry currently occupying the registry key does not carry that identity. The client-supplied `generationId` SHALL NOT be used for this match, because it is supplied by the caller and a later request MAY reuse it; it remains the public handle for the Stop endpoint and for log correlation.

The two public, client-addressed operations — `abort(ownerKey, path, generationId)` and `attach(ownerKey, path)` — SHALL keep addressing an entry the way a client can, and SHALL keep their existing behaviour.

#### Scenario: A replacement reusing the same client generation id is not reachable by the old worker's callbacks

- **GIVEN** a generation was registered with client generation id `G`, released its registry key, and a new generation was then registered for the same owner and path with the same client generation id `G`
- **WHEN** a late callback from the first generation applies a chunk, seeds an assembled message, reads cancellation state, reads the assembled message, or performs a `complete`/`error` transition using the first generation's lease
- **THEN** every one of those calls is a no-op: the replacement's assembled message is unchanged, no terminal event is delivered to the replacement's subscribers, the replacement's registry entry is not removed, and the replacement's runtime generation tracking is not decremented

#### Scenario: Stop and attach remain addressable by the client generation id and path

- **WHEN** a client posts a valid `generationId` and `path` to the Stop endpoint, or attaches by `path`
- **THEN** the operation resolves the entry exactly as before, without the caller needing the internal operation identity

### Requirement: A present registry entry is always a conflict — ownership is released only by the owning worker

`register` SHALL admit a generation only when the registry holds no entry for the `ownerKey + path` key. An entry in any non-released lifecycle state — running, cancellation-requested, finalizing, or retained pending an unsettled terminal write — is still owned and SHALL be rejected with `ConflictException` (HTTP 409). `register` SHALL NOT remove or replace an existing entry under any circumstance.

The registry key SHALL be freed only by the owning worker's single settlement, after its one terminal save attempt has settled. As a result, no replacement generation can exist for a key while an older worker retains the ability to write that conversation.

This conflict check SHALL be evaluated before any `await` in the completion request's pre-stream phase, so the 409 propagates to the exception filter with no SSE response headers sent.

#### Scenario: A Stop immediately followed by a new completion is rejected while the partial save is pending

- **GIVEN** a generation was stopped by the user and its partial terminal save has not yet settled
- **WHEN** a request for the same principal and conversation path calls `register`
- **THEN** it throws `ConflictException` (HTTP 409), the stopped generation keeps its registry key and its ability to complete its partial save, and no second entry exists for that key

#### Scenario: An expired generation still finalizing is rejected rather than replaced

- **GIVEN** a generation passed the stale threshold, had cancellation requested, and is awaiting its terminal save
- **WHEN** a request for the same principal and conversation path calls `register`
- **THEN** it throws `ConflictException` (HTTP 409) and the expiring entry is neither removed nor overwritten

#### Scenario: A conflict is reported before an SSE response is opened

- **GIVEN** a generation is already owned for this principal and conversation path
- **WHEN** a second request to `POST /api/v1/conversations/completions` reaches `register`
- **THEN** the rejection reaches the exception filter with `res.headersSent` false, and the client receives a `409` with the conflict message rather than a `200` with an empty body

#### Scenario: A released key admits the next generation

- **WHEN** the owning worker settles a generation, removing its registry entry
- **THEN** a later `register` for the same `ownerKey + path` succeeds

### Requirement: Cancellation reason is explicit and distinguishes a stale cancellation from a user Stop

The registry SHALL record, per entry, an explicit cancellation reason drawn from a named string enum with exactly the values user-stop, stale-expiry, max-duration, and shutdown. The reason SHALL be set by the corresponding cancellation entry point and SHALL be readable by the owning worker through its lease.

Terminal outcome classification SHALL be derived from that reason, not from a status field that several cancellation sources can set. Only a user-stop reason SHALL produce a `stopped` terminal event to attach subscribers and the `wasStoppedByUser: true` persisted marker. A stale-expiry or max-duration reason SHALL be classified as a non-user abort, which `backend-owned-generation-persistence` already defines as `streamErrorMessage: ''`.

The existing persisted-marker set for successful completion, user Stop, provider error, and non-user abort SHALL be preserved unchanged in meaning.

#### Scenario: A stale cancellation is not reported or persisted as a user stop

- **GIVEN** a generation is cancelled because it passed the stale threshold
- **WHEN** the owning worker finalizes it
- **THEN** attach subscribers receive an `error` terminal event, the persisted partial message carries `streamErrorMessage: ''` and no `wasStoppedByUser`, and the registry entry is released

#### Scenario: A max-duration cancellation is not reported or persisted as a user stop

- **GIVEN** a generation is cancelled because `MAX_GENERATION_DURATION_MS` elapsed while it was still running
- **WHEN** the owning worker finalizes it
- **THEN** the outcome is classified as a non-user abort, exactly as for a stale cancellation, and never as a user Stop

#### Scenario: A user stop keeps its existing markers

- **WHEN** the principal stops a generation through the Stop endpoint and the worker finalizes it
- **THEN** attach subscribers receive a `stopped` terminal event and the persisted partial message carries `wasStoppedByUser: true` and no `streamErrorMessage`

### Requirement: Settlement is idempotent and releases every resource exactly once

All terminal transitions — normal completion, provider error, user Stop, stale expiry, max-duration timeout, an abandoned generator's cleanup, repeated cleanup calls, and process shutdown — SHALL funnel into one settlement path guarded so that an entry settles at most once, no matter how many of those paths run or in what order.

One settlement SHALL, exactly once: clear the entry's max-duration timer; deliver exactly one terminal event to each currently-subscribed attach listener; remove all listeners from the entry's emitter; remove the entry from the registry; and release the entry's runtime generation tracking. Runtime generation tracking SHALL NOT be decremented more than once for an entry and SHALL NOT go negative.

Terminal events SHALL be delivered by invoking each raw listener in isolation, so that a listener which throws is logged and cannot prevent the remaining listeners from being notified or prevent any part of the cleanup above from running. Raw listeners SHALL be used so that one-shot listener wrappers are preserved.

#### Scenario: A throwing terminal listener does not block other listeners or cleanup

- **GIVEN** three attach subscribers are listening for the terminal event and the first one throws when invoked
- **WHEN** the generation completes, errors, is stopped, expires, or times out
- **THEN** the failure is logged, the other two subscribers still receive their terminal event, and the entry's timer, listeners, registry key, and runtime tracking are all released

#### Scenario: Overlapping cleanup paths settle an entry once

- **GIVEN** a generation for which a user Stop, a stale cancellation, a max-duration timeout, a normal completion, and an error path all run
- **WHEN** they overlap in any order
- **THEN** exactly one terminal event is delivered per subscriber, the registry entry is removed once, its timer is cleared once, and runtime generation tracking is decremented once and never below zero

#### Scenario: A subscriber that already disconnected does not affect settlement

- **GIVEN** one attach subscriber removed its own listeners on disconnect while another remains subscribed
- **WHEN** the generation settles
- **THEN** the remaining subscriber receives its terminal event and cleanup completes normally

### Requirement: Subscriber release and upstream termination are bounded; ownership handoff is not

Upstream termination SHALL be bounded: every cancellation entry point SHALL abort the entry's `AbortController`.

Subscriber and resource release SHALL be bounded: if a generation's terminal write has not settled within a configured finalization bound measured from the moment that write was dispatched, the entry SHALL deliver its terminal event to every subscriber, remove all listeners, clear its timer, and release its runtime generation tracking — so no attach subscriber or SSE response is held open by an unsettled write.

Safe ownership handoff SHALL NOT be bounded. An entry whose terminal write has not settled SHALL be **retained** in the registry in a distinct retained state, continuing to own its `ownerKey + path` key and continuing to reject `register` with 409, because releasing the key would readmit the stale-overwrite this capability exists to prevent. Ownership SHALL NOT be cleared merely in order to report fewer active generations.

Recovery SHALL be: the write settling — resolving or rejecting — releases the entry; otherwise the entry persists for the process lifetime and a process restart clears it. A terminal write that fails or whose failure is ambiguous about whether the data was committed SHALL be treated as settled, and ownership released, because the worker is demonstrably finished.

#### Scenario: A never-settling terminal write releases subscribers but not ownership

- **GIVEN** a generation's terminal write is dispatched and never settles
- **WHEN** the finalization bound elapses
- **THEN** every attach subscriber receives its terminal event and is unsubscribed, the entry's timer and runtime tracking are released, the entry remains in the registry in the retained state, and a `register` for the same principal and path still returns 409

#### Scenario: A slow but healthy terminal write is neither cancelled nor duplicated

- **GIVEN** a generation's terminal write exceeds the finalization bound and then succeeds
- **WHEN** it resolves
- **THEN** no second write was attempted, the write was not cancelled, and the entry leaves the retained state and releases its registry key

#### Scenario: An ambiguous persistence failure releases ownership

- **WHEN** a terminal write rejects without establishing whether the data was committed
- **THEN** the failure is logged, the entry settles and releases its registry key, and no second write is attempted

### Requirement: Process shutdown has its own contract and promises nothing about storage

`onModuleDestroy` SHALL remain a distinct path from stale cancellation, and SHALL NOT be reused as the implementation of eviction. Because shutdown leaves no worker to await, it SHALL notify every attach subscriber with a `stopped` terminal event using the same isolated raw-listener delivery, release every entry's timer, listeners, registry key, and runtime tracking, and abort every entry's `AbortController`.

Shutdown SHALL NOT be documented or reported as establishing any outcome for an in-flight persistence write. Neither process shutdown nor a process crash can establish whether a write that was already dispatched committed.

#### Scenario: Shutdown releases every subscriber and resource

- **GIVEN** several generations are registered, in any mix of lifecycle states, with multiple attach subscribers each and one subscriber that throws
- **WHEN** the module is destroyed
- **THEN** every subscriber receives exactly one `stopped` terminal event, the throwing subscriber is logged and does not prevent the others, and every timer, listener, registry entry, and runtime tracking release is performed

#### Scenario: Shutdown makes no persistence claim

- **WHEN** the module is destroyed while a terminal write is in flight
- **THEN** the shutdown path neither waits for that write nor reports its outcome, and the capability does not assert whether it committed

## MODIFIED Requirements

### Requirement: Stale entries are evicted

Stale handling SHALL request cancellation rather than remove an entry. On each `register`, for every entry older than the stale threshold that is still running, the service SHALL set that entry's cancellation reason to stale-expiry, log the expiry at warning level using the entry's pre-rendered subject-free label, and abort the entry's `AbortController`.

Stale handling SHALL NOT clear the entry's max-duration timer, SHALL NOT delete the registry key, SHALL NOT release the entry's runtime generation tracking, and SHALL NOT deliver a terminal event. Those belong to the owning worker's single settlement, which still runs exactly once. An entry that already has a cancellation reason, or that is finalizing or retained pending an unsettled write, SHALL be left untouched, so cancellation is not requested twice.

Aborting is requested only by the four cancellation entry points — user Stop, stale expiry, max-duration timeout, and shutdown. Entry removal SHALL NOT abort as a side effect, and the shutdown path SHALL NOT be copied into stale handling.

The stale threshold SHALL be derived from the configured maximum generation duration so that it can never pre-empt the max-duration timer:

```
staleThreshold = max(30 minutes, MAX_GENERATION_DURATION_MS) + a fixed grace period
```

`MAX_GENERATION_DURATION_MS` is validated with a minimum and no maximum, so a configuration above 30 minutes SHALL still have its max-duration timer fire before the stale threshold is reached.

Stale handling SHALL be triggered by `register` only. No per-request sweep timer and no queue SHALL be introduced. Consequently, recovery of an entry orphaned in-process depends on a later `register` from some principal, and a fully idle process performs no sweep; the per-entry max-duration timer, which is traffic-independent, is what bounds a running generation without another request.

The stale sweep SHALL NOT be described as a backstop for a process crash. A crash loses the registry, its timers, and the sweep together; after a restart the registry is empty and no claim can be made about any write that was in flight.

#### Scenario: An expired running generation is cancelled, not removed

- **GIVEN** a generation is still running and has passed the stale threshold
- **WHEN** `register` runs for any owner and path and performs the sweep
- **THEN** the expired entry's cancellation reason is set to stale-expiry, its `AbortController` is aborted, it is logged by path and owner digest only, and its registry key, max-duration timer, runtime tracking, and subscribers are all left in place for its owning worker to settle

#### Scenario: Stale cancellation does not orphan upstream work

- **GIVEN** a generation is cancelled by the stale sweep
- **WHEN** its worker unwinds
- **THEN** the worker performs its own single terminal save attempt, delivers exactly one terminal event per subscriber, and releases the registry entry — the entry is never removed while its worker is still running

#### Scenario: A configured maximum above 30 minutes is not pre-empted by the stale threshold

- **GIVEN** `MAX_GENERATION_DURATION_MS` is configured to 45 minutes
- **WHEN** a generation runs past 30 minutes
- **THEN** its max-duration timer is still armed and still fires at 45 minutes, and the stale threshold has not been reached

#### Scenario: Cancellation is not requested twice for the same entry

- **GIVEN** an entry has already had cancellation requested, or is finalizing, or is retained pending an unsettled write
- **WHEN** a later `register` performs the sweep
- **THEN** the entry is left untouched and its `AbortController` is not aborted again

#### Scenario: Recovery depends on later traffic, and this is the documented behaviour

- **GIVEN** an entry is orphaned in-process and the service receives no further `register` calls
- **THEN** no sweep runs and the entry is not cancelled by expiry; the per-entry max-duration timer remains the traffic-independent bound on a running generation

### Requirement: In-memory generation registry keyed by principal and path

`ConversationGenerationService` (`apps/chat-api/src/conversations/conversation-generation.service.ts`) SHALL track generations in an in-memory map keyed by `` `${ownerKey}::${path}` ``, where `ownerKey` is the caller's principal key as defined by `generation-principal-ownership` — the cookie session id for a cookie-authenticated caller, and the verified `providerId`+`sub` pair for a header-authenticated caller. The service SHALL accept that key as an opaque `ownerKey` parameter on the public, client-addressed operations `register`, `abort` and `attach`, and SHALL NOT itself inspect the authentication mode or derive the key. Worker-facing operations address their entry through the lease returned by `register` instead.

Each entry stores the client-supplied `generationId`, the internal operation identity, an `AbortController`, an explicit lifecycle state drawn from a named string enum, an optional cancellation reason, `startedAt`, the assembled message snapshot, its attach emitter, its max-duration timer, its runtime-tracking release, and its pre-rendered subject-free log label.

The lifecycle states SHALL be exactly: running; cancellation-requested; finalizing, entered when the terminal write is dispatched; retained, entered when that write has not settled within the finalization bound; and released, meaning the entry is no longer in the map. Every state other than released denotes continuing ownership of the key.

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

### Requirement: Active generations are bounded by a server-owned max-duration timeout, independent of client connection state

`ConversationGenerationService.register` SHALL start a timer for the new entry, in addition to the existing `AbortController`. If the entry is still running after `MAX_GENERATION_DURATION_MS` from registration, the timer SHALL set the entry's cancellation reason to max-duration and abort the entry's `AbortController`, and the owning worker SHALL finalize it as a non-user abort, releasing the registry entry the way any other non-user abort does. Settlement SHALL clear the entry's timer, so a generation that finishes normally never triggers it.

The timer SHALL resolve its target entry by the entry's internal operation identity, so a timer armed for one generation can never abort a later generation that occupies the same key — including one that reuses the same client-supplied `generationId`.

No path other than settlement SHALL clear this timer. In particular, stale handling SHALL NOT clear it, because the stale threshold is derived to be strictly greater than the configured maximum duration.

This bound is independent of the client's HTTP connection: it fires whether or not the originating browser connection is still open, and it is not affected by disconnect (which, per `backend-owned-generation-persistence`, has no effect on the generation). It is the traffic-independent bound on a running generation; stale handling is a backstop for entries this timer cannot cover, and is not a backstop for a process crash, which loses the timer and the registry together.

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
