## Context

DIAL Core exposes OpenAI's Responses API as four proxy endpoints (`POST /openai/v1/responses`, `GET/POST(cancel)/DELETE /openai/v1/responses/{id}`) alongside the existing Chat Completions endpoint. Core is a stateless proxy: it selects the deployment/upstream, rewrites the upstream response id to a `dial_<deployment>_<uuid>` id, and — only when `store: true` — persists a mapping used by GET/CANCEL/DELETE. Core rejects `previous_response_id` and `conversation` outright (`400`, even for `null`), so there is no server-side conversation-state mechanism to lean on: `ai-dial-chat` must keep sending the full relevant turn history on every request, exactly as it does for Chat Completions today.

`ai-dial-chat`'s current generation path is single-mode: `ConversationService.streamCompletion` (`apps/chat-api/src/conversations/conversation.service.ts`) always calls SDK `sendChatCompletionRequest`, parses `chat.completion.chunk` SSE frames, and the frontend (`apps/chat/src/server-api/chat-stream.api.ts` + `libs/chat-shared` chunk applier) only understands that shape. Deployments now report Responses support via `features.responses_api` (already surfaced by `DeploymentsService.getDeploymentDetails` for the detail endpoint; see `deployment-details-api`), computed by DIAL Core from `deployment.supportsInterface(OPENAI_RESPONSES)` independent of model vs. application type.

This is a routing decision made once per generation request, not a system migration: most deployments stay on Chat Completions; only deployments that declare `responses_api: true` move to the new adapter.

## Goals / Non-Goals

**Goals:**
- Route each `streamCompletion` call to Chat Completions or Responses API based on the authoritative `features.responses_api` flag resolved server-side under the user's access token, with zero user-facing mode switch.
- Normalize Responses SSE text events into the existing `StreamChunk` (`chat.completion.chunk`) shape so the frontend, `apply-chunk.server.ts`, and the persistence lifecycle (`backend-owned-generation-persistence`) require no changes.
- Preserve the exact external BFF contract: same route (`POST /api/v1/conversations/completions`), same request/response DTOs, same stop endpoint, same `409` concurrent-generation guard.
- Keep Chat Completions behavior byte-for-byte unchanged for every deployment that doesn't declare `responses_api: true`.

**Non-Goals:**
- `background: true` mode, persisted `response.id` beyond `message.responseId` for diagnostics, and GET/CANCEL/DELETE follow-up operations — deferred; first iteration always sends `store: false`.
- Translating DIAL `custom_content.attachments`/annotations/stages into Responses `input_image`/`input_file` content parts or output items — deferred pending real adapter fixtures.
- Tool calls, reasoning summaries, image generation, and computer-use output items.
- A frontend-visible or user-configurable mode switch — the routing decision is entirely server-side and per-request.
- An operator emergency override flag forcing all deployments back to Chat Completions — not needed unless a rollback requirement emerges; rollback today just means fixing/removing the deployment's `responses_api` capability upstream, which takes effect within the existing 60s details cache TTL.

## Decisions

### Decision: Resolve the generation API in the BFF, immediately before the upstream call

`ConversationController.streamCompletion` passes the authenticated `sub` through to `ConversationService`, which calls the existing `DeploymentsService.getDeploymentDetails(sub, model, token)` — already user-token-scoped, deduplicated, and cached 60s — and reads `features.responsesApi` off the returned model/application details (`type` discriminates which sub-object holds `features`). A toolset resolved as the target deployment is a 400, since toolsets are not generation deployments.

**Alternatives considered:**
- *Trust a flag sent by the frontend* — rejected: the browser only ever needs to know a deployment id; letting it dictate upstream API choice would let a stale/forged client value select security-sensitive upstream behavior, and the flag can change between catalog load and send.
- *A dedicated capability-check endpoint* — rejected: `getDeploymentDetails` already provides this exact data with its own cache; a second endpoint would duplicate caching/invalidation logic for no new information.

### Decision: Adapter seam splits transport from normalization

`resolveGenerationApi(features)` returns a `GenerationApi` enum (`Responses | ChatCompletions`). `ConversationService` calls one of two adapters that share an output type (normalized `StreamChunk` async iterable / callback):
- `chat-completions.adapter.ts` — today's `sendChatCompletionRequest` call/parse, extracted verbatim.
- `responses.adapter.ts` — builds the Responses request, calls SDK `createResponse`, and normalizes the Responses event stream.

`apply-chunk.server.ts` and the persistence lifecycle become adapter-agnostic consumers of normalized chunks — no `if (api === 'responses')` branching outside the two adapter files.

**Alternatives considered:**
- *Branch inline inside the existing relay function* — rejected: `relayModelCompletion` already mixes transport, parsing, persistence, and browser writes; adding a second protocol inline would make both paths harder to test and violate the single-responsibility split the research called out.

### Decision: First-iteration Responses request is minimal and stateless

Request shape: `{ model: <deploymentId>, input: [...history as role/content items], stream: true, store: false }`. `store: false` is deliberate — Core still returns a fresh `dial_...` id but persists no mapping, avoiding an unused 30-day mapping lifetime since GET/CANCEL/DELETE aren't used yet. The returned id is saved as `message.responseId` for rating/diagnostics only. `previous_response_id`/`conversation` are never sent; `buildConversationHistory` continues to assemble the full turn history into `input`, mirroring how it assembles `messages` today.

**Alternatives considered:**
- *`store: true` from day one* — rejected: no code path uses GET/CANCEL/DELETE yet, so every stored mapping would be pure overhead and unused surface area until background mode or resume-on-refresh needs it.

### Decision: Normalize Responses SSE server-side; never proxy raw Responses events to the browser

The adapter maps: `response.created` → note `response.id` (optionally emit `delta.responseId`); `response.output_text.delta` → `StreamChunk` with `choices[0].delta.content = event.delta`; `response.completed` → validate `status`, persist final response id/metadata, emit the same terminal shape + `[DONE]` the Chat Completions path emits today; `response.incomplete` → finalize as a partial/error message, preserving already-received text (matches `backend-owned-generation-persistence`'s existing stop/error partial-save behavior); any in-band `error` payload → existing stream-error path; unrecognized event types → skipped, counted by `event.type` for metrics, never logged with content.

**Alternatives considered:**
- *Proxy raw `event: response.*` frames to the browser and teach the frontend a second SSE dialect* — rejected: the frontend's `parseSSELine`/`applyChunk` only understand `chat.completion.chunk`; teaching it a second protocol would touch far more surface (frontend parser, persistence, stop/partial handling) for no proposal-scoped benefit, and was explicitly ruled out by the research.

### Decision: No automatic fallback from Responses to Chat Completions on runtime failure

Capability resolution failures (401/403/404/5xx from `getDeploymentDetails`) surface as a BFF error before any generation call is made. Once a Responses `createResponse` call has started, a 4xx/5xx or in-stream error ends the attempt as an error — it is never retried against Chat Completions.

**Alternatives considered:**
- *Retry via Chat Completions on Responses failure* — rejected: a Responses call may have already invoked tools or billed tokens before the connection dropped; a silent retry through a different API risks duplicate side effects/billing with no way to detect that the first attempt partially succeeded.

### Decision: Expose `responsesApi`/`chatCompletion` on the deployments list DTO, but never use it for routing

`RawDeploymentFeaturesDto`/`DeploymentFeaturesDto`/`mapToDeploymentItem` gain the two boolean flags (mirroring what `deployment-details-api` already maps), purely for client metadata/observability parity between list and detail views. `ConversationService` always re-resolves capability via `getDeploymentDetails` under the user's token rather than trusting the list value, since list data can be stale relative to the 60s details cache and was never meant to gate security-sensitive upstream behavior.

## Risks / Trade-offs

- **[Risk]** `getDeploymentDetails`'s 60s cache can serve a stale `responsesApi` value right after an operator changes a deployment's interfaces → **Mitigation**: this mirrors the existing detail-endpoint staleness window and already has an `invalidateDetailsCache` escape hatch; no new staleness is introduced by this change.
- **[Risk]** Core's Responses OpenAPI is weak (untyped `ResponsesApiRequest`, `createResponse` request type is `Record<string, never>`) → **Mitigation**: adapter uses a temporary `as never` cast at the single SDK call boundary only, immediately converting the result to locally-defined `generation.types.ts` types; the cast never propagates past `responses.adapter.ts`.
- **[Risk]** Unknown/unhandled Responses event types could silently drop content or throw → **Mitigation**: explicit allowlist of handled event types; anything else is skipped and counted by type in metrics, never logged with payload content.
- **[Risk]** `response.incomplete`/in-band `error` handling diverges subtly from Chat Completions error semantics → **Mitigation**: both terminate through the same existing partial-save/stream-error code paths used today, so `backend-owned-generation-persistence` scenarios apply unchanged; covered explicitly in the test matrix.
- **[Trade-off]** No background mode or GET/CANCEL/DELETE in this iteration means Responses generations can't be resumed after a BFF/pod restart any differently than Chat Completions generations today — accepted, since `store: false` means Core holds no mapping to resume from anyway, and `generation-resume-on-refresh` behavior is unaffected because it doesn't depend on the generation API.

## Migration Plan

- No data migration: `message.responseId` is a new optional field populated only for Responses-routed generations.
- Deploy is additive/backward-compatible: deployments without `responses_api: true` are completely unaffected.
- Rollback is operational, not code-level: unless an emergency override is later required, removing/disabling `responses_api` on a deployment (or reverting this change) returns that deployment to Chat Completions on the next `getDeploymentDetails` cache refresh (≤60s) with no impact on already-persisted conversations.

## Open Questions

- Is foreground-only SSE sufficient for the first product release, or does an early consumer need `background: true`?
- Which non-text Responses output items (reasoning summaries, function/tool calls, image generation, computer use, files) need frontend rendering support, and in what order?
- How does the concrete DIAL Responses adapter encode `custom_content` configuration, stages, attachments, and annotations — needed before slice 4 (rich input/output) can be scoped precisely?
- Does `store: true` become necessary once agentic/tool flows need cross-turn reasoning/tool context, given Core's hard rejection of `previous_response_id`?
- Does any consumer need an explicit operator override to force Chat Completions for an otherwise Responses-capable deployment?
