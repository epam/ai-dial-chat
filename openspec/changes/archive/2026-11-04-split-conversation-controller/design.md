## Context

`apps/chat-api/src/conversations/conversation.controller.ts` (777 lines) declares 18 handlers on one `conversations` v1 controller. It injects `ConversationService` and `ConversationCompletionsResponder`. Only the three `completions*` handlers use the responder. The handlers group as follows:

| Group | Handlers | Lines today |
| --- | --- | --- |
| CRUD and listing | `createConversation`, `listConversations`, `getConversationMetadata`, `getConversation`, `saveConversation`, `renameConversation`, `duplicateConversation`, `deleteConversations`, `deleteAllConversations`, `deleteConversation`, `markConversationViewed` | ~330 |
| Generation | `streamCompletion`, `stopCompletion`, `attachToGeneration` | ~110 |
| Titles | `getConversationTitles`, `streamConversationTitles`, `generateConversationTitle` | ~155 |
| Watch | `watchConversation`, an inline SSE pump | ~110 |

Guards and interceptors are global (`APP_GUARD` in `apps/chat-api/src/auth/auth.module.ts`, `APP_INTERCEPTOR` in `apps/chat-api/src/app/app.module.ts`), and the controller declares no `@UseGuards`/`@UseInterceptors`. No route takes a path parameter, because every by-resource route takes `path` as a query parameter. So the order in which Express registers routes from several controllers cannot change which handler matches.

The precedent is `ConversationPublishController` (`apps/chat-api/src/conversations/conversation-publish.controller.ts`), a sibling on the same path and tag that was split out for file size. The controller rules are in `apps/chat-api/AGENTS.md` (thin controllers, Swagger on every status, URI versioning) and do not change.

## Goals / Non-Goals

**Goals:**

- Each route group lives in its own controller file with its own single dependency.
- `conversation.controller.ts` drops below 450 lines, and each new file stays below 250.
- The HTTP contract, `operationId`s, generated client, telemetry and log messages stay byte-for-byte the same, apart from the OpenAPI path order and the logger context of the watch error log (now `ConversationWatchController`).

**Non-Goals:**

- Moving the watch pump or the title-abort wiring into services.
- Touching `ProjectConversationsController` (`apps/chat-api/src/projects/`).
- Sorting OpenAPI paths, or any other generator change.

## Decisions

### D1 — Four controllers by route group

`ConversationGenerationController`, `ConversationTitlesController` and `ConversationWatchController` are created beside `conversation.controller.ts`. Each one keeps the shared `@ApiTags('conversations')` and `@Controller({ path: 'conversations', version: '1' })`. Handlers move with all their decorators, JSDoc and bodies unchanged. Imports follow each handler: the SSE helpers and `trackSseSubscription` go to the watch controller, and the title-stream constants, examples and `ApiExtraModels` go to the titles controller. Each class gets a JSDoc summary modelled on the one `ConversationPublishController` has, with a pointer to this change's design.

`generateConversationTitle` goes with the titles group rather than with generation. It calls `ConversationService.generateTitle` and has nothing in common with the completion SSE contract, so placing it with titles keeps the generation controller on its single responder dependency.

The watch pump keeps its private state handling inline. It is about 100 lines, the controller stays under 250, and moving it into a service would change a code path rather than relocate it.

Alternatives: see proposal "Alternatives considered". A two-controller split leaves the CRUD file around 650 lines. A service extraction changes behavior-carrying code.

### D2 — Registration order and OpenAPI

`conversation.module.ts` lists `controllers: [ConversationController, ConversationGenerationController, ConversationTitlesController, ConversationWatchController, ConversationPublishController]`. Swagger emits `paths` in that order, so `titles`, `titles/stream`, `completions*`, `watch` and `generate-title` move after `viewed` in `openapi.json`. The document is otherwise identical.

The typescript-fetch generator writes `ConversationsApi.ts` methods in alphabetical order, so the client does not change. The check in task 3 compares the key-sorted JSON before and after and diffs `libs/chat-api-client/src/generated`. A non-empty generated-client diff, or any non-order JSON difference, blocks the change.

### D3 — Test wiring

- `tests/conversation-controller.fixture.ts` exports `createConversationGenerationController(conversationService, generationService)`, which builds the responder exactly as the current `createConversationController` does. It also exports `createConversationWatchController(conversationService)`. `createConversationController` is removed because no spec calls a CRUD handler through it.
- Specs that build a Nest `TestingModule` list the controllers that own the routes they call:
  - `completions*` and `attach*` specs list `ConversationGenerationController`;
  - the title-stream spec lists `ConversationTitlesController`;
  - `conversation.controller.integration.spec.ts` calls CRUD, `completions`, `titles` and `generate-title` routes, so it lists `ConversationController`, `ConversationGenerationController` and `ConversationTitlesController`;
  - `completion-persistence.integration.spec.ts` also calls `GET /`, so it lists `ConversationController` and `ConversationGenerationController`;
  - `telemetry/tests/sse-subscription-metrics.spec.ts` lists the generation and watch controllers and calls `attachToGeneration` / `watchConversation` on them.
- Providers in those modules stay as they are. Providing an unused `ConversationCompletionsResponder` to a module is harmless.
- Test cases and assertions do not change.

### D4 — References

The following are rewritten to name the new owner:

- code comments that name `ConversationController.streamCompletion`: in `streaming/conversation-completions.responder.ts`, `streaming/conversation-streaming.service.ts`, `streaming/tests/conversation-streaming.service.spec.ts` and the `conversation.service.ts` header;
- the docs in `docs/architecture.md` and `docs/responses-api-integration.md`;
- the comment in `conversation-publish.controller.ts`, which still says "a sibling of `ConversationController`" and stays correct.

Main specs that name `ConversationController.streamCompletion` (`backend-owned-generation-persistence`, `responses-api-generation`) are covered by the new capability's ownership table, which defines how those names map to the new classes. Only `generation-live-replay`, which cites the old file path for a moved handler, gets a delta.

## Risks / Trade-offs

- **[Route shadowing across controllers]** → No route has a path parameter, and every route keeps its literal path. `conversation.controller.integration.spec.ts` runs CRUD, generation and title routes against three controllers in one module.
- **[A provider missing in a test module after the move]** → Nest fails such a module at compile time with a clear DI error. The test slices run each affected spec.
- **[A noisy `openapi.json` diff hides a real contract change]** → The key-sorted comparison in task 3 must be empty before the regenerated file is committed.
- **[Spec references to `ConversationController.<handler>` read as stale]** → The ownership table in `conversation-controller-decomposition` maps them. Rewriting every sentence in other capabilities would turn a mechanical move into a wide spec edit.
