# app-level-generation-manager Specification

## Purpose

Frontend ownership of the streaming-generation UI: an app-level context that keeps a stream alive across conversation navigation, plus the per-conversation guards that keep chunks, reloads, stop, and the streaming indicator scoped to the displayed conversation.

## Requirements

### Requirement: App-level generation context survives navigation

`GenerationContext` (`apps/chat/src/context/GenerationContext.tsx`) SHALL be mounted above the routed conversation pages — inside the authenticated route subtree but outside any per-conversation component — so an in-flight stream is not torn down when the user navigates between conversations. The conversation page MUST NOT abort the generation on unmount; only an explicit Stop or tab close ends it.

The context SHALL keep a registry of generation entries keyed by conversation path, each carrying `generationId`, `path`, its `AbortController`, and a `ClientGenerationStatus` of `Active` or `Done`. The registry SHALL live in a ref rather than in state, so recording a generation never re-renders consumers. It exposes exactly three functions:

- `startGeneration(path, generationId): AbortController` — aborts the path's existing entry when that entry is still `Active`, then registers and returns a fresh `AbortController` for the new generation.
- `completeGeneration(path, generationId): void` — marks the path's entry `Done`, and only when the entry's `generationId` still matches, so a late completion from a superseded generation cannot clear the current one.
- `getGeneration(path): GenerationEntry | undefined` — reads the current entry for a path.

There SHALL be no `stopGeneration` on the context: stopping is the streaming hook's concern (see "Stop shows what was received, race-free"), because it involves the backend stop call rather than the local registry.

`useGeneration()` SHALL throw when called outside `GenerationProvider`.

The streaming hook in `libs/chat-hooks` SHALL NOT read this context: the app passes `{ startGeneration, completeGeneration }` into `useConversationStream` as a `generation` parameter, keeping the library free of app contexts.

#### Scenario: Navigating between chats keeps the stream alive

- **WHEN** a generation is active and the user navigates to another conversation and back
- **THEN** the stream is not aborted and the answer is persisted to its originating conversation

#### Scenario: Starting a second generation for the same conversation supersedes the first

- **WHEN** `startGeneration` is called for a path whose existing entry is still `Active`
- **THEN** that entry's `AbortController` is aborted and a new controller is registered and returned

#### Scenario: A superseded generation cannot complete the current one

- **WHEN** `completeGeneration(path, generationId)` is called with an id that no longer matches the path's entry
- **THEN** the entry is left `Active` and untouched

#### Scenario: useGeneration outside the provider throws

- **WHEN** `useGeneration()` is called outside `GenerationProvider`
- **THEN** it throws a descriptive error

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

`handleStop` — exposed by `useConversationStream`, not by the generation context — SHALL only call the stop API; it MUST NOT abort the local fetch or reload eagerly. The backend aborts upstream, saves the partial, then closes the stream, so the fetch ends naturally via `onComplete`, which reloads the saved partial. Because the backend saves before ending the response, the displayed content matches the persisted content (no empty-on-stop / text-on-refresh mismatch).

It SHALL be a no-op unless there is an active generation whose path is the displayed conversation, so a Stop click can never target a stream running in a background conversation. The stopped generation's id SHALL be recorded, so the completion that follows is recognised as a stop rather than a natural end.

An empty stopped assistant message SHALL render a localized "Stopped generating" label at display time rather than writing that text into the message content. The label SHALL be supplied by the host as a `stoppedGeneratingText` prop rather than translated inside the rendering component.

#### Scenario: Stop early then refresh

- **WHEN** the user stops a generation before any token and later refreshes
- **THEN** both views are consistent and an empty stopped message shows the "Stopped generating" label

#### Scenario: Stop mid-stream preserves received tokens

- **WHEN** the user stops after some tokens have streamed
- **THEN** the displayed partial answer matches the saved partial answer

#### Scenario: Stop does not reach a background conversation's stream

- **WHEN** a stream for conversation A is running while the user views conversation B and Stop is invoked
- **THEN** no stop request is sent, because the active generation's path is not the displayed conversation
