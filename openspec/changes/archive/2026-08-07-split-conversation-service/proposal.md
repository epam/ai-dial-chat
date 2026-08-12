## Why

`apps/chat-api/src/conversations/conversation.service.ts` is a 1595-line god service mixing CRUD, listing/metadata enrichment, bulk operations, and SSE streaming (`streamCompletion`, `watchConversation`, `relayModelCompletion`), with a 2790-line spec file to match. The backend files domain went through the same decomposition (archived `2026-07-16-split-files-service`, facade reduced to 192 lines); the conversation domain should follow the same facade + sub-services pattern so each responsibility is independently testable and the HTTP/SSE boundary stops leaking into service code.

## What Changes

- Extract `ConversationPersistenceService` (implements existing `ConversationPersistencePort`) for DIAL Core get/save and display-name preservation.
- Extract `ConversationListingService` for list, metadata, and display-name enrichment.
- Extract `ConversationLifecycleService` for create/delete/rename/duplicate/pin/bulk-delete operations.
- Extract `ConversationStreamingService` for model completion streaming and watch, returning an HTTP-agnostic stream/event abstraction; `ConversationController` takes over ownership of `@Res() Response` / SSE wiring.
- Reduce `ConversationService` to a thin facade (target < 200 lines) that delegates to the above services and keeps existing public method signatures so `ConversationController` and other consumers require no changes.
- Split `conversation.service.spec.ts` (2790 lines) into per-service spec files plus a slim facade spec for cross-service delegation.
- Keep `ConversationGenerationService`, `ConversationNamingService`, `ConversationPublishService` as-is except for constructor-injection wiring updates needed to point at the new persistence service.
- **Not BREAKING**: REST contracts, request/response shapes, and OpenAPI surface are unchanged — this is an internal refactor only. No frontend changes, no OpenAPI regeneration.

## Capabilities

### New Capabilities
- `conversation-service-decomposition`: ownership map of which service owns which conversation responsibility (persistence, listing, lifecycle, streaming, facade) and the equivalence contract guaranteeing behavior is preserved across the split.

### Modified Capabilities
- None. This is an implementation-detail refactor; existing capability specs (`conversations-api`, `bulk-conversation-deletion-api`, `conversation-watch-sse`, `server-chunk-assembler`, `ai-conversation-rename`, `conversation-publish-api`, `duplicate-conversation`) keep their current scenario-level requirements unchanged. Any implementation-detail bullets in those specs that reference the monolithic `ConversationService` will be updated for accuracy as part of `tasks.md`, without changing behavior.

## Impact

- **Code**: `apps/chat-api/src/conversations/` — new `persistence/`, `listing/`, `lifecycle/`, `streaming/` sub-folders; `conversation.service.ts` shrinks to a facade; `conversation.module.ts` registers the new providers; `conversation.controller.ts` gains direct ownership of SSE response wiring.
- **Tests**: `conversation.service.spec.ts` (2790 lines) is split into per-service spec files under matching `tests/` sub-folders; a slim facade spec remains for delegation checks.
- **Dependents**: `ConversationNamingService` (already depends on `ConversationPersistencePort`) is rewired to the new `ConversationPersistenceService` implementation; no signature changes.
- **No impact**: frontend (`apps/chat`), OpenAPI spec/generated client, REST contracts, external callers.
