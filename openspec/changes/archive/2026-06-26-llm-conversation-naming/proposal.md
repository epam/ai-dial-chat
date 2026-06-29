## Why

Conversation titles are currently deduplicated at create time by appending numeric suffixes (`"Hello 1"`, `"Hello 2"`), which produces cluttered sidebar labels when users start multiple chats with similar opening messages. Operators also want an optional utility-model path that generates meaningful titles after the first assistant reply, without exposing that model to the frontend.

## What Changes

- **BREAKING (create naming)**: `POST /api/v1/conversations` no longer appends numeric suffixes to `conversation.name` when a duplicate title exists; the display name is always the base name derived from `firstMessage`.
- **BREAKING (create path)**: When the 2-part storage path `{deploymentId}__{baseName}` is already taken, the backend stores the conversation at `{deploymentId}__{baseName}__{uuid}` while `conversation.name` remains the unsuffixed base name (see design for rationale).
- Remove `fetchAllUserTitles` and `resolveUniqueConversationName` from the create flow; keep `resolveUniqueConversationName` for duplicate conversation only.
- Add `UTILITY_MODEL` env var, `DIAL_API_KEY` deployment secret, and `utility.modelId` config registry entry (server-only visibility).
- Add the first utility feature flag: `features.llmConversationNaming` (server-only, default `false`), enabled only when `UTILITY_MODEL` is set, `DIAL_API_KEY` is set, **and** `LLM_CONVERSATION_NAMING_ENABLED=true`.
- When the flag is on, after the first assistant reply is saved, fire-and-forget LLM rename via `UTILITY_MODEL` + existing `renameConversation` / `moveResource` flow.
- No new REST endpoints; no frontend or i18n changes.

## Capabilities

### New Capabilities

- `llm-conversation-naming`: Utility model configuration, `features.llmConversationNaming` flag, system prompt contract, post-save LLM rename trigger, idempotency marker, timeout/rate-limit expectations.

### Modified Capabilities

- `auto-index-duplicate-names`: Remove numeric suffix on create; replace with collision-only UUID path segment; narrow `resolveUniqueConversationName` / `fetchAllUserTitles` scope to duplicate flow.
- `conversations-api`: Document create naming behavior and optional backend-only post-rename after the first assistant reply.

## Impact

- **Backend**: `apps/chat-api/src/conversations/` (`conversation.service.ts`, new `ConversationNamingService`, prompt constant), `apps/chat-api/src/app-config/` (config registry, `FeatureKey`, `EnvConfigProvider`), `apps/chat-api/src/config/environment.config.ts`, tests.
- **Config / docs**: `apps/chat-api/.env.template`, `apps/chat-api/README.md`.
- **Specs**: delta updates to `auto-index-duplicate-names`, `conversations-api`; new `llm-conversation-naming` spec.
- **Not affected**: OpenAPI surface (no new endpoints), frontend, `libs/*`, i18n.
