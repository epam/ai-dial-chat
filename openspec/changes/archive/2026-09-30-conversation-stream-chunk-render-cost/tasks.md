Slicing strategy: vertical, ordered by value and risk (design D5). Slice 1 (the context split) and slice 2 (item-prop stability) each remove a per-chunk cost that grows with N, and each ships independently. Slice 3 is the opt-in batching, the riskiest part: it touches the generation lifecycle, so it goes last and can be disabled with one host flag.

## 1. Split the sources-sidebar context (apps/chat)

- [x] 1.1 In `apps/chat/src/context/tests/SourcesSidebarContext.spec.tsx`, add failing tests:
  - a component that calls only `useSourcesSidebar()` does not re-render on `setMessages` (use a render counter);
  - a `useSourcesSidebarData()` consumer re-renders and reads the new messages;
  - `useSourcesSidebarData()` outside the provider throws an error that names the provider.
  - Update the existing tests that read `messages`/`conversationModelId` through `useSourcesSidebar()` so they read them through `useSourcesSidebarData()`.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/SourcesSidebarContext.spec.tsx` (new tests fail).
- [x] 1.2 In `apps/chat/src/context/SourcesSidebarContext.tsx`, split into the controls context and the data context under the same `SourcesSidebarProvider`, each value memoized on its own fields, and export `useSourcesSidebarData` (design D1). Remove `messages`/`conversationModelId` from `SourcesSidebarContextValue`, and add a `SourcesSidebarDataContextValue` interface.
  - Verification: the same spec, all green.
- [x] 1.3 In `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`:
  - read `messages`/`conversationModelId` from `useSourcesSidebarData()`;
  - pass `isOpen ? messages : EMPTY_MESSAGES` to `useConversationSources`, with `EMPTY_MESSAGES` as a module-level constant (design D2).
- [x] 1.4 In `apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx`:
  - move `messages`/`conversationModelId` into a `useSourcesSidebarData` mock;
  - add tests showing that `useConversationSources` receives the empty constant while closed and the live messages while open.
  - Verification: `npm run test:file -- apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx`.
- [x] 1.5 Confirm that the other three `vi.mock`s of the context need no change, because they do not return `messages`: `ConversationView.reply.spec.tsx`, `SkillDetailsPdfPreview.spec.tsx` and `Conversation.spec.tsx`. Confirm that typecheck passes.
  - Verification: `npm run test:file -- apps/chat/src/components/CatalogView/tests/SkillDetailsPdfPreview.spec.tsx apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx apps/chat/src/components/Header/tests/Header.spec.tsx`.
- [x] 1.6 Slice check: `npm run verify:changed`.

## 2. Stable message-item props (libs/chat-hooks + apps/chat)

- [x] 2.1 In `libs/chat-hooks/src/conversation/useConversationHandlers/tests/useConversationHandlers.spec.ts`, add failing tests:
  - `handleRegenerateMessage`, `handleRateMessage`, `handleButtonSelect` and `handleEditMessage` keep their identity when the hook re-renders with a new `conversation` object and unchanged other inputs;
  - a callback obtained earlier acts on the conversation currently in `state.conversationRef`: rate clears the rating on the newer conversation.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationHandlers/tests/useConversationHandlers.spec.ts`.
- [x] 2.2 In `libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts`, make those four callbacks read `conversationRef.current` at call time, and drop `conversation` from their dependencies. Keep the synchronous ref assignment in `handleRegenerateMessage`.
  - Verification: the same spec, all green, including the existing "assigns the conversation ref synchronously" test.
  - Scope note: the internal `submitStarter` also closed over `conversation`, which kept `handleButtonSelect` unstable. It now reads the ref too, and the `chat-hooks-conversation-handlers` delta was updated to name it. `handleSend` still closes over `conversation`: it is not a message-item prop, so it is out of scope.
  - Review fix: `handleRateMessage`'s revert now also assigns `state.conversationRef`. Without it a rejected optimistic rating stayed in the ref, and the next successful rate persisted it. A regression test covers this: the first rate fails, the second succeeds, and the saved conversation has no first rating.
- [x] 2.3 Architecture guard: `libs/chat-hooks` gains no app, i18n, routing or env import. Review new imports in the diff.
- [x] 2.4 In `apps/chat/src/components/ConversationView/ConversationView.tsx` (design D3):
  - make `onDialFileSystemClick` a `useCallback` and `editMenuOverlays` a `useMemo`;
  - move `messages`/`isAssistantTyping` into a `latestRef` assigned in `useLayoutEffect`;
  - read them from that ref in `handleStartEdit`, `handleEditMessageWithAnchor` and `handleRegenerateMessageWithAnchor`, and drop them from those callbacks' dependencies.
- [x] 2.5 Add `apps/chat/src/components/ConversationView/tests/ConversationView.message-memo.spec.tsx`:
  - reuse the mock harness pattern of `ConversationView.reply.spec.tsx`, with `ConversationMessageItem` mocked as a `memo` component that has a per-index render counter;
  - re-render `ConversationView` with a `messages` array whose last element is new and whose earlier elements are the same objects;
  - assert that only the last index re-renders.
  - Verification: `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.message-memo.spec.tsx` (fails before 2.4, passes after).
  - Harness note: the reply spec's hook mocks return fresh functions per call (for example `armAnchor: vi.fn()`), which would defeat item memo by themselves. The new spec makes every hook mock return a hoisted, stable value, as the real hooks do. `onDialFileSystemClick` is also passed to `ConversationInput`, which now receives the same stable callback.
- [x] 2.6 In `libs/chat-hooks/README.md`, add a note to `useConversationHandlers`: the callbacks are identity-stable across conversation updates and read the latest conversation from `state.conversationRef`. Run `npm run validate:docs`.
- [x] 2.7 Slice check: `npm run verify:changed`.

## 3. Opt-in per-frame chunk batching (libs/chat-hooks + apps/chat)

- [x] 3.1 Add `libs/chat-hooks/src/conversation/useConversationStream/frame-scheduler.ts` with `createFrameScheduler()` (`schedule`, `flush`, `cancel`, `cancelAll`; one pending task per key; `requestAnimationFrame` with a `setTimeout(…, 16)` fallback), plus `tests/frame-scheduler.spec.ts`, which asserts that:
  - a second schedule for the same key before the frame runs only the latest task, once;
  - `flush` runs the pending task synchronously and it does not run again;
  - `cancel` drops the task;
  - the timer fallback is used when `requestAnimationFrame` is undefined.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/frame-scheduler.spec.ts`.
- [x] 3.2 In `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`, add failing tests with `batchChunksPerFrame: true` and fake frame advancement:
  - three chunks in one frame produce one `setConversation`, and the displayed content contains all three;
  - completion flushes a pending write before the reload, and no later frame overwrites the reloaded conversation;
  - an error or a stop shows the same final message as unbatched mode;
  - a superseding `startStream` flushes, then ignores the old generation;
  - navigating away cancels the pending write while the buffer keeps every chunk;
  - with the option omitted, writes stay synchronous.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`.
- [x] 3.3 In `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`, implement design D4:
  - add the `batchChunksPerFrame` parameter;
  - extract the display write into `applyDisplayWrite`, with its guards re-checked inside;
  - schedule it when batching is enabled;
  - flush at the start of `onComplete`, `onError`, `recoverInterruptedStream`, `handleStop`, and before a superseding `startStream`;
  - cancel on path change, and cancel all on unmount.
  - Verification: the same spec, all green.
  - Implementation note: the pending write snapshots the buffer when it is flushed, not later inside the React updater. A superseding `startStream` replaces the buffer entry before React runs the updater, and the supersede test caught the flushed chunk being dropped when the buffer was read lazily. In the resume path, `applySnapshot` cancels any pending write (a snapshot replaces the buffered message), and `finish` flushes.
- [x] 3.4 In `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts`, batch `applyAttachChunk`'s display write through the same scheduler passed in the existing context object. Add a batching case to `libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`.
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`.
- [x] 3.5 In `libs/chat-hooks/README.md`, document `batchChunksPerFrame` in the `UseConversationStreamParams` table: default `false`, the flush guarantees, and the timer fallback. Run `npm run validate:docs`.
- [x] 3.6 In `apps/chat/src/pages/Conversation/Conversation.tsx`, pass `batchChunksPerFrame: true` to `useConversationStream`. Add an assertion to `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx` that the page enables it.
  - Verification: `npm run test:file -- apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`.
- [x] 3.7 Architecture guard: the scheduler and the stream hook import no app code, and use only the global frame and timer APIs.
- [x] 3.8 Slice check: `npm run verify:changed`.

## 4. Close-out

- [x] 4.1 Run `npm run validate:docs`.
  - Result: passed (49 markdown files).
- [x] 4.2 Run `npm run verify:full` once.
  - Result: typecheck:full, lint:check and format:check pass. test:full reports 2 failures, both pre-existing and outside this change's files:
    - `apps/chat-api` `app-config.service.spec.ts`;
    - `apps/chat` `useSkillFileSystemPicker.spec.ts`.
  - The earlier `ConversationView.reply.spec.tsx` and `libs/conversation-input` failures no longer occur on the current `development`, which this branch is based on. The reply spec also passes with this change's `ConversationView.tsx` stashed, so the fix came from upstream, not from this change.
- [ ] 4.3 Follow-up (record only; do not implement here): propose a docs-drift fix. Two specs no longer match the code:
  - `conversation-sources-sidebar` "Sidebar contexts are produced by a shared factory" describes a `createSidebarContext` factory that does not exist;
  - `chat-hooks-conversation-sources` documents a `{ attachments, sources }` return shape, but the code returns `{ uploaded, generated, sources }`.
