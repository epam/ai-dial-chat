## 1. Scaffolding

- [x] 1.1 Create `persistence/`, `listing/`, `lifecycle/`, `streaming/` sub-folders under `apps/chat-api/src/conversations/`, each with an empty service class and matching `tests/` sub-folder.
- [x] 1.2 Register the four new providers in `conversation.module.ts` alongside the existing `ConversationService`, `ConversationGenerationService`, `ConversationNamingService`, `ConversationPublishService`.
- [x] 1.3 Run `npm exec nx build chat-api` to confirm DI wiring resolves with the new (still-empty) providers in place.

## 2. Extract ConversationPersistenceService

- [x] 2.1 Move `getStoredConversation`, `saveConversation`, `preserveLlmDisplayName` (and any private helpers used only by them) from `ConversationService` into `ConversationPersistenceService`; implement `ConversationPersistencePort`.
- [x] 2.2 Update `ConversationService` facade methods for these to delegate to `ConversationPersistenceService`.
- [x] 2.3 Rewire `ConversationNamingService`'s `ConversationPersistencePort` injection to resolve to `ConversationPersistenceService`.
- [x] 2.4 Relocate the corresponding `describe` blocks from `conversation.service.spec.ts` into `persistence/conversation-persistence.service.spec.ts`, verbatim first.
- [x] 2.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`; fix any regressions before continuing.

## 3. Extract ConversationListingService

- [x] 3.1 Move `listConversations`, `getConversationMetadata`, `enrichListItemsWithStoredDisplayNames` (and private helpers used only by them) into `ConversationListingService`.
- [x] 3.2 Update the facade to delegate list/metadata calls to `ConversationListingService`.
- [x] 3.3 Verify cache key naming and TTL for cached list responses are unchanged (per design.md's equivalence requirement) — no new cache key format, same invalidation triggers. (No caching existed on `listConversations` pre-split; none introduced.)
- [x] 3.4 Relocate corresponding spec blocks into `listing/conversation-listing.service.spec.ts`.
- [x] 3.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 4. Extract ConversationLifecycleService

- [x] 4.1 Move `createConversation`, `deleteConversation`, `renameConversation`, `duplicateConversation`, `pinConversation`, `deleteConversations`, `deleteAllConversations`, `conversationPathExists` into `ConversationLifecycleService`.
- [x] 4.2 Update the facade to delegate lifecycle calls to `ConversationLifecycleService`.
- [x] 4.3 Relocate corresponding spec blocks into `lifecycle/conversation-lifecycle.service.spec.ts`.
- [x] 4.4 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 5. Extract ConversationStreamingService and move SSE glue to the controller

- [x] 5.1 Move `streamCompletion`, `watchConversation`, `relayModelCompletion` into `ConversationStreamingService`, changing their return type from writing directly to `express.Response` to an HTTP-agnostic stream/event representation (per design.md decision). (`streamCompletion`/`relayModelCompletion` became async generators yielding `Uint8Array`; `watchConversation` already returned a plain `ReadableStream` pre-split.)
- [x] 5.2 Update `ConversationController` to own `@Res()` / SSE header setup and to subscribe to the new stream/event representation, writing bytes itself.
- [x] 5.3 Add a contract test that captures the raw SSE byte sequence for a fixed fixture conversation/model response and asserts it is unchanged from pre-split behavior. (Relocated `'writes SSE chunks to res and saves conversation on completion'` in `streaming/tests/conversation-streaming.service.spec.ts`, driven through the same header/write/end sequence the controller now uses.)
- [x] 5.4 Update the facade to delegate streaming calls to `ConversationStreamingService`.
- [x] 5.5 Relocate corresponding spec blocks into `streaming/conversation-streaming.service.spec.ts`.
- [x] 5.6 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 6. Facade cleanup and dead code removal

- [x] 6.1 Remove all now-unused private helpers and imports left behind in `conversation.service.ts` after all four extractions.
- [x] 6.2 Confirm `conversation.service.ts` is a pure delegation facade under ~200 lines. (110 lines — pure/lifecycle/listing/streaming methods are bound property delegates; only `generateTitle`/`markConversationViewed` keep a method body for their one line of glue.)
- [x] 6.3 Reduce `conversation.service.spec.ts` to only cross-service delegation assertions (slim facade spec); remove relocated blocks.
- [x] 6.4 Run `rg "@Res\\(\\)" apps/chat-api/src/conversations/` and confirm it matches only `conversation.controller.ts`.
- [x] 6.5 Run `wc -l apps/chat-api/src/conversations/conversation.service.ts` and confirm it is under 200 lines. (110 lines)

## 7. Documentation and spec deltas

- [x] 7.1 Update implementation-detail bullets in existing capability specs that reference the monolithic `ConversationService` to reflect the new service names, with no scenario-level behavior changes. Updated: `conversations-api`, `bulk-conversation-deletion-api`, `dial-error-mapping`, `backend-owned-generation-persistence`, `llm-conversation-naming`, `conversation-deployment-selection`, `client-channel-protocol`, `file-manager-tab-config`. Checked and left unchanged (no stale references found): `conversation-watch-sse`, `server-chunk-assembler`, `ai-conversation-rename`, `conversation-publish-api`, `duplicate-conversation`, `scheduled-task-unread-tracking` (its `markConversationViewed` reference is still accurate — that method stays a direct facade method, not delegated to a sub-service).

## 8. Final verification

- [x] 8.1 Run `npm exec nx test chat-api`. (1835/1835 tests pass)
- [x] 8.2 Run `npm exec nx lint chat-api`. (clean — only 2 pre-existing unrelated warnings)
- [x] 8.3 Run `npm exec nx build chat-api`. (webpack compiled successfully)
- [x] 8.4 Manually exercise create/list/rename/delete/duplicate/pin and a streaming completion against a running `apps/chat-api` instance to confirm REST/SSE contracts are unchanged end-to-end. Confirmed manually by the user.
