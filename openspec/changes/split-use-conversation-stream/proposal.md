## Why

`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts` is 1292 lines, and its spec `tests/useConversationStream.spec.ts` is 4188 lines. Together they are item F5 of the 2026-10-26 refactoring audit. One hook owns:

- per-path streaming and stop bookkeeping, with seven ownership refs;
- terminal-read failure and retry state;
- the displayed-conversation guard;
- a 600-line `startStream` closure: send, chunk apply and batching, terminal reload, failure display, the 401 save, and interrupted/conflict recovery;
- an 85-line `handleStop` with 404 grace polling;
- the resume wiring into `generation-resume.ts`.

There is also a type-only import cycle: `generation-resume.ts` imports `ConversationStreamTransport` from the hook file, while the hook imports values from it.

The spec mirrors the size problem. One 4188-line file holds 116 cases. Its fixtures are copy-pasted: `makeAttachStream` exists three times and `renderAndFail` twice.

## What Changes

The public API does not change. `useConversationStream` and every type currently exported from `useConversationStream.ts` stay reachable from `@epam/ai-dial-chat-hooks` and `@epam/ai-dial-chat-hooks/conversation` with the same names and shapes. The README does not change.

New modules sit in the same folder, and code moves verbatim:

- **`conversation-stream.types.ts`** holds the exported interfaces: `StreamCompletionOptions`, `ConversationStreamTransport`, `ConversationGenerationLifecycle`, `ConversationStreamChannel`, `ConversationStreamOverlayNotifier`, `ConversationStateAccessor`, `UseConversationStreamParams`, `StartStreamOptions` and `UseConversationStreamResult`.
  - `useConversationStream.ts` re-exports them as an explicit `export type { … }` list, so `export *` in the entry points keeps exporting them.
  - `generation-resume.ts` imports `ConversationStreamTransport` from the types file, which breaks the cycle.
- **`stream-errors.ts`** holds the pure module helpers: `resolveStreamErrorMessage`, `findResumedBackgroundGenerationId` and the status/timeout constants.
- **`useStreamPathState`** holds:
  - the streaming and stoppable path sets with `streamingPathsRef`;
  - the ownership refs (`activeGenerationIdsRef`, `latestGenerationIdsRef`, `resumedGenerationIdsRef`, `resumingPathsRef`, `bufferedGenerationsRef`, `stoppedGenerationIdsRef`, `stopRequestedIdsRef`);
  - the mounted and displayed-conversation guards;
  - `add`/`removeStreamingPath`, `setPathStoppable`, `releaseActiveGeneration`, `remember`/`forgetResumedGenerationId` and `isPathDisplayed`.
- **`useConversationReloadErrors`** holds the reload-failure and retrying state, `clearReloadError`, `reportReloadError` and `retryConversationReload`.
- **`useStopGeneration`** holds `handleStop`, with its id resolution, the 404 grace polling and `sendStop`.
- **`stream-session.ts`** holds `runStreamSession(context, …startStream args)`, the body of `startStream` moved verbatim.
  - Its inner closures, such as `releaseGeneration`, `reloadConversation`, `settleAsFailed`, `saveUnsavedAnswer` and `settleFromServerCopy`, stay closures inside it.
  - The hook's `startStream` remains a `useCallback` with the same dependency array. It calls `runStreamSession` with a context object of exactly the values the body reads today.

`useConversationStream.ts` keeps the parameter mirrors, the frame scheduler, the `resumeGeneration` memo, `restoreBufferedGeneration`, `resumeIfAwaitingGeneration`, the derived render values and the return. It drops to about 350 lines.

**Spec split.** `tests/useConversationStream.spec.ts` splits along the same seams into files of up to about 1000 lines. The cases and assertions stay the same, and the per-file `it` counts add up to the original 116.

- A shared `tests/conversation-stream-harness.ts` holds `makeConversation`, `useHookHarness`, the transport mock, `makeAttachStream` and `renderAndFail`, each defined once.
- The spec files are:
  - `useConversationStream.background.spec.ts` (background generations and attach-supplied ids);
  - `.batching.spec.ts`;
  - `.unsaved-answers.spec.ts`;
  - `.stop.spec.ts`;
  - `.errors.spec.ts` (generation conflict and error text);
  - `.recovery.spec.ts` (interrupted streams and `resumeOnConflict`);
  - `.send.spec.ts` (index translation, channel wait and cancellation re-check, overlay and settled notifications, `resumeIfAwaitingGeneration`).

No behavior changes: the same callbacks, effects, ordering (including `streamingPathsRef` synced during render and the post-commit displayed-conversation ref), timers and messages.

### Non-goals

- Restructuring `startStream`'s state machine into separate modules per terminal path. `runStreamSession` keeps its closures, and that deeper split can follow later.
- Changing `generation-resume.ts` beyond its type import, or `apply-chunk.ts`, `buffered-generation.ts` and `frame-scheduler.ts`.
- Any public API, README or caller change.

### Acceptance criteria

- `useConversationStream.ts` is under 450 lines, `stream-session.ts` under 700, and every other new module under 300. Each new module has a JSDoc summary.
- `generation-resume.ts` no longer imports from `./useConversationStream`.
- The spec files sum to 116 `it` cases with unchanged assertions. No spec file is over about 1000 lines, and each shared fixture is defined once.
- `generation-resume.spec.ts`, `apply-chunk.spec.ts`, `frame-scheduler.spec.ts`, `conversation-path.spec.ts` and the `apps/chat` specs that render the hook's callers pass unedited. These are `Conversation.spec.tsx`, `ConversationReloadConflict.spec.tsx` and `AppPreviewChat.spec.tsx`.
- `nx run-many -t test lint build typecheck -p @epam/ai-dial-chat-hooks` passes, with typecheck real for this lib, and so do `validate:docs`, `validate:specs` and `validate:lib-duplicates`.

### Alternatives considered

1. **Only split the spec.** This leaves the 1292-line hook.
2. **Extract state hooks and move the `startStream` body into a context-taking function** (chosen). It reaches the size targets while keeping every closure and dependency array intact.
3. **Decompose `startStream` into separate recovery, failure and persistence modules.** The closures share session-local state (`genId`, `conversationPath`, `controller`, `isSuperseded`). Splitting them changes control flow, not just location, so it is deferred.

### Rollback

The change is internal to `libs/chat-hooks`. Reverting the commit restores the files, and no consumer changes.

## Capabilities

### New Capabilities

- `conversation-stream-decomposition`: which module owns each concern of `useConversationStream`, the unchanged public surface, the ordering constraints, and how other specs' references to its internals (`activeGenerationIdsRef`, `resumingPathsRef`, `reloadConversation`, `handleStop` and others) map to the new owners.

### Modified Capabilities

None. `useConversationStream.ts` and `generation-resume.ts` keep their paths, so file citations in other specs stay valid. Symbol citations are covered by the ownership table.

## Impact

- **Code:** `libs/chat-hooks/src/conversation/useConversationStream/`.
  - New: `conversation-stream.types.ts`, `stream-errors.ts`, `useStreamPathState.ts`, `useConversationReloadErrors.ts`, `useStopGeneration.ts`, `stream-session.ts`.
  - Edited: `useConversationStream.ts`, and `generation-resume.ts` (type import only).
- **Tests:** `tests/useConversationStream.spec.ts` is replaced by seven spec files plus `tests/conversation-stream-harness.ts`.
- **Lib boundary:** the hook stays transport-injected and imports no app code. `chat-hooks` keeps no `.tsx` outside tests.
- **Unaffected:**
  - callers in `apps/chat`;
  - the README and the public exports;
  - i18n, RTL, a11y, feature gating and telemetry.
