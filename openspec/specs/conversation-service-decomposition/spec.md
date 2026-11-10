# Spec: conversation-service-decomposition

## Purpose

Backend decomposition of the monolithic `ConversationService` (`apps/chat-api/src/conversations/conversation.service.ts`) into four focused injectable services plus a thin facade, mirroring the earlier files-domain split, so persistence, listing, lifecycle mutation, and SSE streaming concerns each live in their own testable service while the observable REST/SSE contract stays unchanged.

## Requirements

### Requirement: Conversation domain service ownership map
The conversation domain SHALL be decomposed into four focused injectable services plus a facade, each owning a disjoint set of responsibilities, so that no single service mixes persistence, listing, lifecycle mutation, and SSE streaming concerns.

- `ConversationPersistenceService` SHALL own DIAL Core get/save primitives and display-name preservation, and SHALL implement the existing `ConversationPersistencePort` interface.
- `ConversationListingService` SHALL own list retrieval, metadata computation, and display-name enrichment for list items.
- `ConversationLifecycleService` SHALL own create, delete, rename, duplicate, pin, and bulk-delete (`deleteConversations`, `deleteAllConversations`) mutations.
- `ConversationStreamingService` SHALL own model completion streaming (`streamCompletion`, an async generator that calls an `onReadyToStream` callback before it yields), conversation watch, background-generation attach resolution and stop (`resolveBackgroundAttach`, `stopBackgroundGeneration`), and `saveClientConversation`, and SHALL NOT depend on `express.Response` or any other HTTP-transport type.
- `ConversationService` SHALL act as a facade that delegates every public method to exactly one service, and SHALL NOT contain business logic beyond delegation. Pure 1:1 delegates to the four services above are bound property references; the two remaining methods each carry one line of glue and delegate to an already-independent service: `generateTitle` qualifies the path and calls `ConversationNamingService.generateTitle`, and `markConversationViewed` builds the conversation URL and calls `ScheduledTaskUnreadService.markViewed`.

#### Scenario: Facade delegates a persistence call
- **WHEN** `ConversationController` calls `ConversationService.getConversation(path, token, bucket)`
- **THEN** the facade delegates to `ConversationPersistenceService.getConversation(path, token, bucket)` and returns its result unchanged
- **AND** `ConversationPersistenceService.getStoredConversation` (a lower-level read used internally by `ConversationPersistenceService` itself and by `ConversationListingService`) is not exposed on the facade

#### Scenario: Facade delegates a listing call
- **WHEN** `ConversationController` calls `ConversationService.listConversations(...)`
- **THEN** the facade delegates to `ConversationListingService.listConversations(...)` and returns its result unchanged

#### Scenario: Facade delegates a lifecycle call
- **WHEN** `ConversationController` calls `ConversationService.deleteConversation(path, token, bucket)`
- **THEN** the facade delegates to `ConversationLifecycleService.deleteConversation(path, token, bucket)` and returns its result unchanged

#### Scenario: Streaming service has no HTTP dependency
- **WHEN** `ConversationStreamingService.streamCompletion(...)` is invoked
- **THEN** it returns an HTTP-transport-agnostic stream/event representation, and `ConversationController` is solely responsible for writing SSE bytes to `express.Response`

### Requirement: Behavior equivalence across the split
The decomposition SHALL NOT change any observable REST or SSE contract: request/response shapes, status codes, error mapping, cache keys, cache TTLs, and structured log fields SHALL remain identical to the pre-split `ConversationService` behavior.

#### Scenario: Identical REST response after extraction
- **WHEN** a client calls `GET /api/v1/conversations` before and after the service split
- **THEN** the response body, status code, and headers are identical for the same underlying data

#### Scenario: Identical SSE event stream after extraction
- **WHEN** a client calls the streaming completion endpoint before and after the service split
- **THEN** the sequence of SSE events written to the wire is byte-for-byte identical for the same input conversation and model response

#### Scenario: Listing stays uncached
- **WHEN** `ConversationListingService` (post-split) serves a list response
- **THEN** it reads DIAL Core on every request — no conversation-list cache key or TTL exists in the conversation domain (the only cache in `apps/chat-api/src/conversations` is `ConversationPublishService`'s publish-history cache)

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
