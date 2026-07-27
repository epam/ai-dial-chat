## 1. Backend: remove path from DTO, controller, service

- [x] 1.1 Remove `path` field from `ListConversationsQueryDto` (`apps/chat-api/src/conversations/dto/list-conversations-query.dto.ts`)
- [x] 1.2 Stop passing `query.path` to `conversationService.listConversations` in `apps/chat-api/src/conversations/conversation.controller.ts`
- [x] 1.3 Remove the `path` parameter, folder-path normalization (trailing-slash handling), and `encodeDialResourcePath` call for `metadataPath` from `ConversationService.listConversations` (`apps/chat-api/src/conversations/conversation.service.ts`)
- [x] 1.4 Pass the bucket-root argument directly to both `getConversationMetadata` calls (user bucket and public bucket) instead of the normalized `metadataPath`
- [x] 1.5 Remove the `isEmptyScopedFolder` / scoped-path 404-tolerance branch; a 404 on the user-bucket call is unconditionally propagated via `handleDialSdkError`

## 2. Backend: update tests

- [x] 2.1 Remove path-forwarding and length-validation tests from `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` (the "forwards non-empty path to the service" case and the >512-char 400 case)
- [x] 2.2 Remove path-normalization and scoped-404 tests from `apps/chat-api/src/conversations/tests/conversation.service.spec.ts` ("normalizes the folder path...", "does not append a second slash...", "returns an empty list instead of 404 when scoped path has no blobs")
- [x] 2.3 Verify the remaining "still throws NotFoundException for a 404 on the bucket root" test still passes unconditionally (no longer needs the empty-path qualifier)
- [x] 2.4 Run `npm exec nx test chat-api`

## 3. Frontend: drop path from the wrapper

- [x] 3.1 Remove `path` from the `listConversations` param type and forwarding logic in `apps/chat/src/server-api/conversations.api.ts`
- [x] 3.2 Run `npm exec nx test chat`

## 4. Regenerate the API client

- [x] 4.1 Run `npm run openapi` to regenerate the Swagger spec and `libs/chat-api-client` from the updated backend DTOs
- [x] 4.2 Run `npm run openapi:check` to confirm the generated client is in sync
- [x] 4.3 Confirm `path` no longer appears in `libs/chat-api-client/src/generated/src/apis/ConversationsApi.ts` (`ListConversationsRequest` and `listConversationsRaw`)

## 5. Specs cleanup

- [x] 5.1 Delete `openspec/specs/conversation-list-path-filter/spec.md` (superseded by this change's REMOVED delta)
- [x] 5.2 Confirm `openspec/specs/conversations-api/spec.md` no longer references `path` after archiving this change

## 6. Verification

- [x] 6.1 Run `npm exec nx lint chat-api` and `npm exec nx lint chat` (chat-api clean; chat lint passes for all files touched by this change — one pre-existing, unrelated prettier failure remains in `DialFileManagerShell.spec.tsx`, present on `development-1.0` before this change)
- [x] 6.2 Run `npm exec nx build chat-api`
- [x] 6.3 Manually confirm `GET /api/v1/conversations/list` (no query params) still returns the full recursive listing as before
