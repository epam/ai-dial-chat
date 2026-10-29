## MODIFIED Requirements

### Requirement: Outstanding SSE operations observed by lifecycle

The application SHALL expose the observable gauge `dial.chat.sse.active`, exported by Prometheus as `dial_chat_sse_active`, with only the fixed `kind` values `client_channel`, `conversation_watch`, `generation_attach`, and `conversation_titles`. Client-channel subscribe and conversation-watch operations SHALL count from before asynchronous setup until their handlers settle. Generation attach operations SHALL count until subscription cleanup, including after the handler returns. Title-stream operations SHALL count from admission through request-owned asynchronous cleanup, including pending queue/read detachment. Cleanup SHALL release each operation's contribution at most once. Ordinary completion-response delivery SHALL NOT contribute to this SSE gauge. Ownership SHALL be tracked through `apps/chat-api/src/telemetry/runtime-metrics.ts`.

#### Scenario: Subscribe or watch setup is pending

- **WHEN** a client-channel subscription or conversation watch is awaiting upstream setup
- **THEN** its kind's gauge includes the operation
- **AND** a client disconnect alone does not remove it while the asynchronous handler is pending

#### Scenario: Subscribe or watch settles

- **WHEN** the asynchronous handler completes or fails
- **THEN** its contribution is removed exactly once

#### Scenario: Attached generation outlives the handler

- **WHEN** a generation attach handler returns with its subscription still active
- **THEN** `generation_attach` continues to include that subscription
- **AND** its contribution is removed exactly once when subscription cleanup runs

#### Scenario: Shutdown releases attached generation subscriptions

- **WHEN** the application shuts down with registered generations and attached subscriptions
- **THEN** the generations emit a stopped terminal event
- **AND** the attached subscriptions run their cleanup and release their gauge contributions

#### Scenario: Title stream is still cleaning up

- **WHEN** its HTTP connection closes but request-owned cancellation has not settled
- **THEN** `conversation_titles` includes the operation until cleanup settles
- **AND** repeated close/abort/finally paths remove its contribution only once

## ADDED Requirements

### Requirement: Title delivery and Core-read latency are measured separately

The BFF SHALL expose the following OpenTelemetry instruments under the existing metrics exporter enablement:

| Instrument                                            | Type / unit         | Measurement                                                                                     |
| ----------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| `dial.chat.conversation_titles.first_result.duration` | Histogram / seconds | Stream admission to the first successful title frame accepted by the response writer            |
| `dial.chat.conversation_titles.read.duration`         | Histogram / seconds | Actual SDK title-body read duration, once per coalesced read, with fixed `outcome: success, failed, cancelled` |
| `dial.chat.conversation_titles.queue.duration`        | Histogram / seconds | Global read admission duration, with fixed `outcome: admitted, rejected, cancelled`             |
| `dial.chat.conversation_titles.results`               | Counter             | Item outcome frames accepted by the writer, with fixed `outcome: resolved, unavailable, failed` |

First-result latency SHALL record once only for a stream that delivers a title; an unavailable/error-only stream SHALL not manufacture a zero-latency success. These metrics SHALL have no ID/title/token/user/deployment/URL labels and SHALL retain no request or credential objects. Metrics failures SHALL not change request behavior. Overall HTTP response duration SHALL retain its existing meaning and SHALL not be relabeled as time to first title. No browser analytics or new feature flag SHALL be introduced.

#### Scenario: One fast and one slow title

- **WHEN** the first title is emitted while a second read is still pending
- **THEN** first-result latency is recorded immediately and independently of eventual response duration

#### Scenario: Two streams coalesce an upstream read

- **WHEN** two streams share one actual SDK read and both deliver its title
- **THEN** read duration is recorded once, while each stream records its own emitted outcome and first-result timing when applicable

#### Scenario: No title can be delivered

- **WHEN** a stream emits only unavailable/error outcomes or closes before its first title
- **THEN** no successful first-result sample is recorded, and cleanup/lifecycle instrumentation still settles
