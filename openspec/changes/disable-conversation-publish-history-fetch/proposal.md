## Why

`GET /api/v1/conversations/publish-history` currently returns a 503 from DIAL Core whenever a user opens the conversation publish panel after publishing to an Organization folder ([GitHub issue #7897](https://github.com/epam/ai-dial-chat/issues/7897)). The frontend still calls this endpoint on every panel open, so every user who publishes a conversation immediately sees a failed request and a history-load error state. Until the backend endpoint is fixed, the frontend should stop calling it rather than surface a guaranteed failure.

## What Changes

- `PublishConversationPanelContainer` no longer fetches publish history on mount/open. `history` stays a permanently empty array, `isHistoryLoading` stays `false`, and `hasHistoryError` can only be set by the reset-on-close effect (never by a failed fetch, since no fetch happens).
- As a direct consequence, `hasExistingPublicationInFolder` (derived from `history` by `usePublishFlow`) is always `false`, so the "already published to this folder" warning and the disabled-submit behavior described in `conversation-publish-flow` cannot currently trigger — this is a **BREAKING** (temporary) behavior change relative to the current spec, tracked explicitly below rather than silently left undocumented.
- `getConversationPublishHistory` (in `apps/chat/src/server-api/conversation-publish.api.ts`) is left in place, unused, so the fetch can be restored with a minimal diff once the backend is fixed.
- No backend change. The `conversation-publish-api` capability (endpoint contract, caching, etc.) is unchanged — the backend still exposes the endpoint as specced; the frontend simply does not call it right now.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `conversation-publish-flow`: the history-driven "already published in this folder" callout and submit-disable behavior is temporarily suspended on the frontend (no history fetch, so the condition can never be true), pending the backend fix tracked in #7897. The requirement is amended to describe this as a temporary, explicitly-scoped exception rather than removing it outright — the underlying UX rule (disable submit / show a warning when this folder already has a publication of this conversation) is restored as soon as the fetch is re-enabled.

## Impact

- `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx` — history fetch removed (already implemented).
- `apps/chat/src/components/PublishConversationPanelContainer/tests/PublishConversationPanelContainer.spec.tsx` — updated to assert the new always-empty-history behavior (already implemented).
- `apps/chat/src/server-api/conversation-publish.api.ts` — `getConversationPublishHistory` untouched, currently unused.
- No change to `apps/chat-api` or the `conversation-publish-api` spec/contract.
- Follow-up (tracked in tasks.md): re-enable the fetch and revert this spec exception once #7897 is resolved on the backend.
