# Spec Delta

## MODIFIED Requirements

### Requirement: Stop is available for a resumed background generation

While the hook is resuming a conversation that contains a message with `backgroundGeneration.status: "pending"` — after a page load, a refresh, or navigation back — `canStopStreaming` SHALL be `true` for that path, and `handleStop` SHALL call `transport.stopCompletion({ generationId, path, content })` with `generationId` taken from the message's `backgroundGeneration.generationId`. The resume SHALL then settle through its existing terminal handling (the attach `stopped` event or a watch update, followed by the reload). For a resumed message without `backgroundGeneration`, Stop availability SHALL stay as before this change, except where "Stop is available for a resumed foreground generation" defines an attach-supplied id.

The hook SHALL only read the id from the conversation it is given; it SHALL NOT decide eligibility or call DIAL Core. **UI / i18n / RTL / a11y impact:** none new — the existing Stop control, its label, and its keyboard behavior are reused.

#### Scenario: Stop after a refresh

- **GIVEN** the page was refreshed during a background generation and the hook resumed it through attach
- **WHEN** the user activates Stop
- **THEN** `transport.stopCompletion` is called with the message's `backgroundGeneration.generationId`, and after the attach `stopped` event the reloaded stopped partial is shown and `isStreaming`/`canStopStreaming` become `false`

#### Scenario: Resumed non-background message keeps today's Stop behavior

- **WHEN** the hook resumes a conversation whose last message has no `backgroundGeneration` and the attach `snapshot` supplies no `generationId`
- **THEN** `canStopStreaming` behaves exactly as before this change

## ADDED Requirements

### Requirement: Stop is available for a resumed foreground generation

While the hook is resuming a non-background generation through `transport.attachToGeneration`, and the attach `snapshot` event carried a `generationId`, `canStopStreaming` SHALL be `true` for that path and `handleStop` SHALL call `transport.stopCompletion({ generationId, path, content })` with that id. This applies only to a resume started through the public `resumeIfAwaitingGeneration` entry point (a page load, a refresh, or navigation back). The resume the hook starts internally — the conflict handover of "A conflict on an opted-in start joins the running generation" and the recovery of `generation-stream-recovery` — SHALL NOT record or act on the attach-supplied id, so their Stop behavior stays exactly as those requirements define it (`canStopStreaming` is `false` throughout a conflict handover; it stays `true` throughout recovery because the local id is known).

The attach-supplied id SHALL be used by `handleStop` only when the page instance has no local generation id for the path and the resumed conversation has no pending background message; a local id and a background message's `backgroundGeneration.generationId` keep precedence, in that order. Recording and forgetting the attach-supplied id SHALL NOT change the stoppable state of a path that has an active local generation. The hook SHALL only read the id from the attach stream; it SHALL NOT decide eligibility or call DIAL Core.

The id SHALL be recorded for the path when the `snapshot` is applied and forgotten when the resume settles for any reason — a terminal event, the attach stream ending without one (the hook then continues on the watch fallback, where no id is known and Stop is unavailable), or a failed final reload. Stop SHALL then settle through the existing terminal handling: the attach `stopped` event is followed by the usual `transport.getConversation` reload, and `isStreaming` and `canStopStreaming` become `false`. After the user activates Stop for the id, replayed `chunk` events SHALL NOT be applied to the displayed message, as for a resumed background generation. A `404` from Stop keeps the handling of "Stop is sent once per generation and a 404 is reported only when the generation keeps running".

For a `snapshot` without a `generationId`, or a resume that never attached, Stop availability SHALL stay as before this change. State ownership stays inside the hook; no new prop or context is introduced. **UI / i18n / RTL / a11y impact:** none new — the existing Stop control, its label, and its keyboard behavior are reused.

#### Scenario: Stop after a refresh of a non-background generation

- **GIVEN** the page was refreshed during a non-background generation and the hook resumed it through attach, whose `snapshot` carried `generationId` `G`
- **WHEN** the user activates Stop
- **THEN** `transport.stopCompletion` is called once with `generationId: G` and the conversation path, and after the attach `stopped` event the reloaded stopped partial is shown and `isStreaming` and `canStopStreaming` become `false`

#### Scenario: Chunks replayed after Stop are not applied

- **GIVEN** the user activated Stop for the attach-supplied id
- **WHEN** further `chunk` events arrive before the terminal event
- **THEN** the displayed message does not change until the reload applies the stopped partial

#### Scenario: A snapshot without an id keeps Stop hidden

- **WHEN** the resume attaches but the `snapshot` has no `generationId`
- **THEN** `canStopStreaming` is `false` and no `stopCompletion` request can be sent for the resumed generation

#### Scenario: The watch fallback has no id

- **WHEN** the attach stream ends without a terminal event and the hook continues on `transport.watchConversation`
- **THEN** the recorded id is dropped, `canStopStreaming` is `false`, and the input stays blocked until the watch resolves

#### Scenario: A local id and a background marker keep precedence

- **WHEN** the page instance started the generation itself, or the resumed conversation has a pending background message
- **THEN** `handleStop` sends the local id, or the background message's `generationId`, respectively, never the attach-supplied one

#### Scenario: A conflict handover keeps Stop hidden

- **GIVEN** a start with `resumeOnConflict: true` was handed over to the resume flow after a `409`
- **WHEN** the attach `snapshot` of the joined generation carries a `generationId`
- **THEN** `canStopStreaming` stays `false`, exactly as "A conflict on an opted-in start joins the running generation" specifies

#### Scenario: Recovery keeps its Stop behavior

- **WHEN** a locally-started generation is recovered through attach and the `snapshot` carries a `generationId`
- **THEN** `canStopStreaming` stays `true` throughout and Stop sends the original local `generationId`, as "Stop remains available during recovery" specifies, and the end of the attach does not clear it before the recovery settles

#### Scenario: A local generation's Stop is never cleared by the attach id lifecycle

- **GIVEN** the path has an active local generation
- **WHEN** an attach-supplied id is recorded and later forgotten for that path
- **THEN** the path's stoppable state for the local generation is unchanged
