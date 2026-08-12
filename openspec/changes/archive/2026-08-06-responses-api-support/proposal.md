## Why

DIAL Core now proxies OpenAI's Responses API (`/openai/v1/responses` and its GET/CANCEL/DELETE follow-ups) alongside Chat Completions. Deployments (models and applications) that only implement the Responses interface currently fail through `ai-dial-chat`'s Chat Completions-only generation flow, because the BFF always calls `sendChatCompletionRequest` regardless of what the deployment actually supports. The chat frontend and its SSE contract must keep working unchanged for existing Chat Completions deployments while newly-onboarded Responses-only deployments become usable, without the user ever choosing a mode manually.

## What Changes

- Add a BFF-side `resolveGenerationApi` step that reads `features.responses_api` from `DeploymentsService.getDeploymentDetails` (already cached, already resolved under the user's access token) immediately before a completion request opens its upstream stream, and picks `responses` when `responsesApi === true`, otherwise `chat_completions` (missing/`false` treated as `chat_completions` for backward compatibility with older Core versions).
- Add a `responses.adapter.ts` in `apps/chat-api/src/conversations/generation/` that calls SDK `createResponse` with a minimal first-iteration request (`input` built from existing conversation history, `stream: true`, `store: false`), parses the Responses SSE event stream, and normalizes `response.created` / `response.output_text.delta` / `response.completed` / `response.incomplete` / in-band `error` events into the existing `StreamChunk` (`chat.completion.chunk`) shape so the current frontend parser, `apply-chunk.server.ts`, and persistence logic need no changes.
- Extract the existing Chat Completions call/parse logic behind the same seam (`chat-completions.adapter.ts`) so `ConversationService.streamCompletion` calls one of the two adapters via the resolver instead of hard-coding `sendChatCompletionRequest`.
- Add `responsesApi` / `chatCompletion` fields to the deployments **list** DTO mapping (`RawDeploymentFeaturesDto`, `DeploymentFeaturesDto`, `mapToDeploymentItem`) to match what the **details** endpoint already exposes, for client metadata completeness. Generation routing itself always re-resolves via `getDeploymentDetails` under the user's token rather than trusting a list-item value the browser sent.
- Runtime failures from the Responses adapter surface as a stream/generation error using the existing error path; there is no automatic fallback to Chat Completions after a Responses call has started, since a partially-completed Responses call may already have billed tokens or invoked tools.
- Out of scope for this change (tracked as follow-ups, not blocking): `background: true` mode, persisted DIAL `response.id` for GET/CANCEL/DELETE, rich output items (tool calls, reasoning summaries, image generation, computer use), and attachment/annotation translation into `input_image`/`input_file` content parts.

## Capabilities

### New Capabilities

- `responses-api-generation`: BFF-owned dual-mode generation routing — capability resolution, request mapping from conversation history to a Responses `input`, and normalization of Responses SSE events into the existing chat `StreamChunk` contract, so `ConversationService.streamCompletion` transparently uses Responses API or Chat Completions per deployment without any frontend or wire-contract change.

### Modified Capabilities

- `deployments-api`: `GET /api/v1/deployments` list-item mapping (`DeploymentItemDto`/`DeploymentFeaturesDto`) gains `responsesApi` and `chatCompletion` feature flags, mirroring what `deployment-details-api` already exposes.

No other existing capability's requirements change: `backend-owned-generation-persistence`, `generation-registry`, `stop-generation-endpoint`, `completion-mode`, and `server-chunk-assembler` all keep their current behavior unchanged — the new `responses-api-generation` capability adds a dispatch step in front of the existing Chat Completions transport, it does not alter the persistence lifecycle, the concurrency guard, the stop endpoint, or the history-building contract those capabilities already define.

## Impact

- **Affected code**: `apps/chat-api/src/conversations/conversation.service.ts`, `apps/chat-api/src/conversations/conversation.controller.ts`, `apps/chat-api/src/conversations/conversation.module.ts` (new dependency on `DeploymentsModule`), new `apps/chat-api/src/conversations/generation/{generation-api.ts,generation.types.ts,chat-completions.adapter.ts,responses.adapter.ts}`, `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`, `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`, `apps/chat-api/src/deployments/deployments.service.ts` (`mapToDeploymentItem`).
- **Affected tests**: new unit tests for the resolver, request mapper, and event normalizer; updated `ConversationService`/`ConversationController` tests with a mocked Responses-capable deployment; existing Chat Completions supertest integration tests must stay green.
- **Dependencies**: relies on the already-installed `@epam/ai-dial-typescript-sdk@0.1.0-dev.31` `createResponse`/`getResponseItem`/`cancelResponseItem`/`deleteResponseItem` methods (only `createResponse` is used in this change) and on DIAL Core already exposing `features.responses_api` per deployment.
- **No frontend changes**: `POST /api/v1/conversations/completions` keeps its existing route, request DTO, and `StreamChunk` SSE contract; no frontend OpenAPI client regeneration is required unless `DeploymentItemDto.features` gains the new flags in the generated client types.
- **No breaking changes**: deployments that don't declare `responses_api: true` keep their exact current Chat Completions behavior.
