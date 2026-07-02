## 1. Awaiting-resume detection utility

- [x] 1.1 Create `apps/chat/src/utils/generation-resume.ts` with `isAwaitingGenerationResume(conversation: Conversation): boolean` — `true` when the last message is `role: assistant`, `content` is empty, and neither `hasStreamError` nor `wasStoppedByUser` is set.
- [x] 1.2 Add `apps/chat/src/utils/tests/generation-resume.spec.ts` covering: empty-placeholder-last-message → `true`; non-empty content → `false`; `hasStreamError: true` → `false`; `wasStoppedByUser: true` → `false`; empty `messages` array → `false`.

## 2. Resume-watch support in `useConversationStream`

- [x] 2.1 Add a `GENERATION_RESUME_WATCH_TIMEOUT_MS` constant (default 5 minutes) near the hook or in `apps/chat/src/constants/`, matching the pattern of `DISPLAY_NAME_WATCH_TIMEOUT_MS`.
- [x] 2.2 In `apps/chat/src/hooks/conversation/useConversationStream.ts`, add `resumeIfAwaitingGeneration(conversationId: string, conversation: Conversation): void`:
  - Returns immediately if `!isAwaitingGenerationResume(conversation)`.
  - Adds the conversation's path to `streamingPaths` via the existing `addStreamingPath`.
  - Opens a subscription with `watchConversation` (reuse the raw-fetch SSE reader pattern from `ConversationsContext.watchForDisplayNameUpdate`: `getReader()`, `TextDecoder`, split on `\n`, parse `data:` lines as `{ url, action }`).
  - On an `UPDATE` action: call `getConversation(conversationPath)`; if `!isAwaitingGenerationResume(result)`, update `conversation`/`conversationRef` state (guarded by `isPathDisplayed`, same as `startStream`'s `onComplete`), call `removeStreamingPath`, and stop reading.
  - On timeout (`GENERATION_RESUME_WATCH_TIMEOUT_MS`) or a natural stream end without a qualifying event: perform one final `getConversation`, apply the result to state (guarded by `isPathDisplayed`), and call `removeStreamingPath` unconditionally.
  - Does **not** get aborted by conversation navigation/unmount — it is not wired to any cleanup; like `startStream`'s callbacks, it keeps running and simply gates state writes on `isPathDisplayed`, so returning to the conversation before it resolves resumes the typing indicator with no extra code.
- [x] 2.3 Add `apps/chat/src/hooks/conversation/tests/useConversationStream.spec.ts` cases (extend existing file) covering: awaiting-resume conversation adds the path to `streamingPaths`; a qualifying `UPDATE` event resolves state and clears `streamingPaths`; a non-qualifying `UPDATE` event keeps watching; timeout performs a final fetch and clears `streamingPaths` regardless of outcome; resolving while a different conversation is displayed clears `streamingPaths` but does not touch the displayed conversation's state.
- [x] 2.4 Keep resume-watch dedupe scoped to active watches only: duplicate calls while a watch is active no-op, but the same conversation path can start a fresh resume watch after the previous one resolves or times out.

## 3. Wire resume into `ConversationPage` load flow

- [x] 3.1 In `apps/chat/src/pages/Conversation/Conversation.tsx`'s `loadConversation`, replace the bare `else { setConversation(result); }` branch: call `setConversation(result)` as before, then call `resumeIfAwaitingGeneration(id, result)`.
- [x] 3.2 Guard against calling `resumeIfAwaitingGeneration` more than once for the same path from React StrictMode's double-invoke while a resume watch is active; keep the guard inside `useConversationStream` so it is cleared when the watch resolves or times out.
- [x] 3.3 Confirm no changes are needed in `useConversationHandlers.ts`, `ConversationMessageItem.tsx`, or `build-message-actions.ts` — their existing `isStreaming`/`isAssistantTyping` consumption should already produce the typing indicator and guarded Regenerate/edit no-ops once `streamingPaths` includes the resumed path.
- [x] 3.4 Keep Stop tied to a live same-tab generation: expose a separate stop-availability flag from `useConversationStream`, pass it through `ConversationPage`/`ConversationView`, and ensure the input does not render Stop for resumed generations that have no local `generationId`.


## 4. Checks

- [x] 4.1 `npm exec nx lint chat`
- [x] 4.2 `npm exec nx test chat`
- [x] 4.3 `npm exec nx build chat` (or typecheck target) to confirm no type regressions
