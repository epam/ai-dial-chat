## MODIFIED Requirements

### Requirement: Backend retains in-flight assistant message content per active generation

`ConversationGenerationService`'s registry entry (`apps/chat-api/src/conversations/conversation-generation.service.ts`) SHALL retain the current assembled assistant `ConversationMessageDto` for each active generation, updated every time `ConversationStreamingService.streamCompletion`'s relay loop (`ChatCompletionsAdapter.stream` or `ResponsesAdapter.stream`) applies a chunk via `applyChunkToMessage`. This retained content SHALL include merged `custom_content.stages`, matching exactly what the assembled message would contain if inspected at that instant.

#### Scenario: Assembled message reflects the latest chunk

- **WHEN** a chunk is applied to the in-flight assistant message during an active generation
- **THEN** the registry entry's retained assembled message reflects that chunk's content immediately, before the next chunk is processed
