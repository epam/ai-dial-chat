Slicing strategy: vertical, lib outward. Slice 1 closes the watch lost-update gap that the handover depends on. Slice 2 adds the opt-in conflict handover in `libs/chat-hooks`. Slice 3 opts the page's load-time auto-start in and proves the reload scenario end to end. Slice 4 updates the docs. Each slice is verified before the next starts.

## 1. Resume watch re-checks once subscribed (`libs/chat-hooks`)

- [x] 1.1 Write failing tests in `libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`:
  - Attach is unavailable, the watch opens, and the immediate `getConversation` returns a non-awaiting copy. The resume finishes with that copy without any `UPDATE` event and without advancing to `GENERATION_RESUME_WATCH_TIMEOUT_MS`.
  - The immediate check returns an awaiting copy. The resume resolves on a later qualifying `UPDATE`.
  - The immediate check rejects. The watch continues.
- [x] 1.2 In `createResumeIfAwaitingGeneration.runWatch` (`libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts`), run one `transport.getConversation` after `transport.watchConversation` resolves. Finish and abort the watch when the copy is no longer awaiting; ignore a rejection. Keep the existing timeout and final check unchanged.
- [x] 1.3 Architecture guard: the change uses only the injected `transport`. It adds no `/api` path, server-api or generated-client import, app context, or env access.

Verification:
- `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`
- `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`
- `npm run verify:changed`

## 2. Opt-in conflict handover (`libs/chat-hooks`)

- [x] 2.1 Write failing unit tests for `fetchConversationForRecovery`'s new optional `isPending` predicate in `libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`:
  - A pending result is retried on the `RECOVERY_REFETCH_DELAYS_MS` schedule.
  - The first non-pending result is returned.
  - A result still pending at the end of the schedule returns `null`.
  - Without the predicate, behaviour is unchanged.
- [x] 2.2 Add the `isPending` parameter to `fetchConversationForRecovery` in `libs/chat-hooks/src/conversation/useConversationStream/generation-resume.ts`.
- [x] 2.3 Write failing hook tests in `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`, next to the existing `GenerationConflictError` and `StreamInterruptedError` cases, one per scenario of "A conflict on an opted-in start joins the running generation":
  - The pre-start re-fetch, then the placeholder, then attach `done` ends on the server copy, with no `streamErrorMessage` and `canStopStreaming` `false` during the handover.
  - The already-finished copy is applied directly.
  - An unresolvable handover writes `generationConflictMessage`.
  - `transport.streamCompletion` is called exactly once.
  - A superseded opted-in start makes no re-fetch.
  - A conflict without the option still settles immediately with the conflict message. The existing #8688 tests stay green.
- [x] 2.4 Export `StartStreamOptions` (`{ resumeOnConflict?: boolean }`) from `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` and from the lib's `src/index.ts`. Add the optional trailing `options` parameter to `startStream`, `UseConversationStreamResult.startStream`, and `ConversationStreamStarter` (`libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts`).
- [x] 2.5 In `startStream`'s `onError`, route a non-superseded `GenerationConflictError` with `resumeOnConflict` to a new `recoverConflictedStart`. Model it on `recoverInterruptedStream`:
  - Report through `onStreamError`.
  - Clear `stoppablePath` for this generation.
  - Reserve `resumingPathsRef`.
  - Re-fetch with the pre-start `isPending` predicate (`messages.length === messageIndex` and the last message is a user message).
  - Classify the result: still generating → hand over to `resumeGeneration` with `onSettled: settleRecovered` and `skipDedupe: true`; finished → apply the server copy; not recoverable → `settleAsFailed(error)`.
  - Leave `recoverInterruptedStream`'s behaviour unchanged.
- [x] 2.6 Architecture guard: `resumeOnConflict` is a host-supplied boolean. The hook does not infer it from `mode`. No `/api` path, server-api or generated-client import, app context, routing, storage, or env access is added to `libs/chat-hooks`.

Verification:
- `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/generation-resume.spec.ts`
- `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`
- `npm run test:file -- libs/chat-hooks/src/conversation/useConversationHandlers/tests/useConversationHandlers.spec.ts`
- `npm run verify:changed`

## 3. Load-time auto-start opts in (`apps/chat`)

- [x] 3.1 Write failing tests in `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`, next to the existing `ContinueLastUser` auto-start test:
  - The load-time auto-start of a user-last conversation passes `{ resumeOnConflict: true }` as `startStream`'s options argument.
  - User-initiated send, regenerate and edit do not pass the option.
- [x] 3.2 Pass `{ resumeOnConflict: true }` from the auto-start call in `loadConversation` (`apps/chat/src/pages/Conversation/Conversation.tsx:508-516`), and from no other call site. `AppPreviewChat` stays unchanged.
- [x] 3.3 Write a page-level regression test in `apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx` that uses the real `useConversationStream` with a fake transport:
  - The first `getConversation` returns `[user]`.
  - `streamCompletion` fails with `GenerationConflictError`.
  - Re-fetches return `[user]`, then `[user, placeholder]`.
  - Attach emits a snapshot, chunks and `done`, and the final `getConversation` returns `[user, answer]`.
  - Assert, by visible text, that the answer is shown and the conflict text is not.
  - Assert that `streamCompletion` was called once and no `saveConversation` call was made for the path.
- [x] 3.4 Confirm that rate and delete cannot act on the in-flight assistant message while the path is streaming (`libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts`, `handleRateMessage` / `handleConfirmDelete`, and the message action row). If either is reachable, add an `isStreaming` no-op guard and a test in `libs/chat-hooks/src/conversation/useConversationHandlers/tests/useConversationHandlers.spec.ts`. Otherwise, record the evidence in the PR description.

Verification:
- `npm run test:file -- apps/chat/src/pages/Conversation/tests/Conversation.spec.tsx`
- `npm run test:file -- libs/chat-hooks/src/conversation/useConversationHandlers/tests/useConversationHandlers.spec.ts`
- `npm run verify:changed`

## 4. Docs and close-out

- [x] 4.1 Update `libs/chat-hooks/README.md`, in the `useConversationStream` section:
  - Document `startStream`'s optional `options` argument and the `StartStreamOptions` export.
  - Describe the opted-in conflict handover, including its fallback to the conflict message.
  - Describe the watch re-check.
  - Keep every code fence valid against the exported names.
- [x] 4.2 Run `npm run validate:docs`.
- [x] 4.3 Run `npm run verify:full` once.

## 5. Follow-ups (out of scope, record only)

- [ ] 5.1 Open an issue for optimistic concurrency (`If-Match`) on client conversation saves (rate, delete, settings, status messages), so a stale client copy can never replace a newer server answer in any scenario.
- [ ] 5.2 Post on #8935 that the reported reload overwrite is traced to this frontend path, with a link to this change. Ask QA to confirm with a HAR: a `continue_last_user` completion answered with `409` after the reload. The post is published only after the user approves its text.
