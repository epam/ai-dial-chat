## Context

`POST /api/v1/rate` (`apps/chat-api/src/rate/`) proxies a like/dislike rating to DIAL Core's `POST /v1/{deployment_name}/rate`. Today the flow is:

- **Frontend** (`libs/chat-hooks/src/conversation/useConversationHandlers/useConversationHandlers.ts`, `handleRateMessage`): on a fresh Like/Dislike (`rating != null`) calls `rateApi.rateMessage({ conversationId, responseId, modelId, rate: rating, comment? })` then persists the conversation. On toggle-off (`rating == null`) it **skips the API call** and only persists the conversation with `rating: undefined`.
- **BFF** (`apps/chat-api/src/rate/rate.service.ts`): builds `{ rate: dto.rate, modelId: dto.modelId, conversationId: dto.conversationId, responseId: dto.responseId }` and POSTs it as JSON to `${baseUrl}/v1/{modelId}/rate`.
- **DTO** (`rate-message.dto.ts`): `rate` is `@IsIn([1, -1])`, comment says "DIAL Core adds this value to the message like count" — an unverified assumption from the original PR (`feat: add like and dislike (#6858)`, no design doc, no cited Core schema).

**Confirmed DIAL Core contract** — two independent sources, verified during exploration for this change, agree exactly:

1. `epam/ai-dial-core` `docs/open_api_core.yaml` (`development` branch), operation `rateDeployment`, path `/v1/{deployment_name}/rate`:
   ```yaml
   RateRequest:
     required: [rate]
     properties:
       responseId: { type: string, nullable: true }
       rate: { type: boolean, default: false }
   ```
2. The installed `@epam/ai-dial-typescript-sdk@0.1.1` (`node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts`), generated from the same upstream spec, declares the identical `RateRequest` shape and the same `operations['rateDeployment']` request body.

So today's BFF→Core body has never matched what Core accepts: `modelId`/`conversationId` aren't in `RateRequest` at all (the model is already the path segment; `conversationId` only ever belonged in the `X-CONVERSATION-ID` header), and `rate` is boolean, not `1 | -1`. Core has no ternary state — it cannot represent "actively disliked" as distinct from "no rating" internally; both are `rate: false`. That is Core's own limitation, not something this change can or should paper over.

## Goals / Non-Goals

**Goals:**

- Send DIAL Core a `RateRequest`-conforming body for every rating call (Like, Dislike, and clear) — not just the clear case, since the clear fix cannot be correct while the body shape it reuses is wrong.
- Make clearing a Like (the required scenario) send a compensating request to Core, so Core's aggregate no longer silently diverges from `message.rating`.
- Keep the fix symmetric: clearing an active Dislike also sends a request (matching the consumer spec in `ai-dial-chat-pg`'s `message-actions/spec.md`, which already requires this "even when clearing an active Dislike"), rather than adding a special-cased branch only for Like.
- Keep the browser-facing contract (`POST /api/v1/rate`, `RateMessageDto`, generated `RateApi.rateMessage`) as close to unchanged as the fix allows: only widen `rate` to admit `null` for "clear". No new endpoint, no new required field, no change to auth/rate-limit/cache/error-mapping behavior.

**Non-Goals:**

- Does not change how `Message.rating` is represented or persisted in conversation storage (`MessageRating.Like = 1` / `Dislike = -1` / `undefined`) — that stays a local/BFF-only concept; only the wire body sent to Core changes.
- Does not attempt to give Core a third state for "actively disliked" vs "cleared" — Core's schema has no such state, and inventing one is out of scope (would require a Core-side change this repo cannot make).
- Does not touch the negative-feedback-modal collection flow, category list, or comment-encoding — only the "already active → toggle off" branch that currently returns early without calling anything.
- Does not change the `X-CONVERSATION-ID` / `X-JOB-TITLE` header forwarding — those are cross-endpoint conventions, not `RateRequest` body fields, and are unaffected by this fix.

## Decisions

### 1. Represent "clear" as `rate: null` on the browser-facing DTO, not a new enum member or endpoint

`useConversationHandlers.handleRateMessage` already types its `rating` parameter as `MessageRating | null` — `null` already means "clear" in the in-memory/local-state sense. Extending `RateMessageDto.rate` from `MessageRating` (`1 | -1`) to `MessageRating | null` reuses that exact meaning on the wire, so no new sentinel value (e.g. `0`) needs to be invented and no separate `clear: boolean` field needs to be added alongside `rate`.

- `RateMessageDto.rate` type: `MessageRating | null`. Validation: `@IsIn([1, -1, null])`, kept `@ApiProperty({ nullable: true, ... })` documenting the new meaning.
- Alternative considered — new field `clear?: boolean` alongside a still-non-null `rate`: rejected. It would require the client to keep sending a stale `rate` value alongside `clear: true`, is redundant with the `MessageRating | null` type the hook already carries, and doubles the states a reader has to reconcile (`rate` vs `clear` vs their combination) for no benefit.
- Alternative considered — a distinct HTTP verb/endpoint (e.g. `DELETE /api/v1/rate`): rejected as unnecessary API surface growth; the existing endpoint already carries `responseId`/`modelId`/`conversationId`, all of which a clear request still needs (for the URL path and the `X-CONVERSATION-ID` header), so a second endpoint would duplicate all of that.

### 2. `RateService` builds the Core body from scratch instead of forwarding `dto` fields

Today `RateService` builds the outbound body directly from `dto` fields whose names happen to collide with what looked plausible for Core. Instead, `RateService.rateMessage` explicitly constructs `{ responseId: dto.responseId, rate: dto.rate === MessageRating.Like }` and POSTs only that — `dto.modelId` continues to select the URL path segment, `dto.conversationId` continues to drive the `X-CONVERSATION-ID` header, and neither is copied into the JSON body sent to Core.

- `dto.rate === MessageRating.Like` (`=== 1`) is `true`; `MessageRating.Dislike` (`-1`) and `null` (clear) both resolve to `false` — the only two states Core's boolean can hold.
- `comment` (BFF-only, used for the negative-feedback text) is not part of `RateRequest` either and is already never forwarded to Core in the current code (it's not in Core's schema) — no change needed there beyond confirming it stays BFF-local (used only for whatever downstream feedback-storage this repo has, unaffected by this change).

### 3. Always call the rate API when a rating is cleared — no branch on "was it a Like or a Dislike"

`handleRateMessage`'s `if (rating != null) { ...call API... } else { ...just persist... }` branch collapses to a single path: call `rateApi.rateMessage({ ..., rate: rating })` for every change including `rating === null`, then persist on success, revert on failure — identical control flow to the existing non-null path, just with `rate` now allowed to be `null`.

- Alternative considered — only call the API when the previous rating was `MessageRating.Like` (since clearing a Dislike is a no-op from Core's perspective: it was already `false`): rejected. It adds a branch that has to inspect `previousRating` to decide whether to skip, contradicts the `ai-dial-chat-pg` consumer spec's explicit requirement to send a rating-clear request "even when clearing an active Dislike," and the redundant call when clearing a Dislike is harmless (idempotent `rate: false`).

### 4. Regenerate the OpenAPI artifacts; never hand-edit them

`RateMessageDto.rate` becoming nullable changes the generated Swagger schema and therefore `libs/chat-api-client/openapi.json` and everything under `libs/chat-api-client/src/generated/**` (the `RateMessageDto` model's `rate` type, and the doc-comment on `RateApi.rateMessage`). Run `npm run openapi` after the DTO change, then `npm run openapi:check` and build/lint `chat-api-client`, per `apps/chat-api/AGENTS.md`. No manual edits to `src/generated/**`.

## Risks / Trade-offs

- **Core cannot distinguish "actively disliked" from "cleared"** → not mitigated, and not mitigable from this side: it's Core's own boolean model. Documented in the spec delta so a future reader doesn't mistake it for a bug in this change. If DIAL Core itself later adds a ternary rating, this mapping (`Like → true`, everything else → `false`) is the seam to revisit.
- **The BFF→Core body shape change is silently breaking if Core was in fact tolerating the old shape via lenient/ignore-unknown-fields JSON parsing** → mitigated by keeping the change scoped to what Core's own spec documents (`responseId`, `rate: boolean`); the old fields (`modelId`, `conversationId`, numeric `rate`) were either ignored by Core already (extra properties) or actively rejected (wrong `rate` type) — either way, sending the documented shape can only make the call more correct, never less.
- **Downstream `ai-dial-chat-pg` depends on `@epam/ai-dial-chat-hooks` at a pinned dev version** → no action required in this repo; the consumer's own spec already anticipates this exact fix, and picks it up on its next version bump. Not a compatibility break: `rate: null` was previously rejected by validation (`@IsIn([1, -1])`), so no existing caller could have been relying on omitting the API call.

## Migration Plan

No data migration. This is a behavior/contract fix with no schema stored in conversation history (`Message.rating` keeps its existing `1 | -1 | undefined` shape). Rollout is a normal deploy: BFF and frontend land together in the same release since the frontend now always calls the endpoint on clear, and the endpoint must already forward the corrected body when that call arrives. No feature flag — the prior behavior (silently not telling Core about a cleared rating) has no user-facing value worth gating behind a flag.

## Open Questions

- None outstanding on the contract itself — `RateRequest`'s shape is confirmed from two independent authoritative sources (Core's own OpenAPI spec and the installed TypeScript SDK's generated types), so this change does not extend Core's API surface, only starts conforming to it.
