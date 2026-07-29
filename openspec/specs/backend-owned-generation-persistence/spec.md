## Purpose

The backend owns conversation persistence across the generation lifecycle — saving the start, final, and partial (stop/error) states — so the frontend never races to save and chunks cannot land in the wrong conversation.

## Requirements

### Requirement: Backend persists the conversation across the generation lifecycle

`ConversationService.streamCompletion` (`apps/chat-api/src/conversations/conversation.service.ts`) SHALL own conversation persistence for a completion. The frontend MUST NOT call `saveConversation` during streaming. The backend SHALL save at the start of generation (user message + empty assistant placeholder), on successful completion (full assembled assistant message), and on stop/error (the partial assistant message accumulated so far).

#### Scenario: Start state saved before streaming

- **WHEN** a completion request is accepted
- **THEN** the backend saves the conversation with the new user message and an empty assistant placeholder before opening the upstream stream

#### Scenario: Final state saved on completion

- **WHEN** the upstream stream emits `[DONE]`
- **THEN** the backend writes the fully assembled assistant message at the placeholder index and saves the conversation

#### Scenario: Partial state saved on error

- **WHEN** the upstream stream fails before `[DONE]`
- **THEN** the backend saves the partial assistant message with `streamErrorMessage` set — carrying the DIAL Core error text when one is available, or an empty string when no upstream text exists (empty body, non-user abort). The presence of the field (even `''`) is the terminal-error signal; the frontend localizes a generic fallback when the value is empty.

### Requirement: Generation finalizes on `[DONE]`, not on socket close

The streaming read loop SHALL treat the `[DONE]` SSE payload as the completion signal: it MUST save the final conversation, mark the generation complete in the registry, and close the response. It MUST NOT wait for the upstream socket to close, because providers may keep the connection open after `[DONE]`, which would otherwise leave the generation registered as active and reject the next request with HTTP 409.

#### Scenario: Provider keeps the connection open after `[DONE]`

- **WHEN** the upstream emits `[DONE]` but does not close the connection
- **THEN** the backend still finalizes the generation, releases the registry entry, and closes its response

### Requirement: A pre-stream failure releases the registry entry

If `getConversation` or history building fails after the generation has been registered but before streaming starts, the backend SHALL release the registry entry so a transient failure does not lock the conversation until stale eviction.

#### Scenario: Conversation fetch fails after registration

- **WHEN** registration succeeds but the subsequent `getConversation` throws
- **THEN** the backend marks the generation errored (releasing the entry) and rethrows, so a retry is not rejected with 409
