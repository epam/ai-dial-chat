# Spec: conversation-deployment-selection

## Requirements

### Requirement: CreateConversationDto accepts deploymentId

`apps/chat-api/src/conversations/dto/create-conversation.dto.ts` SHALL include a required `deploymentId` field:

```ts
@ApiProperty({
  description:
    'ID of the catalog item (model or application) to use for this conversation. May contain percent-encoded bytes.',
  example: 'applications/catalog/Untitled%20app%201__0.0.1',
  minLength: 1,
  maxLength: 256,
  pattern: DEPLOYMENT_ID_PATTERN.source,
})
@IsString()
@MinLength(1)
@MaxLength(256)
@Matches(DEPLOYMENT_ID_PATTERN, {
  message: DEPLOYMENT_ID_VALIDATION_MESSAGE,
})
deploymentId!: string;
```

Where `DEPLOYMENT_ID_PATTERN` is defined in `apps/chat-api/src/common/validators/deployment-id.pattern.ts`:

```ts
export const DEPLOYMENT_ID_PATTERN = /^(?:[\w.\-:@/]|%[\dA-Fa-f]{2})+$/;
export const DEPLOYMENT_ID_VALIDATION_MESSAGE =
  'Must contain only supported characters or valid percent-encoded bytes';
```

No default is allowed. If `deploymentId` is absent or fails validation, `ValidationPipe` MUST respond 400.

The Swagger `@ApiResponse({ status: 400 })` annotation on the `createConversation` handler MUST list missing/invalid `deploymentId` as an example of a 400 case.

#### Scenario: Valid request with deploymentId returns 201

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello", "deploymentId": "applications/catalog/MyApp__1.0.0" }`
- **THEN** the response status is 201 and the returned conversation has `model.id === "applications/catalog/MyApp__1.0.0"`

#### Scenario: Missing deploymentId returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello" }` and no `deploymentId`
- **THEN** the response status is 400 with a validation error referencing `deploymentId`

#### Scenario: Empty string deploymentId returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello", "deploymentId": "" }`
- **THEN** the response status is 400

#### Scenario: deploymentId exceeding 256 chars returns 400

- **WHEN** `POST /api/v1/conversations` is called with `deploymentId` of length 257
- **THEN** the response status is 400

#### Scenario: deploymentId with disallowed characters returns 400

- **WHEN** `POST /api/v1/conversations` is called with `deploymentId` containing invalid characters (e.g. `"bad id!"`, `"path with spaces"`, `"percent%2"` with malformed percent encoding)
- **THEN** the response status is 400 with a validation error referencing `deploymentId`

---

### Requirement: ConversationService uses deploymentId from DTO

`ConversationService.createConversation` SHALL accept a `deploymentId: string` parameter and use it for both `model.id` and `assistantModelId` in the constructed `Conversation` object.

The signature SHALL be:

```ts
async createConversation(
  firstMessage: string,
  token: string,
  bucket: string,
  deploymentId: string,
  customContent?: MessageCustomContentDto,
): Promise<ConversationResponseDto>
```

The controller SHALL pass `dto.deploymentId` to the service call.

#### Scenario: Returned conversation has correct model.id

- **WHEN** `ConversationService.createConversation('Hello', token, bucket, 'applications/catalog/MyApp__1.0.0')` is called
- **THEN** the returned `ConversationResponseDto.model.id === 'applications/catalog/MyApp__1.0.0'` and `assistantModelId === 'applications/catalog/MyApp__1.0.0'`

---

### Requirement: Generated client and frontend wrapper updated for deploymentId

After adding `deploymentId` to `CreateConversationDto`, the following MUST run and pass:

1. `npm run openapi`
2. `npm run openapi:check`
3. `npm exec nx build chat-api-client -- --skip-nx-cache`
4. `npm exec nx lint chat-api-client`

`apps/chat/src/server-api/conversations.api.ts` SHALL export `createConversation` accepting and forwarding `deploymentId`:

```ts
export const createConversation = (
  firstMessage: string,
  deploymentId: string,
  attachments?: AttachmentDto[],
  configurationValue?: Record<string, unknown>,
  formValue?: Record<string, unknown>,
) =>
  conversationsApi.createConversation({
    createConversationDto: {
      firstMessage,
      deploymentId,
      ...(attachments?.length || configurationValue || formValue
        ? {
            custom_content: {
              ...(attachments?.length ? { attachments } : {}),
              ...(configurationValue
                ? { configuration_value: configurationValue }
                : {}),
              ...(formValue ? { form_value: formValue } : {}),
            },
          }
        : {}),
    },
  });
```

#### Scenario: Generated client accepts deploymentId in CreateConversationDto

- **WHEN** `npm run openapi` runs
- **THEN** the generated `CreateConversationDto` type in `@epam/chat-api-client` includes `deploymentId: string` as a required field

#### Scenario: Frontend wrapper forwards all custom_content fields

- **WHEN** `createConversation('Hello', 'dep-1', attachments, configValue, formValue)` is called
- **THEN** the generated client receives `custom_content` with all three optional fields (attachments, configuration_value, form_value) when present

---

### Requirement: ConversationRoute passes selectedItemId to createConversation

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` SHALL:

1. Call `useDeployments()` to get `{ items, selectedItemId, setSelectedItemId, isLoading, error }`.
2. Pass the selected deployment item and related state/handlers into the conversation input component.
3. Include `selectedItemId` (non-null guard) in the `apiCreateConversation` call as `deploymentId`:

```ts
// Regular message send (handleCreateConversation):
if (!selectedItemId) return;
const attachmentDtos = attachmentsToDtos(attachments || []);
await apiCreateConversation(message, selectedItemId, attachmentDtos);

// Schema starter with configuration (handleStarterSelect):
if (!selectedItemId) return;
const configurationValue = propertyKey ? { [propertyKey]: starter.const } : undefined;
await apiCreateConversation(text, selectedItemId, [], configurationValue);
```

The send callback SHALL NOT fire when `selectedItemId` is `null` — which can occur during initial load, when the deployments list is empty, or when explicitly cleared — enforced by the input component's disabled send button state and by explicit `if (!selectedItemId) return;` guards in `handleCreateConversation`, `handleStarterSelect`, and `NewConversationComposer.handleSend`.

#### Scenario: handleCreateConversation passes selectedItemId as deploymentId to apiCreateConversation

- **WHEN** the user sends a message and `ConversationRoute`'s `handleCreateConversation` is invoked with `useDeployments().selectedItemId === 'item-1'`
- **THEN** `apiCreateConversation` is called with `(message, 'item-1', attachmentDtos)`

#### Scenario: handleCreateConversation is a no-op when selectedItemId is null

- **WHEN** the user attempts to send and `useDeployments().selectedItemId === null` (e.g., during initial load or when deployments list is empty)
- **THEN** `handleCreateConversation` returns early, `apiCreateConversation` is NOT called, and the send button is disabled via `NewConversationComposer.handleSend`'s check of `!selectedDeploymentId`

---

### Requirement: ConversationRoute renders deployment conversation starters

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` SHALL render starter buttons and intro text for the selected deployment on the new-conversation screen.

The route SHALL derive Quick Apps starters from `selectedDeployment.conversationStarters` first, normalized through `getQuickAppConversationStarters`. Only when the deployment has no valid Quick Apps starters SHALL the route fall back to schema-based starters derived from `selectedDeploymentConfiguration`. Quick Apps starters take priority because `selectedDeploymentConfiguration`'s `starter`/`button` schema property can be an auto-generated mirror of the same Quick Apps starters, and that mirror is not guaranteed to preserve the app's configured submit-vs-populate behavior (see the "populate-only" bug scenario below) — Quick Apps' own `conversationStarters` config (title, text, `autoSubmit`, `chatMessageInputDisabled`, `introText`) is the fully-configured, authoritative source for this feature. `propertyKey` and `description` (both derived from the schema) SHALL be treated as `undefined` whenever Quick Apps starters are the active source, so a selected Quick Apps starter never picks up a stale schema `configuration_value` or schema description.

Quick Apps mapping on the frontend SHALL:
- Trim `introText`, starter `title`, and starter `text`.
- Omit invalid starters whose title or text is blank.
- Treat `autoSubmit` as `true` unless the API value is explicitly `false`.
- Map `chatMessageInputDisabled === true` to the composer's disabled input state.

The displayed intro text SHALL use Quick Apps `conversationStarters.introText` when Quick Apps starters are the active source; otherwise it SHALL use the schema description (falling back to Quick Apps `introText` if the schema has none).

Input-disabled state follows the same source precedence as starters: when Quick Apps starters are the active source, `isInputDisabled` SHALL come exclusively from Quick Apps `conversationStarters.chatMessageInputDisabled` — the schema's `isChatMessageInputDisabled` SHALL be ignored in that case, since it can be a stale/incorrect mirror of the same underlying setting. Only when Quick Apps starters are NOT the active source (a genuinely schema-only deployment) SHALL `isInputDisabled` come from `selectedDeploymentConfiguration.isChatMessageInputDisabled`.

Selecting a starter with submit enabled SHALL create a conversation through the existing first-message flow using the starter text and the selected deployment id, without adding any schema `configuration_value`. Selecting a starter with submit disabled SHALL populate the chat input with the starter text without creating a conversation.

The starter text used for both the created conversation's first message and the populated input SHALL be computed by `getStarterConversationText(starter, description)`: the schema `description` is a fallback used only when the selected starter's own `dial:widgetOptions.populateText` is explicitly `null`. When `populateText` is a non-null string, that starter's own text SHALL always be used, even when a schema `description` is also present — the shared schema description (or Quick Apps intro text) MUST NOT override an individual starter's configured prompt.

State ownership: `ConversationRoute` owns the derived starter list, intro text, input-disabled state, and transient populated input message. `DeploymentsContext` owns the selected deployment item and deployment configuration fetch.

**i18n impact:** None; this uses user-configured starter/intro text and existing composer labels.

**RTL / UI impact:** Starter layout is delegated to `StarterButtons`, which already owns RTL overflow behavior. New intro text is plain centered text and uses logical layout inherited from the page.

**Memoisation:** Derived Quick Apps starter settings SHALL be memoized from `selectedDeployment.conversationStarters`; starter selection handlers SHALL be wrapped in `useCallback`.

**Accessibility:** Starter controls SHALL remain real buttons via `StarterButtons`; intro text is static descriptive copy and does not need a live region.

#### Scenario: Quick Apps intro and starters render on new conversation screen

- **WHEN** the selected application deployment has `conversationStarters.introText` and valid `starters`, and its deployment configuration does not define schema starters
- **THEN** the new-conversation screen shows the intro text and renders the starter buttons below the input

#### Scenario: Quick Apps starters take precedence over a schema mirror

- **WHEN** `selectedDeploymentConfiguration` provides schema starters and the selected deployment also has valid Quick Apps `conversationStarters`
- **THEN** the rendered starters, intro text, and starter-selection behavior come from the Quick Apps configuration, not the schema

#### Scenario: Schema starters are used when the deployment has no Quick Apps starters

- **WHEN** `selectedDeploymentConfiguration` provides schema starters and the selected deployment has no valid Quick Apps `conversationStarters`
- **THEN** the rendered starters come from the schema configuration

#### Scenario: Populate-only Quick Apps starter is respected even when the schema forces submit

- **WHEN** the deployment's Quick Apps `conversationStarters` has `autoSubmit: false` (the App Editor's "Populate prompt in the chat input" behavior) for a starter, AND `selectedDeploymentConfiguration` mirrors that same starter with `dial:widgetOptions: { populateText: null, submit: true }` and a shared `description`
- **THEN** selecting the starter populates the chat input with the Quick Apps starter's own `text` and does NOT create a conversation
- **AND** `apiCreateConversation` is NOT called, and the schema `description` is NOT sent as the message

#### Scenario: Quick Apps chatMessageInputDisabled: false is respected even when the schema mirror is disabled

- **WHEN** the deployment's Quick Apps `conversationStarters` has `chatMessageInputDisabled: false`, AND `selectedDeploymentConfiguration.isChatMessageInputDisabled` is `true` (a stale/incorrect schema mirror), AND Quick Apps starters are the active source
- **THEN** `isInputDisabled` is `false` both before and after selecting a populate-only starter — the user can type, edit, and send a message

#### Scenario: Non-submit Quick Apps starter populates the input

- **WHEN** a user selects a Quick Apps starter whose normalized `submit` flag is false
- **THEN** the chat input is populated with the starter text and no conversation is created

#### Scenario: Submit Quick Apps starter creates a conversation without schema configuration

- **WHEN** a user selects a Quick Apps starter whose normalized `submit` flag is true
- **THEN** `apiCreateConversation` is called with the starter text, selected deployment id, and attachments only
- **AND** no schema `configuration_value` is added to the first message

#### Scenario: Each schema starter uses its own prompt even when a shared description is present

- **WHEN** the deployment configuration's `starter`/`button` property has a `description` AND the selected `StarterOption` has a non-null `dial:widgetOptions.populateText`
- **THEN** `apiCreateConversation` (or the populated input) uses that starter's own `populateText`, not the schema `description`

#### Scenario: Null populateText falls back to the schema description

- **WHEN** the selected `StarterOption` has `dial:widgetOptions.populateText === null` and the schema property defines a `description`
- **THEN** the created conversation's first message (or populated input) uses the schema `description` text

---

### Requirement: Backend and frontend tests for deploymentId

`apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` SHALL cover:

1. 201 with a valid `deploymentId` — returned conversation has `model.id === deploymentId`.
2. 400 when `deploymentId` is missing.
3. 400 when `deploymentId` is an empty string.
4. 400 when `deploymentId` exceeds 256 characters.
5. 400 when `deploymentId` contains disallowed characters (e.g. `"bad id!"`, malformed percent encoding).

`apps/chat-api/src/conversations/tests/conversation.service.spec.ts` SHALL cover:

1. `createConversation` returns a `ConversationResponseDto` with `model.id` equal to the passed `deploymentId`.
2. `assistantModelId` equals `deploymentId`.

A unit test in `apps/chat/src/server-api/` SHALL verify that `createConversation(firstMessage, deploymentId, attachments, configValue, formValue)` passes `deploymentId` as a field of the generated-client request body `createConversationDto`.

#### Scenario: Integration test — 201 with deploymentId

- **WHEN** `POST /api/v1/conversations` receives `{ firstMessage: 'Hi', deploymentId: 'applications/catalog/MyApp__1.0.0' }`
- **THEN** the response status is 201 and `body.model.id === 'applications/catalog/MyApp__1.0.0'`

#### Scenario: Integration test — 400 without deploymentId

- **WHEN** `POST /api/v1/conversations` receives `{ firstMessage: 'Hi' }` with no `deploymentId`
- **THEN** the response status is 400

#### Scenario: Integration test — 400 with invalid deploymentId characters

- **WHEN** `POST /api/v1/conversations` receives `{ firstMessage: 'Hi', deploymentId: 'bad id!' }`
- **THEN** the response status is 400

#### Scenario: Wrapper passes deploymentId to the generated client

- **WHEN** `createConversation('Hello', 'dep-1', attachments, configValue, formValue)` is called
- **THEN** the generated `conversationsApi.createConversation` is invoked with `{ createConversationDto: { firstMessage: 'Hello', deploymentId: 'dep-1', custom_content: { attachments, configuration_value: configValue, form_value: formValue } } }`
