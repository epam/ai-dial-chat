## Why

`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts` was 1185 lines. `streamCompletion` was one async generator that took 16 positional parameters, and it ran every phase in a single body: the preparation deadline, capability resolution, the start-state write with the foreground marker, the relay, the metrics and the terminal write. Callers and mocks addressed arguments by index (`args[10]`, `calls[0][13]`), so a new parameter shifted every test. This is refactoring plan item B12.

## What Changes

- `streamCompletion` takes one `StreamCompletionRequest` object instead of 16 positional parameters. `ConversationCompletionsResponder` and every spec mock read named fields.
- The preparation deadline (`startPreparationDeadline`, the abandoned-step release and the interruption exceptions) moves to `streaming/generation-preparation.ts` as `GenerationPreparation`.
- The foreground marker lifecycle moves to `streaming/foreground-generation-lock.ts` as `ForegroundGenerationLock`: the start-state write, the marker release, the stop request, the periodic re-reads and the terminal write.
- `streamCompletion` becomes a sequence of named steps: `prepareGeneration`, `saveStartState` and `relayAndFinalize`. `relayAndFinalize` uses `openRelay`, `recordRelayMetrics` and `toTerminalWrite`.
- The local `GenerationCapabilities` interface is dropped in favour of the existing `GenerationApiSelection`.

No behavior change: the SSE events, status codes, persistence writes, metrics, log messages and registry transitions are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-service-decomposition`: adds the requirement that `streamCompletion` takes a single request object and that the preparation deadline and the foreground marker lifecycle are separate collaborators of `ConversationStreamingService`.

## Impact

- `apps/chat-api/src/conversations/streaming/`: `conversation-streaming.service.ts` (1185 → 816 lines), new `stream-completion-request.ts`, `generation-preparation.ts` and `foreground-generation-lock.ts`; `conversation-completions.responder.ts` builds the request object.
- Seven specs move from positional arguments to the request object.
- No endpoint, DTO, OpenAPI, environment variable or frontend change.
