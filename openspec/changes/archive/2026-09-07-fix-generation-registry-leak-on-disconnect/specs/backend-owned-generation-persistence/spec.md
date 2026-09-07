## MODIFIED Requirements

### Requirement: Backend persists the conversation across the generation lifecycle

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, invoked via the `ConversationService` facade) SHALL own conversation persistence for a completion. The frontend MUST NOT call `saveConversation` during streaming. The backend SHALL save at the start of generation (user message + empty assistant placeholder), on successful completion (full assembled assistant message), and on stop/error/client-disconnect (the partial assistant message accumulated so far).

A failure of the **start-state** save SHALL be logged as a warning and SHALL NOT abort the request: the stream still opens, and the terminal save that follows writes the conversation anyway. Losing the placeholder costs a resumable mid-flight view; refusing to stream because of it would cost the answer itself.

The terminal save SHALL distinguish how the generation ended:

| Outcome | Persisted marker | Registry status |
|---|---|---|
| Upstream reached `[DONE]` | assembled message, no marker | `Done` |
| Upstream rejected the request | `streamErrorMessage` = DIAL Core text, or `''` when it gave none | `Error` |
| The user pressed Stop | `wasStoppedByUser: true`, **no** `streamErrorMessage` | `Stopped` |
| The client disconnected before the request handler finished consuming the stream (not a user Stop) | `streamErrorMessage: ''` | `Error` |
| Aborted for any other reason | `streamErrorMessage: ''` | `Error` |
| The relay itself threw | `streamErrorMessage` = the thrown error's message | `Error` |

A user stop is deliberately not an error state: the frontend renders an empty stopped message with its "Stopped generating" label, which it can only do when no `streamErrorMessage` is present.

The terminal save and registry release MUST run exactly once per generation regardless of *why* the generator stops iterating — including when the HTTP response consuming the stream closes early (client disconnect) and the controller's consuming loop is abandoned before the relay reaches `[DONE]`/error/stop. The generator SHALL guarantee this via its own cleanup (e.g. a `finally` around its relay loop), since an abandoned consumer cannot itself invoke the generator's terminal logic.

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

#### Scenario: Client disconnect mid-stream still finalizes and persists

- **GIVEN** a generation is actively streaming and has not yet reached `[DONE]`, stop, or error
- **WHEN** the client's HTTP connection closes (e.g. the browser tab is closed or navigates away) before the controller's consuming loop reaches the end of the stream
- **THEN** the backend saves the partial assistant message accumulated so far with `streamErrorMessage: ''` (or `wasStoppedByUser: true` if the user had already pressed Stop), marks the generation `Error` (or `Stopped`), and releases the registry entry — exactly once, with no dependency on the 30-minute stale-entry sweep
