## ADDED Requirements

### Requirement: Streaming completion phases are separate collaborators
`ConversationStreamingService.streamCompletion` SHALL take a single `StreamCompletionRequest` object (`apps/chat-api/src/conversations/streaming/stream-completion-request.ts`) rather than positional parameters. The preparation deadline SHALL be owned by `GenerationPreparation` (`apps/chat-api/src/conversations/streaming/generation-preparation.ts`), and the foreground marker lifecycle — the start-state write, the marker release, the stop request, the periodic re-reads and the terminal write — SHALL be owned by `ForegroundGenerationLock` (`apps/chat-api/src/conversations/streaming/foreground-generation-lock.ts`). Both collaborators SHALL log through the streaming service's own logger. The split SHALL NOT change any SSE event, status code, persistence write, metric or registry transition.

#### Scenario: Caller passes named fields
- **WHEN** `ConversationCompletionsResponder` starts a completion
- **THEN** it calls `streamCompletion` with one `StreamCompletionRequest` whose fields include `conversationPath`, `token`, `bucket`, `generationId`, `mode`, `model`, `ownerKey`, `onReadyToStream` and `sub`

#### Scenario: Preparation outlives its deadline
- **WHEN** a preparation step is still pending when `GENERATION_PREPARATION_TIMEOUT_MS` elapses
- **THEN** `GenerationPreparation` abandons the preparation, throws `GenerationPreparationInterruptedException`, and releases the generation's key only after the pending step settles

#### Scenario: Terminal write after a completed relay
- **WHEN** a foreground relay completes
- **THEN** `ForegroundGenerationLock.writeTerminalState` re-reads the conversation, applies the final message only to the message still carrying this generation's marker, and completes the lease
