# generation-stream-recovery Specification

## Purpose

Client-side recovery of a live generation whose completion stream was interrupted (device sleep, phone lock, network loss): the built-in transport tags network-level loss and idle silence as `StreamInterruptedError`, and `useConversationStream` re-checks the server copy and rejoins the still-running generation through the attach/watch resume flow, shows an already-saved answer, or falls back to the error banner — keeping Stop available throughout.

## Requirements

### Requirement: The built-in transport reports a network-level interruption as `StreamInterruptedError`

`libs/chat-hooks` SHALL export `StreamInterruptedError`, an `Error` subclass with `name === 'StreamInterruptedError'` and an optional `cause` that holds the original error. `createChatStreamApi`'s `streamCompletion` SHALL report a `StreamInterruptedError` through `onError` in exactly these cases:

- `fetch` rejects with a non-abort error, for example `TypeError: Failed to fetch` or `Load failed`;
- `reader.read()` rejects with a non-abort error after a 2xx response;
- the idle watchdog fires (see the next requirement).

It SHALL NOT use `StreamInterruptedError` for:

- a non-OK HTTP status, which is still a generic `Error` or a `GenerationConflictError` for `409`;
- a missing response body;
- an in-band error chunk (`StreamUpstreamError` / `GenerationPersistenceError`);
- a caller-initiated abort, which stays silent as today.

`streamCompletion` SHALL report at most one terminal callback (`onComplete` or `onError`) per call.

#### Scenario: Mid-stream read failure is tagged
- **WHEN** a 2xx completion response is being read and `reader.read()` rejects with `TypeError('network error')`
- **THEN** `onError` is called once with a `StreamInterruptedError` whose `cause` is that `TypeError`, and `onComplete` is not called

#### Scenario: Fetch rejection is tagged
- **WHEN** `fetch` rejects with `TypeError('Failed to fetch')`
- **THEN** `onError` receives a `StreamInterruptedError`

#### Scenario: HTTP errors are not interruptions
- **WHEN** the completion response status is `502`
- **THEN** `onError` receives an error that is not a `StreamInterruptedError`

#### Scenario: Caller abort stays silent
- **WHEN** the caller's `signal` aborts while the stream is open
- **THEN** neither `onError` nor `onComplete` is called

### Requirement: The built-in transport detects a stalled stream with an idle watchdog

After a 2xx response is received, `createChatStreamApi` SHALL record the time of the last received body byte. SSE comment lines such as `: init` and `: keepalive` count as bytes. The watchdog SHALL declare the stream stalled when no byte has arrived for `idleTimeoutMs`. That value is a new optional `CreateChatStreamApiDeps.idleTimeoutMs`, defaulting to `DEFAULT_STREAM_IDLE_TIMEOUT_MS = 45_000`, which is three backend keepalive intervals. A stalled stream SHALL be handled as follows:

1. cancel the response reader, which is the transport's own cancellation and does not abort the caller's `signal`;
2. report `StreamInterruptedError` through `onError`;
3. suppress any later read error or end-of-stream from that cancelled reader.

The watchdog SHALL be evaluated:

- by a timer that is re-armed on every received byte;
- immediately on `document` `visibilitychange` when `document.visibilityState === 'visible'`;
- immediately on `window` `online`;
- immediately on `window` `pageshow`.

Timers can be frozen or throttled while a device sleeps, so a wake-up SHALL be noticed without waiting for a timer. Every listener and timer SHALL be removed when the stream settles or the caller aborts. The watchdog SHALL use only standard DOM APIs, and SHALL do nothing when `window`/`document` are undefined (non-browser hosts).

#### Scenario: A silent socket is detected by the timer
- **WHEN** a 2xx stream receives bytes, then none for `idleTimeoutMs`
- **THEN** the reader is cancelled and `onError` receives one `StreamInterruptedError`

#### Scenario: Wake-up past the deadline is detected immediately
- **WHEN** the last byte arrived more than `idleTimeoutMs` ago and `visibilitychange` fires with `visibilityState === 'visible'`
- **THEN** the stream is declared stalled synchronously within that event handler, without waiting for the timer

#### Scenario: A healthy stream is not interrupted on wake
- **WHEN** `visibilitychange` or `online` fires while the last byte arrived less than `idleTimeoutMs` ago
- **THEN** the stream continues and no error is reported

#### Scenario: Keepalive comments keep the stream alive
- **WHEN** the stream receives only `: keepalive` comments every 15 s for several minutes
- **THEN** the watchdog never fires

#### Scenario: Listeners are released on settle
- **WHEN** the stream completes, errors, or is aborted by the caller
- **THEN** its `visibilitychange`, `online`, and `pageshow` listeners and its idle timer are removed

### Requirement: An interrupted generation is recovered against the server copy

State ownership: all recovery state SHALL live inside `useConversationStream`, in its existing refs `bufferedGenerationsRef`, `resumingPathsRef`, `activeGenerationIdsRef` and `latestGenerationIdsRef`. No context, prop, or host callback is added.

When `startStream`'s `onError` receives a `StreamInterruptedError` for a generation that is not superseded, the hook SHALL NOT settle it as a failure. It SHALL instead:

1. Call `onStreamError` once with the error, as for every error.
2. Keep the path in `streamingPaths`, keep the buffered live message and the displayed partial content, and write no `streamErrorMessage`.
3. Add the path to `resumingPathsRef`, so a concurrent `resumeIfAwaitingGeneration` from a conversation reload does not start a second resume.
4. Re-fetch the conversation with `transport.getConversation`, retrying on rejection with the bounded backoff `RECOVERY_REFETCH_DELAYS_MS = [1000, 2000, 4000, 8000, 16000]`, which gives six attempts. A `window` `online` event SHALL trigger the pending retry immediately.
5. Classify the fetched conversation `server` against the local placeholder index `messageIndex`:
   - **Still generating.** `server.messages.length - 1 === messageIndex` and `isAwaitingGenerationResume(server)` is true. The hook SHALL hand over to the resume flow (attach, then watch fallback), which is the same flow `resumeIfAwaitingGeneration` runs. The resume buffer SHALL be seeded with the local buffered message, not the server's empty placeholder, so the partial content never blanks out before the attach `snapshot` arrives.
   - **Already finished.** `server.messages.length - 1 === messageIndex`, the last message is an assistant message, and `isAwaitingGenerationResume(server)` is false. The hook SHALL settle exactly as `onComplete` does after a successful reload: apply `server` to the displayed state and clear the buffer.
   - **Not recoverable.** Any other shape, for example the request never reached the backend, or every retry rejected. The hook SHALL settle exactly as the existing transport-error path does: restore the buffered partial, write `streamErrorMessage: ''`, and clear the streaming state.
6. Apply every state write only while `isPathDisplayed(path)` holds and the generation is not superseded, as for live stream callbacks.

Settlement bookkeeping runs once, when recovery ends in any outcome, including after a handover once the resume flow settles:

- `removeStreamingPath` (unless superseded);
- clearing this path's `activeGenerationIdsRef` entry and stoppable state when they still hold this generation;
- `completeGeneration`;
- `channel?.notifyGenerationSettled`;
- `overlay?.notifyGenerationEnd`, unless the user stopped the generation.

No new i18n keys: recovery reuses the typing indicator, and the fallback reuses `chat.streamErrorTitle`/`chat.streamError`. No RTL or a11y impact, since no markup is added. The feature is not gated by `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES`. No cache is introduced. Observability is the existing `onStreamError`, which receives the `StreamInterruptedError`; no metric is added.

#### Scenario: Device wakes while the backend is still generating
- **GIVEN** a live generation has streamed partial content at `messageIndex`
- **WHEN** `onError` receives a `StreamInterruptedError` and the re-fetched conversation's last message, at `messageIndex`, is the unresolved placeholder
- **THEN** no error banner is shown, the partial content stays visible, `isStreaming` stays `true`, `transport.attachToGeneration` is called for the path, and the attach `snapshot`/`chunk` events update the message

#### Scenario: Device wakes after the backend finished
- **WHEN** `onError` receives a `StreamInterruptedError` and the re-fetched conversation's last message at `messageIndex` is a completed assistant answer
- **THEN** the displayed conversation is replaced with the fetched one, `isStreaming` becomes `false`, and no `streamErrorMessage` is written

#### Scenario: Network is still down on wake
- **WHEN** `transport.getConversation` rejects on the first attempts and a later retry, possibly triggered by `online`, succeeds within the backoff bound
- **THEN** recovery continues with that result as if the first attempt had succeeded

#### Scenario: Recovery gives up
- **WHEN** every re-fetch attempt rejects, or the fetched conversation has no assistant message at `messageIndex`
- **THEN** the buffered partial is restored with `streamErrorMessage: ''`, `isStreaming` and `canStopStreaming` become `false`, and the host renders the existing banner

#### Scenario: Reload during recovery does not double-resume
- **WHEN** the user navigates away and back during recovery, and the host calls `resumeIfAwaitingGeneration` with the reloaded placeholder conversation
- **THEN** that call is a no-op, the recovery's own handover remains the only attach, and `restoreBufferedGeneration` returns the buffered partial content

#### Scenario: A superseded generation does not recover
- **WHEN** a `StreamInterruptedError` arrives for a generation that a newer generation on the same path has superseded
- **THEN** no re-fetch is made and no state is written

#### Scenario: Other errors keep today's behavior
- **WHEN** `onError` receives a `GenerationPersistenceError`, `StreamUpstreamError`, a `GenerationConflictError` for a start that did not pass `resumeOnConflict`, or any other error that is not a `StreamInterruptedError`
- **THEN** it is settled exactly as before this change, with no re-fetch

#### Scenario: An opted-in conflict uses the conflict handover, not this recovery
- **WHEN** `onError` receives a `GenerationConflictError` for a start that passed `resumeOnConflict: true`
- **THEN** it follows `chat-hooks-conversation-stream`'s "A conflict on an opted-in start joins the running generation", which shares this requirement's re-fetch schedule and classification, and is not settled immediately

### Requirement: Stop remains available during recovery

Recovery starts from a locally-started generation whose `generationId` the hook knows. So, unlike a resume that starts on page load, `canStopStreaming` SHALL stay `true` for the path throughout recovery, including after the handover to attach/watch. `handleStop` SHALL keep calling `transport.stopCompletion({ generationId, path, content })`, where `content` is the buffered message text for the path (sent so the backend can save a background generation's stopped answer; `ConversationStreamTransport.stopCompletion` declares it `content?: string`), and recovery SHALL settle through the resume flow's terminal handling once the backend confirms the stop (the attach `stopped` event, or a watch update, followed by the reload).

#### Scenario: User stops during recovery
- **WHEN** recovery has handed over to attach and the user activates Stop
- **THEN** `transport.stopCompletion` is called with the original `generationId`; when the attach stream emits `stopped`, the reloaded stopped partial is shown, `isStreaming`/`canStopStreaming` become `false`, and `overlay.notifyGenerationEnd` is not called
