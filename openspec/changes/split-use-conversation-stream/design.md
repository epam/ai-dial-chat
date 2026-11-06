## Context

**Hook structure** (`useConversationStream.ts`, 1292 lines; line numbers at the time of writing):

| Lines | Content |
| --- | --- |
| 50–61 | constants |
| 64–258 | exported interfaces |
| 203–214, 266–274 | pure helpers |
| 298–307 | parameter mirrors and the frame scheduler |
| 312–346 | path state and ownership refs |
| 348–398 | reload-failure state and callbacks |
| 406–419 | displayed-conversation guard |
| 421–486 | path mutators |
| 493–527 | `resumeGeneration` memo |
| 535–1132 | `startStream` |
| 1134–1159 | `restoreBufferedGeneration` |
| 1161–1231 | `handleStop` |
| 1238–1256 | `resumeIfAwaitingGeneration` |
| 1262–1291 | derived values and the return |

`startStream` holds closures over session-local `genId`, `conversationPath`, `messageIndex` and `controller`. Several of them forward-reference each other asynchronously. For example, `onError` calls `settleAsFailed`, `recoverInterruptedStream` and `recoverConflictedStart`, which are declared later.

**Ordering constraints:**

- `streamingPathsRef.current` is assigned during render (line 316).
- `displayedConversationIdRef` is updated in an effect whose cleanup cancels scheduled frames.
- `mountedRef` is set in an effect and handles StrictMode re-mount.
- The derived render values read `conversationRef.current` at render time.

**Public surface:** `export *` of `useConversationStream.ts` from both entry points, plus `applyChunkToMessages`, `mergeStages`, `getConversationPath` and `isAwaitingGenerationResume`.

**Spec (`tests/useConversationStream.spec.ts`):** 116 `it` cases in about 20 describes.

- Fixtures at lines 26–105.
- `makeAttachStream` is duplicated at 342, 3584 and 3940.
- `renderAndFail` is duplicated at 2693 and 2760.

## Goals / Non-Goals

**Goals:**

- One concern per module.
- The hook file under 450 lines.
- The type cycle removed.
- The spec split into files of up to about 1000 lines with each fixture defined once.
- An identical public API and identical behavior.

**Non-Goals:**

- Decomposing `startStream`'s terminal paths.
- Touching the sibling modules beyond one import.
- API or README changes.

## Decisions

### D1 — Types first, to break the cycle

The exported interfaces move to `conversation-stream.types.ts`. `useConversationStream.ts` re-exports them with an explicit `export type { … } from './conversation-stream.types';` list. `export type *` would also work for TypeScript, but `scripts/validate-docs.mjs` resolves only braced and `export *` re-exports., so its `export *` consumers see the same names. `generation-resume.ts` switches its `import type` to the types file. `ConversationReloadFailure`, which is not exported, moves with the reload-error hook.

### D2 — State hooks return refs and mutators, and are called in the old order

`useStreamPathState` is called where the path state is declared today. It owns the refs and returns them, plus the mutators and `isPathDisplayed`. It keeps:

- the render-time `streamingPathsRef` sync;
- the displayed-conversation effect, including `frameScheduler.cancelAll` in its cleanup, with `frameScheduler` passed in;
- the mount effect.

`mountedRef` and its mount effect stay in `useConversationStream`: both state hooks need it, and `useStreamPathState` needs `clearReloadError` from the reload-error hook. So the hook calls `useConversationReloadErrors` first and `useStreamPathState` second, right after the mount effect. The mount effect still precedes the displayed-conversation effect, as before. `useConversationReloadErrors` is called before it and needs `mountedRef` and `conversationId`. Its effects and callbacks keep their dependency arrays. A ref passed in is added to the arrays that read it, which is stable and changes no behavior.

### D3 — `startStream` body moves to `runStreamSession(context, …args)`

The 600-line body moves verbatim into `stream-session.ts` as a plain function. Its first parameter is a `StreamSessionContext` object of exactly the values the body reads from the hook scope:

- the refs;
- the mutators;
- `transport`, `generation`, `channel` and `overlay`;
- `conversationRef` and `setConversation`;
- `frameScheduler` and `resumeGeneration`;
- the message props;
- `reportReloadError`/`clearReloadError`;
- `onStreamErrorRef` and `batchChunksPerFrameRef`.

The hook's `startStream` stays `useCallback((...args) => runStreamSession(context, ...args), sameDeps)`. Because the context is built from the same values the callback closes over today, and the dependency array is unchanged, its identity and behavior are unchanged. The existing `eslint-disable` for exhaustive-deps stays with its reason.

### D4 — `handleStop` becomes `useStopGeneration`

It takes the refs from `useStreamPathState` plus `conversationId`, `conversationRef`, `frameScheduler`, `onStopError`, `overlay` and `transport`, and keeps its dependency array, with the passed refs added.

### D5 — Spec split by describe, fixtures in a harness module

Each original `describe` moves whole into the concern file listed in the proposal. The direct root-level `it`s move into the file whose concern they test, following the map in the F5 structure analysis.

The harness module exports the top fixtures and the root `beforeEach`/`afterEach` as a `setupStreamTestHooks()` helper, called once per file. It also exports the deduplicated `makeAttachStream` and `renderAndFail`. The three `makeAttachStream` copies and the two `renderAndFail` copies are compared before deduplication. If they differ, the helper takes a parameter for the difference rather than silently picking one.

### D6 — Verification per slice

After each slice, run the stream specs, `generation-resume.spec.ts` and the three `apps/chat` caller specs, plus ESLint for chat-hooks.

`chat-hooks` has a real `typecheck` target (`tsc --build`), which runs pinned to the worktree. Its result is compared with a clean baseline, because a junctioned worktree adds noise. The `it` totals are compared with the baseline before and after the spec split.

## Risks / Trade-offs

- **[A context object misses a value, leaving a stale or undefined closure]** → The typecheck flags a missing property. The context type is declared field by field from the analysis, and the full stream spec suite runs after D3.
- **[Effect order shifts when state moves into hooks]** → The hooks are called at the old declaration positions, and only stable-ref dependencies are added. The ordering-sensitive cases (displayed-conversation cancel, StrictMode mount, Stop polling) are in the spec suite.
- **[Fixture copies differ subtly]** → D5 compares them before deduplicating.
- **[`stream-session.ts` stays large, about 620 lines]** → This is accepted for this change. It holds one concern, the session state machine, and its deeper split is a stated non-goal.
