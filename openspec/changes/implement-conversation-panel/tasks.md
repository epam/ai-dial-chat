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
- [x] 3.3 Create `src/models/ConversationHistoryPanel.ts` with `ConversationHistoryItem`, `ConversationHistoryColors`, `ConversationHistoryPanelProps`
- [x] 3.4 Implement `ConversationHistoryPanel` component with header toggle, scrollable list, empty state, backdrop, CSS width transition
- [x] 3.5 Export all types from `src/index.ts`
- [x] 3.6 Write 8 unit tests covering all spec scenarios
- [x] 3.7 Build passes (`npm exec nx build @epam/ai-dial-conversation-history`); tests pass when run directly (`npx vitest run` from lib dir)

## 4. App Integration (apps/chat)

- [ ] 4.1 Add `listConversations` wrapper to `conversations.api.ts` — blocked on slice 1
- [ ] 4.2 Create `ConversationsContext` — blocked on slice 1
- [ ] 4.3 Wrap app with `<ConversationsProvider>` — blocked on slice 1
- [x] 4.4 Add `isHistoryPanelOpen` state and `toggleHistoryPanel` callback to `app.tsx`
- [x] 4.5 Add panel toggle icon button to `Header.tsx` (`isHistoryPanelOpen`, `onHistoryPanelToggle` props); desktop only (`hidden desktop:flex`)
- [x] 4.6 Render `<ConversationHistoryPanel>` in `app.tsx` with desktop persistent / mobile overlay behaviour; currently passes `EMPTY_CONVERSATIONS` until backend slice is done
- [x] 4.7 Add i18n keys: `conversationHistory.title`, `conversationHistory.toggleAriaLabel`, `conversationHistory.empty`
- [x] 4.8 `npm exec nx build @epam/chat` passes with zero errors

## 5. Responsive / Visual QA

- [ ] 5.1 Verify desktop: panel expands/collapses with smooth CSS transition, `<main>` content shifts
- [ ] 5.2 Verify mobile: panel renders as drawer overlay, backdrop closes it
- [ ] 5.3 Verify keyboard navigation: toggle button focusable, Enter/Space works
- [ ] 5.4 Run `npm exec nx build @epam/chat` — confirm zero build errors ✓ (done in 4.8)
