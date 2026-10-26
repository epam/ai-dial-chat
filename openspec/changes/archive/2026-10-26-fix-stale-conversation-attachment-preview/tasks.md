# Tasks

## 1. Shared guard hook

- [x] 1.1 Add `apps/chat/src/hooks/attachment/useLatestCanvasRequest.ts` (JSDoc, module-level generation, per-instance mounted ref); verify with `npm run test:file -- apps/chat/src/hooks/attachment/tests/useLatestCanvasRequest.spec.ts` covering supersede, a guard taken for a synchronous preview, unmount and cross-instance order.
- [x] 1.2 Replace the private `generationRef`/`isMountedRef` in `apps/chat/src/hooks/files/useDialFilePreview.ts` with the hook; verify with `npm run test:file -- apps/chat/src/hooks/files/tests/useDialFilePreview.spec.ts`.

## 2. Wire the callers

- [x] 2.1 Pass the guard from `handleMessageAttachmentClick` and `handleInputAttachmentClick` in `apps/chat/src/components/ConversationView/ConversationView.tsx`; verify with `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.reply.spec.tsx` (existing mocks of `openAttachmentCanvas` still pass).
- [x] 2.2 Pass the guard in the three click handlers of `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx` and skip the download/new-tab fallback and `handleClose` when superseded; verify with `npm run test:file -- apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx`.

- [x] 2.3 Add one case to `apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx` where a source click is superseded by another click before it resolves `false`, asserting no download, no `window.open` and no `handleClose` (spec scenario "A superseded sources-panel click does not download or open a tab"); verify with `npm run test:file -- apps/chat/src/components/ConversationSourcesPanel/tests/ConversationSourcesPanel.spec.tsx`.
- [x] 2.4 Pass the guard from `handleAttachmentClick` in `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx` (the new-conversation input tray); verify with `npm run test:file -- apps/chat/src/components/NewConversationComposer/tests/NewConversationComposer.spec.tsx`.
- [x] 2.5 Add a case to `apps/chat/src/components/ConversationView/tests/ConversationView.message-memo.spec.tsx` asserting that two quick message-attachment clicks hand `openAttachmentCanvas` guards where only the second is current; verify with `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.message-memo.spec.tsx` (fails when the guard argument is removed).

## 3. Verification

- [x] 3.1 Library guard: confirm `git diff --stat` touches nothing under `libs/*`.
- [ ] 3.2 Run `npm run verify:changed`, then once `npm run verify:full`, and `npm run validate:specs`. Not completed: `@epam/ai-dial-chat-shared:typecheck` fails in `PanelEmptyState.tsx` on `development` independently of this change, so `verify:changed` and `verify:full` stay red; the touched test files, `tsc` on the touched files and `npm run validate:specs` pass.
