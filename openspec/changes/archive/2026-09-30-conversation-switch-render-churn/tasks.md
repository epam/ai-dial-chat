Slicing strategy: vertical. Each slice is one independently shippable render-churn fix with its own test. Slice 1 (provider) and slice 2 (panel memo boundaries) do not depend on each other.

## 1. Idempotent ConversationsContext updaters

- [x] 1.1 Add failing tests to `apps/chat/src/context/tests/ConversationsContext.spec.tsx` covering four cases:
  - `updateConversationTitle` with the current title keeps the `conversations` reference;
  - `updateConversationTitle` with a new title returns a new array in which only the matched item is a new object;
  - `removeConversationFromList` with an unknown id keeps the reference;
  - `pinConversation` with the current `isPinned` keeps the reference immediately after the call, and the API is still called.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/ConversationsContext.spec.tsx` (the new tests fail).
- [x] 1.2 In `apps/chat/src/context/ConversationsContext.tsx`, rewrite `updateConversationTitle` as `findIndex` + `slice`, returning `prev` when there is no match or the title is equal (design D1).
- [x] 1.3 In the same file, make `removeConversationFromList` return `prev` when the filter removed nothing.
- [x] 1.4 In the same file, make the optimistic write and the revert in `pinConversation` return `prev` when there is no match or `isPinned` is already the target value. Keep the strict `c.id === id` match and the API call unchanged.
  - Verification for 1.2–1.4: `npm run test:file -- apps/chat/src/context/tests/ConversationsContext.spec.tsx` (all green).
- [x] 1.5 Add a test to `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`: loading a conversation whose API `name` equals the list title does not change the `conversations` value observed by a `useConversations()` consumer. Use the spec's existing context mock or harness; do not add a new provider. No change to `Conversation.tsx` (design D1).
  - Verification: `npm run test:file -- apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`.
  - Done as: the spec mocks `useConversations` entirely, so the page test asserts the page's half of the contract — the loaded `name` reaches `updateConversationTitle` unchanged, exactly once. The list-reference half is proven by the provider test in 1.1.
- [x] 1.6 Slice check: `npm run verify:changed`.
  - Result: typecheck and lint pass. `test:changed` reports 4 failures in `ConversationView.reply.spec.tsx` (3) and `useSkillFileSystemPicker.spec.ts` (1). All 4 also fail with this change stashed, so they pre-exist on `development` and are unrelated.

## 2. Stable conversation panel memo boundaries

- [x] 2.1 Add a failing test to `apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`:
  - add a render counter to the existing `ConversationPanel` mock;
  - re-rendering the view with identical props and an identical `useConversations` mock value does not increment the counter;
  - changing `activeConversationId` does increment it.
  - Verification: `npm run test:file -- apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx` (the new test fails).
- [x] 2.2 In `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`, memoize the `labels` object passed to `ConversationPanel` with `useMemo` over `t`, `filterLabels`, `groupLabels` and `unreadIndicatorLabel`.
- [x] 2.3 In the same file, memoize the `headerActions` element with `useMemo` over `activeConversationId`, `isConversationExportHidden`, `handleExportAll` and `handleImportClick`.
  - Harness note: the spec's `react-i18next` mock returned a fresh `t` per call and its `useDeployments` mock a fresh `items` array per call; both were made stable (as the real providers are) so memos keyed on them hold. The lib mock is now `memo`-wrapped like the real `ConversationPanel`.
  - Verification for 2.2–2.3: `npm run test:file -- apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx` (all green).
- [x] 2.4 Add `apps/chat/src/app/tests/app.spec.tsx` (design D4):
  - mock `ConversationPanelView` with a render counter, plus the heavy hooks and contexts `App` needs;
  - force an `App` re-render through a `useSourcesSidebar` mock whose value changes identity;
  - assert the counter does not increase.
  - If the provider surface makes this disproportionate, fall back to asserting that `onRequestedFilterChange` keeps its identity across two renders, and record that the fallback was taken in this task.
  - Verification: `npm run test:file -- apps/chat/src/app/tests/app.spec.tsx` (fails before 2.5).
  - Done with the full variant (no fallback): `App` re-renders through a test context read by the mocked `useSourcesSidebar`; the memo-wrapped `ConversationPanelView` mock's render count stays flat.
- [x] 2.5 In `apps/chat/src/app/app.tsx`, replace the inline `onRequestedFilterChange` arrow with a `useCallback` (`handlePanelRequestedFilterChange`, empty deps), following `handlePanelActiveFilterChange` (design D2).
  - Verification: `npm run test:file -- apps/chat/src/app/tests/app.spec.tsx` and `npm run test:file -- apps/chat/src/components/ConversationPanel/tests/ConversationPanelView.spec.tsx`.
- [x] 2.6 Slice check: `npm run verify:changed`.
  - Result: typecheck and lint pass; `test:changed` shows only the same 4 pre-existing failures noted in 1.6.

## 3. Close-out

- [x] 3.1 Confirm that no `libs/*` file changed (`git diff --stat -- libs/` is empty), so the library isolation rule is untouched. No README or docs update is needed: no public API or documented behavior changes.
- [x] 3.2 Run `npm run verify:full` once.
  - Result: typecheck:full, lint:check and format:check pass. test:full reports 14 failures, all outside this change:
    - `@epam/chat` (4): the same pre-existing failures noted in 1.6.
    - `@epam/ai-dial-conversation-input` (9): `Input.send-tooltip.spec.tsx` and `Input.spec.tsx`.
    - `@epam/chat-api` (1): `app-config.service.spec.ts`.
  - This change touches neither `@epam/ai-dial-conversation-input` nor `@epam/chat-api`.

## 4. Follow-ups (out of scope, record only; do not implement here)

- [ ] 4.1 Propose a separate change for the rest of the per-navigation panel cost:
  - `useConversationPanelItems` deployment `Map` and per-item cache;
  - `collapseScheduledTaskConversations` no longer keyed on `activeConversationId`;
  - a stable react-window `rowProps`, `memo(ConversationRow)`, lazy `getActions` and a smaller overscan.
- [ ] 4.2 Propose a separate change for the stream-chunk cost:
  - split `messages` out of `SourcesSidebarContext`;
  - stabilize `ConversationMessageItem` props (`onDialFileSystemClick`, `editMenuOverlays`);
  - batch chunks per animation frame.
- [ ] 4.3 Propose a separate fix for the stale-response race in `ConversationPage.loadConversation`.
