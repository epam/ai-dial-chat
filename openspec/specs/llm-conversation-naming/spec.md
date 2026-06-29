# Spec: llm-conversation-naming

## Purpose

Backend-only utility that generates a short conversation display title from the first user and assistant messages after the initial exchange, using a configured utility model. Naming is opt-in, fire-and-forget, and updates `conversation.name` in place without changing the storage path.

## Requirements

### Requirement: Utility model deployment ID is registered as server-only config

The backend SHALL register a config definition:

| Field | Value |
|---|---|
| `key` | `utility.modelId` |
| `type` | `config` |
| `valueType` | `string` |
| `visibility` | `server` |
| `defaultValue` | `null` |
| `envVar` | `UTILITY_MODEL` |

`UTILITY_MODEL` SHALL be declared as an optional string on `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`. The value MUST NOT appear in the client config endpoint response.

`apps/chat-api/.env.template` and `apps/chat-api/README.md` SHALL document `UTILITY_MODEL`.

#### Scenario: utility.modelId resolves when env is set

- **GIVEN** `UTILITY_MODEL=gpt-4o-mini` is configured at boot
- **WHEN** `AppConfigService` resolves `utility.modelId` for any context
- **THEN** the resolved value is `"gpt-4o-mini"`

#### Scenario: utility.modelId is absent when env is unset

- **GIVEN** `UTILITY_MODEL` is not set
- **WHEN** `AppConfigService` resolves `utility.modelId`
- **THEN** the resolved value is `null` or `undefined`

---

### Requirement: LLM conversation naming feature flag is server-only and opt-in

The backend SHALL register a feature definition:

| Field | Value |
|---|---|
| `key` | `features.llmConversationNaming` |
| `type` | `feature` |
| `valueType` | `boolean` |
| `visibility` | `server` |
| `defaultValue` | `false` |

`FeatureKey` SHALL include `LlmConversationNaming = 'features.llmConversationNaming'`.

The flag SHALL resolve to `true` only when **all** of the following hold:

1. `UTILITY_MODEL` is set (non-empty),
2. `DIAL_API_KEY` is set (non-empty), and
3. `LLM_CONVERSATION_NAMING_ENABLED=true` in the environment.

`DIAL_API_KEY` SHALL be an optional string on `EnvironmentVariables`. It is a server-only deployment secret used as the `Api-Key` header when calling the utility model in DIAL Core for conversation naming. It MUST NOT be exposed to the frontend client config bundle.

`LLM_CONVERSATION_NAMING_ENABLED` SHALL be an optional boolean on `EnvironmentVariables`, defaulting to `false` when unset.

This SHALL establish the pattern for future utility features: `utility.*` config keys (`visibility: server`) plus `features.*` flags derived from `UTILITY_MODEL` presence and an explicit `*_ENABLED=true` env var.

The flag MUST NOT be exposed to the frontend client config bundle.

#### Scenario: Flag is false when utility model is unset

- **GIVEN** `UTILITY_MODEL` is not set and `LLM_CONVERSATION_NAMING_ENABLED=true`
- **WHEN** `AppConfigService.isEnabled(FeatureKey.LlmConversationNaming, ctx)` is called
- **THEN** the result is `false`

#### Scenario: Flag is false when explicit enable is off

- **GIVEN** `UTILITY_MODEL=gpt-4o-mini` and `LLM_CONVERSATION_NAMING_ENABLED` is unset or `false`
- **WHEN** `AppConfigService.isEnabled(FeatureKey.LlmConversationNaming, ctx)` is called
- **THEN** the result is `false`

#### Scenario: Flag is true when all prerequisites are met

- **GIVEN** `UTILITY_MODEL=gpt-4o-mini`, `DIAL_API_KEY=secret-key`, and `LLM_CONVERSATION_NAMING_ENABLED=true`
- **WHEN** `AppConfigService.isEnabled(FeatureKey.LlmConversationNaming, ctx)` is called
- **THEN** the result is `true`

#### Scenario: Flag is false when DIAL API key is unset

- **GIVEN** `UTILITY_MODEL=gpt-4o-mini`, `DIAL_API_KEY` is not set, and `LLM_CONVERSATION_NAMING_ENABLED=true`
- **WHEN** `AppConfigService.isEnabled(FeatureKey.LlmConversationNaming, ctx)` is called
- **THEN** the result is `false`

---

### Requirement: Conversation naming system prompt is a backend constant

The system prompt for LLM conversation naming SHALL live in `apps/chat-api/src/conversations/prompts/conversation-naming.prompt.ts` as exported constant `CONVERSATION_NAMING_SYSTEM_PROMPT`.

The prompt SHALL instruct the model to return only a short title (no quotes, labels, or markdown), use the same language as the user's message, and avoid generic titles.

#### Scenario: Prompt is imported by naming service

- **WHEN** `ConversationNamingService` builds a chat completion request
- **THEN** the system message content equals `CONVERSATION_NAMING_SYSTEM_PROMPT`

---

### Requirement: LLM naming uses first user and assistant plain-text messages

`ConversationNamingService` SHALL call `sendChatCompletionRequest` on `UTILITY_MODEL` with:

- `stream: false`
- `Api-Key` request header from `DIAL_API_KEY` (not the user's session bearer token)
- One system message (`CONVERSATION_NAMING_SYSTEM_PROMPT`)
- One user message containing the first user message `content` and first assistant message `content`, separated by `\n\n---\n\n`, using plain text only (no attachments or custom_content in the LLM request)

The model response `choices[0].message.content` SHALL be passed through `prepareEntityName` before rename.

#### Scenario: Non-streaming completion is sent to utility model

- **WHEN** LLM naming is triggered for a conversation
- **THEN** `sendChatCompletionRequest` is called with `stream: false`, deployment id from `UTILITY_MODEL`, and `Api-Key` header from `DIAL_API_KEY`

---

### Requirement: LLM rename runs fire-and-forget with timeout and graceful degradation

`ConversationNamingService` SHALL:

- Run asynchronously without blocking the `saveConversation` HTTP response (`void` fire-and-forget from `ConversationService.saveConversation`).
- Enforce a configurable timeout (`UTILITY_NAMING_TIMEOUT_MS`, default `10000`) via `AbortController`.
- On any error (timeout, DIAL error, empty LLM response, or save failure): log at `warn` or `error` and leave `conversation.name` unchanged; MUST NOT throw to the save caller.
- Track in-flight renames per conversation id to skip duplicate concurrent attempts.

#### Scenario: Save succeeds when LLM call fails

- **GIVEN** `features.llmConversationNaming` is enabled
- **WHEN** `saveConversation` completes successfully but the async LLM call throws
- **THEN** the save response is still 200/201 with the message-derived name unchanged

#### Scenario: Timeout keeps original name

- **GIVEN** the utility model does not respond within `UTILITY_NAMING_TIMEOUT_MS`
- **WHEN** the naming service aborts the request
- **THEN** the conversation name is not updated and `llmNamingDone` remains unset/false

---

### Requirement: LLM rename is idempotent via llmNamingDone marker

The conversation JSON persisted in DIAL Core SHALL support optional boolean field `llmNamingDone`.

- On create: field absent or implicitly false.
- After successful LLM display-name update: set `llmNamingDone: true` on the saved conversation body.

LLM naming MUST NOT run when `llmNamingDone === true`.

#### Scenario: Second save does not re-trigger naming

- **GIVEN** a conversation with `llmNamingDone: true` and 2 messages
- **WHEN** `saveConversation` is called again
- **THEN** no LLM naming request is made

---

### Requirement: LLM naming triggers only after the first complete exchange

When `features.llmConversationNaming` is enabled, `ConversationService.saveConversation` SHALL invoke the naming service only when **all** of the following hold:

1. `llmNamingDone` is not `true`
2. Exactly 2 non-status messages: one `user`, one `assistant`
3. Both messages have non-empty trimmed `content`
4. The assistant message is the last message in the array

LLM naming MUST NOT run on: create (`POST /conversations`), duplicate, regenerate, message edit, or saves with 3+ messages.

#### Scenario: First reply triggers async naming

- **GIVEN** `features.llmConversationNaming` is enabled and a conversation has 1 user message saved
- **WHEN** `saveConversation` persists the first assistant reply (2 messages total)
- **THEN** the naming service is invoked asynchronously

#### Scenario: Third message does not trigger naming

- **GIVEN** a conversation with 2 messages and `llmNamingDone` not set
- **WHEN** `saveConversation` is called with 3 messages (user, assistant, user)
- **THEN** the naming service is NOT invoked

#### Scenario: Flag off never invokes naming

- **GIVEN** `features.llmConversationNaming` resolves to `false`
- **WHEN** `saveConversation` persists the first assistant reply
- **THEN** the naming service is NOT invoked

---

### Requirement: Successful LLM naming updates display name in place

After a successful LLM response, the naming service SHALL reload the conversation, then call `saveConversation` at the **same storage path** with `{ name: sanitisedTitle, llmNamingDone: true }`. It MUST NOT call `renameConversation` or `moveResource`; the storage path and `conversation.id` remain unchanged.

#### Scenario: LLM title updates conversation display name without path change

- **GIVEN** LLM returns `"Docker networking basics"`
- **WHEN** the in-place save succeeds
- **THEN** `conversation.name` becomes `"Docker networking basics"`, the storage path is unchanged, and `llmNamingDone` is `true`
