## 1. i18n Keys

- [x] 1.1 Add `conversationHistory.duplicateLabel` and `conversationHistory.duplicateReadOnlyDescription` to `apps/chat/src/i18n/locales/en.json`
- [x] 1.2 Add `DuplicateLabel` and `DuplicateReadOnlyDescription` enum values to `ConversationHistoryI18nKeys` in `apps/chat/src/constants/translation-keys.ts`

## 2. NestJS Backend

- [x] 2.1 Add `duplicateConversation(sourcePath, token, bucket)` method to `apps/chat-api/src/conversations/conversation.service.ts` using `this.client.copyResource`
- [x] 2.2 Add response DTO `DuplicateConversationResponseDto` (file: `apps/chat-api/src/conversations/dto/duplicate-conversation.dto.ts`)
- [x] 2.3 Add `@Post('duplicate')` endpoint to `apps/chat-api/src/conversations/conversation.controller.ts` with Swagger decorators and throttle
- [x] 2.4 Regenerate `libs/chat-api-client` from the updated Swagger spec (`npm run generate:api` or project equivalent)

## 3. Frontend Server API and Context

- [x] 3.1 Add `duplicateConversation(conversationPath: string)` to `apps/chat/src/server-api/conversations.api.ts`
- [x] 3.2 Add `duplicateConversation(id: string): Promise<string>` to `ConversationsContext` interface and `ConversationsProvider` in `apps/chat/src/context/ConversationsContext.tsx`

## 4. Conversation Row Action

- [x] 4.1 Add Duplicate item to `getActions` callback in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` (after Rename, before Delete), calling `duplicateConversation` from context and navigating to the new conversation

## 5. Read-Only Overlay Button

- [x] 5.1 Add `onDuplicateConversation?: () => void` prop to `ConversationView` in `apps/chat/src/components/ConversationView/ConversationView.tsx`
- [x] 5.2 Replace the `<DialNotification>` read-only block with a centered action button (duplicate icon + `duplicateReadOnlyDescription` label) that calls `onDuplicateConversation`
- [x] 5.3 Wire `onDuplicateConversation` in `apps/chat/src/pages/Conversation/Conversation.tsx` — call `duplicateConversation(conversationId)` and navigate to the new conversation on success

## 6. Verification

- [x] 6.1 Run `npm exec nx lint chat-api` and `npm exec nx lint chat` — fix any new errors
- [x] 6.2 Run `npm exec nx test chat-api` — confirm existing tests pass
- [x] 6.3 Manually verify: duplicate action appears in row dropdown and creates a new conversation in My Chats
- [x] 6.4 Manually verify: opening a shared/org conversation shows the centered button, clicking it duplicates and navigates
