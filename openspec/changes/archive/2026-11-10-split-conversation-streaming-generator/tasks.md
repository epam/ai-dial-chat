Branch: `refactor/split-conversation-streaming-generator`, from `development`, in the worktree `C:/projects/wt-b12`.

## 1. Request object

- [x] 1.1 Add `StreamCompletionRequest` and switch `streamCompletion` to it (design D1).
- [x] 1.2 Build the request in `ConversationCompletionsResponder`. Move the mocks and assertions in `completions.integration.spec.ts`, `completion-response-lifecycle.spec.ts`, `conversation.controller.integration.spec.ts`, `conversation.service.spec.ts`, `project-completions.integration.spec.ts`, `conversation-streaming.service.spec.ts` and `project-conversations.integration.spec.ts` from argument indexes to named fields.

## 2. Extract

- [x] 2.1 Move the preparation deadline, the abandoned-step release and the interruption exceptions to `GenerationPreparation` (D2).
- [x] 2.2 Move the start-state write, marker release, stop request, re-reads and terminal write to `ForegroundGenerationLock` (D2).
- [x] 2.3 Split `streamCompletion` into `prepareGeneration`, `saveStartState` and `relayAndFinalize`, with `openRelay`, `recordRelayMetrics` and `toTerminalWrite` (D3). Replace the local `GenerationCapabilities` with `GenerationApiSelection`.

  Result: 1185 → 816 lines; the longest method is `relayAndFinalize` at 128 lines.

## 3. Close

- [x] 3.1 `tsc` over the `chat-api` app and spec sources together passes, apart from the existing `src/net/proxy-agent.setup.ts` error that comes from the installed `https-proxy-agent` typings.
- [x] 3.2 `nx lint @epam/chat-api` passes (warnings only, none new). The full `nx test @epam/chat-api` run passes.
- [x] 3.3 Run `validate:specs` and `openspec validate split-conversation-streaming-generator`.
