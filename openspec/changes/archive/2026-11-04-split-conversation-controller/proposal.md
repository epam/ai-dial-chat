## Why

`apps/chat-api/src/conversations/conversation.controller.ts` is 777 lines and is item B7 of the 2026-10-26 refactoring audit. It is one `@Controller({ path: 'conversations', version: '1' })` class with 18 handlers that fall into four unrelated groups:

- **Resource CRUD and listing:** create, list, metadata, get, save, rename, duplicate, the three delete routes and `viewed`. These handlers delegate one call each to `ConversationService`.
- **Generation:** `completions`, `completions/stop` and `completions/attach`. These delegate to `ConversationCompletionsResponder` and own the `x-timezone` header and the SSE contract.
- **Titles:** `titles`, `titles/stream` and `generate-title`. They own the client-abort wiring and the title-stream OpenAPI examples.
- **Watch:** `watch`. A 100-line inline SSE pump with keepalive, drain and reader-cancel handling and the `conversation_watch` gauge.

Every group's Swagger annotations sit between the others, so a change to the watch pump or the title stream is read past the CRUD routes, and the reverse is also true. The CRUD handlers also carry a `ConversationCompletionsResponder` dependency they never use. The publish routes already went through this split: `ConversationPublishController` (`apps/chat-api/src/conversations/conversation-publish.controller.ts`) is a sibling on the same `conversations` v1 path, kept separate for file-size reasons. This change follows that pattern.

## What Changes

- **New `ConversationGenerationController`** (`conversations/conversation-generation.controller.ts`). It takes `completions`, `completions/stop` and `completions/attach`, moved unchanged with their decorators. Its only dependency is `ConversationCompletionsResponder`.
- **New `ConversationTitlesController`** (`conversations/conversation-titles.controller.ts`). It takes `titles`, `titles/stream` and `generate-title`, moved unchanged. Its only dependency is `ConversationService`.
- **New `ConversationWatchController`** (`conversations/conversation-watch.controller.ts`). It takes `watch`, with its SSE pump moved unchanged. Its only dependency is `ConversationService`.
- **`ConversationController`** keeps the CRUD and listing routes and drops the `ConversationCompletionsResponder` constructor parameter. Its file shrinks to about 400 lines.
- All four classes keep `@ApiTags('conversations')` and `@Controller({ path: 'conversations', version: '1' })`. Handler names, and so `operationId`s and generated client method names, do not change.
- **`conversation.module.ts`** registers the three new controllers next to `ConversationController` and `ConversationPublishController`.
- **Tests:**
  - `tests/conversation-controller.fixture.ts` replaces `createConversationController` with `createConversationGenerationController` and `createConversationWatchController`.
  - Specs that build a Nest testing module list the controller or controllers that own the routes they call.
  - Assertions do not change.
- **Regenerated `libs/chat-api-client/openapi.json`.** Swagger lists paths in controller registration order, so the moved paths are listed after the CRUD ones. The document is otherwise identical. The generated client sorts its methods by name, so it does not change.

No behavior changes:

- the same routes, HTTP methods, status codes, DTOs, headers and SSE framing;
- the same guards and interceptors, all global (the current controller declares none);
- the same `operationId`s and the same generated client;
- the same telemetry (`dial_chat_sse_active` kinds), log message text and env vars. The watch handler's one error log moves with it, so its Nest logger context reads `ConversationWatchController` instead of `ConversationController`.

### Non-goals

- Changing any route, handler body or Swagger text.
- Splitting `ProjectConversationsController` or the projects module's completion routes.
- Moving the watch pump into a service or a shared SSE helper. It moves as-is.
- Moving `conversation-generation.service.ts` or `conversation-naming.service.ts` into subfolders (plan item B9).
- Sorting OpenAPI paths in `openapi-spec.ts`.

### Acceptance criteria

- `conversation.controller.ts` is under 450 lines and contains none of the moved handlers, `ConversationCompletionsResponder`, `../common/utils/sse` or `../telemetry/runtime-metrics`.
- Each new controller is under 250 lines and injects only the dependency listed above.
- The regenerated `openapi.json` is deep-equal to the current one once object keys are sorted, the generated client under `libs/chat-api-client/src/generated` has no diff, and `npm run openapi:check` passes.
- Every existing conversations, telemetry and streaming spec passes with the same number of `it` cases and unchanged assertions. `npm exec nx run-many -t test lint build typecheck -p chat-api` passes.

### Alternatives considered

1. **Two controllers, generation plus everything else** (the plan's B7 wording). The CRUD file keeps the watch pump and the title stream and stays around 650 lines, so it misses the size target. Rejected.
2. **Four controllers by route group** (chosen). Each class has one dependency and one reason to change, and the split follows the `ConversationPublishController` precedent.
3. **Move the watch pump and title-abort wiring into services, and keep one controller.** This changes runtime code paths and their tests rather than only moving them, so it carries more risk for the same size win. Rejected for this change. The watch pump can still move in a later change.

### Rollback

The change is internal to `chat-api`, apart from the reordered `openapi.json`. Reverting the commit restores both, with no contract, env or data migration.

## Capabilities

### New Capabilities

- `conversation-controller-decomposition`: which conversations controller owns which `/api/v1/conversations` route, the shared path, tag and version, and the no-contract-change guarantee.

### Modified Capabilities

- `generation-live-replay`: "No active generation for the path returns 404" names `ConversationGenerationController.attachToGeneration` in `conversation-generation.controller.ts` instead of `ConversationController` in `conversation.controller.ts`.

## Impact

- **Code:** `apps/chat-api/src/conversations/`.
  - New: `conversation-generation.controller.ts`, `conversation-titles.controller.ts` and `conversation-watch.controller.ts`.
  - Edited: `conversation.controller.ts` and `conversation.module.ts`.
  - Comments that name `ConversationController.streamCompletion` in `streaming/conversation-completions.responder.ts`, `streaming/conversation-streaming.service.ts` and `conversation.service.ts` are updated to the new owner.
- **Tests:**
  - `conversations/tests/conversation-controller.fixture.ts`;
  - the specs that build the controller: `attach-generation*`, `background-attach`, `completion-*`, `completions`, `conversation-title-stream`, `conversation-watch` and `conversation.controller.integration`;
  - `telemetry/tests/sse-subscription-metrics.spec.ts`.
- **Generated:** `libs/chat-api-client/openapi.json` (path order only).
- **Docs:**
  - `docs/architecture.md`, in the backend-owned persistence paragraph, names `ConversationController.streamCompletion`.
  - `docs/responses-api-integration.md` names `ConversationController` in its flow diagram and the timezone-header text, and cites `conversation.controller.ts` in its file table.

  All of these move to `ConversationGenerationController` / `conversation-generation.controller.ts`. No README names these controllers.
- **Unaffected:**
  - the frontend, libs and the generated client code;
  - env vars;
  - i18n: no new strings;
  - RTL and a11y, feature gating and telemetry.
