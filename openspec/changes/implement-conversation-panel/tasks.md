## 1. Backend — List Conversations Endpoint (apps/chat-api)

> ⚠️ Deferred — route conflict with existing `@Get()` handler + no in-memory store (service is DIAL Core backed). Tracked separately.

- [ ] 1.1 Add `ConversationMetadataDto` class to `apps/chat-api/src/conversations/dto/conversation-metadata.dto.ts`
- [ ] 1.2 Add `getConversations` method to `ConversationService` calling DIAL Core folder metadata endpoint
- [ ] 1.3 Add `ListConversationsQueryDto` with validated `limit` / `offset` query params
- [ ] 1.4 Add `@Get('list')` handler to `ConversationController` (avoids conflict with existing `@Get()`)
- [ ] 1.5 Write integration tests
- [ ] 1.6 Typecheck and test verification

## 2. Generated API Client — Regenerate (libs/chat-api-client)

> ⚠️ Deferred — depends on slice 1.

- [ ] 2.1 Regenerate `libs/chat-api-client` with new `GET /api/v1/conversations/list` operation
- [ ] 2.2 Confirm `ConversationsApi` includes `listConversations` method

## 3. New `libs/conversation-history` Library

- [x] 3.1 Scaffold library: `package.json` (`"license": "Apache-2.0"`, peer deps), `vite.config.mts`, `tsconfig.lib.json`, eslint/tailwind/postcss configs
- [x] 3.2 Register in `tsconfig.base.json` path aliases; `npm install` to link workspace package
- [x] 3.3 Update `src/models/ConversationHistoryPanel.ts` — extend `ConversationHistoryItem` with `isPinned?: boolean` and `source?: 'my-chats' | 'shared' | 'organization'`; add `onNewChat`, `newChatLabel`, `searchPlaceholder`, `filterLabels` to `ConversationHistoryPanelProps`
- [x] 3.4 Implement `NewChatButton` sub-component: `IconPlus` icon + label, calls `onNewChat`, keyboard-accessible
- [x] 3.5 Implement `SearchInput` sub-component: search icon, controlled by local `useState<string>`, filters parent list via callback
- [x] 3.6 Implement `FilterTabs` sub-component: `role="tablist"`, 4 tabs (All / My chats / Shared / Organization), `aria-selected`, local `useState<FilterTab>`
- [x] 3.7 Implement `ConversationGroup` sub-component: collapsible section with disclosure button (chevron icon), `useState<boolean>` open state (default true), hides when item count is 0
- [x] 3.8 Update `ConversationHistoryPanel` component: integrate `NewChatButton`, `SearchInput`, `FilterTabs`, grouped `ConversationGroup` sections (Pinned + My chats); apply combined search + tab filter before passing items to groups
- [x] 3.9 Export all new/updated types from `src/index.ts`
- [x] 3.10 Expand unit tests to cover: new-chat button callback, search filtering, empty-after-search state, filter tab switching, tab+search combination, Pinned/My-chats grouping, section collapse/expand (targeting ≥15 tests total)
- [x] 3.11 Build passes (`npm exec nx build @epam/ai-dial-conversation-history`); all tests pass

## 4. App Integration (apps/chat)

- [ ] 4.1 Add `listConversations` wrapper to `conversations.api.ts` — blocked on slice 1
- [ ] 4.2 Create `ConversationsContext` — blocked on slice 1
- [ ] 4.3 Wrap app with `<ConversationsProvider>` — blocked on slice 1
- [x] 4.4 Add `isHistoryPanelOpen` state and `toggleHistoryPanel` callback to `app.tsx`
- [x] 4.5 Add panel toggle icon button to `Header.tsx` (`isHistoryPanelOpen`, `onHistoryPanelToggle` props); desktop only (`hidden desktop:flex`)
- [x] 4.6 Render `<ConversationHistoryPanel>` in `app.tsx` with desktop persistent / mobile overlay behaviour; currently passes `EMPTY_CONVERSATIONS` until backend slice is done
- [x] 4.7 Add i18n keys: `conversationHistory.title`, `conversationHistory.toggleAriaLabel`, `conversationHistory.empty`; add new keys: `conversationHistory.newChat`, `conversationHistory.searchPlaceholder`, `conversationHistory.filterAll`, `conversationHistory.filterMyChats`, `conversationHistory.filterShared`, `conversationHistory.filterOrganization`, `conversationHistory.pinnedSection`, `conversationHistory.myChatsSection`
- [x] 4.8 Pass new props (`onNewChat`, `newChatLabel`, `searchPlaceholder`, `filterLabels`) from `app.tsx` into `ConversationHistoryPanel`; wire `onNewChat` to navigate to new conversation
- [x] 4.9 `npm exec nx build @epam/chat` passes with zero errors

## 5. Responsive / Visual QA

- [ ] 5.1 Verify desktop: panel expands/collapses with smooth CSS transition, `<main>` content shifts
- [ ] 5.2 Verify mobile: panel renders as drawer overlay, backdrop closes it
- [ ] 5.3 Verify keyboard navigation: toggle button, New chat button, search input, filter tabs, and section toggles are all focusable; Enter/Space works on buttons
- [ ] 5.4 Verify New chat button creates a new conversation
- [ ] 5.5 Verify search filters the list in real time
- [ ] 5.6 Verify filter tabs switch visible conversations correctly
- [ ] 5.7 Verify Pinned section shows only `isPinned` items; My chats shows the rest
- [ ] 5.8 Run `npm exec nx build @epam/chat` — confirm zero build errors
