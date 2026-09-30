## ADDED Requirements

### Requirement: Optional per-frame batching of displayed chunks

`useConversationStream` SHALL accept an optional `batchChunksPerFrame?: boolean` parameter, default `false`. With the default, chunk application is exactly as it is today.

When `batchChunksPerFrame` is `true`:

- **Per chunk:**
  - Each accepted chunk SHALL still be applied synchronously to the per-path buffered message. The buffer is never deferred, so restore-after-navigation and completion checks see every chunk immediately.
  - The display write (`setConversation` with the buffered message) SHALL be coalesced: at most one pending write per conversation path, scheduled with `requestAnimationFrame`. A `setTimeout(…, 16)` fallback is used when `requestAnimationFrame` is unavailable.
- **At flush time:** the pending write SHALL re-check the same guards the immediate write uses: the generation is not superseded, the path is displayed, and a previous conversation exists. It then applies `restoreBufferedMessage` with the buffer's current content and assigns `state.conversationRef.current` inside the updater, as today.
- **Before terminal transitions:** a pending write SHALL be flushed synchronously before any of the following touches displayed state for that path:
  - the completion reload's `setConversation`;
  - error handling and interrupted-stream recovery;
  - `handleStop`'s settle;
  - a superseding `startStream` for the same path.
- **Cancellation:** a pending write SHALL be cancelled, not flushed, when the path stops being displayed or the hook unmounts.
- **Resume path:** the resume path (`generation-resume.ts` chunk application) SHALL batch the same way.

The parameter is host-agnostic and uses only the standard browser frame API. `apps/chat` passes `true`. This adds no user-visible string, feature flag or telemetry. The message log's `aria-live` region still receives every text addition, at most one frame later.

#### Scenario: Several chunks in one frame produce one displayed update

- **GIVEN** `batchChunksPerFrame: true` and a displayed streaming conversation
- **WHEN** three chunks arrive before the next animation frame
- **THEN** `setConversation` is invoked once when the frame fires, and the displayed message contains all three chunks' content

#### Scenario: Completion never shows an older state than the last chunk

- **GIVEN** `batchChunksPerFrame: true` and a chunk whose display write is still pending
- **WHEN** the stream completes
- **THEN** the pending write is flushed before the completion reload, and no later frame re-applies the buffer over the reloaded conversation

#### Scenario: A pending write is dropped when the user navigates away

- **GIVEN** `batchChunksPerFrame: true` and a pending display write for path P
- **WHEN** P stops being the displayed path before the frame fires
- **THEN** the write is cancelled and the newly displayed conversation is untouched, while P's buffer still holds all chunks

#### Scenario: The default keeps synchronous application

- **WHEN** `batchChunksPerFrame` is omitted
- **THEN** each accepted chunk calls `setConversation` synchronously, as before
