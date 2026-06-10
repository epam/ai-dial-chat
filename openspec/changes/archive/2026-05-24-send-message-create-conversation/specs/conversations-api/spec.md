# Spec: conversations-api

## ADDED Requirements

### Requirement: POST /api/v1/conversations creates and persists a new conversation

The backend SHALL expose `POST /api/v1/conversations` in `apps/chat-api/src/conversations/conversation.controller.ts`. The controller MUST be versioned (`version: '1'`), annotated with `@ApiTags('conversations')`, and delegate all logic to `ConversationService`. The endpoint accepts a JSON body validated by `CreateConversationDto`. On success it returns HTTP 201 with the created `Conversation`. The service generates a UUID via `crypto.randomUUID()`, constructs a `Conversation` object `{ id, messages: [userMessage], createdAt }`, and stores it in an in-memory `Map<string, Conversation>`. Persistence is in-memory for this slice; a database layer is a follow-up.

Request body (`CreateConversationDto`):

```
{ "firstMessage": "<string, @IsString, @MinLength(1), @MaxLength(4000)>" }
```

Response body (201 Created) — shape matches the `Conversation` type from `@epam/ai-dial-chat-shared`:

```
{
  "id": "<uuid>",
  "messages": [{ "id": "<uuid>", "role": "user", "content": "...", "timestamp": "<ISO-8601>" }],
  "createdAt": "<ISO-8601>"
}
```

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })` on the handler — stricter than the global 100 req/min default.

Error codes:

- `400 Bad Request` — body fails DTO validation (empty `firstMessage`, exceeds 4000 chars)
- `500 Internal Server Error` — unexpected failure in `ConversationService`

#### Scenario: Valid request returns 201 with conversation

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello" }`
- **THEN** the response status is 201 and the body contains a `Conversation` with `id` (UUID format), `messages` array with one user message whose `content` is `"Hello"`, and `createdAt` as an ISO-8601 string

#### Scenario: Empty firstMessage returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "" }`
- **THEN** the response status is 400 with a validation error message

#### Scenario: Missing firstMessage returns 400

- **WHEN** `POST /api/v1/conversations` is called with an empty body `{}`
- **THEN** the response status is 400

#### Scenario: firstMessage exceeding 4000 chars returns 400

- **WHEN** `POST /api/v1/conversations` is called with `firstMessage` of length 4001
- **THEN** the response status is 400

---

### Requirement: Shared Conversation and Message types live in libs/chat-shared

The `Conversation` and `Message` interfaces SHALL be declared in `libs/chat-shared/src/models/chat.ts` and re-exported from `libs/chat-shared/src/index.ts`. Both `apps/chat` (via `@epam/ai-dial-chat-shared`) and `apps/chat-api` (same import) MUST import these types from the shared lib. No duplicate type definitions are permitted in app-level files.

`Message` shape:

```ts
interface Message {
  id: string; // UUID
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO-8601
}
```

`Conversation` shape:

```ts
interface Conversation {
  id: string; // UUID
  messages: Message[];
  createdAt: string; // ISO-8601
}
```

#### Scenario: Shared types are importable in both apps

- **WHEN** `apps/chat` imports `Conversation` from `@epam/ai-dial-chat-shared`
- **THEN** TypeScript resolves the type without error

#### Scenario: Shared types are importable in chat-api

- **WHEN** `apps/chat-api` imports `Conversation` from `@epam/ai-dial-chat-shared`
- **THEN** TypeScript resolves the type without error

---

### Requirement: ConversationsModule is registered in the root AppModule

`ConversationsModule` SHALL be listed in the `imports` array of `apps/chat-api/src/app/app.module.ts`. It MUST declare `ConversationController` in its `controllers` array and `ConversationService` in its `providers` array.

#### Scenario: Module is wired into the app

- **WHEN** the NestJS application bootstraps
- **THEN** `POST /api/v1/conversations` is reachable and returns a response (not 404)

---

### Requirement: ConversationService has unit tests and ConversationController has integration tests

Unit tests SHALL cover `ConversationService.createConversation` in `apps/chat-api/src/conversations/tests/conversation.service.spec.ts`. Integration tests SHALL cover the `POST /api/v1/conversations` endpoint using supertest in `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`. Tests MUST follow the pattern established by `chat/tests/chat.controller.integration.spec.ts` and use HTTP status codes and response body assertions rather than implementation-specific selectors.

#### Scenario: Service creates a conversation with a valid UUID

- **WHEN** `ConversationService.createConversation('Hello')` is called
- **THEN** the returned `Conversation` has an `id` matching UUID format and a `messages` array with one entry where `content === 'Hello'`

#### Scenario: Integration test covers 201 and 400 paths

- **WHEN** the integration test suite for `ConversationController` runs
- **THEN** it covers: 201 with valid body, 400 with empty `firstMessage`, 400 with missing body
