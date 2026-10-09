# Tasks

Slicing strategy: contract-first, then vertical.

- **Group 1** adds the backend `status` field. Clients ignore it, so nothing changes at runtime.
- **Group 2** exposes it on `GenerationPersistenceError`. No caller reads it yet.
- **Group 3** adds the hook behavior behind the optional transport method. No host implements it yet.
- **Group 4** wires the app adapter, which turns the behavior on end to end.

Each group lands its own tests and docs.

## 1. Backend: `status` on the `conversation_save_failed` stream error

- [x] 1.1 Add a helper next to `GENERATION_PERSISTENCE_ERROR` in `apps/chat-api/src/conversations/generation/persistence-error.ts` that returns the envelope with an optional numeric `status`. In `finalize` in `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, record `status === GenerationStatus.Done && err instanceof HttpException ? err.getStatus() : undefined` in the `catch` (a stopped, aborted, or failed answer gets no `status`), and yield the helper's envelope. Leave `persistenceFailed`, attach events, and `background-generation.service.ts` unchanged. Verification: `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`.
- [x] 1.2 In `apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`, assert that a `401` terminal write of a completed answer yields `conversation_save_failed` with `status: 401` and the unchanged message, and that a `401` write of an answer that did not complete yields no `status`. In `apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts`, extend the existing expiring-token case to expect `status: 401`, and the 503 storage-failure case to expect its own status. Verification: `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts`.
- [x] 1.3 Update the "Completion persistence failures" section of `apps/chat-api/README.md`:
  - state that the stream error carries the rejected write's `status`;
  - state that the originating client makes one recovery save on `401`;
  - keep the statement that the backend performs no automatic write retry.

  Verification: `npm run validate:docs`.

## 2. Lib transport: expose `status` on `GenerationPersistenceError`

- [x] 2.1 In `libs/chat-hooks/src/conversation/create-chat-stream-api.ts`:
  - give `GenerationPersistenceError` an optional readonly `status?: number` constructor argument and field, with JSDoc;
  - make the parser pass `error.status` only when it is a number, using a local narrowing (no change to `StreamChunk` in `libs/chat-shared`).

  Verification: `npm run test:file -- libs/chat-hooks/src/conversation/tests/create-chat-stream-api.spec.ts`.
- [x] 2.2 Add tests to `libs/chat-hooks/src/conversation/tests/create-chat-stream-api.spec.ts`: a chunk with `status: 401` yields `status === 401`, and a chunk without `status`, or with a non-numeric `status`, yields `status === undefined`. Verification: same command as 2.1.
- [x] 2.3 Update the `conversation_save_failed` paragraph of `libs/chat-hooks/README.md` to document `GenerationPersistenceError.status`. Verification: `npm run validate:docs`.

## 3. Lib hook: one recovery save on `401`, warning deferred

- [x] 3.1 Add the optional `saveConversation?(path: string, conversation: Conversation): Promise<Conversation>` method to `ConversationStreamTransport` in `libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`, with a JSDoc saying it is used only for the single recovery save after a `401` terminal-save failure. Add a module-level `401` constant in that file (not exported), mirroring `GENERATION_CONFLICT_STATUS` in `create-chat-stream-api.ts`. Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts` still passes.
- [x] 3.2 In the same file, inside `startStream`'s `settleAsFailed` (design D3–D6):
  - extract the existing warning-writing code into a local function;
  - when the error is a `GenerationPersistenceError` with `status === 401` and `transport.saveConversation` exists, skip the immediate warning and start the recovery with `void`, through a local helper that handles its own errors:
    - read through `transport.getConversation`;
    - apply `restoreBufferedMessage`;
    - call `transport.saveConversation` once;
    - after each await, stop if the hook is unmounted, the generation was superseded, or the buffer was replaced;
    - on success, delete the buffer and, if displayed, set the saved conversation and `conversationRef`;
    - on failure, call the extracted warning function.
  - otherwise, call the warning function immediately, as today.

  Add a short block comment explaining the case: credentials expired during a long generation ([#9324](https://github.com/epam/ai-dial-chat/issues/9324)), and why only `401` (the write was refused, so it cannot have been committed). Verification: the tests in 3.3 pass.
- [x] 3.3 Add tests to `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`, each named for observable behavior:
  - a `401` failure is saved once with the received answer and never shows the warning;
  - no warning is shown while the recovery is pending, and the stop control is released;
  - a rejected recovery read or save shows the warning and does not retry;
  - a non-`401` or missing `status` shows the warning immediately with no extra read;
  - a transport without `saveConversation` shows the warning immediately;
  - a new generation, or navigation away, during the recovery leaves the displayed conversation and the newer buffer untouched;
  - the recovery still saves when the conversation is no longer displayed;
  - a stored copy that is not this turn's unsaved placeholder (too short, or holding a different answer) shows the warning and is not saved over;
  - `onStreamError` is called once with the original error.

  Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`.
- [x] 3.4 Extend the existing hook-level attach test ("preserves an attached answer on terminal failure") in `libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts` to confirm that an attach `error` event with `errorType: conversation_save_failed` makes no `saveConversation` call (the attach flow is exercised through the hook there, not in `generation-resume.spec.ts`). Verification: `npm run test:file -- libs/chat-hooks/src/conversation/useConversationStream/tests/useConversationStream.spec.ts`.
- [x] 3.5 Architecture guard: confirm the `libs/chat-hooks` diff adds no `/api` path, generated-client or `server-api` import, credential or cookie access, or logging, and uses only extensionless relative imports. Verification: `git diff -- libs/chat-hooks` shows none of them.
- [x] 3.6 Update `libs/chat-hooks/README.md`:
  - list the optional sixth transport method `saveConversation(path, conversation)`;
  - describe the `401` recovery save and its deferred warning in the persistence paragraph.

  Verification: `npm run validate:docs`.

## 4. App adapter and architecture docs

- [x] 4.1 Implement `saveConversation` in `apps/chat/src/utils/conversation-stream-transport.ts`. It delegates to `saveConversation` from `apps/chat/src/server-api/conversations.api.ts`, with the same `Conversation` / `ConversationResponseDto` casts `getConversation` uses there. Verification: `npm run verify:changed` passes after this slice.
- [x] 4.2 Update the persistence summary in `docs/architecture.md`:
  - the error now carries `status`;
  - the backend still makes a single terminal write;
  - the originating client makes one recovery save on `401`;
  - retained browser state still does not survive a page reload.

  Verification: `npm run validate:docs`.
- [x] 4.3 Close the change with `npm run validate:specs` and one `npm run verify:full`. Result: `validate:specs` passes; `verify:full` passes typecheck, lint, and format, and its only test failure is `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` "exposes only refinement availability for model undefined", which fails identically on a clean `development` checkout and is unrelated to this change (tracked separately).
