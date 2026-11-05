Slicing: one controller at a time, each slice moving its handlers, wiring the module and updating the specs that call them. `chat-api` must be green after each slice. Paths are under `apps/chat-api/src/` unless stated otherwise. Relative imports are extensionless. Before slice 1, save the current `libs/chat-api-client/openapi.json` to the scratchpad as the baseline for task 4.2.

## 1. `ConversationGenerationController`

- [x] 1.1 Create `conversations/conversation-generation.controller.ts` with `ConversationGenerationController(completionsResponder: ConversationCompletionsResponder)` and a JSDoc summary (design D1). Move `streamCompletion`, `stopCompletion` and `attachToGeneration` from `conversation.controller.ts` with every decorator unchanged.
- [x] 1.2 Remove the `completionsResponder` parameter and the imports that are now unused from `ConversationController`. Register the new controller in `conversations/conversation.module.ts` in the order from design D2.
- [x] 1.3 In `conversations/tests/conversation-controller.fixture.ts`, replace `createConversationController` with `createConversationGenerationController`, which builds the responder the same way. Switch `attach-generation-backpressure.spec.ts`, `completion-response-lifecycle.spec.ts` and `completions.integration.spec.ts` to it.
- [x] 1.4 Update the `TestingModule` `controllers` lists (design D3) in:
  - `attach-generation.integration.spec.ts`, `background-attach.integration.spec.ts` and `completions.integration.spec.ts`: the generation controller;
  - `completion-persistence.integration.spec.ts` and `conversation.controller.integration.spec.ts`: add the generation controller;
  - `telemetry/tests/sse-subscription-metrics.spec.ts`: add the generation controller and call `attachToGeneration` on it.

Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/attach-generation-backpressure.spec.ts apps/chat-api/src/conversations/tests/attach-generation.integration.spec.ts apps/chat-api/src/conversations/tests/background-attach.integration.spec.ts apps/chat-api/src/conversations/tests/completion-persistence.integration.spec.ts apps/chat-api/src/conversations/tests/completion-response-lifecycle.spec.ts apps/chat-api/src/conversations/tests/completions.integration.spec.ts apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts apps/chat-api/src/telemetry/tests/sse-subscription-metrics.spec.ts`

## 2. `ConversationTitlesController`

- [x] 2.1 Create `conversations/conversation-titles.controller.ts` with `ConversationTitlesController(conversationService)` and a JSDoc summary. Move `getConversationTitles`, `streamConversationTitles` (with `ApiExtraModels` and the title-stream constants and examples) and `generateConversationTitle` unchanged. Register it in the module.
- [x] 2.2 Add the titles controller to the `controllers` lists in `conversation-title-stream.controller.integration.spec.ts` (replacing `ConversationController`) and `conversation.controller.integration.spec.ts`.

Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-title-stream.controller.integration.spec.ts apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`

## 3. `ConversationWatchController`

- [x] 3.1 Create `conversations/conversation-watch.controller.ts` with `ConversationWatchController(conversationService)` and a JSDoc summary. Move `watchConversation` with its SSE pump unchanged, along with the `../common/utils/sse` and `../telemetry/runtime-metrics` imports. Register it in the module.
- [x] 3.2 Add `createConversationWatchController(conversationService)` to the fixture and use it in `conversation-watch.controller.spec.ts`. In `telemetry/tests/sse-subscription-metrics.spec.ts`, register the watch controller and call `watchConversation` on it.

Verification: `npm run test:file -- apps/chat-api/src/conversations/tests/conversation-watch.controller.spec.ts apps/chat-api/src/telemetry/tests/sse-subscription-metrics.spec.ts`

## 4. Close

- [x] 4.1 Remove unused imports from `conversation.controller.ts`. Confirm the line counts: under 450 for `conversation.controller.ts` and under 250 for each new controller. Confirm that `conversation.controller.ts` has no `ConversationCompletionsResponder`, `../common/utils/sse` or `../telemetry/runtime-metrics` reference.
- [x] 4.2 Run `npm run openapi`. Confirm that the key-sorted `libs/chat-api-client/openapi.json` deep-equals the key-sorted baseline, and that `git diff --stat libs/chat-api-client/src/generated` is empty (design D2). Commit the reordered `openapi.json`. Run `npm run openapi:check`.
- [x] 4.3 Rewrite the references from design D4 to the new owner:
  - the code comments in `conversations/streaming/conversation-completions.responder.ts`, `conversations/streaming/conversation-streaming.service.ts`, `conversations/streaming/tests/conversation-streaming.service.spec.ts` and `conversations/conversation.service.ts`;
  - `docs/architecture.md` (backend-owned persistence paragraph);
  - `docs/responses-api-integration.md` (flow diagram, timezone-header text and file table).

  Then run `npm run validate:docs`.
- [x] 4.4 Confirm that each touched spec keeps the same number of `it` cases.
- [x] 4.5 `npm exec nx run-many -- -t test lint build typecheck -p chat-api --excludeTaskDependencies --parallel=1` passes, and `npm run validate:specs` passes. Applied in a worktree whose `node_modules` is a junction, where plain `nx run-many` resolves to the main checkout. So tests ran with Vitest in the worktree (323 files, 6637 tests), lint with ESLint (clean), and `nx run chat-api:build` and `typecheck` were pinned with `NX_WORKSPACE_ROOT_PATH`. The build passes. The typecheck error set equals the clean `origin/development` baseline in that worktree, which has a pre-existing `proxy-agent.setup.ts` error and its TS6305 cascade; the only differences are the same cascade on the new controller imports.
- [ ] 4.6 Run `npm run verify:full` once.
