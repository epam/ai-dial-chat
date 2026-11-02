## ADDED Requirements

### Requirement: Generation preparation is bounded, and an abandoned preparation retains ownership until it settles

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) SHALL bound **preparation** with one server-owned deadline of `GENERATION_PREPARATION_TIMEOUT_MS`. Preparation is every await between a successful `register` and the end of the pre-stream phase. The deadline is measured from immediately after `register` succeeds. Preparation ends at the `onReadyToStream` call on the non-background path, at the handoff to `BackgroundGenerationService.startAndRelay` on the background path, or when a preparation step rejects or is abandoned. The steps are:

- the hidden-model check;
- generation-capability resolution;
- the stored-conversation read;
- on the non-background path, the start-state save.

`GENERATION_PREPARATION_TIMEOUT_MS` SHALL be an optional integer declared on `EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`), validated at boot with a minimum of `1000`, defaulting to `30000`, and read through `ConfigService` with `infer: true`. It is independent of `MAX_GENERATION_DURATION_MS` and `GENERATION_FINALIZE_TIMEOUT_MS`.

The deadline SHALL be implemented with exactly one timer per admitted generation. That timer SHALL be cleared on every exit from preparation and SHALL add no listener to the lease's `AbortSignal`. A preparation that completes before the deadline SHALL behave exactly as it did without the deadline.

The deadline bounds the *wait*, not the remote operation. It SHALL NOT be described as cancelling, fencing or establishing the outcome of a DIAL Core request. When the deadline elapses while a step is still pending, the preparation is **abandoned**:

1. The worker SHALL run no further code on that generation's behalf once the pending step settles. That means no later preparation step, no start-state save, no `onReadyToStream`, no upstream model request and no terminal save. The step's eventual result SHALL be discarded.
2. Through its lease, the registry entry SHALL move to the retained `settling` state and release its subscriber resources exactly as the finalization bound does. Each current attach subscriber receives one terminal event: `stopped` when the recorded cancellation reason is user-stop, `error` otherwise. All listeners are removed, the max-duration timer is cleared, and the entry keeps its key, its runtime generation tracking and its `settling` gauge contribution. This SHALL be a no-op for an entry that is absent, belongs to another lease, or already released its resources.
3. Ownership SHALL be retained: `register` for the same principal and path keeps throwing `ConflictException`, `abort` for it returns `false`, and `attach` returns no attachment.
4. The key SHALL be released only when the abandoned step itself resolves or rejects, through the owning lease's single settlement. A rejection SHALL be observed and logged through the service `Logger` and never left unhandled. A later settlement call on the old lease SHALL NOT affect a newer entry for the same key.
5. The abandonment SHALL be logged once at `warn` with the entry's subject-free log label and a bounded step name. It SHALL NOT log the owner key, the token or conversation content.

A user-stop, max-duration or stale-expiry cancellation that arrives during preparation SHALL NOT by itself abandon preparation. It records its reason and aborts the lease as before, and `backend-owned-generation-persistence` defines what follows once preparation completes. Process shutdown during preparation releases the entry through its own contract. The worker then stops at its next preparation boundary, as `backend-owned-generation-persistence` defines.

This requirement adds no lifecycle state, no telemetry instrument and no cross-pod coordination. It is not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` and has no i18n, RTL or accessibility impact.

#### Scenario: A stalled stored-conversation read is abandoned at the deadline

- **GIVEN** a generation is registered and its stored-conversation read never settles
- **WHEN** `GENERATION_PREPARATION_TIMEOUT_MS` elapses
- **THEN** the entry is `settling` with its subscribers released, the request fails before SSE headers are sent, and no start-state save and no upstream model request are made

#### Scenario: A stalled start-state save is abandoned without releasing ownership

- **GIVEN** a non-background generation's start-state save is dispatched and has not settled
- **WHEN** the deadline elapses
- **THEN** `register` for the same principal and path throws `ConflictException`, `onReadyToStream` is never called, and no upstream model request and no terminal save are made

#### Scenario: A late resolution releases the key exactly once

- **GIVEN** a preparation was abandoned and its pending step later resolves
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

## MODIFIED Requirements

### Requirement: A present registry entry is always a conflict — ownership is released only by the owning worker

`register` SHALL admit a generation only when the registry holds no entry for the `ownerKey + path` key. An entry in any non-released lifecycle state is still owned and SHALL be rejected with `ConflictException` (HTTP 409). Those states are `Active`, `CancelRequested`, `Finalizing` and `Settling`, the last being retained pending an unsettled terminal write or an unsettled abandoned preparation step. `register` SHALL NOT remove or replace an existing entry under any circumstance.

The registry key SHALL be freed only by the owning worker's single settlement, and only after the last operation that can still write that conversation on the generation's behalf has settled. That is the one terminal save attempt. When no terminal save is attempted, it is the preparation step that rejected or was abandoned. As a result, no replacement generation can exist for a key while an older worker retains the ability to write that conversation.

This conflict check SHALL be evaluated before any `await` in the completion request's pre-stream phase, so the 409 propagates to the exception filter with no SSE response headers sent.

#### Scenario: A Stop immediately followed by a new completion is rejected while the partial save is pending

- **GIVEN** a generation was stopped by the user and its partial terminal save has not yet settled
- **WHEN** a request for the same principal and conversation path calls `register`
- **THEN** it throws `ConflictException` (HTTP 409), the stopped generation keeps its registry key and its ability to complete its partial save, and no second entry exists for that key

#### Scenario: An expired generation still finalizing is rejected rather than replaced

- **GIVEN** a generation passed the stale threshold, had cancellation requested, and is awaiting its terminal save
- **WHEN** a request for the same principal and conversation path calls `register`
- **THEN** it throws `ConflictException` (HTTP 409) and the expiring entry is neither removed nor overwritten

#### Scenario: An abandoned preparation with a pending start-state save is rejected rather than replaced

- **GIVEN** a generation's preparation was abandoned at the deadline while its start-state save is still pending
- **WHEN** a request for the same principal and conversation path calls `register`
- **THEN** it throws `ConflictException` (HTTP 409), and the retained entry is neither removed nor overwritten until that save settles

#### Scenario: A conflict is reported before an SSE response is opened

- **GIVEN** a generation is already owned for this principal and conversation path
- **WHEN** a second request to `POST /api/v1/conversations/completions` reaches `register`
- **THEN** the rejection reaches the exception filter with `res.headersSent` false, and the client receives a `409` with the conflict message rather than a `200` with an empty body

#### Scenario: A released key admits the next generation

- **WHEN** the owning worker settles a generation, removing its registry entry
- **THEN** a later `register` for the same `ownerKey + path` succeeds
