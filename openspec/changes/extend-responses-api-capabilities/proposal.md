# Extend Responses API feature coverage

**Status: draft — not scoped for implementation yet.** This proposal captures the feature list, what has
been spiked/confirmed against a live DIAL Core instance, and the open questions blocking a real
implementation plan. See `docs/responses-api-integration.md` for the current, shipped behavior this proposal
extends.

Two code changes from this work are **live on `development`, shipped and verified** (not part of this
proposal's remaining scope):

- Typed the pre-existing Chat Completions DTO gap for `stages`/`annotations`/`form_schema`.
- A debug log for generation-API routing decisions (`Generation API resolved for "<model>" — api: ...`).

Everything else below is **spike-only**: findings gathered by testing against real deployments. Most
scaffolding was reverted once it answered its question — tools/function calling, and `top_p`/
`response_format` (confirmed Core accepts them, then reverted because neither has a capability gate and
each would silently alter every real Responses request on `development`). A few pieces of passthrough/
mapping code remain live in `responses.adapter.ts`/`generation.types.ts` because they're gated and cost
nothing to keep: multimodal input, `reasoning.effort` request passthrough (gated behind
`features.reasoningEfforts`, hardcoded test value, no real per-conversation setting yet), and the
reasoning-to-`stages` mapping (persisted, not shown in the UI). This document is still the record of what's
confirmed vs. still guessed, since none of it has a real UI/setting layer on top yet.

## Summary: done, left, blockers

**Done — live code, confirmed by testing, kept:**

- **Multimodal input** (image attachments) — confirmed working over Responses.
- **`reasoning.effort`** request passthrough — confirmed Core accepts it without rejection; kept live,
  gated behind `features.reasoningEfforts` so it's a no-op on unsupported deployments.
- **Reasoning surfacing** — the model's reasoning text (`response.reasoning_text.delta`) is captured into
  the message's `custom_content.stages` (reusing the existing stages accumulator) via
  `recordWithoutStreaming`, so it lands in persisted conversation data without being streamed live to the
  browser — no "Thinking" panel shows in the chat UI today.
- **Stages support over Responses — definitively answered "no."** Confirmed via a same-deployment,
  same-prompt comparison: Chat Completions gets automatic server-side web-search grounding (stages) for
  `-web-search` deployments; Responses gets none. This is a Core-side gap, not something fixable in this
  repo.

**Done — closed, reverted:**

- **Tools/function calling** — routing confirmed live (a tool-call event does arrive), but not implemented
  in Chat at all (no DTO, no round trip). All spike scaffolding was removed; flagged as out of scope for
  this effort, a separate initiative if wanted.
- **`top_p` / `response_format`** request passthrough — confirmed Core accepts both without rejection, then
  reverted: neither has a capability gate, so leaving them live would silently alter every real Responses
  request on `development` (forced `top_p: 0.5`, forced `response_format: 'text'`) with no way to opt out.

**Still open / unverified:**

- Deep Research (`custom_fields.configuration`) passthrough — code exists, never live-tested (no deployment
  found with both a configuration schema and working Responses connectivity).
- Citations/annotations — not spiked at all.
- Remaining DIAL payloads (assistant attachments round-trip, `form_value`/`state`, full stage parity) — no
  Responses-native slot identified.
- `reasoning.effort` has no real per-conversation setting or UI control — it's a hardcoded test value (the
  deployment's first supported effort level); no behavioral (A/B) proof it actually changes model output.

**What stops this from becoming a real implementation plan:**

1. **No Core-side visibility.** No `ai-dial-core` checkout or vendored OpenAPI spec for
   `/openai/v1/responses` anywhere in this workspace — every finding above came from live-testing against a
   running deployment, not reading a contract. Several open questions (capability-flag semantics for
   Responses specifically, `input_file` gating, whether `custom_fields.configuration` is even accepted)
   can't be resolved without either Core's spec or Core-side engineering input.
2. **"Upstream is missing required id"** — a pre-existing, unexplained base-connectivity error on some
   deployments, blocking several tests (notably Deep Research) entirely. Not diagnosable from this repo.
3. **No persisted settings layer.** `ConversationResponseDto` has no fields for reasoning effort, top_p, or
   response_format — so even confirmed-safe passthroughs can't become real user-facing features without new
   DTO/API/UI work, which is a separate, larger change.
4. **Product-scope question, not a technical one:** is tools/function calling even wanted, given Chat
   Completions doesn't have it either? That decision gates whether stages can ever be conclusively
   tested (a real test needs a tool-executing deployment).

## Why

`docs/responses-api-integration.md`'s "Not yet supported" list names several gaps between the Responses
adapter and the Chat Completions adapter: extra generation parameters, tools/function calling, reasoning
summaries, multimodal input, citations/rich output, and DIAL-specific payloads
(attachments/configuration/forms/stages). Closing them would let more Responses-capable deployments behave
the same regardless of which upstream API Core routes them through.

Several of these gaps cannot be scoped into concrete tasks yet — they depend on facts about DIAL Core's
`/openai/v1/responses` contract that this repo cannot answer from its own source (no `ai-dial-core` checkout,
no vendored Core OpenAPI spec for the Responses endpoint). This proposal exists to record the feature list,
what live spikes have already answered, and the specific open questions before any implementation task is
written.

## Findings by feature

Each entry: what was tested, against which deployment, the result, and what's still missing before it's a
real, shippable feature (not just a confirmed passthrough).

### Multimodal input (image attachments) — CONFIRMED, spike code still in place

Tested against `ali.qwen3.7-plus` (`responsesApi: true`, `contentParts: true`).

- DIAL's own `custom_content.attachments` passthrough (mirroring Chat Completions verbatim) **does not
  work** — Core's Responses endpoint silently ignores it; the model reported no image seen. **Ruled out.**
- Mapping to OpenAI-native content parts **works**: `{ type: 'input_image', image_url: <data-uri-or-url> }`
  for `image/*` attachments. Confirmed with a `files/...`-referenced attachment; the inline-base64 shape is
  implemented analogously but not separately live-tested.
- `input_file` (non-image attachments) is **hard-rejected** on this deployment:
  `"Invalid content type: 'input_file' is only supported for 'qwen3.5-ocr' model."` No capability flag
  predicts this — it's a Core-side per-model allowlist. Non-image attachments are intentionally dropped
  (never mapped to `input_file`) rather than sent unconditionally, since that would break any non-image
  attachment on any deployment other than `qwen3.5-ocr`.

**Implementation** (still in code, marked spike/TEMPORARY, not hardened into a real feature — no DTOs, no
Swagger contract, no tests, no `openapi` regen):
`apps/chat-api/src/conversations/generation/generation.types.ts` (`ResponsesInputContentPart` union) and
`responses.adapter.ts` (`buildInputItem`).

**Still missing:** a real capability signal (or Core documentation) for `input_file` support; confirmation
the inline-base64 shape works live; DTOs/tests/openapi regen before this ships for real.

### Deep Research / `custom_content.configuration_value` passthrough — implemented, still unverified

Mirrors the existing Chat Completions `configuration_value` → `custom_fields.configuration` mechanism
(`chat-completions.adapter.ts:56-60`) — not a Responses "tool"; do not model it as one.

**Still in code** (not reverted — this is a real mechanism, just unconfirmed): `generation.types.ts`
(`custom_fields?: { configuration }`), `responses.adapter.ts` (`buildRequest`'s `configuration` param),
`conversation-streaming.service.ts` (threads the already-computed `configuration` value through).

**Status: no deployment found that can verify this.** `openai-mock-model` is the only deployment (of 109
scanned) reporting `hasConfigurationSchema: true` alongside `responsesApi: true`, but it fails at a more
fundamental level before configuration passthrough is even reachable (see the base-connectivity finding
below) — this is unrelated to `store` (tested `store: false → true`; no change, reverted). `ali.qwen3.7-plus`
gets past that base error but doesn't report `hasConfigurationSchema: true`. **Open until a suitable
deployment is found or Core-side info is available.**

### Base-connectivity error — "Upstream is missing required id"

Hit on **multiple** deployments (`ali.qwen3.8-max-preview`, `openai-mock-model`, and per user report "many
other models"), using nothing but the already-shipped, minimal `buildRequest` output — not a regression from
anything in this session. Confirmed **not** caused by `store: false` (tested `store: true`; no change,
reverted).

`ali.qwen3.7-plus` is the one deployment confirmed to get **past** this error entirely (used for every other
spike below). Working theory (unconfirmed): affected deployments have an empty `responses_defaults` on
Core's side and the upstream provider expects an `id` field Chat's stateless design never sends. Whether
this is fixable from Chat's side at all, or is purely deployment/Core-side misconfiguration, is **unresolved
and needs Core-side input** — it cannot be diagnosed further by reading this repo.

### Tools / function calling — routing confirmed, but NOT implemented; closed for this session

Spiked whether Core routes a tool-call event back through the Responses SSE stream, using
`ali.qwen3.7-plus` (`tools: true`): sent one hardcoded test tool (`get_current_weather`), and logged
`response.output_item.done` events with `item.type === 'function_call'`.

**Result: CONFIRMED** — Core forwarded the model's tool-call intent back
(`tool call observed — name: get_current_weather, call_id: ...`).

**This only proves routing/plumbing works — full function calling is NOT implemented and was deliberately
not carried forward.** What's missing is materially larger than a spike:

- a real tool-schema DTO — nothing in `send-completion.dto.ts` / `MessageCustomContentDto` lets a caller
  define tools today; the hardcoded weather tool was a throwaway test aid, not a usable mechanism;
- the round trip — executing the call and sending a `function_call_output` item back so the model can
  continue the turn (currently the turn just ends once a tool call is emitted); `parallel_tool_calls`
  behavior and multi-turn `call_id` state (in a stateless, `store: false` design) are unexplored.

All spike scaffolding (`ResponsesToolDefinition`, `tools` field, `toolsSupported` threading, the
`response.output_item.done` handler) was **reverted** after this result was recorded. Reintroducing this
needs a real design (tool-schema DTO + round-trip contract) first, not just re-adding the hardcoded tool.

### Reasoning effort, `top_p`, `response_format` — passthrough CONFIRMED; only `reasoning.effort` kept

All three were spiked the same way against `ali.qwen3.7-plus` and checked via a temporary debug line
confirming the field was actually present in the outgoing request body (log removed after confirming): send
a value, confirm no rejection from Core.

| Parameter         | Capability signal used                          | Test value sent                              | Result | Status |
| ------------------ | ------------------------------------------------ | --------------------------------------------- | ------ | ------ |
| `reasoning.effort` | `features.reasoningEfforts` (non-empty array)     | `reasoningEfforts[0]` (`"low"`)               | Confirmed, no rejection | **Kept** — gated, no-op unless the deployment reports the signal |
| `top_p`            | none exists — reused `temperatureSupported`       | hardcoded `0.5`                               | Confirmed, no rejection | **Reverted** — see below |
| `response_format`  | none exists — sent unconditionally                | hardcoded `{ type: 'text' }` (the safe default) | Confirmed, no rejection | **Reverted** — see below |

`seed` **cannot be spiked at all** — 0 of 109 scanned deployments report `features.seed: true`.

Presence/frequency penalties were identified as the same shape (no capability flag) but not yet spiked.

**Why `top_p`/`response_format` were reverted after confirming, unlike `reasoning.effort`:** `top_p` had no
real capability gate — it fired on every request where `temperatureSupported` was true, silently forcing
`0.5` regardless of what a real user would otherwise get. `response_format` had no gate at all — it fired
unconditionally on every single Responses request. Leaving either live on `development` meant real traffic
through the Responses path was silently altered with no way to opt out, for zero product benefit (nothing
consumes the confirmation beyond this document). `reasoning.effort` doesn't have this problem: it's a no-op
unless the deployment explicitly reports `features.reasoningEfforts`, so keeping it live changes nothing for
any deployment that doesn't support it.

**Every one of these three still has the same two gaps, so none is a finished feature even where kept:**

1. **No persisted per-conversation setting.** Unlike `temperature`, none of these have a real field on
   `ConversationResponseDto` or a UI control — `reasoning.effort`'s kept value is always the deployment's
   *first* supported effort level, not a user choice. (Note: Chat's existing `conversation.responseFormat`
   UI setting is a **client-side Markdown/plain-text rendering hint**, unrelated to the `response_format` API
   parameter tested here — it is never sent upstream in either adapter today. Confirmed with the user before
   spiking.)
2. **No behavioral confirmation.** "Core didn't reject it" proves the field round-trips through Core; it
   does not prove Core forwards it to the model or that the model's output actually changes. A real
   `response_format` test would need `json_object`/`json_schema` and a check that the model returns valid
   JSON; a real reasoning-effort test would need a low-vs-high A/B comparison on a task sensitive to it.

### Reasoning items/summaries — CONFIRMED present in the stream; captured in data, not shown in the UI

Live-tested on `ali.qwen3.7-plus-web-search`. The real event names (not the sketch previously written
here) are `response.reasoning_text.delta` (token-by-token reasoning text, same shape as
`response.output_text.delta` but for the model's chain-of-thought) and `response.output_item.done` with
`item.type: 'reasoning'` carrying the full text again as `item.summary: [{ type: 'summary_text', text }]`.

Originally both fell into `handleEvent`'s `default:` branch — logged at debug level, counted as an
unknown-event metric, never forwarded to the browser or persisted. `handleEvent` now has a dedicated
`response.reasoning_text.delta` case that maps each delta into a synthetic `custom_content.stages` entry
(`index: 0`, `name: 'Thinking'` sent once per `item_id`, `content` appended per delta), reusing the exact
`mergeStages` accumulation Chat Completions already uses for its own stages. It's recorded onto the
assembled message via `recordWithoutStreaming` rather than `writeChunk`, so the reasoning stage lands in the
persisted conversation data but is never queued into `pendingChunks` — nothing streams live to the browser,
so the chat UI shows no "Thinking" panel. `response.output_item.done` for the reasoning item is still
unhandled/dropped by choice: the full text already arrived via the deltas, so re-sending it as a second copy
would duplicate content.

**Verified the reasoning/answer boundary is clean, not buggy.** A follow-up test looked like reasoning text
was leaking into the visible chat answer (mid-thought content appearing outside the "Thinking" stage).
Instrumenting both event types side-by-side showed Core closes the reasoning item cleanly
(`reasoning_text.done` → `output_item.done`) and opens a distinct new message item
(`output_item.added` → `content_part.added`) *before* any `output_text.delta` fires — there is no
mid-stream relabeling. What looked like a boundary bug was qwen3.7-plus itself writing its actual final
answer in a deliberative, reasoning-style voice ("Wait, some platforms inject a search tool
automatically...") — a model-quality/prompting issue, not a protocol or adapter defect. No code change
needed for this part; the stage-mapping code is doing the right thing with the events as Core sends them.

Remaining gap: `ConversationMessageDto`/`StageDto` have no reasoning-specific field — this only works because
`stages` is a generic accumulator. A persisted-message-state review is still open if reasoning needs to be
distinguished from an actual tool-executed stage later (e.g. for analytics or a different UI treatment).

### Stages — CONFIRMED not supported (Core-side gap, not a client-request gap)

Live-tested the same session, same deployment/prompt (`ali.qwen3.7-plus-web-search`, "search the web and
cite your source"). The full raw event sequence — `response.in_progress` → `response.output_item.added`
(reasoning) → `response.reasoning_text.delta`×N → `response.reasoning_text.done` →
`response.output_item.done` (reasoning) → `response.output_item.added` (message) →
`response.content_part.added` → `response.output_text.done` → `response.content_part.done` →
`response.output_item.done` (message) — contains no `stages`/`custom_content` shape anywhere.

**Resolved from a caveat to a confirmed gap.** Initially this looked inconclusive — no tools were sent, so
maybe Core just had nothing to wrap in a stage. But the identical prompt run through **Chat Completions**
against the *same* `ali.qwen3.7-plus-web-search` deployment produced 8 `"Web Search"`/`"Web Search
#N"` stages with real query/source lists — and the Chat Completions request body carries **no `tools`
array either**. `-web-search` deployments do fully server-orchestrated, automatic web grounding that is
invisible to the client's request; Chat never asks for it and never sees a tool-call round trip, Core just
does it. That rules out the "blocked on missing tools implementation" explanation entirely — this is not a
client-request gap, it's a **Core-side gap**: whatever internal mechanism triggers a deployment's automatic
search grounding is wired for the Chat Completions endpoint and not bridged to the Responses endpoint.
Same deployment, same prompt, zero client-side differences, different behavior — Responses gets no search,
no stages, and a model that says it has no search tool.

- **Citations:** not spiked. Would map a Responses-native annotation/citation event into the existing
  `Annotation`/`AnnotationDto` shape. Shape of Core's native event is unconfirmed — assumed to resemble
  OpenAI's `url_citation`.
- **Remaining DIAL payloads** (assistant-produced attachments, `form_value`/`state`, full `stages` parity):
  no obvious Responses-native slot found; may need a Core contract change.

## Where things live (for whoever picks this up)

- Capability flags straight from Core, confirmed by reading `deployment-mapper.util.ts:144-187`
  (`mapDeploymentFeatures`): `rate`, `mcp`, `tokenize`, `truncatePrompt`, `hasConfigurationSchema`,
  `systemPrompt`, `tools`, `seed`, `urlAttachments`, `folderAttachments`, `allowResume`,
  `accessibleByPerRequestKey`, `contentParts`, `temperature`, `cache`, `autoCaching`, `parallelToolCalls`,
  `assistantAttachmentsInRequest`, `chatCompletion`, `responsesApi`, `maxTokensSupported`,
  `maxCompletionTokensSupported`, `customTemperatureSupported`, `reasoningEfforts` (array).
- Deep Research is entirely the `custom_content.configuration_value` → `custom_fields.configuration`
  mechanism — see `openspec/specs/chat-input-tools-menu/spec.md` and
  `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts:56-60`. Not a Responses "tool".
- Attachment shapes to support for any future multimodal mapping: `attachment.data` (inline base64) or
  `attachment.url` (`files/...` or HTTPS) — see `getValidAttachments` in `chat-completions.adapter.ts:22-27`
  and validation in `apps/chat-api/src/conversations/dto/attachment.dto.ts`.
- No `ai-dial-core` checkout and no vendored Core OpenAPI spec for `/openai/v1/responses` exist anywhere
  under `C:\projects\dial\`. Any question about what Core's Responses endpoint actually accepts needs either
  a real Core instance to test against, or someone providing Core's spec/docs directly.
- Full Code Map for the existing (shipped) integration: see `docs/responses-api-integration.md`'s "Code Map"
  table.
- The operator flag is **`RESPONSES_API_ENABLED`** (trailing `D`) — `RESPONSES_API_ENABLE` silently falls
  back to the default (`false`), no error/warning. Check the debug routing log first if routing looks wrong.

## Open Questions

- What does Core's Responses endpoint expect for attachments? **Partially resolved** — see Findings above.
  Still open: what actually gates `input_file` acceptance (no capability flag found), whether any content-part
  type exists for non-image/non-OCR files, and whether `input_image` holds across other deployments.
- Does Core's `/openai/v1/responses` accept `custom_fields.configuration`? **Still open** — no deployment
  found that can verify it (see Findings above).
- What causes "Upstream is missing required id" on some deployments and not others (see Findings above)?
  **Needs Core-side input** — not diagnosable from this repo.
- Do `features.seed` / `features.reasoningEfforts` / `features.contentParts` / `features.tools` describe
  capability of the deployment in general, or of its Chat Completions transport specifically? Unverified
  whether these flags mean anything for a deployment routed through Responses (reasoningEfforts and tools
  routing were spiked and behaved as expected on `ali.qwen3.7-plus`, but this wasn't cross-checked on a
  second deployment).
- Is there a genuine Core capability signal for `top_p`, `presence_penalty`, `frequency_penalty`,
  `response_format` — or is sending them pure guesswork (unconditional/reused-signal, as spiked)? Presence/
  frequency penalties were never spiked.
- Does `features.assistantAttachmentsInRequest` describe an input-side echo-back capability, or something
  else? Relevant to whether assistant-produced attachments can round-trip through Responses at all.
- Is there a Responses-native slot for `form_value`/`state` (the DIAL stateful-app opaque payload), or does
  that require a Core contract change?
- What is the actual product scope for tool/function calling — is it wanted at all given Chat Completions
  doesn't have it either, and if so, does it belong to this Responses-focused effort or a separate
  initiative?
- None of the above can be resolved by reading this repo. Resolving them needs either DIAL Core's OpenAPI
  spec/source for the Responses endpoint, or a real Core instance to test individual fields against.

## Manual QA Scenarios

*(For once an item above is actually implemented — recorded now so verification isn't designed from scratch
per slice later.)*

- **Debug visibility (already shipped):** with debug logging enabled, send a completion request against a
  Responses-capable deployment and a Chat-Completions-only deployment; confirm the
  `Generation API resolved for "<model>" — api: ..., responsesApiEnabled: ..., deployment.responsesApi: ...`
  log line appears for both, with correct values.
- **Multimodal input — both attachment shapes:** send a message with an inline base64 image attachment, and
  separately one with a `files/...` URL attachment, to a Responses-routed deployment with
  `features.contentParts: true`; confirm the assistant's response reflects the image content in both cases.
- **Deep Research via Responses:** once a suitable deployment exists, toggle Deep Research on for a
  Responses-routed deployment; confirm the outgoing request carries the configuration value and that
  toggling it off omits the field, matching the existing Chat Completions scenarios in
  `openspec/specs/chat-input-tools-menu/spec.md`.
- **Reasoning effort / top_p / response_format — real feature version:** once a persisted per-conversation
  setting and UI control exist, confirm the user-selected value (not a hardcoded constant) is what's sent,
  and run a behavioral check (low-vs-high reasoning effort on a sensitive task; `json_object` producing valid
  JSON).
- **Citations parity:** trigger a citation-producing response through a Responses-routed deployment; confirm
  the citation renders identically (same component, same tooltip/quote behavior) as an equivalent
  Chat-Completions citation.
- **Reasoning summary persistence:** trigger a reasoning-capable deployment; confirm the reasoning summary
  (if the UI surfaces it) or at least its persisted `custom_content` field survives a conversation reload.
- **Regression — Chat Completions unaffected:** for a deployment that stays on Chat Completions (either
  `RESPONSES_API_ENABLED=false` or `features.responsesApi` absent/false), confirm none of the new fields
  change its request or response shape at all.
- **Rollback path still works:** with any of the above enabled, set `RESPONSES_API_ENABLED=false` and
  restart; confirm every deployment falls back to Chat Completions immediately, per the existing operator
  kill-switch behavior.
