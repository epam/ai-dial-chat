## Why

`GET /api/v1/catalog/{entityType}/{entityId}/publish-history` proxies the same DIAL Core `getPublications` call as the conversation publish-history endpoint, which currently returns a 503 from DIAL Core ([GitHub issue #7897](https://github.com/epam/ai-dial-chat/issues/7897)). The conversation publish panel already stopped calling its equivalent endpoint (`disable-conversation-publish-history-fetch`), but `CatalogView` — which drives the publish panel for applications and toolsets — still called `getCatalogPublishHistory` on every publish-panel open, so publishing an application or toolset immediately surfaced a failed request and a history-load error.

## What Changes

- `CatalogView.getPublishHistory` no longer calls `getCatalogPublishHistory`/`mapPublishHistoryEntryDto`. It always resolves to `[]`, matching the frozen-empty-history approach already used by `PublishConversationPanelContainer`.
- `getCatalogPublishHistory` (in `apps/chat/src/server-api/publish.api.ts`) is left in place, unused, so the fetch can be restored with a minimal diff once the backend is fixed.
- No backend change. The `catalog-publish-api` capability (endpoint contract, caching, etc.) is unchanged — the backend still exposes the endpoint as specced; the frontend simply does not call it right now.

## Capabilities

### Modified Capabilities

- `catalog-publish-flow`: the publish history list and its loading/error states can never trigger from a real fetch (history is always the empty list), temporarily suspending the "Publish submission and history use real backend data" requirement's history-fetch behavior, pending the backend fix tracked in #7897.

## Impact

- `apps/chat/src/components/CatalogView/CatalogView.tsx` — history fetch removed (already implemented).
- `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` — updated to assert the new always-empty-history behavior (already implemented).
- `apps/chat/src/server-api/publish.api.ts` — `getCatalogPublishHistory` untouched, currently unused.
- No change to `apps/chat-api` or the `catalog-publish-api` spec/contract.
- Follow-up: re-enable the fetch and revert this spec exception once #7897 is resolved on the backend (same follow-up already tracked for `disable-conversation-publish-history-fetch`).
