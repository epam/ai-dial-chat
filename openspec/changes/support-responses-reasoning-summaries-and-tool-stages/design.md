## Context

`ResponsesAdapter.relay` (`apps/chat-api/src/conversations/generation/responses.adapter.ts:201-294`) is a single `switch` over `event.type`. It currently recognizes `response.created`, `response.output_text.delta`, `response.completed`, `response.failed`, `response.incomplete`, and the top-level `error` frame; everything else — including every reasoning-summary event and every tool output-item/lifecycle event — falls into the `default` branch (`responses.adapter.ts:277-292`), which never writes a chunk, never touches `assembledMessage`, and only records a sanitized event-type label on `generationUnknownEventsTotal`.

Confirmed against `C:/dial_projects/ai-dial-core` (see proposal "Verified DIAL Core contract"): Core does not synthesize DIAL stages for Responses events. It proxies the native stream, rewriting only the response id and collecting output attachments (`CollectResponsesApiOutputAttachmentsFn.java:14`), and treats `response.completed`/`response.incomplete` as terminal (`ResponsesSseListener.java:17`). Any reasoning-summary or tool-stage behavior must therefore be built entirely in this adapter and its surrounding merge/persistence/UI layers — nothing upstream will help.

The existing stage infrastructure this change reuses is already proven for Chat Completions: `Stage`/`StageStatus`/`MessageCustomContent` (`libs/chat-shared/src/models/chat.ts:48-149`), the additive index-keyed merge in both `apply-chunk.server.ts:118-147` (backend) and `apply-chunk.ts:65-96` (frontend), and the `CollapsedGroup` → `StagesPanel` → `StageItem` rendering chain (`libs/conversation-stages/src/components/**`), which already computes `Executed in N steps` off `stages.length` (`CollapsedGroup.tsx:157,193`). None of this is Responses-aware today, and per the library-isolation rule it must stay that way.

`ConversationMessageCustomContentDto` (`apps/chat-api/src/conversations/dto/message-custom-content.dto.ts`) — and therefore the generated `libs/chat-api-client/openapi.json:6999-7078` — documents only `attachments`, `configuration_value`, and `form_value`. It does not yet document `stages` or `annotations`, which are already produced at runtime by `apply-chunk.server.ts`. This is a pre-existing generated-contract gap this change must not deepen by adding another undocumented runtime-only field.

Verification note on the upstream OpenAI contract: this design uses the event/field shapes already verified and listed in the task prompt (reasoning-summary events keyed by `item_id`/`output_index`/`summary_index`, with incremental text in `response.reasoning_summary_text.delta.delta` and full text in the paired `.done`; output-item events carrying `item` and `output_index`; web-search lifecycle events carrying `item_id` and `output_index`). Live re-verification against `developers.openai.com` during this task hit response-size limits on the full streaming-events reference page and returned inconsistent field lists on smaller fetches, so those shapes are **not independently re-confirmed by this design** and are flagged as an assumption — see Open Questions. Tasks must re-check them against the installed `@epam/ai-dial-typescript-sdk` types and/or real fixtures before the adapter code is finalized.

## Goals / Non-Goals

**Goals:**

- Normalize the official reasoning-summary events into a new, distinct `custom_content.reasoning_summaries` field on the shared chunk/persistence shape, deduplicated between delta and done events, ordered, and rendered in a collapsible section that never affects `stages.length`.
- Normalize `web_search_call` output items into the existing `Stage`/`custom_content.stages` representation via the existing merge and `CollapsedGroup` rendering, with correlation by upstream identity rather than arrival order, and correct terminal handling for stages left unsettled.
- Keep `libs/conversation-stages` and `libs/chat-shared`'s type surface free of Responses API discriminators; resolve tool-kind labels at the `apps/chat` boundary.
- Keep the change additive: no schema/version bump, no behavior change for text-only Responses deployments or for Chat Completions.

**Non-Goals** (mirrors the proposal's non-goals list — not repeated in full here):

- No client-side `function_call`/`custom_tool_call` execution loop, no `previous_response_id`/`store: true`/background mode, no tool approval/auth UX, no citations/annotations work, no reasoning-effort UI, no `ai-dial-core` change.

## Decisions

### 1. Opt-in mechanism: deployment `responsesDefaults`, not a Chat-side default

Compared against the three alternatives from the proposal prompt:

| Option | Verdict |
| --- | --- |
| Always send `reasoning: { summary: "auto" }` from Chat | **Rejected.** Summary availability is model/org-verification-dependent; Core has no reliable capability flag today, so an unconditional default risks a hard rejection from models that reject the field. |
| Treat non-empty `features.reasoning_efforts` as a proxy capability | **Rejected.** Reasoning effort and reasoning summaries are independent OpenAI parameters; a model can support one without the other. Coupling them would produce false positives/negatives with no contract backing the inference. |
| New explicit Core capability flag (future, coordinated change) | **Deferred**, not rejected — the right long-term fix, but out of scope: it requires an `ai-dial-core` change, which this task explicitly avoids absent new evidence. |
| **Selected: deployment `responsesDefaults` merge (Core-side, already implemented)** | Core already recursively merges deployment-configured defaults into the outbound Responses request (`ResponsesApiRequest.java:64`, `ChatUtil.java:62`, `JsonUtil.java:78`). An operator who configures `{"reasoning":{"summary":"auto"}}` on a deployment's `responsesDefaults` gets summaries; Chat sends nothing extra and therefore cannot make an unsupported model reject an otherwise-valid request. Chat's job is purely passive: recognize and render summary events **if** they show up. |

This means `ResponsesAdapter.buildRequest` requires **no change** for this decision — the opt-in lives entirely in deployment configuration outside Chat's request body. Chat's Responses request continues to omit `reasoning` entirely.

### 2. Persisted/normalized reasoning-summary shape: ordered array keyed by identity, not a single string, not a stage

Comparing the three options the prompt requires:

1. **Single accumulated `reasoning_summary?: string`** — rejected. A response can contain multiple reasoning output items, each with multiple summary parts (`summary_index`); a single string can't represent more than one without an ambiguous separator convention, and it can't be merged idempotently when a duplicate/replayed done event arrives for one part but not others.
2. **Ordered `reasoning_summaries[]` keyed by output/summary indexes — selected.** Mirrors the `Stage[]`/`Annotation[]` merge-by-key pattern already proven in both `apply-chunk` implementations. Each entry is independently addressable by `(itemId, outputIndex, summaryIndex)`, so per-key deduplication (delta vs. done) and multi-item ordering both fall out of the same additive-merge mechanism already used for stages/annotations — no new merge paradigm.
3. **Folding into `custom_content.stages`** — rejected per the prompt's explicit constraint: a reasoning summary is not an executed action and must never inflate `Executed in N steps`.

**Normalized chunk field** (`NormalizedStreamChunk.choices[].delta.custom_content.reasoning_summaries`, `apps/chat-api/src/conversations/generation/generation.types.ts`):

```ts
export interface ReasoningSummaryChunk {
  /** Upstream reasoning output item id — primary correlation key. */
  itemId: string;
  /** Position of the reasoning item in the response's output array. */
  outputIndex: number;
  /** Position of this summary part within the reasoning item. */
  summaryIndex: number;
  /** Incremental or (fallback) complete summary text fragment for this key. */
  text: string;
}
```

**Wire chunk example — delta:**

```json
{
  "choices": [{
    "delta": {
      "custom_content": {
        "reasoning_summaries": [
          { "itemId": "rs_1", "outputIndex": 0, "summaryIndex": 0, "text": "Checking the " }
        ]
      }
    }
  }]
}
```

**Wire chunk example — a second delta for the same key (accumulates), then a second summary part starting:**

```json
{ "choices": [{ "delta": { "custom_content": { "reasoning_summaries": [
  { "itemId": "rs_1", "outputIndex": 0, "summaryIndex": 0, "text": "weather API" }
] } } }] }
```

```json
{ "choices": [{ "delta": { "custom_content": { "reasoning_summaries": [
  { "itemId": "rs_1", "outputIndex": 0, "summaryIndex": 1, "text": "Formatting the result" }
] } } }] }
```

**Persisted message** (`ConversationMessageCustomContentDto.reasoning_summaries`, new field, wire key stays snake_case for consistency with the sibling `stages`/`form_schema`/`annotations` keys):

```json
{
  "custom_content": {
    "reasoning_summaries": [
      { "itemId": "rs_1", "outputIndex": 0, "summaryIndex": 0, "text": "Checking the weather API" },
      { "itemId": "rs_1", "outputIndex": 0, "summaryIndex": 1, "text": "Formatting the result" }
    ],
    "stages": [ /* unrelated to reasoning_summaries — see Decision 4 */ ]
  }
}
```

Shared type addition (`libs/chat-shared/src/models/chat.ts`), same shape reused for both the wire delta and the persisted array — no separate DTO/model pair needed since both are plain optional arrays of the same value type:

```ts
export interface ReasoningSummaryPart {
  itemId: string;
  outputIndex: number;
  summaryIndex: number;
  text: string;
}
// MessageCustomContent.reasoningSummaries?: ReasoningSummaryPart[]  (camelCase in TS, `reasoning_summaries` on the wire — same convention `custom_content` itself already uses)
```

### 3. Delta/done deduplication is the adapter's responsibility, not the merge layer's

The merge layer (`apply-chunk.server.ts` / `apply-chunk.ts`) only knows how to concatenate text for a given key — it cannot tell "this done event's full text duplicates text already streamed via deltas" from "this is the only text this part will ever get." Pushing dedup into the merge layer would require it to track per-key "have I seen a delta" state, which the existing stage/annotation merges don't need and shouldn't grow just for this feature.

Instead, `ResponsesAdapter.relay` keeps a per-response `Set<string>` of `(itemId, outputIndex, summaryIndex)` keys that have received at least one `response.reasoning_summary_text.delta`:

- On `response.reasoning_summary_text.delta`: write a chunk with `text: event.delta`, and mark the key as seen.
- On `response.reasoning_summary_text.done`: if the key was **not** already seen (no prior delta for this exact part — the upstream-only-emits-done case), write one chunk with `text: event.text` (the complete text, merged exactly like a delta fragment). If the key **was** already seen, write nothing — the deltas already fully cover it.
- `response.reasoning_summary_part.added` is a structural marker (a new part starting) and produces no chunk on its own; it exists so the adapter's per-key set can be initialized before the first delta if useful for future validation, but is not required to emit content.
- Empty text is never written: a `delta`/`done` whose text is an empty string is skipped so no empty-string chunk (and therefore no empty-panel entry) is ever created — satisfies "empty summary parts must not create an empty panel."

This mirrors the existing `response.output_text.delta` handling in kind (adapter decides what constitutes a content update) while adding the minimal state needed for correctness.

### 4. Tool-stage identity correlation and dedup

Reuses the existing `Stage.index` merge key from `mergeStages`, but assigns it deliberately rather than relying on arrival order:

- On `response.output_item.added` where `item.type === 'web_search_call'`: the adapter records `itemId -> outputIndex` in a per-response `Map`, and writes a `Stage` chunk with `index: outputIndex`, `status: null`, `tag`/`name` resolved per Decision 6. This is the **only** point a new stage is created for this item.
- On `response.web_search_call.in_progress` / `.searching`: looked up via `item_id` in the map; these are intentional no-ops (already-running state, nothing new to report) and must not create a second stage, must not touch `status`, and must not increment `generation.responses.unknown_events` (they are recognized, just deliberately ignored).
- On `response.web_search_call.completed`: looked up via `item_id`; writes a `Stage` chunk with the same `index` and `status: StageStatus.Completed`. If `response.output_item.done` for the same item already settled the stage (see next bullet), this is naturally idempotent — merging `Completed` onto an already-`Completed` stage is a no-op change.
- On `response.output_item.done`: if `item.type === 'web_search_call'`, resolves `item.status` (`completed` → `StageStatus.Completed`; anything else explicit like `failed`/`incomplete` → `StageStatus.Failed`) and writes the settling chunk keyed by the same `outputIndex`. If `item.type` is `reasoning` or `message`, no stage chunk is written at all (satisfies "a reasoning item and a final message output item are not tool stages").
- Both the generic (`output_item.added/done`) and tool-specific (`web_search_call.*`) events for the **same** `item_id`/`output_index` therefore resolve to the same `Stage.index` and the same additive merge already in `mergeStages` — no duplicate-stage detection logic is needed beyond "always derive the key from `item_id`/`output_index`, never from event-arrival sequence."
- Malformed/out-of-order defense: if a tool-specific lifecycle event arrives for an `item_id` the adapter has not seen via `output_item.added` (out-of-order upstream), the adapter logs a debug line (no payload content) and skips the event rather than guessing an index — it does not crash and does not block subsequent text/terminal events.

### 5. Unsettled stages at termination are marked `Failed`, never left `status: null`

Requirement: "do not silently mark an unconfirmed execution successful," across response failure, incomplete, malformed/missing done events, and user abort.

`StageStatus` only has two members, `Completed` and `Failed` (`chat.ts:48-53`). This design reuses `Failed` for "unsettled at termination" rather than adding a third status (e.g. `Cancelled`/`Unknown`):

- **Selected: reuse `StageStatus.Failed`.** No `Stage`/`StageStatus` type change, no new branch needed in `StageIcon`/`StageItem` rendering, no new modified-capability surface in `stage-visualization`. Consistent with the requirement's actual bar — "never claim success" — which `Failed` satisfies exactly.
- **Rejected: add `StageStatus.Unknown`/`Cancelled`.** More semantically precise (an aborted-by-user web search isn't necessarily an error), but expands the rendering matrix (`StageIcon` would need a third visual state) for a distinction the requirement doesn't ask for. Flagged as a trade-off below, not silently dropped.

Mechanism: at the end of `relay` (every return path — `completed`, `error`, `aborted`, `rejected` before any stream started), the adapter inspects `assembledMessage.custom_content?.stages` for entries with `status: null` and, if any exist, writes one corrective chunk marking them `StageStatus.Failed` before returning — this covers both "response terminated abnormally" and "response completed normally but the expected tool-done event never arrived" in one code path, since both leave a stage at `status: null` when the stream ends.

### 6. Tool-kind label resolution stays at the `apps/chat` boundary

Comparing the three options from the proposal prompt:

1. **Persist a preformatted English `Stage.name` in the BFF** — rejected as the primary mechanism (though see below): bakes English text into persisted data, which cannot be relocalized later and doesn't match the "all labels through `react-i18next` at the app boundary" rule for anything language-selectable.
2. **Add provider-neutral tool-kind metadata to the stage, resolve the label in `apps/chat` — selected.** `Stage` gains an optional field, e.g. `toolKind?: ToolStageKind` (a DIAL-level enum such as `WebSearch = 'web_search'` — never the raw `web_search_call` discriminator), defined in `libs/chat-shared` (shared types only, no logic, consistent with its existing role). The backend sets `toolKind` and a **safe non-localized fallback** `name`/`tag` (so a byte-for-byte-old frontend or an export/import round trip still shows something sensible). `apps/chat` (in `ConversationMessageItem` or a small new mapper util under `apps/chat/src/utils/`) reads `stage.toolKind`, and when recognized, overwrites `name`/`tag` with the localized string from `react-i18next` **before** the stages array reaches `CollapsedGroup`/`StagesPanel`. `libs/conversation-stages` keeps receiving a plain `Stage[]` and never imports or branches on `ToolStageKind` — it only ever sees the final resolved `name`/`tag` strings, identical to how it already treats Chat-Completions-produced stages.
3. **Separate normalized activity type, adapted to `Stage` before rendering** — rejected as unnecessary indirection: `Stage` already has the exact fields (`name`, `tag`) this needs, and introducing a second type just to carry `toolKind` until the adapt-to-`Stage` step duplicates option 2's outcome with an extra type and mapping function for no behavioral gain.

Backward compatibility: existing Chat-Completions-produced stages never set `toolKind`, so the new mapping step is a no-op for every stage that isn't Responses-tool-originated — `apps/chat` only overwrites `name`/`tag` when `toolKind` is present and recognized.

### 7. Stage content and privacy for `web_search_call`

- `name`/`tag` communicate the tool category (e.g. tag `"Web Search"`) and, only once the design treats it as user-visible conversation content, the resolved query if the upstream item exposes one in a documented field — this design does **not** enable that in the MVP (no new `include` request values are added, per the prompt's explicit constraint), so the MVP stage shows category only, no query text, no raw item JSON, no arguments/results.
- Nothing from `web_search_call` items is added to logs or metric attributes — only the bounded normalized `toolKind` value (never a raw upstream type string) is eligible for a future metric, and only if it proves operationally useful (see Observability below).
- No citations/annotations are synthesized from search metadata; that remains entirely the existing, separate annotations feature.

### 8. Support matrix (evaluated against the current official Responses output-item union and this project's adapter)

| Output item type | Category | MVP action |
| --- | --- | --- |
| `web_search_call` | Provider-hosted, safe to visualize now | **Supported** — mapped to a `Stage` per Decisions 4–5 |
| `message` | Not a tool call | Explicitly excluded from stage mapping (final text output) |
| reasoning item | Not a tool call | Handled by Decisions 2–3, never staged |
| `file_search_call` | Provider-hosted | **Not in this MVP** — same generic mapper shape as `web_search_call`, deferred only because it is not yet an accepted/verified adapter configuration in this project; a follow-up can widen the mapper's item-type allowlist without new orchestration once confirmed |
| `code_interpreter_call` | Provider-hosted | **Not in this MVP** — same reasoning as `file_search_call`; also carries larger output payloads, so enabling it should separately justify payload/privacy handling before widening |
| `image_generation_call` | Provider-hosted | **Not in this MVP** — not yet a verified adapter configuration; output is binary/attachment-shaped and would need its own privacy/size review |
| `mcp_call` and MCP list/approval items | Approval-dependent | **Explicitly unsupported** — approval flows are out of scope per the proposal's non-goals |
| `function_call` | Client-executed | **Explicitly unsupported** — no client-side execution loop exists; emitting this item must never produce a stage that implies execution happened |
| `custom_tool_call` | Client-executed | **Explicitly unsupported**, same reasoning as `function_call` |
| `computer_call` | Approval-dependent / client-executed | **Explicitly unsupported** |
| shell / apply-patch / tool-search call items | Unknown/provider-specific in this project's contract | **Explicitly unsupported** — not present in any configured adapter today; treated as unknown-but-safe (falls through the existing unknown-event/unknown-item-type handling, never crashes) |

Only `web_search_call` is wired into the generic mapper in this change. Every other row is documented as explicitly out of scope in both the spec and `docs/responses-api-integration.md`, so a future change can widen the allowlist without re-deriving this table.

### 9. Reasoning-summary UI component placement

Comparing the three options from the proposal prompt:

1. **Host-agnostic component in `libs/conversation-stages`** — selected, conditionally: the library already owns the markdown-rendering and collapse/expand pattern this needs (`StageMarkdownContent`, the `grid-template-rows` expand transition used by `StageItem`/`CollapsedGroup`). A new `ReasoningSummary` component there accepts `parts: ReasoningSummaryPart[]` (or the already-concatenated text — decided during implementation, see spec) plus a `labels` prop (title, expand/collapse aria labels) exactly like `CollapsedGroupLabels` today, and renders with zero knowledge of Responses API event names — it only receives already-normalized text and resolved labels, identical to how `StagesPanel` never learns about Core's stage wire format.
2. **App-local component in `ConversationMessageItem`** — rejected as the primary location: would duplicate `StageMarkdownContent`'s sanitized-markdown rendering and the existing collapse-transition CSS, which the library already has fully worked out and tested.
3. **Reusing a stage row** — rejected per Decision 2/the proposal's explicit requirement: a reasoning summary must be visually and semantically distinct from an executed step and must never be countable via `stages.length`; forcing it through `StageItem` risks exactly that conflation.

`ConversationMessageItem.tsx` (near its existing `hasStages && <CollapsedGroup .../>` block, `ConversationMessageItem.tsx:471-477`) renders the new component conditionally and separately from `CollapsedGroup`, passing resolved i18n labels the same way `executedLabel`/`stepsLabel` are already passed into `CollapsedGroup` today.

## Risks / Trade-offs

- **[Risk] Reusing `StageStatus.Failed` for "unsettled at termination" overloads its meaning (interrupted ≠ actually errored)** → Mitigation: documented explicitly in Decision 5 and in the delta spec; acceptable because the requirement's actual bar is "never claim success," which this satisfies, and because avoiding a new `StageStatus` value avoids widening `StageIcon`/`StagesPanel`'s rendering matrix for a distinction not required by the acceptance criteria. Revisit if product feedback wants a visually distinct "cancelled" state.
- **[Risk] Upstream event/field shapes were not independently re-verified against live OpenAI docs during this task (fetch-size/consistency issues)** → Mitigation: tasks include an explicit step to cross-check the adopted shapes against `@epam/ai-dial-typescript-sdk`'s installed Responses types and/or real Core-proxied fixtures before finalizing the adapter's event interfaces, and all adapter tests use realistic SSE fixtures rather than hand-typed assumptions.
- **[Risk] A future deployment enables `file_search_call`/`code_interpreter_call` before the mapper is widened** → Mitigation: those item types are simply unrecognized by the MVP mapper and fall through to the existing safe unknown-item handling (no stage, no crash, no false success claim) — see Decision 8 — so enabling them early degrades gracefully rather than breaking.
- **[Risk] `toolKind` on `Stage` is a new optional field on a type consumed by both apps and libs** → Mitigation: `libs/conversation-stages` never reads it (Decision 6); it exists purely for the `apps/chat`-boundary mapping step, keeping the module-boundary rule intact.

## Migration Plan

- Purely additive: new optional fields (`reasoning_summaries` on custom content, `toolKind` on `Stage`) with no schema/version bump. A conversation without them is valid before and after this change.
- Backend Swagger DTO + `libs/chat-api-client/openapi.json` regeneration happens in the same change as the DTO field addition (never hand-edited).
- Rollback: reverting the Chat-side event-normalization and UI commits is sufficient. Conversations saved with the new fields remain loadable by a rolled-back client — it simply ignores fields it doesn't know about, matching the existing `MessageCustomContentDto`'s already-permissive shape.
- No export-envelope version bump: the change adds optional fields to an already-extensible `custom_content` object; nothing about the envelope's required shape changes (see Open Questions for confirming this against the actual export/import round-trip test).

## Open Questions

1. Confirm the exact reasoning-summary and output-item/web-search event field names against `@epam/ai-dial-typescript-sdk`'s installed types (or real Core-proxied fixtures) before finalizing `generation.types.ts` — this design's shapes come from the task prompt's pre-verified list, not an independently re-fetched OpenAI doc (see Context).
2. Should the `ReasoningSummary` component live in `libs/conversation-stages` or a new sibling library, given it is not a "stage" — implementation should confirm no `@nx/enforce-module-boundaries` friction before finalizing the package choice.
3. Whether `file_search_call`/`code_interpreter_call` are actually reachable through any currently configured adapter in this deployment — if confirmed reachable, they may be worth widening into this same change's mapper rather than a strict follow-up (design currently assumes "not yet verified," per Decision 8, and defers them).
