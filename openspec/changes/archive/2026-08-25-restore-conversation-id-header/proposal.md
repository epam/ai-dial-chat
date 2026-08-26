## Why

Legacy Chat forwarded a stable conversation reference to DIAL Core in `X-CONVERSATION-ID` for generation and rating requests. The backend-owned generation flow on `development` dropped that outbound header, breaking conversation-level correlation in DIAL Core and any downstream observability or application logic that depends on it.

## What Changes

- Forward the persisted `conversation.id` as `X-CONVERSATION-ID` on both Chat Completions and Responses API generation requests from the BFF to DIAL Core.
- Forward `RateMessageDto.conversationId` as the same header on rating requests.
- Keep the browser-facing completion and rating endpoints, request DTOs, generated client, authentication, rate limits, and response shapes unchanged.
- Document and test the restored outbound-header contract.
- **BREAKING**: none. This restores legacy-compatible upstream behavior; rollback is removal of the outbound header additions and their tests/spec clauses.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `responses-api-generation`: both generation transports forward the stable persisted conversation id to DIAL Core in `X-CONVERSATION-ID`.
- `message-rating`: the BFF rating proxy forwards the request's `conversationId` to DIAL Core in `X-CONVERSATION-ID`.

## Impact

- Generation transport: `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts`, and `apps/chat-api/src/conversations/generation/responses.adapter.ts`.
- Rating transport: `apps/chat-api/src/rate/rate.service.ts`.
- Tests: the existing conversation-streaming and rating service specs assert the outbound header.
- Documentation: `docs/responses-api-integration.md` records the BFF-to-Core header behavior.
- No OpenAPI regeneration, frontend change, library change, i18n, RTL, accessibility, cache, feature-flag, or rate-limit impact.
- Alternative considered: have the browser send a new header or DTO field. Rejected because the BFF already owns and loads the authoritative persisted conversation and should not trust or duplicate client-supplied transport metadata.
