## ADDED Requirements

### Requirement: Attached terminal read failures allow read-only recovery

The attach/watch terminal reconciliation SHALL distinguish a rejected conversation read from an explicit `conversation_save_failed` terminal event. A failed read SHALL retain the assembled snapshot and deltas, including stages-only responses, settle streaming controls, and notify the owning `useConversationStream` of a retryable read failure without writing a persistence warning onto the message. Retry SHALL repeat the terminal read with the same buffer-ownership guards. Successful reads SHALL retain existing authoritative-server, placeholder-protection, and background-status semantics. An explicit persistence-error event SHALL continue to retain output with its host-translated warning without a terminal reload. No wire contract, feature gate, telemetry, or generated-client change is introduced.

#### Scenario: Attach reports done but the terminal GET is blocked

- **WHEN** an attached client receives snapshot and deltas, then a done event, but its terminal GET rejects
- **THEN** it retains the assembled answer and exposes a reload notification without a generation or persistence error

#### Scenario: Attached read retry succeeds

- **WHEN** the user retries the terminal read and receives the saved enriched answer
- **THEN** the hook applies the server result and clears the reload notification without another completion or save

#### Scenario: An attached retry loses ownership

- **WHEN** a newer generation replaces the resumed buffer while its retry is pending
- **THEN** the late result or failure cannot overwrite the newer answer or attach a stale notification
