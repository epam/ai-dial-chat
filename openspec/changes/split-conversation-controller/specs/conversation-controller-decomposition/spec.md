## ADDED Requirements

### Requirement: Conversations routes are owned by four sibling controllers

`apps/chat-api/src/conversations/` SHALL serve the `/api/v1/conversations` routes from four controllers. All four SHALL be declared with `@ApiTags('conversations')` and `@Controller({ path: 'conversations', version: '1' })` and registered in `ConversationModule` (`apps/chat-api/src/conversations/conversation.module.ts`) next to `ConversationPublishController`. Each controller SHALL inject only the dependency listed for it:

| Controller | File | Routes | Injects |
| --- | --- | --- | --- |
| `ConversationController` | `apps/chat-api/src/conversations/conversation.controller.ts` | `POST /`, `GET /list`, `GET /metadata`, `GET /`, `PUT /`, `PATCH /`, `POST /duplicate`, `POST /deletions`, `POST /deletions/all`, `DELETE /`, `PATCH /viewed` | `ConversationService` |
| `ConversationGenerationController` | `apps/chat-api/src/conversations/conversation-generation.controller.ts` | `POST /completions`, `POST /completions/stop`, `POST /completions/attach` | `ConversationCompletionsResponder` |
| `ConversationTitlesController` | `apps/chat-api/src/conversations/conversation-titles.controller.ts` | `POST /titles`, `POST /titles/stream`, `POST /generate-title` | `ConversationService` |
| `ConversationWatchController` | `apps/chat-api/src/conversations/conversation-watch.controller.ts` | `POST /watch` | `ConversationService` |

Each handler SHALL keep its method name, decorators, Swagger text and body. A spec elsewhere that names `ConversationController.<handler>` for a handler in the generation, titles or watch rows refers to that handler on the controller this table assigns it to.

The split introduces no endpoint, no cache, no i18n string, no UI (so no RTL or accessibility impact), no feature gate and no new telemetry. The `conversation_watch` and `generation_attach` kinds of `dial_chat_sse_active` keep being emitted from the same handlers.

#### Scenario: Each controller owns only its routes

- **WHEN** the four controller files are inspected
- **THEN** each declares exactly the routes in its table row, and no route is declared twice

#### Scenario: Each controller injects one dependency

- **WHEN** the constructors of the four controllers are inspected
- **THEN** `ConversationController`, `ConversationTitlesController` and `ConversationWatchController` take only `ConversationService`, and `ConversationGenerationController` takes only `ConversationCompletionsResponder`

### Requirement: The controller split does not change the API contract

Splitting the controller SHALL NOT change any route path, HTTP method, status code, request or response DTO, header, SSE framing, `operationId`, guard, interceptor or log message text. The only logging difference is the Nest logger context of the watch handler's error log, which names `ConversationWatchController`. Regenerating the OpenAPI document with `npm run openapi` SHALL produce a `libs/chat-api-client/openapi.json` that is deep-equal to the pre-split document once object keys are sorted. Only the order of the `paths` keys may change, because Swagger lists paths in controller registration order. The generated client under `libs/chat-api-client/src/generated` SHALL have no diff, because it orders operations by name.

#### Scenario: OpenAPI document is unchanged apart from path order

- **WHEN** `npm run openapi` runs after the split
- **THEN** the key-sorted `openapi.json` equals the key-sorted document from before the split, the generated client files have no diff, and `npm run openapi:check` passes

#### Scenario: Existing route tests pass unchanged

- **WHEN** the conversations, streaming and telemetry specs run against the split controllers, each registering the controller that owns the routes it calls
- **THEN** every spec passes with the same number of `it` cases and unchanged assertions
