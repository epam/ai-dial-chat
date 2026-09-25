## MODIFIED Requirements

### Requirement: Backend persists the conversation across the generation lifecycle

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, invoked via the `ConversationService` facade) SHALL own conversation persistence for a completion. The frontend MUST NOT call `saveConversation` during streaming. The backend SHALL save at the start of generation (user message + empty assistant placeholder), on successful completion (full assembled assistant message), and on stop/error (the partial assistant message accumulated so far).

A failure of the **start-state** save SHALL be logged as a warning and SHALL NOT abort the request: the stream still opens, and the terminal save that follows writes the conversation anyway. Losing the placeholder costs a resumable mid-flight view; refusing to stream because of it would cost the answer itself.

The terminal save SHALL distinguish how the generation ended:

| Outcome | Persisted marker | Registry status |
|---|---|---|
| Upstream reached `[DONE]` | assembled message, no marker | `Done` |
| Upstream rejected the request | `streamErrorMessage` = DIAL Core text, or `''` when it gave none | `Error` |
| The user pressed Stop | `wasStoppedByUser: true`, **no** `streamErrorMessage` | `Stopped` |
| Aborted for any other reason (e.g. the relay itself threw before producing a result) | `streamErrorMessage: ''` | `Error` |
| The relay itself threw (e.g. undici `TypeError: terminated` while reading the upstream body, a socket reset, a programming error) | `streamErrorMessage: ''` | `Error` |

`streamErrorMessage` SHALL only ever carry text that DIAL Core itself supplied as a user-facing error (a rejected request's error body, or an in-band `{error}` chunk's `displayMessage`/`message`). A thrown JavaScript error's `message` is transport or runtime detail: it SHALL be logged server-side through the service `Logger` with the full error, and SHALL NOT be persisted to, or relayed through the generation registry to, the user.

A user stop is deliberately not an error state: the frontend renders an empty stopped message with its "Stopped generating" label, which it can only do when no `streamErrorMessage` is present.

The downstream HTTP connection closing (browser tab closed, page navigated away, refresh) is explicitly **not** one of the outcomes in this table — see "A closed downstream response does not alter generation persistence or outcome" below. The terminal save and registry release MUST still run exactly once per generation regardless of *why* the generator stops iterating, but the only ways the generator's consuming loop legitimately stops iterating are the relay reaching a terminal outcome (`[DONE]`/error/stop) or an unexpected exception; a closed downstream response is not, by itself, a reason for the consuming loop to stop. The generator SHALL guarantee the exactly-once terminal save/release via its own cleanup (e.g. a `finally` around its relay loop) for the exception case, since an abandoned consumer cannot itself invoke the generator's terminal logic.

#### Scenario: Start state saved before streaming

- **WHEN** a completion request is accepted
- **THEN** the backend saves the conversation with the new user message and an empty assistant placeholder before opening the upstream stream

#### Scenario: Final state saved on completion

- **WHEN** the upstream stream emits `[DONE]`
- **THEN** the backend writes the fully assembled assistant message at the placeholder index and saves the conversation

#### Scenario: Partial state saved on error

- **WHEN** the upstream stream fails before `[DONE]`
- **THEN** the backend saves the partial assistant message with `streamErrorMessage` set — carrying the DIAL Core error text when one is available, or an empty string when no upstream text exists (empty body, non-user abort, relay throw). The presence of the field (even `''`) is the terminal-error signal; the frontend localizes a generic fallback when the value is empty.

#### Scenario: A mid-stream transport abort persists no raw error text

- **WHEN** reading the upstream stream throws `TypeError('terminated')` after some content was already assembled
- **THEN** the backend saves the partial assistant message (assembled content preserved) with `streamErrorMessage: ''`, finalizes the generation as `Error` with an empty message, and logs the thrown error via `Logger.error`; the string `terminated` is not present in the saved conversation

#### Scenario: DIAL Core-supplied error text is still persisted

- **WHEN** DIAL Core rejects the request with an error body, or emits an in-band `{error:{message}}` chunk
- **THEN** the persisted `streamErrorMessage` is that DIAL Core text, unchanged by this requirement

#### Scenario: A Responses stream that ends without a terminal signal persists no internal text

- **WHEN** a Responses API stream ends with no recognized terminal event (no `response.completed`, `response.failed`, `response.incomplete`, or `error` event)
- **THEN** the persisted `streamErrorMessage` is `''`, not the adapter's internal "ended before completion" diagnostic, and that diagnostic is logged server-side instead

#### Scenario: A Responses terminal failure keeps its upstream message
- **WHEN** a Responses API stream ends with `response.failed`, `response.incomplete`, or an `error` event carrying a message
- **THEN** the persisted `streamErrorMessage` is that upstream message

#### Scenario: A user stop is not persisted as an error

- **WHEN** the generation is aborted and the registry already records it as stopped by the user
- **THEN** the partial message is saved with `wasStoppedByUser: true` and no `streamErrorMessage`, and the generation is finalized as `Stopped`

#### Scenario: A failed start-state save does not abort the stream

- **WHEN** the start-state `saveConversation` rejects
- **THEN** the failure is logged as a warning and the completion request proceeds to stream normally
