# Spec: conversation-stream-decomposition

## Purpose

Which module owns each concern of `useConversationStream` (path and generation-ownership state, reload errors, stream lifecycle, stop and resume), how its spec splits along the same seams, and that the public hook API and its callers stay unchanged.

## Requirements

### Requirement: Conversation stream concerns live in focused modules behind an unchanged API

`useConversationStream` (`libs/chat-hooks/src/conversation/useConversationStream/useConversationStream.ts`) SHALL delegate its concerns to these modules in the same folder:

| Module | Owns |
| --- | --- |
| `conversation-stream.types.ts` | the exported transport, lifecycle, channel, overlay, state-accessor, params, options and result interfaces |
| `stream-errors.ts` | `resolveStreamErrorMessage`, `findResumedBackgroundGenerationId`, the status and timeout constants |
| `useStreamPathState.ts` | streaming and stoppable path sets, `streamingPathsRef`, the generation-ownership refs (`activeGenerationIdsRef`, `latestGenerationIdsRef`, `resumedGenerationIdsRef`, `resumingPathsRef`, `bufferedGenerationsRef`, `stoppedGenerationIdsRef`, `stopRequestedIdsRef`), the mounted and displayed-conversation guards, and their mutators |
| `useConversationReloadErrors.ts` | terminal-read failures and retries, `clearReloadError`, `reportReloadError`, `retryConversationReload` |
| `useStopGeneration.ts` | `handleStop`, its generation-id resolution, the 404 grace polling, `sendStop` |
| `stream-session.ts` | `runStreamSession`: the send pipeline, chunk apply and batching, terminal reload, failure display, the 401 save, interrupted and conflict recovery |

`useConversationStream.ts` SHALL keep:

- the parameter mirrors and the frame scheduler;
- the shared `resumeGeneration` instance;
- `startStream` as a `useCallback` with its dependency array, delegating to `runStreamSession`;
- `restoreBufferedGeneration`, `resumeIfAwaitingGeneration` and the derived render values.

It SHALL re-export every type it exported before, so `@epam/ai-dial-chat-hooks` and `@epam/ai-dial-chat-hooks/conversation` expose the same names and shapes.

`generation-resume.ts` SHALL import its transport type from `conversation-stream.types.ts`, not from `useConversationStream.ts`.

A spec that names an internal of `useConversationStream`, for example `reloadConversation`, `settleFromServerCopy`, `isSuperseded`, `activeGenerationIdsRef`, `resumingPathsRef` or `handleStop`, refers to it in the module this table assigns it to.

The split SHALL NOT change any callback identity rule, effect, the render-time sync of `streamingPathsRef`, the post-commit displayed-conversation ref, timers, messages or the README.

#### Scenario: The public surface is unchanged

- **WHEN** the exports of `libs/chat-hooks/src/index.ts` and `libs/chat-hooks/src/entry-points/conversation.ts` are compared before and after the split
- **THEN** the same names are exported with the same types, and `npm run validate:docs` passes without README edits

#### Scenario: Callers are unaffected

- **WHEN** `Conversation.spec.tsx`, `ConversationReloadConflict.spec.tsx` and `AppPreviewChat.spec.tsx` in `apps/chat` run without edits
- **THEN** they pass

### Requirement: The stream spec splits along the same seams without losing cases

`tests/useConversationStream.spec.ts` SHALL be replaced by spec files grouped by concern, with shared fixtures defined once in `tests/conversation-stream-harness.ts`. `makeAttachStream` and `renderAndFail` SHALL each have a single definition. Each case SHALL keep its assertions, the per-file `it` counts SHALL sum to the original 116, and no spec file SHALL exceed about 1000 lines.

#### Scenario: Case count is preserved

- **WHEN** the `it` and `it.each` occurrences of the new spec files are counted
- **THEN** their total equals the 116 of the original file, and the vitest run reports the same number of executed tests as before the split
