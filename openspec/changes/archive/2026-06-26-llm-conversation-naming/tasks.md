## 1. Env, registry, and feature flag

- [x] 1.1 Add `UTILITY_MODEL`, `LLM_CONVERSATION_NAMING_ENABLED`, and `UTILITY_NAMING_TIMEOUT_MS` (default `10000`) to `EnvironmentVariables` in `environment.config.ts`
- [x] 1.2 Register `utility.modelId` (`visibility: server`, env `UTILITY_MODEL`) in `config-registry.constants.ts`
- [x] 1.3 Add `FeatureKey.LlmConversationNaming` and `features.llmConversationNaming` definition (`visibility: server`, default `false`)
- [x] 1.4 Implement derived resolution in `EnvConfigProvider` (requires `UTILITY_MODEL` + `LLM_CONVERSATION_NAMING_ENABLED=true`, mirror `features.asrEnabled` pattern)
- [x] 1.5 Add unit tests in `env-config.provider.spec.ts` and `feature-flags.service.spec.ts` for the new key and flag
- [x] 1.6 Update `apps/chat-api/.env.template` and `apps/chat-api/README.md`
- [x] 1.7 Verify: `npm exec nx test chat-api -- --testPathPattern=env-config|feature-flags` and `npm exec nx lint chat-api`

## 2. Remove numeric dedup on create

- [x] 2.1 Refactor `createConversation`: use unsuffixed `baseName` for `conversation.name`; remove `fetchAllUserTitles` / `resolveUniqueConversationName` calls
- [x] 2.2 Add targeted path-collision check; use `{deploymentId}__{baseName}__{uuid}` when 2-part path exists; keep 2-part path when free
- [x] 2.3 Confirm `duplicateConversation` still uses `fetchAllUserTitles` + `resolveUniqueConversationName`
- [x] 2.4 Update `conversation.service.spec.ts` and `conversation-naming.spec.ts` for unsuffixed create and collision path cases
- [x] 2.5 Verify: `npm exec nx test chat-api -- --testPathPattern=conversation` and `npm exec nx lint chat-api`

## 3. ConversationNamingService and system prompt

- [x] 3.1 Add `apps/chat-api/src/conversations/prompts/conversation-naming.prompt.ts` with `CONVERSATION_NAMING_SYSTEM_PROMPT`
- [x] 3.2 Create `ConversationNamingService` with non-streaming `sendChatCompletionRequest`, timeout via `AbortController`, and `prepareEntityName` on response
- [x] 3.3 Register provider in `ConversationsModule`; inject `AppConfigService` for flag check and `ConfigService` for model id / timeout
- [x] 3.4 Add `conversation-naming.service.spec.ts` covering success, timeout, empty LLM response, and DIAL error paths
- [x] 3.5 Verify: `npm exec nx test chat-api -- --testPathPattern=conversation-naming` and `npm exec nx lint chat-api`

## 4. saveConversation hook and idempotency

- [x] 4.1 Add optional `llmNamingDone?: boolean` to `ConversationResponseDto` in `openapi-response.dto.ts`; regenerate OpenAPI client (`npm run openapi`) so frontend types include the field
- [x] 4.2 After successful save in `ConversationService.saveConversation`, `void` call naming service when trigger conditions match (flag on, 2 messages, non-empty content, `llmNamingDone` not true)
- [x] 4.3 On successful in-place save set `llmNamingDone: true`; on save failure log warning and leave the message-derived name; never throw to save caller
- [x] 4.4 Add in-flight dedup `Set` in naming service to skip concurrent attempts for same conversation id
- [x] 4.5 Extend `conversation.service.spec.ts` for hook invocation, flag-off skip, third-message skip, and fire-and-forget behavior
- [x] 4.6 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`

## 5. Spec sync and docs

- [x] 5.1 Archive-ready: confirm delta specs match implementation (`llm-conversation-naming`, `auto-index-duplicate-names`, `conversations-api`)
- [x] 5.2 Run full `npm exec nx test chat-api` and `npm exec nx lint chat-api` as final slice check
