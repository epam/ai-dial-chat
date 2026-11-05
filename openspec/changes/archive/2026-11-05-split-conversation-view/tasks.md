Slicing: one extraction per slice. Item hooks come before item sections. After each slice the view and item specs pass unedited and ESLint is clean. Branch: `refactor/split-conversation-views`. Implement after `split-conversation-panel-view`.

Per-slice verification: `npm run test:file -- $(ls apps/chat/src/components/ConversationView/tests/*.spec.tsx) apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx apps/chat/src/pages/Conversation/tests/ConversationReloadConflict.spec.tsx apps/chat/src/pages/ApplicationEditor/setup/tests/AppPreviewChat.spec.tsx`

## 1. Baseline

- [x] 1.1 Record the line counts of both files and the `it` counts of every spec listed above.

## 2. ConversationView hooks

- [x] 2.1 `hooks/conversation/useConversationDeploymentState.ts` (design D3).
- [x] 2.2 `hooks/conversation/useConversationMcpApps.ts`. The view no longer imports `server-api/mcp-apps`.
- [x] 2.3 `hooks/conversation/useMessageListLabels.ts`.
- [x] 2.4 `hooks/conversation/useComposerDraftWiring.ts`: block C, moved contiguously and called at its old position (design D2, spec requirement 2).
- [x] 2.5 `hooks/conversation/useAnchoredMessageActions.ts`: the send, regenerate, start, cancel and edit handlers, with `latestRef` and its `useLayoutEffect`.

## 3. ConversationView sections

- [x] 3.1 `ConversationFileManagerModal.tsx`
- [x] 3.2 `ConversationReadOnlyFooter.tsx`

## 4. ConversationMessageItem

- [x] 4.1 `hooks/conversation/useMessageCitations.tsx`
- [x] 4.2 `hooks/conversation/useMessageAttachments.ts`
- [x] 4.3 `hooks/conversation/useGroupedVisualizer.ts`

  All three are called before the edit-branch return, in the old order.
- [x] 4.4 `message/MessageEditMode.tsx`, with the lazy `EditMessageInput` and `preloadEditInput` if they are used only there.
- [x] 4.5 `message/MessageReferenceChips.tsx`, `message/MessageVisualizerSlot.tsx`, `message/MessageMcpAppPreview.tsx` and `message/MessageStreamError.tsx`.

## 5. Close

- [x] 5.1 Confirm the line counts. Record the actual numbers against the targets (view under 1100, item under 800). Each new module has a JSDoc summary and is under 300 lines. Actual: `ConversationView.tsx` is 1075 lines (was 1508) and `ConversationMessageItem.tsx` is 761 (was 1177). The new modules range from 51 to 229 lines, each with a JSDoc summary.
- [x] 5.2 Confirm the specs are unedited and the `it` counts match the baseline.
- [x] 5.3 `nx run-many -t test lint build typecheck -p @epam/chat` passes, pinned to the worktree. `npm run validate:docs` and `npm run validate:specs` pass. Results: test 278 files / 4113 tests, lint 0 errors, build passes. `@epam/chat:typecheck` in Nx is a no-op: it echoes that the target is disabled, because `apps/chat/tsconfig.spec.json` sets `noEmit`. This is true on `development` too. Types were therefore checked with `tsc -p apps/chat/tsconfig.app.json --noEmit` run directly. It reports no error in any file this change touches. The 72 remaining errors are in untouched files and in libs that the worktree resolves through the junctioned `node_modules`.
- [ ] 5.4 Check in the running app: streaming re-renders only the streaming row, and draft restore works after switching conversations.
- [ ] 5.5 Run `npm run verify:full` once.
