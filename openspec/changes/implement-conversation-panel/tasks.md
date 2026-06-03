## 1. Backend — List Conversations Endpoint (apps/chat-api)

> ✅ Implemented as `GET /api/v1/conversations/list` with cursor pagination (`nextToken`) backed by DIAL Core. See `conversation-panel-state-and-list-path` change for the `path` parameter addition.

- [x] 1.1 Add `ConversationListItemDto` and `ConversationListResponseDto` to `apps/chat-api/src/conversations/dto/conversation-list.dto.ts`
- [x] 1.2 Add `listConversations` method to `ConversationService` calling DIAL Core metadata endpoint with `recursive=true`
- [x] 1.3 Add `ListConversationsQueryDto` with validated `limit` / `nextToken` / `path` query params
- [x] 1.4 Add `@Get('list')` handler to `ConversationController` with rate limiting `@Throttle({ default: { limit: 30, ttl: 60000 } })`
- [x] 1.5 Write integration tests for `GET /api/v1/conversations/list`
- [x] 1.6 Typecheck and test verification

## 2. Generated API Client — Regenerate (libs/chat-api-client)

> ✅ Regenerated. `ConversationsApi.listConversations({ limit?, nextToken?, path? })` is available.

- [x] 2.1 Regenerate `libs/chat-api-client` with new `GET /api/v1/conversations/list` operation
- [x] 2.2 Confirm `ConversationsApi` includes `listConversations` method with `path?` parameter

## 3. New `libs/conversation-panel` Library

> ✅ Implemented as `@epam/ai-dial-conversation-panel` at `libs/conversation-panel/`. Note: library name changed from the planned `libs/conversation-history`.

- [x] 3.1 Scaffold library: `package.json` (`"license": "Apache-2.0"`, peer deps for `react`, `@epam/ai-dial-ui-kit`, `@tabler/icons-react`), `vite.config.mts`, `tsconfig.lib.json`, eslint/tailwind/postcss configs
- [x] 3.2 Register in `tsconfig.base.json` path aliases as `@epam/ai-dial-conversation-panel`; `npm install` to link workspace package
- [x] 3.3 Add `src/models/ConversationPanel.ts` with: `ConversationSource` (string enum), `FilterTab` (string enum), `FilterLabels`, `ConversationHistoryItem`, `ConversationHistoryColors`, `ConversationHistoryTypography`, `ConversationPanelStyles`, `ConversationPanelProps`
- [x] 3.4 Implement `NewChatButton` sub-component: `IconPlus` icon + label, calls `onNewChat`, keyboard-accessible
- [x] 3.5 Implement `SearchInput` sub-component: search icon, controlled by local `useState<string>`, filters parent list via callback
- [x] 3.6 Implement `FilterTabs` sub-component: `role="tablist"`, 4 tabs using `FilterTab` enum, `aria-selected`, local `useState<FilterTab>`
- [x] 3.7 Implement `ConversationGroup` sub-component: collapsible section with disclosure button (chevron icon), `useState<boolean>` open state (default true), hides when item count is 0
- [x] 3.8 Implement `ConversationPanel` component: header with `title` prop (no toggle button), `NewChatButton`, `SearchInput`, `FilterTabs`, grouped `ConversationGroup` sections (Pinned + My chats); combined search + tab filter; backdrop overlay when `onBackdropClick` provided
- [x] 3.9 Export all types and `ConversationPanel` from `src/index.ts`
- [x] 3.10 Unit tests in `libs/conversation-panel/src/components/ConversationPanel/tests/ConversationPanel.spec.tsx`
- [x] 3.11 Build passes (`npm exec nx build @epam/ai-dial-conversation-panel`); tests pass

## 4. App Integration (apps/chat)

- [x] 4.1 Add `listConversations` wrapper to `apps/chat/src/server-api/conversations.api.ts` delegating to generated `conversationsApi.listConversations({ limit?, nextToken?, path? })`
- [x] 4.2 Create `apps/chat/src/context/ConversationsContext.tsx` with `ConversationsProvider` and `useConversations` hook; fetches on mount with cancelled-flag pattern
- [x] 4.3 Wrap app with `<ConversationsProvider>` in `apps/chat/src/main.tsx`
- [x] 4.4 Add `isHistoryPanelOpen` / `setIsHistoryPanelOpen` via `useLocalStorage('conversationPanelOpen', false)` in `app.tsx`; add `toggleHistoryPanel` and `closeHistoryPanel` callbacks
- [x] 4.5 Add panel toggle icon button to `Header.tsx` (`isHistoryPanelOpen`, `onHistoryPanelToggle` props); desktop only (`hidden desktop:flex`)
- [x] 4.6 Create `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` — app-level adapter wiring `useConversations`, `useTranslation`, `useIsMobile`, and routing into `ConversationPanel`
- [x] 4.7 Render `<ConversationPanelView>` in `app.tsx` with `isOpen`, `activeConversationId`, `onClose`, `onSelectConversation`, `onNewChat`
- [x] 4.8 Add i18n keys: `conversationHistory.title`, `conversationHistory.toggleAriaLabel`, `conversationHistory.empty`, `conversationHistory.newChat`, `conversationHistory.searchPlaceholder`, `conversationHistory.filterAll`, `conversationHistory.filterMyChats`, `conversationHistory.filterShared`, `conversationHistory.filterOrganization`, `conversationHistory.pinnedSection`, `conversationHistory.myChatsSection`
- [x] 4.9 `npm exec nx build @epam/chat` passes with zero errors

## 5. Outstanding / Follow-up

> Tasks below were planned for manual QA. The panel is functionally implemented; these are verification and polish items.

- [ ] 5.1 Verify desktop: panel expands/collapses with CSS transition, `<main>` content shifts
- [ ] 5.2 Verify mobile: panel renders as drawer overlay, backdrop closes it
- [ ] 5.3 Verify keyboard navigation: toggle button, New chat button, search input, filter tabs, and section toggles are all focusable; Enter/Space works
- [x] 5.4 Fix `useMatch('/conversations/:id')` → restore `useMatch('/conversations/*')` with `params['*']` for correct `activeConversationId` (bug found in code review of PR #6953)
- [x] 5.5 Fix `ConversationsProvider` placement — already correctly inside `RequireAuth` in `apps/chat/src/main.tsx` (line 35) — move inside `RequireAuth` in `apps/chat/src/main.tsx` to avoid unauthenticated fetch on the login page
- [x] 5.6 Fix title extraction in `listConversations`: added `getConversationTitleFromName` to `conversation.utils.ts` (splits `{deploymentId}__{title}__{uuid}` and returns middle segments); used in `conversation.service.ts` line 171 in `listConversations` returns the human-readable name (not the raw DIAL Core filename `model__title__uuid`)
/
