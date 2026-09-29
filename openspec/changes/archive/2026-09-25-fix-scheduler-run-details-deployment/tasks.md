## 1. Run-details deployment source (vertical slice — complete path end to end)

- [x] 1.1 Add `conversationModelId` / `setConversationModelId` to `apps/chat/src/context/SourcesSidebarContext.tsx` (same shape as the existing `messages`/`setMessages` pair), with coverage in `apps/chat/src/context/tests/SourcesSidebarContext.spec.tsx`.
- [x] 1.2 Publish `conversation.assistantModelId || conversation.model.id` from the Conversation page's existing messages-publish effect in `apps/chat/src/pages/Conversation/Conversation.tsx`, and clear it on unmount alongside `setMessages([])`.
- [x] 1.3 Resolve the Details section's Model field in `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` from `conversationModelId` (via `findDeploymentByIdOrReference` + `resolveLocalizedText`, raw-id fallback) instead of `activeScheduledTask.task?.model`; drop the `as string` cast.

## 2. Verification

- [x] 2.1 Add the regression test (run conversation model `gpt-4o` shown, schedule current `gpt-5` absent) and update the sidebar/deployments mocks in `apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx`.
- [x] 2.2 Update the `useSourcesSidebar` mock in `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx` for the new context field.
- [x] 2.3 Verify: `npm run test:file -- apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx apps/chat/src/context/tests/SourcesSidebarContext.spec.tsx apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx` passes; `apps/chat` app and spec sources typecheck; eslint clean on the touched files (modulo pre-existing branch-wide `@nx/enforce-module-boundaries` lazy-load errors that reproduce on the pristine tree).
