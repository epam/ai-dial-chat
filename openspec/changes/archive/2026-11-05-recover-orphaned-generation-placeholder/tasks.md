# Tasks

Slicing: vertical, risk-first. Group 1 proves the behaviour in the hook with failing tests first, including the supersede race that carries the main risk; group 2 wires the host. Before editing `libs/chat-hooks`, read `AGENTS.md` "Library isolation" and `.claude/rules/libs.md`.

## 1. Hook: release and mark an orphaned placeholder

- [x] 1.1 Write failing tests in `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts` (or the resume spec beside it) for: load an unresolved placeholder, attach `404`, the watch's immediate re-check still returns the placeholder; assert the message shows the interrupted text, `isStreaming` and `canStopStreaming` are false, `handleRegenerateMessage` and sending are no longer short-circuited, and no save request is sent. Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts` fails for the right reason first.
- [x] 1.2 Add `generationInterruptedMessage` (exported English default beside `DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE` in `libs/chat-hooks/src/conversation/create-chat-stream-api.ts`, JSDoc stating the default) to the options of `useConversationStream.ts` and thread it to `createResumeIfAwaitingGeneration` in `generation-resume.ts`. Verification: typecheck of `@epam/ai-dial-chat-hooks` via `npm run verify:changed` once the slice is done.
- [x] 1.3 Implement `showInterrupted()` and call it from `runWatch` after the immediate re-check, from the path where `watchConversation` fails to open, and from the attach-ended-without-terminal path, per design D1; keep the watch running afterwards. Verification: the tests from 1.1 pass.
- [x] 1.4 Add tests for the remaining scenarios of the spec: a saved answer arriving while the watch runs replaces the interrupted message; sending while the watch runs supersedes it and a later watch result changes nothing; attach serving a live generation shows no interrupted text; a pending background message resumes and shows none; a placeholder with retained content keeps the persistence warning; a hidden or other displayed path is untouched; the English default text when the option is omitted. Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts` and the generation-resume spec file pass.
- [x] 1.5 Update `libs/chat-hooks/README.md` with the option and its default, and run `npm run validate:docs`. Verification: the command passes.
- [x] 1.6 Architecture guard: confirm `libs/chat-hooks` gained no import of i18n, app contexts, routing, env or `/api` paths. Verification: `npm exec nx lint chat-hooks` passes and a grep of the diff for those terms is empty.

## 2. Host wiring and copy

- [x] 2.1 Add `GenerationInterrupted = 'chat.generationInterrupted'` to `ChatI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and the sentence to `apps/chat/src/i18n/locales/en.json` next to `generationPersistenceError`. Check the exact English value does not already exist under a shared key. Verification: the translation-key lint or test passes (`npm run verify:changed`).
- [x] 2.2 Pass `generationInterruptedMessage: t(ChatI18nKeys.GenerationInterrupted)` in `apps/chat/src/pages/Conversation/Conversation.tsx` and `apps/chat/src/pages/ApplicationEditor/setup/AppPreviewChat.tsx`. Verification: the existing specs under `apps/chat/src/pages/Conversation` that mount the hook still pass, (no app spec exists for `generationPersistenceErrorMessage`, so there is no existing wiring test to extend).
- [x] 2.3 RTL and accessibility check: the text renders in the existing stream-error card, so confirm no physical-direction class or new element is introduced. Verification: diff review shows no new markup.

## 3. Specs and close-out

- [x] 3.1 Run `openspec validate recover-orphaned-generation-placeholder --strict` and `npm run validate:specs`. Verification: both pass.
- [ ] 3.2 After implementation, run `npm run verify:changed` once for the slice, then exactly one `npm run verify:full` to close the change. Verification: both exit 0.
