## ADDED Requirements

### Requirement: App-level generation context survives navigation

`GenerationContext` (`apps/chat/src/context/GenerationContext.tsx`) SHALL be mounted above the router so an in-flight stream is not torn down when the user navigates between conversations. It exposes `startGeneration(path, generationId)`, `stopGeneration`, `completeGeneration`, and `getGeneration(path)`. The conversation page MUST NOT abort the generation on unmount; only an explicit Stop or tab close ends it.

#### Scenario: Navigating between chats keeps the stream alive

- **WHEN** a generation is active and the user navigates to another conversation and back
- **THEN** the stream is not aborted and the answer is persisted to its originating conversation

### Requirement: Chunks and reloads are scoped to the displayed conversation

Because the conversation page is not remounted between conversations, `useConversationStream` SHALL guard every state write by the currently displayed conversation path: `onChunk` applies a chunk only when its stream path matches the displayed conversation (and the `generationId` is current), and `onComplete`/`onError` reload or mutate state only when their path is still displayed. `isStreaming` SHALL reflect only the displayed conversation.

#### Scenario: Stream into a background conversation does not touch the foreground

- **WHEN** a stream for conversation A is running and the user is viewing conversation B
- **THEN** A's chunks and completion reload do not modify B's displayed state, and B does not show a typing indicator

#### Scenario: Returning to a streaming conversation resumes live rendering

- **WHEN** the user returns to a conversation whose stream is still active
- **THEN** subsequent chunks render live again because the path matches

### Requirement: Auto-start on load is idempotent

When a loaded conversation ends with a user message, the page SHALL render the assistant placeholder and start a generation at most once per conversation, guarded by an already-started set and `getGeneration(path)`. The placeholder MUST be rendered even when the start is skipped, so chunks have a slot to land in. This prevents React StrictMode's double mount from launching a duplicate generation (which the backend rejects with 409).

#### Scenario: StrictMode double mount starts one generation

- **WHEN** `loadConversation` runs twice for a new conversation ending in a user message
- **THEN** exactly one generation is started and the placeholder is shown both times

### Requirement: Stop shows what was received, race-free

`handleStop` SHALL only call the stop API; it MUST NOT abort the local fetch or reload eagerly. The backend aborts upstream, saves the partial, then closes the stream, so the fetch ends naturally via `onComplete`, which reloads the saved partial. Because the backend saves before ending the response, the displayed content matches the persisted content (no empty-on-stop / text-on-refresh mismatch). An empty stopped assistant message SHALL render a localized "Stopped generating" label at display time rather than writing that text into the message content.

#### Scenario: Stop early then refresh

- **WHEN** the user stops a generation before any token and later refreshes
- **THEN** both views are consistent and an empty stopped message shows the "Stopped generating" label

#### Scenario: Stop mid-stream preserves received tokens

- **WHEN** the user stops after some tokens have streamed
- **THEN** the displayed partial answer matches the saved partial answer
