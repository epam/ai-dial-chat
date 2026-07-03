## Why

The LLM conversation naming feature currently detects when the server has generated a display title by polling `GET /conversations/:path` every 2 seconds for up to 50 seconds. This poll fires on **every navigation** to any conversation that lacks `llmNamingDone: true` — including old conversations pre-dating the feature, conversations where naming is disabled, and any re-send in an existing chat — generating up to 25 unnecessary HTTP requests per visit with no benefit.

DIAL Core exposes a push-based `POST /v1/ops/resource/subscribe` SSE endpoint that fires an `UPDATE` event the moment a resource changes. Switching to subscriptions eliminates the wasted polling and gives instant title updates.

## What Changes

- **New BFF endpoint** `POST /api/v1/conversations/watch` proxies a DIAL Core resource subscription SSE stream to the browser for a single conversation path (same pattern as the existing `streamCompletion` endpoint).
- **New frontend API wrapper** calls the watch endpoint and reads the SSE stream.
- **`watchForDisplayNameUpdate`** in `ConversationsContext` is rewritten to open a subscription instead of polling; it closes as soon as an `UPDATE` event is confirmed to carry `llmNamingDone: true` or a changed name, or when the component unmounts.
- **Polling code removed**: `DISPLAY_NAME_POLL_INTERVAL_MS`, `DISPLAY_NAME_POLL_MAX_ATTEMPTS`, and the recursive `poll()` function are deleted.

## Capabilities

### New Capabilities

- `conversation-watch-sse`: BFF endpoint that subscribes to DIAL Core resource-update events for a conversation and proxies the SSE stream to the browser; frontend API wrapper and updated `watchForDisplayNameUpdate` hook logic.

### Modified Capabilities

- `llm-conversation-naming`: The **client-side detection mechanism** changes from polling to SSE subscription. Backend naming logic (fire-and-forget, `llmNamingDone`, idempotency) is unchanged.

## Impact

- **`apps/chat-api`**: New controller action + service method in the conversations domain; new DTO; new route registered in Swagger; `@epam/ai-dial-typescript-sdk` `subscribeToResources` used server-side.
- **`apps/chat`**: `ConversationsContext.tsx` polling replaced by SSE fetch; new `conversations.api.ts` wrapper; `display-name-watch.ts` utility unchanged.
- **Generated API client** (`@epam/chat-api-client`): new `watchConversation` operation added after `openapi` regeneration.
- **No breaking changes** to existing public API contracts; existing `llmNamingDone` persistence logic on the backend is untouched.
