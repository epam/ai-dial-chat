## Context

Legacy Chat generated a stable per-conversation `reference` and forwarded it as `X-CONVERSATION-ID` to DIAL Core from both completion and rating proxies. The current BFF owns generation and persistence, but its outbound Chat Completions, Responses API, and rating calls omit that header. Current conversations already carry a persisted `id`; newly created and duplicated conversations receive a trailing UUID, while rename updates the display name without moving the stored resource. The BFF therefore has an authoritative stable identifier without extending the browser-facing contract.

This change crosses the conversation-generation and rating domains in `apps/chat-api`; implementation follows `apps/chat-api/AGENTS.md`. It changes only the BFF-to-DIAL-Core transport contract.

## Goals / Non-Goals

**Goals:**

- Restore conversation-level correlation on every outbound generation request, regardless of whether the selected transport is Chat Completions or Responses API.
- Restore the same correlation on outbound rating requests.
- Use one authoritative persisted identifier and lock the behavior with transport-level unit tests.
- Keep public BFF endpoints backward compatible.

**Non-Goals:**

- Adding a new request header or DTO field to the browser-facing API.
- Restoring the legacy `conversation.reference` field as a separate data-model property.
- Changing generation selection, SSE normalization, persistence, authentication, rate limiting, caching, or error mapping.
- Changing frontend state, UI, i18n, accessibility, RTL behavior, feature flags, or any library under `libs/*`.

## Decisions

### Decision 1: Derive the header at the BFF boundary from the authoritative conversation id

`ConversationStreamingService` SHALL pass the loaded `startConversation.id` into the selected generation transport, which SHALL set `X-CONVERSATION-ID` immediately before calling DIAL Core. `RateService` SHALL use the already-required `RateMessageDto.conversationId` for the same header.

Alternative: add a browser-supplied header or a second DTO field mirroring legacy `reference`. Rejected because the BFF already loads the authoritative persisted conversation for generation, and the rating DTO already carries its conversation id. Duplicating transport metadata would expand OpenAPI and allow the client to send a value inconsistent with the resource being processed.

Alternative: extract only the trailing UUID from the current storage path. Rejected because legacy/imported conversations can have unsuffixed paths; the full persisted id works for both formats and remains stable under the current rename behavior.

### Decision 2: Apply the contract to both generation implementations

The live Chat Completions relay in `ConversationStreamingService`, the extracted `ChatCompletionsAdapter` seam, and `ResponsesAdapter` SHALL all support the header. This avoids transport-dependent observability and prevents the dormant/extracted adapter contract from diverging when orchestration is consolidated later.

Alternative: patch only the currently selected Chat Completions call site. Rejected because Responses-capable deployments would still lose correlation and the documented adapter seam would remain inconsistent.

### Decision 3: Preserve public API and generated-client contracts

`POST /api/v1/conversations/completions` and `POST /api/v1/rate` retain their existing bodies, status codes, auth requirements, throttles, and response shapes. The new header exists only on outbound BFF-to-Core requests, so Swagger and `libs/chat-api-client` require no regeneration.

## Risks / Trade-offs

- **[Risk] A transport path omits the header during a later refactor** → Keep assertions for both Chat Completions and Responses calls in `conversation-streaming.service.spec.ts`, plus the rating assertion in `rate.service.spec.ts`.
- **[Risk] A persisted id differs from a UI route representation because of encoding** → Source the generation value from the conversation loaded by the BFF, not the route string sent by the browser; rating continues to use its canonical DTO field as it already does in the DIAL Core body.
- **[Trade-off] The full persisted id is more descriptive than legacy's random `reference`** → Accepted because it is already sent as `conversationId` in the rating body and no new logging is added by Chat. Tokens and request bodies remain excluded from logs.

## Migration Plan

Deploy the BFF changes without a frontend or DIAL Core migration. Existing and newly created conversations begin sending the header on their next generation or rating request. Rollback removes the three generation header insertions and the rating header insertion; no stored data or public API needs migration.

## Open Questions

_None._
