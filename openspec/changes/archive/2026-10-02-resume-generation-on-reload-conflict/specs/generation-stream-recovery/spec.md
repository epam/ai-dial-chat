## MODIFIED Requirements

### Requirement: An interrupted generation is recovered against the server copy

State ownership: all recovery state SHALL live inside `useConversationStream`, in its existing refs `bufferedGenerationsRef`, `resumingPathsRef`, `activeGenerationIdRef` and `latestGenerationIdsRef`. No context, prop, or host callback is added.

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
- clearing `activeGenerationIdRef`/`stoppablePath` when they still hold this generation;
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
