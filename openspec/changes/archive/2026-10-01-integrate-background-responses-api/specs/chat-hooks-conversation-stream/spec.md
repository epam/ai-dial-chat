# Spec Delta

## ADDED Requirements

### Requirement: A pending background message is awaiting resume

The hook's awaiting-generation detection SHALL treat a conversation that contains a message with `backgroundGeneration.status: "pending"` — at any position, even when that message already carries a `responseId` or other payload and even when a status message follows it — as awaiting resume. The resume SHALL seed and update the buffered message at **that** message's index (not at the last index), and its terminal reload check SHALL compare against that index. A message whose `backgroundGeneration.status` is `completed`, `stopped`, or `failed` SHALL NOT make the conversation awaiting resume. For conversations without `backgroundGeneration`, detection and the buffer index SHALL behave exactly as before this change.

The hook SHALL read only this data field of the conversation it is given. It SHALL NOT call DIAL Core, read feature flags, or know which deployments are eligible — the backend's attach and Stop endpoints, reached through the injected transport, perform all recovery.

**State owner:** `useConversationStream` (existing per-path streaming state); no new context. **UI / i18n / RTL / a11y impact:** none — the existing generating indicator, error banner and Retry are reused.

#### Scenario: Pending background message with responseId resumes

- **WHEN** a conversation is loaded that contains a message with `responseId` set and `backgroundGeneration.status: "pending"`
- **THEN** it is detected as awaiting resume and the hook attaches through the transport

#### Scenario: Pending message followed by a status message resumes at its own index

- **WHEN** the conversation is `[user, assistant{backgroundGeneration.status: "pending"}, status(model changed)]` and the attach replays chunks
- **THEN** the chunks update the assistant message at index 1, and the status message at index 2 is unchanged

#### Scenario: Finished background message does not resume

- **WHEN** every message with `backgroundGeneration` has `status` `completed`, `stopped`, or `failed`, and the last message is not otherwise an unresolved placeholder
- **THEN** it is not awaiting resume and renders normally

#### Scenario: Messages without the field are unchanged

- **WHEN** no message in the conversation has a `backgroundGeneration` field
- **THEN** awaiting-resume detection returns the same result as before this change

#### Scenario: Replay from the beginning shows no duplicates

- **WHEN** an attach delivers a snapshot of the stored empty placeholder followed by chunks replayed from the first token
- **THEN** the displayed message equals the concatenation of the replayed chunks, with no text repeated

### Requirement: A stream that ends on a pending background message resumes

When a completion stream or an attach stream ends and the hook's reload via `transport.getConversation` returns a conversation that contains a message with `backgroundGeneration.status: "pending"`, the hook SHALL NOT settle the path as finished. It SHALL keep the path streaming and start the existing attach-then-watch resume flow for it, exactly as on page load. This covers a stream ended by the backend's max-duration detach and a final save that failed and left the message `pending`. A message without `backgroundGeneration`, or with a finished status, SHALL settle exactly as before this change.

#### Scenario: Max-duration detach resumes instead of settling

- **WHEN** the completion stream ends without a terminal event and the reloaded conversation contains a `pending` background message
- **THEN** the path stays streaming, the hook attaches through the transport, and the generating indicator stays visible

#### Scenario: Normal completion still settles

- **WHEN** the completion stream ends and the reloaded last message has `backgroundGeneration.status: "completed"` or no `backgroundGeneration`
- **THEN** the path settles and streaming state is cleared, as before this change

### Requirement: Stop is available for a resumed background generation

While the hook is resuming a conversation that contains a message with `backgroundGeneration.status: "pending"` — after a page load, a refresh, or navigation back — `canStopStreaming` SHALL be `true` for that path, and `handleStop` SHALL call `transport.stopCompletion({ generationId, path })` with `generationId` taken from the message's `backgroundGeneration.generationId`. The resume SHALL then settle through its existing terminal handling (the attach `stopped` event or a watch update, followed by the reload). For a resumed message without `backgroundGeneration`, Stop availability SHALL stay as before this change.

The hook SHALL only read the id from the conversation it is given; it SHALL NOT decide eligibility or call DIAL Core. **UI / i18n / RTL / a11y impact:** none new — the existing Stop control, its label, and its keyboard behavior are reused.

#### Scenario: Stop after a refresh

- **GIVEN** the page was refreshed during a background generation and the hook resumed it through attach
- **WHEN** the user activates Stop
- **THEN** `transport.stopCompletion` is called with the message's `backgroundGeneration.generationId`, and after the attach `stopped` event the reloaded stopped partial is shown and `isStreaming`/`canStopStreaming` become `false`

#### Scenario: Resumed non-background message keeps today's Stop behavior

- **WHEN** the hook resumes a conversation whose last message has no `backgroundGeneration`
- **THEN** `canStopStreaming` behaves exactly as before this change
