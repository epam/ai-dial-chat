# Spec: conversation-deployment-selection

## Requirements

### Requirement: CreateConversationDto accepts catalogItemId

`apps/chat-api/src/conversations/dto/create-conversation.dto.ts` SHALL include a required `catalogItemId` field:

```ts
@ApiProperty({
  description: 'The id of the selected catalog item (CatalogItemDto.id) to use as the conversation model/application',
  example: 'anthropic.claude-v3-sonnet',
  minLength: 1,
  maxLength: 256,
})
@IsString()
@MinLength(1)
@MaxLength(256)
@Matches(/^[\w.\-:@/]+$/, {
  message: 'catalogItemId may only contain alphanumeric characters, dots, hyphens, colons, at-signs, and forward slashes',
})
catalogItemId!: string;
```

No default is allowed. If `catalogItemId` is absent or fails validation, `ValidationPipe` MUST respond 400.

The Swagger `@ApiResponse({ status: 400 })` annotation on the `createConversation` handler MUST list missing/invalid `catalogItemId` as an example of a 400 case.

#### Scenario: Valid request with catalogItemId returns 201

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello", "catalogItemId": "anthropic.claude-v3-sonnet" }`
- **THEN** the response status is 201 and the returned conversation has `model.id === "anthropic.claude-v3-sonnet"`

#### Scenario: Missing catalogItemId returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello" }` and no `catalogItemId`
- **THEN** the response status is 400 with a validation error referencing `catalogItemId`

#### Scenario: Empty string catalogItemId returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello", "catalogItemId": "" }`
- **THEN** the response status is 400

#### Scenario: catalogItemId exceeding 256 chars returns 400

- **WHEN** `POST /api/v1/conversations` is called with `catalogItemId` of length 257
- **THEN** the response status is 400

#### Scenario: catalogItemId with disallowed characters returns 400

- **WHEN** `POST /api/v1/conversations` is called with `catalogItemId` containing characters outside `[\w.\-:@/]` (e.g. `"bad id!"`)
- **THEN** the response status is 400 with a validation error referencing `catalogItemId`

---

### Requirement: ConversationService uses catalogItemId from DTO

`ConversationService.createConversation` SHALL accept a `catalogItemId: string` parameter and use it for both `model.id` and `assistantModelId` in the constructed `Conversation` object. The hardcoded `'anthropic.claude-v3-sonnet'` strings SHALL be removed.

The signature SHALL be:

```ts
async createConversation(
  firstMessage: string,
  token: string,
  bucket: string,
  catalogItemId: string,
  attachments?: MessageAttachment[],
): Promise<Conversation>
```

The controller SHALL pass `dto.catalogItemId` to the service call.

#### Scenario: Returned conversation has correct model.id

- **WHEN** `ConversationService.createConversation('Hello', token, bucket, 'my-catalog-item')` is called
- **THEN** the returned `Conversation.model.id === 'my-catalog-item'` and `Conversation.assistantModelId === 'my-catalog-item'`

#### Scenario: Hardcoded model string is absent from service

- **WHEN** the source file `apps/chat-api/src/conversations/conversation.service.ts` is read
- **THEN** the string `'anthropic.claude-v3-sonnet'` does not appear anywhere in the file

---

### Requirement: Generated client and frontend wrapper updated for catalogItemId

After adding `catalogItemId` to `CreateConversationDto`, the following MUST run and pass:

1. `npm run openapi`
2. `npm run openapi:check`
3. `npm exec nx build chat-api-client -- --skip-nx-cache`
4. `npm exec nx lint chat-api-client`

`apps/chat/src/server-api/conversations.api.ts` SHALL export `createConversation` accepting and forwarding `catalogItemId`:

```ts
export const createConversation = (
  firstMessage: string,
  catalogItemId: string,
  attachments?: AttachmentDto[],
) =>
  conversationsApi.createConversation({
    createConversationDto: {
      firstMessage,
      catalogItemId,
      ...(attachments?.length ? { attachments } : {}),
    },
  });
```

#### Scenario: Generated client accepts catalogItemId in CreateConversationDto

- **WHEN** `npm run openapi` runs after the DTO change
- **THEN** the generated `CreateConversationDto` type in `@epam/chat-api-client` includes `catalogItemId: string` as a required field

#### Scenario: Frontend wrapper compiles with updated signature

- **WHEN** `npm exec nx build chat -- --skip-nx-cache` runs
- **THEN** the build succeeds without TypeScript errors referencing `catalogItemId`

---

### Requirement: ConversationRoute passes selectedCatalogItemId to createConversation

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` SHALL:

1. Call `useDeployments()` to get `{ items, selectedItemId, setSelectedItemId, isLoading, error }`.
2. Pass `catalogItems`, `selectedCatalogItemId`, `onSelectedCatalogItemChange`, and the four translated label props into `<ConversationInput>`.
3. Include `selectedItemId` (non-null guard) in the `apiCreateConversation` call as `catalogItemId`:

```ts
if (!selectedItemId) return;
await apiCreateConversation(message, selectedItemId, attachmentDtos);
```

The send callback SHALL NOT fire when `selectedItemId` is `null` — enforced by the `Input` component's disabled state and by the explicit guard in `handleSend`. `ModelsContext` MUST NOT be used.

#### Scenario: handleSend passes selectedItemId as catalogItemId to apiCreateConversation

- **WHEN** `handleSend('Hello', [])` is called with `useDeployments().selectedItemId === 'item-1'`
- **THEN** `apiCreateConversation` is called with `('Hello', 'item-1', [])`

#### Scenario: handleSend is a no-op when selectedItemId is null

- **WHEN** `handleSend('Hello', [])` is called with `useDeployments().selectedItemId === null`
- **THEN** `apiCreateConversation` is NOT called

---

### Requirement: Backend and frontend tests for catalogItemId

`apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` SHALL cover:

1. 201 with a valid `catalogItemId` — returned conversation has `model.id === catalogItemId`.
2. 400 when `catalogItemId` is missing.
3. 400 when `catalogItemId` is an empty string.
4. 400 when `catalogItemId` exceeds 256 characters.
5. 400 when `catalogItemId` contains disallowed characters (e.g. `"bad id!"`).

`apps/chat-api/src/conversations/tests/conversation.service.spec.ts` SHALL cover:

1. `createConversation` returns a `Conversation` with `model.id` equal to the passed `catalogItemId`.
2. `assistantModelId` equals `catalogItemId`.
3. The hardcoded string `'anthropic.claude-v3-sonnet'` is not referenced.

A unit test in `apps/chat/src/server-api/` SHALL verify that `createConversation(firstMessage, catalogItemId, attachments)` passes `catalogItemId` as a field of the generated-client request body `createConversationDto`.

#### Scenario: Integration test — 201 with catalogItemId

- **WHEN** `POST /api/v1/conversations` receives `{ firstMessage: 'Hi', catalogItemId: 'gpt-4' }`
- **THEN** the response status is 201 and `body.model.id === 'gpt-4'`

#### Scenario: Integration test — 400 without catalogItemId

- **WHEN** `POST /api/v1/conversations` receives `{ firstMessage: 'Hi' }` with no `catalogItemId`
- **THEN** the response status is 400

#### Scenario: Integration test — 400 with invalid catalogItemId characters

- **WHEN** `POST /api/v1/conversations` receives `{ firstMessage: 'Hi', catalogItemId: 'bad id!' }`
- **THEN** the response status is 400

#### Scenario: Wrapper passes catalogItemId to the generated client

- **WHEN** `createConversation('Hello', 'dep-1')` is called
- **THEN** the generated `conversationsApi.createConversation` is invoked with `{ createConversationDto: { firstMessage: 'Hello', catalogItemId: 'dep-1' } }`
