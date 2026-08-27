# backend-owned-generation-persistence Specification

## Purpose

The backend owns conversation persistence across the generation lifecycle — saving the start, final, and partial (stop/error) states — so the frontend never races to save and chunks cannot land in the wrong conversation.

## Requirements

### Requirement: Backend persists the conversation across the generation lifecycle

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, invoked via the `ConversationService` facade) SHALL own conversation persistence for a completion. The frontend MUST NOT call `saveConversation` during streaming. The backend SHALL save at the start of generation (user message + empty assistant placeholder), on successful completion (full assembled assistant message), and on stop/error (the partial assistant message accumulated so far).

A failure of the **start-state** save SHALL be logged as a warning and SHALL NOT abort the request: the stream still opens, and the terminal save that follows writes the conversation anyway. Losing the placeholder costs a resumable mid-flight view; refusing to stream because of it would cost the answer itself.

The terminal save SHALL distinguish how the generation ended:

| Outcome | Persisted marker | Registry status |
|---|---|---|
| Upstream reached `[DONE]` | assembled message, no marker | `Done` |
| Upstream rejected the request | `streamErrorMessage` = DIAL Core text, or `''` when it gave none | `Error` |
| The user pressed Stop | `wasStoppedByUser: true`, **no** `streamErrorMessage` | `Stopped` |
| Aborted for any other reason | `streamErrorMessage: ''` | `Error` |
| The relay itself threw | `streamErrorMessage` = the thrown error's message | `Error` |

A user stop is deliberately not an error state: the frontend renders an empty stopped message with its "Stopped generating" label, which it can only do when no `streamErrorMessage` is present.

#### Scenario: Start state saved before streaming

- **WHEN** a completion request is accepted
- **THEN** the backend saves the conversation with the new user message and an empty assistant placeholder before opening the upstream stream

#### Scenario: Final state saved on completion

- **WHEN** the upstream stream emits `[DONE]`
- **THEN** the backend writes the fully assembled assistant message at the placeholder index and saves the conversation

#### Scenario: Partial state saved on error

- **WHEN** the upstream stream fails before `[DONE]`
- **THEN** the backend saves the partial assistant message with `streamErrorMessage` set — carrying the DIAL Core error text when one is available, or an empty string when no upstream text exists (empty body, non-user abort). The presence of the field (even `''`) is the terminal-error signal; the frontend localizes a generic fallback when the value is empty.

#### Scenario: A user stop is not persisted as an error

- **WHEN** the generation is aborted and the registry already records it as stopped by the user
- **THEN** the partial message is saved with `wasStoppedByUser: true` and no `streamErrorMessage`, and the generation is finalized as `Stopped`

#### Scenario: A failed start-state save does not abort the stream

- **WHEN** the start-state `saveConversation` rejects
- **THEN** the failure is logged as a warning and the completion request proceeds to stream normally

### Requirement: Generation finalizes on `[DONE]`, not on socket close

The streaming read loop SHALL treat the `[DONE]` SSE payload as the completion signal: it MUST save the final conversation, mark the generation complete in the registry, and close the response. It MUST NOT wait for the upstream socket to close, because providers may keep the connection open after `[DONE]`, which would otherwise leave the generation registered as active and reject the next request with HTTP 409. Stopping at `[DONE]` SHALL cancel the upstream reader rather than merely releasing its lock, so the connection is actually closed instead of left dangling.

An upstream socket that closes **without** ever sending `[DONE]` SHALL be treated as the end of the stream too, and logged as such, so a truncated response still finalizes rather than hanging.

#### Scenario: Provider keeps the connection open after `[DONE]`

- **WHEN** the upstream emits `[DONE]` but does not close the connection
- **THEN** the backend still finalizes the generation, releases the registry entry, and closes its response

### Requirement: A pre-stream failure releases the registry entry

If any step between registering the generation and opening the upstream stream fails — resolving the deployment's generation capability, fetching the conversation, or building its history — the backend SHALL release the registry entry before rethrowing, so a transient failure does not lock the conversation until stale eviction.

#### Scenario: Conversation fetch fails after registration

- **WHEN** registration succeeds but the subsequent `getConversation` throws
- **THEN** the backend marks the generation errored (releasing the entry) and rethrows, so a retry is not rejected with 409
