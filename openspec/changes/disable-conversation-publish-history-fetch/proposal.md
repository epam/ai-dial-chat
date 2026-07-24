## Why

`GET /api/v1/conversations/publish-history` currently returns a 503 from DIAL Core whenever a user opens the conversation publish panel after publishing to an Organization folder ([GitHub issue #7897](https://github.com/epam/ai-dial-chat/issues/7897)). The frontend still calls this endpoint on every panel open, so every user who publishes a conversation immediately sees a failed request and a history-load error state. Until the backend endpoint is fixed, the frontend should stop calling it rather than surface a guaranteed failure.

## What Changes

- `PublishConversationPanelContainer` no longer fetches publish history on mount/open. `history` stays a permanently empty array, `isHistoryLoading` stays `false`, and `hasHistoryError` can only be set by the reset-on-close effect (never by a failed fetch, since no fetch happens).
- Publish eligibility is unaffected. Each submit creates a new admin-approval request, so publication history is informational and SHALL NOT disable repeat submission to the same folder. This clarifies the expected behavior reported in [GitHub issue #7896](https://github.com/epam/ai-dial-chat/issues/7896).
- `getConversationPublishHistory` (in `apps/chat/src/server-api/conversation-publish.api.ts`) is left in place, unused, so the fetch can be restored with a minimal diff once the backend is fixed.
- No backend change. The `conversation-publish-api` capability (endpoint contract, caching, etc.) is unchanged — the backend still exposes the endpoint as specced; the frontend simply does not call it right now.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `conversation-publish-flow`: publish history is temporarily unavailable in the panel pending the backend fix tracked in #7897. The requirement also clarifies that history is informational: repeat publish requests to the same folder remain allowed and SHALL NOT show a duplicate/replace warning or disable submit.

## Impact

- `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx` — history fetch removed (already implemented).
- `apps/chat/src/components/PublishConversationPanelContainer/tests/PublishConversationPanelContainer.spec.tsx` — updated to assert the new always-empty-history behavior (already implemented).
- `apps/chat/src/server-api/conversation-publish.api.ts` — `getConversationPublishHistory` untouched, currently unused.
- No change to `apps/chat-api` or the `conversation-publish-api` spec/contract.
- Follow-up (tracked in tasks.md): re-enable the fetch and retire only the temporary history-visibility exception once #7897 is resolved on the backend; repeat-request eligibility remains unchanged.
