## MODIFIED Requirements

### Requirement: Generation gauge reflects the physical registry

The application SHALL expose the observable gauge `dial.chat.generations.active`, exported by
Prometheus as `dial_chat_generations_active`, with exactly one bounded application attribute
`state`, taking only the fixed generation lifecycle values `active`, `cancel_requested`,
`finalizing`, and `settling`. It SHALL report the number of entries physically retained in the
generation registry, broken down by that state and including entries that are cancelling,
finalizing, or retained pending an unsettled persistence write. Entry insertion, removal,
replacement, and shutdown SHALL keep the gauge consistent with registry ownership. The gauge
SHALL NOT claim to count upstream tasks that outlive their registry entries.

A released entry contributes nothing, so the `released` lifecycle value SHALL NOT be reported.

A falling gauge value SHALL NOT be documented or interpreted as evidence that conversations were
durably persisted. It reports retention only. `state="settling"` specifically means an entry whose
terminal write has not settled within the finalization bound and which therefore still owns its
registry key — the operational signal that ownership is being retained, as
`generation-registry` requires.

The gauge SHALL continue to carry no user, conversation, deployment, session, or Kubernetes pod
identifier, and its instrumentation SHALL continue to retain no request, credential, stream, or
per-user key.

#### Scenario: Generation remains registered during persistence
- **WHEN** a stopped or aborted generation is still registered while persistence is pending
- **THEN** it continues to contribute to the generation gauge, reported as `state="finalizing"`

#### Scenario: A retained entry awaiting an unsettled write is distinguishable from live work
- **GIVEN** a generation's terminal write has not settled within the finalization bound
- **WHEN** runtime metrics are collected
- **THEN** the entry is reported as `state="settling"` and is not counted as `state="active"`

#### Scenario: Registry entry released or replaced
- **WHEN** an entry is removed on completion, error, stale cancellation reaching settlement, or shutdown
- **THEN** the removed entry no longer contributes to the gauge
- **AND** a new entry registered for the same registry key after release does not double count the key

#### Scenario: A falling gauge is not evidence of successful persistence
- **WHEN** the gauge value decreases
- **THEN** neither the metric description nor the operational documentation asserts that the corresponding conversations were durably persisted

#### Scenario: Runtime metrics do not contain unbounded identifiers
- **WHEN** runtime memory and active-operation gauges are collected
- **THEN** their application attributes contain only the specified fixed `kind` and `state` values, where applicable
- **AND** they contain no user, conversation, deployment, or Kubernetes pod identifiers
