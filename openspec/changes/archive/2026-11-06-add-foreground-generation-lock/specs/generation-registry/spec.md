## ADDED Requirements

### Requirement: A storage-authorized Stop aborts a local entry by path and generation id

`ConversationGenerationService` SHALL expose an operation that aborts the active foreground entry for a conversation `path` and `generationId`, whatever principal owns it. It sets the cancellation reason to user-stop and moves the entry to `CancelRequested`, as `abort` does.

It SHALL be called only after a Stop was stored on that generation's marker with the stopping caller's own token (`foreground-generation-lock` "A Stop from any writer is stored on the marker"). The stored write is the authorization: DIAL Core accepted it from a caller who may write the conversation. The operation returns `false` and changes nothing when:

- no entry for that `path` carries that `generationId`;
- the entry is not `Active`;
- the entry runs on the background path.

The lookup needs no owner key. It SHALL NOT change `register`, `abort` or `attach`, which stay keyed by principal and path. Attach to another principal's generation stays refused.

#### Scenario: A stored Stop aborts another principal's local entry

- **GIVEN** principal P1 runs a foreground generation G on path X on this instance
- **WHEN** principal P2's Stop for G was stored on the marker and the operation is called with X and G
- **THEN** it returns `true`, the entry's cancellation reason is user-stop, and the generation ends as a user stop

#### Scenario: No entry for the id is a no-op

- **WHEN** the operation is called with a `generationId` no local entry on that path carries
- **THEN** it returns `false` and no entry changes

## MODIFIED Requirements

### Requirement: Cancellation reason is explicit and distinguishes a stale cancellation from a user Stop

The registry SHALL record, per entry, an explicit cancellation reason drawn from a named string enum with exactly these values:

- user-stop;
- stale-expiry;
- max-duration;
- shutdown;
- lock-lost.

The reason SHALL be set by the corresponding cancellation entry point and SHALL be readable by the owning worker through its lease. The lock-lost reason is set when the worker's re-read finds its own `foregroundGeneration` marker gone (`foreground-generation-lock` "The worker re-reads its conversation and honours a stored Stop"). A Stop stored on the marker by another writer or instance sets user-stop.

Terminal outcome classification SHALL be derived from that reason, not from a status field that several cancellation sources can set.

- Only a user-stop reason SHALL produce a `stopped` terminal event to attach subscribers and the `wasStoppedByUser: true` persisted marker.
- A stale-expiry, max-duration or lock-lost reason SHALL be classified as a non-user abort, which `backend-owned-generation-persistence` already defines as `streamErrorMessage: ''`.
- For lock-lost the terminal write is then skipped, because the marker it would apply to is gone.

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

#### Scenario: A lost marker is a non-user abort

- **GIVEN** a generation is cancelled because its re-read found its marker gone
- **WHEN** the owning worker finalizes it
- **THEN** attach subscribers receive an `error` terminal event, the cancellation reason is lock-lost, and no conversation write is made

### Requirement: Generation preparation is bounded, and an abandoned preparation retains ownership until it settles

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) SHALL bound **preparation** with one server-owned deadline of `GENERATION_PREPARATION_TIMEOUT_MS`.

**What preparation covers.** Preparation is every await between a successful `register` and the end of the pre-stream phase. The deadline is measured from immediately after `register` succeeds. Preparation ends:

- at the `onReadyToStream` call on the non-background path;
- at the handoff to `BackgroundGenerationService.startAndRelay` on the background path;
- or when a preparation step rejects or is abandoned.

The steps are:

- the hidden-model check;
- generation-capability resolution;
- the stored-conversation read;
- on the non-background path, the start-state save, which is the conditional write that stores the `foregroundGeneration` marker.

**Configuration.** `GENERATION_PREPARATION_TIMEOUT_MS` SHALL be an optional integer declared on `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`), validated at boot with a minimum of `1000`, defaulting to `30000`, and read through `ConfigService` with `infer: true`. It is independent of `MAX_GENERATION_DURATION_MS` and `GENERATION_FINALIZE_TIMEOUT_MS`.

**One timer.** The deadline SHALL be implemented with exactly one timer per admitted generation. That timer SHALL be cleared on every exit from preparation and SHALL add no listener to the lease's `AbortSignal`. A preparation that completes before the deadline SHALL behave exactly as it did without the deadline.

The deadline bounds the *wait*, not the remote operation. It SHALL NOT be described as cancelling, fencing or establishing the outcome of a DIAL Core request. When the deadline elapses while a step is still pending, the preparation is **abandoned**:

1. **No further code runs** on that generation's behalf once the pending step settles, with one exception. That means no later preparation step, no further start-state save, no `onReadyToStream`, no upstream model request and no terminal save, and the step's eventual result SHALL be discarded. The exception: when the abandoned step is the start-state write and it settles in any way other than a version conflict or `409`, the worker SHALL make the single release write `foreground-generation-lock` "A generation that stored its marker always releases it" requires. It is a no-op when the marker was not stored.
2. **Subscribers are released.** Through its lease, the registry entry SHALL move to the retained `settling` state and release its subscriber resources exactly as the finalization bound does:
   - each current attach subscriber receives one terminal event: `stopped` when the recorded cancellation reason is user-stop, `error` otherwise;
   - all listeners are removed and the max-duration timer is cleared;
   - the entry keeps its key, its runtime generation tracking and its `settling` gauge contribution.

   This SHALL be a no-op for an entry that is absent, belongs to another lease, or already released its resources.
3. **Ownership is retained:** `register` for the same principal and path keeps throwing `ConflictException`, `abort` for it returns `false`, and `attach` returns no attachment.
4. **Settlement.** The key SHALL be released only when the abandoned step itself resolves or rejects — and, for a start-state write, after the release write above settles — through the owning lease's single settlement.
   - A rejection SHALL be observed and logged through the service `Logger` and never left unhandled.
   - A later settlement call on the old lease SHALL NOT affect a newer entry for the same key.
5. **Logging.** The abandonment SHALL be logged once at `warn` with the entry's subject-free log label and a bounded step name. It SHALL NOT log the owner key, the token or conversation content.

**Cancellations during preparation.** A user-stop, max-duration or stale-expiry cancellation that arrives during preparation SHALL NOT by itself abandon preparation. It records its reason and aborts the lease as before, and `backend-owned-generation-persistence` defines what follows once preparation completes. Process shutdown during preparation follows its own contract, and the worker then stops at its next preparation boundary as `backend-owned-generation-persistence` defines. A marker the generation already stored is released as `foreground-generation-lock` defines.

This requirement adds no lifecycle state, no telemetry instrument and no cross-pod coordination. It is not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` and has no i18n, RTL or accessibility impact.

#### Scenario: A stalled stored-conversation read is abandoned at the deadline

- **GIVEN** a generation is registered and its stored-conversation read never settles
- **WHEN** `GENERATION_PREPARATION_TIMEOUT_MS` elapses
- **THEN** the entry is `settling` with its subscribers released, the request fails before SSE headers are sent, and no start-state save and no upstream model request are made

#### Scenario: A stalled start-state save is abandoned without releasing ownership

- **GIVEN** a non-background generation's start-state save is dispatched and has not settled
- **WHEN** the deadline elapses
- **THEN** `register` for the same principal and path throws `ConflictException`, `onReadyToStream` is never called, and no upstream model request and no terminal save are made

#### Scenario: A late start-state write that stored the marker is released

- **GIVEN** a preparation was abandoned while its start-state write was pending
- **WHEN** that write is stored
- **THEN** one release write removes the generation's marker, and only then is the key released exactly once

#### Scenario: A late resolution releases the key exactly once

- **GIVEN** a preparation was abandoned and its pending step, other than the start-state write, later resolves
- **WHEN** it resolves
- **THEN** the result is discarded, no further preparation step or save runs, the key and runtime tracking are released exactly once, and a later `register` for the same principal and path succeeds

#### Scenario: A late rejection is observed and releases the key

- **GIVEN** a preparation was abandoned and its pending step later rejects
- **WHEN** it rejects
- **THEN** the rejection is logged, no unhandled rejection is raised, and the key is released exactly once

#### Scenario: Attach subscribers are released at the deadline

- **GIVEN** a client attached during preparation and received the placeholder snapshot
- **WHEN** the deadline elapses
- **THEN** that subscriber receives exactly one `error` terminal event and is unsubscribed, and a later `attach` for the same principal and path returns no attachment

#### Scenario: Abandonment after a user Stop delivers a stopped event

- **GIVEN** the principal stopped the generation during preparation and preparation then stalls
- **WHEN** the deadline elapses
- **THEN** current subscribers receive `stopped`, and the entry is retained until the pending step settles

#### Scenario: A preparation that completes in time is unaffected

- **WHEN** every preparation step settles before the deadline
- **THEN** the preparation timer is cleared, no subscriber is released early, and the generation proceeds exactly as without the deadline

#### Scenario: The old lease cannot affect a newer entry

- **GIVEN** an abandoned preparation's pending step settled, its key was released, and a new generation was registered for the same principal and path
- **WHEN** any lease-scoped call is made with the old lease
- **THEN** it is a no-op and the new entry's state, subscribers and key are unchanged

#### Scenario: No timer or listener is left behind

- **WHEN** a preparation completes, fails, or is abandoned and later settles
- **THEN** no preparation timer remains armed, the lease's `AbortSignal` gained no listener from the deadline, and the entry's emitter has no listeners

### Requirement: Process shutdown has its own contract and waits for foreground terminal writes within a bound

`onModuleDestroy` SHALL remain a distinct path from stale cancellation, and SHALL NOT be reused as the implementation of eviction. For every entry it SHALL, at once:

- set the cancellation reason to shutdown unless one is already recorded;
- abort the entry's `AbortController`;
- notify every attach subscriber with a `stopped` terminal event, using the same isolated raw-listener delivery.

**Background entries.** For an entry on the background path defined by `background-responses-generation`, shutdown SHALL detach instead of finishing it:

- the relay is aborted and the client's completion stream ends cleanly;
- the entry is released;
- no Core cancel and no conversation write are made;
- the message stays `pending` for recovery on another instance.

**Foreground entries.** For an entry on the Chat Completions or stateless Responses path, shutdown SHALL retain the key while the owning worker makes its own terminal write, or its release write when the stream had not opened (`foreground-generation-lock`). A stored marker is then removed before the process exits.

- `onModuleDestroy` SHALL wait for those entries to settle for at most `FOREGROUND_SHUTDOWN_FLUSH_MS` (10 s) in total.
- When the bound elapses, it SHALL release every entry still present — its timer, listeners, registry key and runtime tracking — exactly as before this change.
- The bound is a code constant, kept below the usual 30 s termination grace period of a container platform.

**No persistence claim.** Shutdown SHALL NOT be documented or reported as establishing an outcome for a write that has not settled within the bound. Neither process shutdown nor a process crash can establish whether such a write committed. A marker whose write did not settle stops holding the conversation at its `expiresAt`.

#### Scenario: Shutdown releases every subscriber and resource

- **GIVEN** several generations are registered, in any mix of lifecycle states, with multiple attach subscribers each and one subscriber that throws
- **WHEN** the module is destroyed
- **THEN** every subscriber receives exactly one `stopped` terminal event, the throwing subscriber is logged and does not prevent the others, and by the end of the flush bound every timer, listener, registry entry, and runtime tracking release is performed

#### Scenario: Shutdown waits for a foreground terminal write

- **GIVEN** a foreground generation is streaming
- **WHEN** the module is destroyed and the worker's terminal write settles within `FOREGROUND_SHUTDOWN_FLUSH_MS`
- **THEN** the stored answer carries `streamErrorMessage: ''` and no `foregroundGeneration`, and the entry settles through its worker's own settlement

#### Scenario: Shutdown stops waiting at the bound

- **WHEN** the module is destroyed while a foreground terminal write never settles
- **THEN** after `FOREGROUND_SHUTDOWN_FLUSH_MS` the entry is released directly, and the capability does not assert whether the write committed

#### Scenario: Shutdown detaches a background generation

- **GIVEN** a background generation is running on the instance
- **WHEN** the module is destroyed
- **THEN** its relay is aborted and its entry released, no Core cancel is sent, no conversation write is made, and the message stays `pending`

## RENAMED Requirements

FROM: ### Requirement: Process shutdown has its own contract and promises nothing about storage
TO: ### Requirement: Process shutdown has its own contract and waits for foreground terminal writes within a bound
