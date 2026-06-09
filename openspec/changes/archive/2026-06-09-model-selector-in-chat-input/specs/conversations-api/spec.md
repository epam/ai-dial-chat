## MODIFIED Requirements

---

### Requirement: POST /api/v1/conversations creates and persists a new conversation

The backend SHALL expose `POST /api/v1/conversations` in `apps/chat-api/src/conversations/conversation.controller.ts`. The controller MUST be versioned (`version: '1'`), annotated with `@ApiTags('conversations')`, and delegate all logic to `ConversationService`. The endpoint accepts a JSON body validated by `CreateConversationDto`. On success it returns HTTP 201 with the created `Conversation`. The service generates a UUID via `crypto.randomUUID()`, constructs a `Conversation` object using the provided `catalogItemId` for `model.id` and `assistantModelId`, and stores it in DIAL Core via `AppService.client.saveConversation`. Persistence is via DIAL Core; the in-memory `Map` is not used for production conversations.

Request body (`CreateConversationDto`):

```
{
  "firstMessage": "<string, @IsString, @MinLength(1), @MaxLength(4000)>",
  "catalogItemId": "<string, @IsString, @MinLength(1), @MaxLength(256), @Matches(/^[\w.\-:@/]+$/)>",
  "attachments"?: "<AttachmentDto[], optional>"
}
```

Response body (201 Created) — shape matches the `Conversation` type from `@epam/ai-dial-chat-shared`:

```
{
  "id": "<folder/path>",
  "model": { "id": "<catalogItemId>" },
  "messages": [...],
  "createdAt": "<ISO-8601>"
}
```

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })` on the handler — stricter than the global 100 req/min default.

Error codes:

- `400 Bad Request` — body fails DTO validation (empty `firstMessage`, exceeds 4000 chars, missing `catalogItemId`, empty `catalogItemId`, `catalogItemId` exceeds 256 chars, `catalogItemId` contains disallowed characters)
- `500 Internal Server Error` — unexpected failure in `ConversationService`
- `502 Bad Gateway` / `503 Service Unavailable` — DIAL Core returned an upstream error

#### Scenario: Valid request returns 201 with conversation

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello", "catalogItemId": "anthropic.claude-v3-sonnet" }`
- **THEN** the response status is 201 and the body contains a `Conversation` with `model.id === "anthropic.claude-v3-sonnet"`, `messages` array with one user message whose `content` is `"Hello"`, and an `id` string

#### Scenario: Empty firstMessage returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "", "catalogItemId": "dep-1" }`
- **THEN** the response status is 400 with a validation error message

#### Scenario: Missing firstMessage returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "catalogItemId": "dep-1" }`
- **THEN** the response status is 400

#### Scenario: firstMessage exceeding 4000 chars returns 400

- **WHEN** `POST /api/v1/conversations` is called with `firstMessage` of length 4001 and a valid `catalogItemId`
- **THEN** the response status is 400

#### Scenario: Missing catalogItemId returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello" }` and no `catalogItemId`
- **THEN** the response status is 400 with a validation error referencing `catalogItemId`

#### Scenario: Empty catalogItemId returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello", "catalogItemId": "" }`
- **THEN** the response status is 400

#### Scenario: catalogItemId exceeding 256 chars returns 400

- **WHEN** `POST /api/v1/conversations` is called with `catalogItemId` of length 257
- **THEN** the response status is 400

#### Scenario: catalogItemId with disallowed characters returns 400

- **WHEN** `POST /api/v1/conversations` is called with `catalogItemId` containing characters outside `[\w.\-:@/]` (e.g. `"bad id!"`)
- **THEN** the response status is 400 with a validation error referencing `catalogItemId`
