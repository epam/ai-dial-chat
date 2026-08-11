## Why

The Responses adapter (`apps/chat-api/src/conversations/generation/responses.adapter.ts`) only normalizes `response.output_text.delta` (`responses.adapter.ts:210`); every other native event — including the official reasoning-summary events and tool output-item/lifecycle events — falls into the unknown-event branch (`responses.adapter.ts:277`) and is discarded after incrementing `generation.responses.unknown_events`. DIAL Core does not translate these events into DIAL stages on Chat's behalf (verified against `ai-dial-core`: `ResponsesController.java:308`, `ResponsesSseListener.java:17`, `CollectResponsesApiOutputAttachmentsFn.java:14` — Core proxies native events and only rewrites the response id and collects attachments). A Responses-capable deployment configured with `reasoning.summary` or provider-hosted web search today streams a reasoning summary or a completed `web_search_call` that AI DIAL Chat silently drops, even though the equivalent Chat Completions experience already has a working stage UI (`CollapsedGroup`/`StagesPanel`, `libs/conversation-stages/`) that can display exactly this kind of activity.

## What Changes

- Recognize the official reasoning-summary streaming events (`response.reasoning_summary_part.added`, `response.reasoning_summary_text.delta`, `response.reasoning_summary_text.done`) in `responses.adapter.ts`, accumulate summary text per `item_id`/`output_index`/`summary_index` without duplication, and emit it as a new `custom_content.reasoning_summaries` field on the normalized chunk (`NormalizedStreamChunk`), distinct from `custom_content.stages`.
- Recognize `response.output_item.added` / `response.output_item.done` plus the `web_search_call` lifecycle events (`response.web_search_call.in_progress`/`.searching`/`.completed`) and translate exactly one `web_search_call` output item into one existing `Stage` entry in `custom_content.stages`, correlated by stable upstream identity (`item_id`/`output_index`) rather than arrival order, with a provider-neutral tool-kind marker so `libs/conversation-stages` never learns Responses API discriminators.
- Extend both merge implementations (`apps/chat-api/src/conversations/utils/apply-chunk.server.ts` and `apps/chat/src/utils/apply-chunk.ts`) to accumulate `reasoning_summaries` the same way on both the persistence and live-rendering paths, and to keep merging Responses-origin `stages` through the existing `mergeStages` logic unchanged.
- Add a Swagger DTO field for `reasoning_summaries` (and formally document the already-runtime `stages`/`annotations` fields that `ConversationMessageCustomContentDto` currently omits — confirmed missing from `libs/chat-api-client/openapi.json:6999-7078`), regenerate `libs/chat-api-client`, and keep the wire shape additive/optional so older clients and existing conversations are unaffected.
- Add a new host-agnostic, collapsible reasoning-summary UI element rendered near the assistant message's stages (reusing the existing markdown/collapse approach), and a small app-boundary mapper that turns the provider-neutral tool-kind marker into a localized `Stage.name`/`tag` so `Executed in N steps` keeps counting only actual tool stages.
- Update `docs/responses-api-integration.md` to move reasoning summaries and the `web_search_call` provider-hosted stage from "not yet supported" to "supported", while keeping reasoning effort, other tool types, and client-side function execution explicitly unsupported.
- **Non-breaking / additive only.** No existing Chat Completions behavior, no existing DIAL-native stage behavior, and no text-only Responses behavior changes. No `ai-dial-core` change is proposed (see Verified DIAL Core contract findings above).

## Capabilities

### New Capabilities

- `reasoning-summary-generation`: recognizing, accumulating, and normalizing the official Responses reasoning-summary streaming events into a new `reasoning_summaries` field on the normalized chunk and on persisted message custom content, in `apps/chat-api/src/conversations/generation/`.
- `reasoning-summary-display`: the host-agnostic, collapsible UI element that renders accumulated reasoning summaries near an assistant message's stages, kept semantically and visually separate from executed steps, plus the shared `MessageCustomContent.reasoning_summaries` type and its frontend merge behavior.
- `responses-tool-stage-mapping`: translating actual Responses tool-execution output items (starting with `web_search_call`) into the existing `custom_content.stages` representation, including identity correlation, dedup between generic and tool-specific events, and terminal-state handling for stages left running when the response fails/aborts/is incomplete.

### Modified Capabilities

- `server-chunk-assembler`: `applyChunkToMessage` gains `reasoning_summaries` merge behavior mirroring the frontend, alongside its existing `stages`/`annotations`/`attachments` merge logic.
- `stage-visualization`: `CollapsedGroup`/`StagesPanel` render Responses-origin stages through the same existing mechanism; a new app-boundary label-resolution step maps a stable, provider-neutral tool-kind marker to a localized display name/tag before the stage reaches `libs/conversation-stages`.

## Impact

- **Backend**: `apps/chat-api/src/conversations/generation/responses.adapter.ts`, `generation.types.ts`, `generation-metrics.ts`; `apps/chat-api/src/conversations/utils/apply-chunk.server.ts`; `apps/chat-api/src/conversations/dto/conversation-message.dto.ts` / `message-custom-content.dto.ts` (new Swagger-documented optional field); `libs/chat-api-client/openapi.json` and generated client (regenerated, not hand-edited).
- **Shared types**: `libs/chat-shared/src/models/chat.ts` (`MessageCustomContent.reasoning_summaries`, `StreamChunkDelta.custom_content.reasoning_summaries`; `Stage` gains an optional provider-neutral tool-kind marker consumed only at the app boundary).
- **Frontend**: `apps/chat/src/utils/apply-chunk.ts` (new merge branch); `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx` (new reasoning-summary section, tool-kind label resolution); new i18n keys in `apps/chat/src/i18n/locales/en.json` / `translation-keys.ts`.
- **Libs**: a new host-agnostic reasoning-summary component (exact location decided in design — either `libs/conversation-stages` or app-local, per the design's library-isolation comparison); `libs/conversation-stages` itself gains no Responses-specific knowledge.
- **Docs**: `docs/responses-api-integration.md` (supported-events table, normalized chunk examples, code map, observability, limitations).
- **No new HTTP endpoint.** No change to Chat Completions requests/responses or native DIAL-produced stages. No `ai-dial-core` change.
