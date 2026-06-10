## 1. Model — Add noResultsLabel prop

- [x] 1.1 Add `/** Message shown when conversations exist but none match the active filter. */` JSDoc + `noResultsLabel: string` to `ConversationPanelProps` in `libs/conversation-panel/src/models/ConversationPanel.ts`

## 2. ConversationPanel lib — Two-state logic and PanelEmptyState

- [x] 2.1 Import `PanelEmptyState` from `@epam/ai-dial-sidebar` in `libs/conversation-panel/src/components/ConversationPanel/ConversationPanel.tsx`
- [x] 2.2 Import `IconMessageCircle` and `IconSearchOff` from `@tabler/icons-react` in `ConversationPanel.tsx`
- [x] 2.3 Destructure `noResultsLabel` from props in `ConversationPanel`
- [x] 2.4 Replace `const isEmpty = filteredItems.length === 0` with:
  - `const isNoConversations = conversations.length === 0`
  - `const isNoResults = conversations.length > 0 && filteredItems.length === 0`
- [x] 2.5 Replace the `isEmpty ? <EmptyState ...> : <groups>` render branch with three branches:
  - `isNoConversations` → `<PanelEmptyState icon={<IconMessageCircle size={48} stroke={1} aria-hidden />} label={emptyLabel} />`
  - `isNoResults` → `<PanelEmptyState icon={<IconSearchOff size={45} stroke={1} aria-hidden />} label={noResultsLabel} />`
  - else → conversation groups

## 3. Delete internal EmptyState component

- [x] 3.1 Delete `libs/conversation-panel/src/components/EmptyState/EmptyState.tsx`
- [x] 3.2 Remove the `EmptyState` import from `ConversationPanel.tsx`

## 4. App call site — Pass noResultsLabel

- [x] 4.1 Add `ConversationHistoryI18nKeys.NoResults = 'conversationHistory.noResults'` to `apps/chat/src/constants/translation-keys.ts`
- [x] 4.2 Add `"noResults": "No results found"` under `conversationHistory` in `apps/chat/src/i18n/locales/en.json`
- [x] 4.3 Pass `noResultsLabel={t(ConversationHistoryI18nKeys.NoResults)}` to `<ConversationPanel>` in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`

## 5. Verification

- [x] 5.1 Run `npm exec nx lint conversation-panel` and confirm no errors
- [x] 5.2 Run `npm exec nx typecheck conversation-panel` and confirm no errors
- [x] 5.3 Run `npm exec nx lint chat` and confirm no errors
- [ ] 5.4 Open the conversation panel with no conversations — confirm `IconMessageCircle` + `emptyLabel` text is shown
- [ ] 5.5 Type a search query that matches nothing — confirm `IconSearchOff` + "No results found" is shown
- [ ] 5.6 Clear the query — confirm conversations reappear
