## Why

Clicking an active Like a second time only clears `message.rating` locally and skips the rating API entirely (`useConversationHandlers.ts` `handleRateMessage`, `if (rating != null)` guard). DIAL Core's own `/v1/{deployment_name}/rate` endpoint never learns the like was withdrawn, so its aggregate rating for that response stays wrong indefinitely. The downstream consumer `ai-dial-chat-pg` already specs the corrected behavior ("a rating-clear request is sent to persist the clear") against the published `@epam/ai-dial-chat-hooks` package, so the fix belongs here, in the shared hook.

Establishing the fix surfaced a second, larger problem: the BFF's outbound body to DIAL Core has never matched Core's real contract. Core's own OpenAPI spec (`epam/ai-dial-core` `docs/open_api_core.yaml`, corroborated independently by the installed `@epam/ai-dial-typescript-sdk` v0.1.1 type definitions) defines `RateRequest` as `{ responseId?: string | null, rate: boolean }` — no `conversationId`, no `modelId` in the body, and a **boolean** `rate`, not a signed integer. The current `RateService` sends `{ rate: 1 | -1, modelId, conversationId, responseId }`, a shape `RateRequest` has never accepted. This was introduced in `feat: add like and dislike (#6858)` without checking Core's schema; the DTO's own comment ("DIAL Core adds this value to the message's like count") is an unverified assumption, not documented Core behavior.

Because Core only tracks a boolean per response — no ternary "like / dislike / no opinion" — the correct compensating value for cancelling a Like is the same value a fresh Dislike sends: `rate: false`. Fixing the cancel case correctly therefore requires fixing the outbound body shape for every rating, not just the toggle-off path.

## What Changes

- Fix `RateService.rateMessage` to send DIAL Core the real `RateRequest` shape: `{ responseId, rate: boolean }` only. `modelId` continues to select the URL path segment (`/v1/{modelId}/rate`); `conversationId` continues to drive the `X-CONVERSATION-ID` header (unaffected — that header is a cross-endpoint tracing convention, not part of `RateRequest`, and is not documented per-operation in Core's spec either way). Neither field is sent as a JSON body property to Core any more.
- Map the browser-facing numeric rating to Core's boolean: `MessageRating.Like` (`1`) → `rate: true`; `MessageRating.Dislike` (`-1`) → `rate: false`; a cleared rating → `rate: false` (same wire value as Dislike — Core cannot distinguish the two, which is a platform limitation, not a bug in this change).
- Widen the browser↔BFF `RateMessageDto.rate` field from `1 | -1` to `1 | -1 | null`, where `null` means "clear the previously sent rating". This is the only browser-facing contract change; the generated `RateApi.rateMessage` method signature and endpoint path/status codes are unchanged.
- **BREAKING (internal only, not browser-facing)**: the JSON body `RateService` sends to DIAL Core changes shape (drops `conversationId`/`modelId`, converts `rate` to boolean). No external caller of DIAL Core is affected; this is the BFF-to-Core leg only.
- Fix `handleRateMessage` in `libs/chat-hooks` to call `rateApi.rateMessage` with `rate: null` whenever a rating is cleared (Like or Dislike), instead of skipping the API call, then persist the conversation on success and revert optimistically on failure — matching the existing pattern already used for a fresh rating.
- Update `message-rating` spec requirements, generated OpenAPI schema/client, and tests to reflect the corrected contract.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `message-rating`: the BFF rate endpoint's outbound DIAL Core contract, the `RateMessageDto` shape, and the optimistic-toggle/negative-feedback-modal requirements that describe skipping the API call on clear.

## Impact

- **Backend**: `apps/chat-api/src/rate/dto/rate-message.dto.ts`, `rate.service.ts`, `rate.controller.ts` (Swagger docs), and their specs (`apps/chat-api/src/rate/tests/*.spec.ts`).
- **Shared hook**: `libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts` and its spec.
- **Generated client**: `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated/**` (regenerated via `npm run openapi`, not hand-edited).
- **Specs/docs**: `openspec/specs/message-rating/spec.md`.
- **Downstream**: `ai-dial-chat-pg` consumes the fix transitively once it upgrades `@epam/ai-dial-chat-hooks`; no action required in this repo for that consumer's own spec, which already expects this behavior.
