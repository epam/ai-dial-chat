# Spec: llm-conversation-naming (delta)

## REMOVED Requirements

### Requirement: Client polls GET conversation until llmNamingDone changes

**Reason**: Replaced by the push-based `conversation-watch-sse` capability. Polling wastes up to 25 HTTP requests per navigation for conversations that lack `llmNamingDone: true` (old conversations, disabled naming).

**Migration**: `watchForDisplayNameUpdate` now opens a single SSE connection via `POST /api/v1/conversations/watch` instead of scheduling recursive `window.setTimeout` calls. The public contract of `watchForDisplayNameUpdate` (`(conversationId, previousName, onUpdated) => () => void`) is unchanged — callers require no updates.
