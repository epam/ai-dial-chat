## Why

`ResponsesAdapter.buildRequest` (`apps/chat-api/src/conversations/generation/responses.adapter.ts:58-85`) builds a Responses request containing only `model`, `input`, `stream: true`, and `store: false`. Switching a deployment's generation API from Chat Completions to Responses silently drops the conversation's `temperature` setting — even though `ChatCompletionsAdapter.buildRequest` (`chat-completions.adapter.ts:84-86`) already forwards it — and there is no way for a client to request a Responses output-token cap at all, since no persisted field exists for it. This change closes both gaps now, before the Responses branch grows further, while keeping the just-hardened terminal-state/stream behavior (`openspec/specs/responses-api-generation/spec.md`) untouched.

## Problem

- Responses generation does not forward the conversation's `temperature`, so identical conversations can sample differently depending on which generation API the deployment resolves to.
- Chat has no typed, persisted field for a Responses-specific output-token limit, so a client cannot express `max_output_tokens` at all.
- Deployment metadata (`limits.maxCompletionTokens`, legacy `defaults.max_tokens`, DIAL Core `responsesDefaults`) must not be conflated with a user-selected value for either parameter — each has a different owner and meaning.

## Solution

- Extend `ResponsesApiRequestBody` with optional `temperature` and `max_output_tokens` wire fields.
- Forward `startConversation.temperature` into the Responses request only when the resolved deployment's `features.temperature` capability is explicitly `true` — reusing the deployment `features` already fetched by `resolveGenerationApiForDeployment` (`conversation.service.ts:1198-1221`) instead of a second `DeploymentsService.getDeploymentDetails` call.
- Add an optional `maxOutputTokens?: number` field to the persisted `Conversation` model (`libs/chat-shared/src/models/chat.ts:284`) and `ConversationResponseDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts:616-662`), and map a present, validated value straight through to `max_output_tokens` — no capability gate, since no Responses-specific capability flag exists in this codebase today (confirmed by inspection; see design.md).
- Validate `maxOutputTokens` at the adapter seam where it crosses from persisted Chat data into the outbound DIAL Core request: only a positive, finite, safe integer is forwarded; anything else is treated as absent.
- Leave the hardened terminal-state, `response.failed`, EOF, error-extraction, and status-message-filtering behavior from `harden-responses-stream-handling` untouched.

## Non-Goals

- No new UI control for `maxOutputTokens` — no reusable generic max-tokens control exists in `libs/conversation-input` today (only `responseFormat`/`systemPrompt`/`temperature` are exposed via `ChatSettingsConfig`), so this iteration is backend/model-focused; UI editing is a documented follow-up.
- No changes to Chat Completions request construction, `POST /api/v1/conversations/completions` contract, or browser SSE chunk shape.
- No fallback from Responses to Chat Completions, no retries, no new endpoints/env vars/feature flags/dependencies/caches, no `ai-dial-core` changes.
- No tools, reasoning, penalties, seed, response-format, multimodal, attachment, `store: true`, or continuation-id work.

## Acceptance Criteria

- A Responses-capable deployment that explicitly supports temperature forwards the conversation's exact `temperature`, including `0`.
- A deployment with unsupported or unknown temperature capability never sends `temperature` on a Responses request.
- Capability resolution for temperature reuses the deployment details already fetched to pick the generation API — no duplicate `getDeploymentDetails` call.
- A present, valid `Conversation.maxOutputTokens` (any positive safe integer, including `1`) is sent as `max_output_tokens` unchanged; an absent value omits the field entirely (never `null`/`undefined`/`0`/a deployment-derived value).
- Invalid `maxOutputTokens` values (zero, negative, fractional, non-finite, unsafe integer) can never reach DIAL Core as `max_output_tokens`.
- `maxOutputTokens` round-trips losslessly through every conversation persistence surface it actually touches (load/save; duplicate; import/export where the full object is carried through verbatim).
- Existing conversations without `maxOutputTokens` serialize, save, duplicate, import, and export exactly as before.
- Chat Completions behavior, the completions HTTP contract, and the hardened Responses stream/terminal-state behavior are unchanged.

## Backward Compatibility and Rollback

- Both new fields are optional on `ResponsesApiRequestBody`, `Conversation`, and `ConversationResponseDto` — existing conversations that omit them are unaffected, and no migration is required.
- No request/response contract change for `POST /api/v1/conversations/completions` or the browser SSE stream; the only new optional DTO surface is the persisted conversation shape.
- Rollback is a plain revert of the adapter/type/DTO/test/doc changes; there is no persisted-data migration to unwind, since omitting the new optional field was always valid.

## Alternatives Considered

- **Derive `max_output_tokens` from `limits.maxCompletionTokens` or legacy `defaults.max_tokens`** — rejected: those describe a ceiling and a Chat-Completions-only default respectively, not a user-selected Responses value; the prompt and this proposal explicitly forbid conflating them.
- **Gate `maxOutputTokens` behind `maxTokensSupported`/`maxCompletionTokensSupported`** — rejected: those flags describe Chat Completions parameters per current Core documentation, and no Responses-specific capability flag exists to gate on instead; gating on the wrong flag would incorrectly suppress or permit the field.
- **Re-fetch deployment details inside `ResponsesAdapter` for temperature capability** — rejected: `resolveGenerationApiForDeployment` already fetches and discards `features`; a second lookup is redundant latency/cost for the same request.
- **Add a new UI max-tokens control in this change** — rejected: no reusable generic control exists yet, and building one would expand this change beyond the backend/model scope the prompt requires; deferred as a follow-up.

## Capabilities

### New Capabilities
_None._

### Modified Capabilities
- `responses-api-generation`: adds capability-gated `temperature` forwarding and optional `max_output_tokens` mapping to the Responses request, plus the validation/omission rules and persistence-round-trip requirements for `maxOutputTokens`.

## Impact

- `apps/chat-api/src/conversations/generation/generation.types.ts` — optional `temperature`/`max_output_tokens` on `ResponsesApiRequestBody`.
- `apps/chat-api/src/conversations/generation/responses.adapter.ts` — `buildRequest` accepts deployment temperature-support context and a validated `maxOutputTokens`, maps both to the wire request.
- `apps/chat-api/src/conversations/conversation.service.ts` — `resolveGenerationApiForDeployment` retains and surfaces `features` (or the specific temperature-support flag) instead of discarding it.
- `apps/chat-api/src/openapi/openapi-response.dto.ts` (`ConversationResponseDto`) — optional `maxOutputTokens` field.
- `libs/chat-shared/src/models/chat.ts` (`Conversation`) — optional `maxOutputTokens` field.
- `libs/chat-api-client` — regenerated only if the DTO change requires it; generated files are never hand-edited.
- `docs/responses-api-integration.md` — move `temperature` and `max_output_tokens` into the supported scope.
- `openspec/specs/responses-api-generation/spec.md` — delta for the modified capability.
