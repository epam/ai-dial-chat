## 1. Backend — Preserve DIAL Core flags

- [x] 1.1 In `apps/chat-api/src/conversations/conversation.service.ts`, extend the `getConversationMetadata` response type cast to include `sharedWithMe?: boolean` and `publishedWithMe?: boolean` on each item
- [x] 1.2 In the same service, map the two flags in the `.map()` transform: `sharedWithMe: item.sharedWithMe ?? false` and `publishedWithMe: item.publishedWithMe ?? false`
- [x] 1.3 Remove the temporary debug `this.logger.log('DIAL Core listConversations raw items: ...')` added during investigation

## 2. Backend — DTO and Swagger

- [x] 2.1 In `apps/chat-api/src/conversations/dto/conversation-list.dto.ts`, add `sharedWithMe: boolean` and `publishedWithMe: boolean` fields with `@ApiProperty` decorators
- [x] 2.2 Run `npm exec nx lint chat-api` and `npm exec nx build chat-api` to verify no type errors

## 3. Generated API Client

- [x] 3.1 Regenerate `libs/chat-api-client` using the repo OpenAPI script so the generated `ConversationListItemDto` includes the two new fields
- [x] 3.2 Verify the generated model in `libs/chat-api-client/src/generated/src/models/index.ts` contains `sharedWithMe` and `publishedWithMe`

## 4. Frontend Adapter

- [x] 4.1 In `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, import `ConversationSource` from `@epam/ai-dial-conversation-panel`
- [x] 4.2 Add a `getSource` helper that maps `{sharedWithMe, publishedWithMe}` → `ConversationSource` (Shared / Organization / MyChats)
- [x] 4.3 Pass `source: getSource(item)` in the `conversations` useMemo mapping alongside `id` and `title`
- [x] 4.4 Remove the temporary debug `console.log('[ConversationsContext] raw response:...')` from `apps/chat/src/context/ConversationsContext.tsx`

## 5. Verification

- [x] 5.1 Run `npm exec nx typecheck chat` and `npm exec nx lint chat` — no errors
- [x] 5.2 Start the app (`npm run start:all`) and open the conversation panel
- [x] 5.3 Verify "My chats" tab shows own conversations, "Shared" shows shared-with-me, "Organization" shows published — or confirm tabs show empty when no such conversations exist in the test environment
- [x] 5.4 Verify the "All" tab still shows all conversations
