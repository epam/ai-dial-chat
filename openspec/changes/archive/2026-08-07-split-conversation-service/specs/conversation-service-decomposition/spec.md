## ADDED Requirements

### Requirement: Conversation domain service ownership map
The conversation domain SHALL be decomposed into four focused injectable services plus a facade, each owning a disjoint set of responsibilities, so that no single service mixes persistence, listing, lifecycle mutation, and SSE streaming concerns.

- `ConversationPersistenceService` SHALL own DIAL Core get/save primitives and display-name preservation, and SHALL implement the existing `ConversationPersistencePort` interface.
- `ConversationListingService` SHALL own list retrieval, metadata computation, and display-name enrichment for list items.
- `ConversationLifecycleService` SHALL own create, delete, rename, duplicate, pin, and bulk-delete mutations.
- `ConversationStreamingService` SHALL own model completion streaming and conversation watch, and SHALL NOT depend on `express.Response` or any other HTTP-transport type.
- `ConversationService` SHALL act as a facade that delegates every public method to exactly one of the four services above, and SHALL NOT contain business logic beyond delegation.

#### Scenario: Facade delegates a persistence call
- **WHEN** `ConversationController` calls `ConversationService.getConversation(path, token, bucket)`
- **THEN** the facade delegates to `ConversationPersistenceService.getConversation(path, token, bucket)` and returns its result unchanged
- **AND** `ConversationPersistenceService.getStoredConversation` (a lower-level read used internally by `ConversationListingService` and `ConversationLifecycleService`) is not exposed on the facade

#### Scenario: Facade delegates a listing call
- **WHEN** `ConversationController` calls `ConversationService.listConversations(...)`
- **THEN** the facade delegates to `ConversationListingService.listConversations(...)` and returns its result unchanged

#### Scenario: Facade delegates a lifecycle call
- **WHEN** `ConversationController` calls `ConversationService.deleteConversation(id)`
- **THEN** the facade delegates to `ConversationLifecycleService.deleteConversation(id)` and returns its result unchanged

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

#### Scenario: Cache key and TTL preserved
- **WHEN** `ConversationListingService` (post-split) serves a cached list response
- **THEN** it uses the same cache key naming and TTL that `ConversationService` used pre-split, and invalidates on the same triggering events
