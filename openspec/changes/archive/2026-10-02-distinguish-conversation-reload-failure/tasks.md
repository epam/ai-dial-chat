## 1. Reload recovery slice

Strategy: one vertical slice through the shared hook and both app consumers, followed by specification/documentation reconciliation.

- [x] 1.1 Separate failed reads from persistence errors in `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` and `generation-resume.ts`; retain buffers, expose read retry, and guard concurrent/stale retries. Keep host contracts outside the library through the existing transport. Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`.
- [x] 1.2 Add regression coverage in those hook specs for initiating/attached GET failures, repeated retries, saved enrichment, placeholders, background pending, supersession, navigation, and unmount. Verification: the same exact-file command as 1.1.
- [x] 1.3 Add a localized reload notification under `apps/chat/src/components/ConversationView/`, thread optional props through `ConversationView.tsx`, and wire `pages/Conversation/Conversation.tsx` plus `pages/ApplicationEditor/setup/AppPreviewChat.tsx`. Add translation enum members and supported locale strings. Preserve mobile wrapping, logical alignment, keyboard access, announcement, and a 44px touch target. Verification: `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationReloadNotification.spec.tsx apps/chat/src/components/ConversationView/tests/ConversationMessageItem.spec.tsx` plus the existing consumer tests.
- [x] 1.4 Verify the completed slice with `npm run verify:changed`; inspect library isolation and RTL/mobile markup.

## 2. Documentation and specification reconciliation

- [x] 2.1 Update `libs/chat-hooks/README.md`, `apps/chat/README.md`, and `docs/architecture.md` with reload-error semantics and the additive hook result. Verification: `npm run validate:docs`.
- [x] 2.2 Sync the three delta specs into their main specs and validate with `openspec validate --specs` and `openspec validate distinguish-conversation-reload-failure`.
- [x] 2.3 Run `npm run verify:full` once; record any environmental or unrelated failures without changing unrelated files.

## 3. Review follow-up

- [x] 3.1 Preserve active generation ownership across StrictMode effect cleanup while retaining unmount invalidation of read retries. Cover both deferred and already-connected channel auto-starts through completion and read retry. Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`, followed by slice and full verification.

Review follow-up verification: both new StrictMode cases failed before the fix and passed after it. The two focused suites passed through Nx (121 tests), `npm run verify:changed` passed, and `npm run validate:docs` passed. `npm run verify:full` passed typecheck but stopped at unrelated lint errors in unchanged files: `libs/chat-shared/src/constants/entity-colors.ts:20` (extra blank line) and `libs/attachment-canvas/src/components/HtmlContent/HtmlContent.tsx:17` (import order). Full-workspace formatting and tests were not reached by that command; the affected test run passed. Library isolation is unchanged.
