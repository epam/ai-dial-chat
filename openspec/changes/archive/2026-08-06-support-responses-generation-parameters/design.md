## Context

`harden-responses-stream-handling` (archived at `openspec/changes/archive/2026-08-06-harden-responses-stream-handling`) landed an explicit terminal-state model in `responses.adapter.ts` (`ResponsesTerminalState`, `response.failed`/EOF/`[DONE]` precedence) and is the current source of truth in `openspec/specs/responses-api-generation/spec.md`. This change is a strict follow-up: it only touches request *construction* (`buildRequest` and the fields feeding it), never the SSE read loop, terminal-signal precedence, or error-extraction logic those files already implement.

Inspection of the post-hardening worktree (commit `6d19cbd20`, branch `feat/responses-stream-hardening`) confirms:

- `ResponsesApiRequestBody` (`generation.types.ts:18-23`) carries only `model`, `input`, `stream: true`, `store: false`.
- `ChatCompletionsAdapter.buildRequest` (`chat-completions.adapter.ts:84-86`) already forwards `startConversation.temperature` unconditionally (no capability gate) — Responses must gate more conservatively because some Responses-capable models reject the field outright, per the prompt's explicit requirement.
- `resolveGenerationApiForDeployment` (`conversation.service.ts:1198-1221`) fetches `DeploymentsService.getDeploymentDetails(sub, model, token)`, reads `features` off `modelDetails`/`applicationDetails`, calls `resolveGenerationApi(features)`, and **discards `features`** — it never reaches `ConversationService.streamCompletion` (`conversation.service.ts:1224` onward) or the `buildRequest` call at `conversation.service.ts:1372-1376`.
- `ModelCapabilitiesDto`/`ApplicationCapabilitiesDto` (`deployment-details.dto.ts:113-114`) expose `temperature?: boolean` ("Supports the temperature parameter"), already populated by `DeploymentsService` (`deployments.service.ts:194`, `:284`).
- No Responses-specific max-output-tokens capability flag exists anywhere in this codebase (`deployment-details.dto.ts`, `deployments.service.ts`, `openapi-response.dto.ts`, `libs/chat-api-client/openapi.json`, generated client models) — only the Chat-Completions-only `maxTokensSupported`/`maxCompletionTokensSupported` pair (`deployment-details.dto.ts:136-142`). Per the prompt's rule, these must not be reused for `max_output_tokens` gating.
- `Conversation` (`libs/chat-shared/src/models/chat.ts:272`, `temperature` at line 284) and `ConversationResponseDto` (`openapi-response.dto.ts:616-662`, `temperature!` at line 633) are structurally 1:1 with no dedicated mapping layer — `ConversationService` reads/writes `ConversationResponseDto` directly as the persisted JSON shape (e.g. `conversation.service.ts:191`, `:546-553`, `:846`).
- `SaveConversationBodyDto` (`save-conversation.dto.ts:8-15`) validates its `conversation` field with only `@IsObject()` — no `@ValidateNested()`/`@Type()` — so no field of `ConversationResponseDto`, including the existing `temperature`, is individually validated by class-validator today. This is a pre-existing gap this change does not widen or attempt to fix wholesale; it does mean `maxOutputTokens` needs its own explicit runtime check rather than relying on nested DTO validation that doesn't currently run.
- No generic max-tokens UI control exists: `ChatSettingsConfig`/`ChatSettingsValues` (`libs/conversation-input/src/models/Input.ts:313-363`) expose only `responseFormat`, `systemPrompt`, `temperature`; `DeploymentFeatures` (`libs/chat-shared/src/models/deployment-features.ts:9-17`) gates only those three. Building a new control is out of scope for this change (see proposal Non-Goals).

## Goals / Non-Goals

**Goals:**
- Forward `temperature` on Responses requests, gated on the deployment's actual, already-fetched `features.temperature` capability.
- Introduce a persisted, optional `maxOutputTokens` on `Conversation`/`ConversationResponseDto`, validated and mapped to `max_output_tokens` on the Responses request, independent of any Chat-Completions-only capability flag.
- Reuse the existing deployment-details fetch — zero additional `getDeploymentDetails` calls per generation.
- Keep every hardened terminal-state/error-extraction/status-filtering behavior byte-for-byte unchanged.

**Non-Goals:**
- No UI for editing `maxOutputTokens` (documented follow-up).
- No change to Chat Completions request construction or capability gating.
- No new Responses-specific capability flag invented on the Chat side — Chat only reads flags Core already exposes.
- No nested nx `@ValidateNested()` nested validation for the whole `ConversationResponseDto` — out of scope; would risk rejecting previously-accepted payloads for unrelated fields.

## Decisions

### 1. Retain `features.temperature` alongside the resolved `GenerationApi`

`resolveGenerationApiForDeployment` returns `{ generationApi: GenerationApi; temperatureSupported: boolean }` instead of a bare `GenerationApi`. It still makes exactly one `getDeploymentDetails` call; the only change is that the already-computed `features` object is read once more (`features?.temperature === true`) before being allowed to go out of scope, and the boolean is threaded back to `streamCompletion`. `streamCompletion` passes `temperatureSupported` into `responsesAdapter.buildRequest(...)` alongside the existing `model`/`startConversation`/`messagesForCompletion` params.

Alternative considered — pass the full `features` object through: rejected as broader than needed; `buildRequest` only ever needs the one boolean, and passing the narrowest fact keeps the adapter's public signature self-documenting and avoids leaking the deployment-details shape into the generation adapter layer.

Alternative considered — re-fetch inside `ResponsesAdapter`: rejected per the prompt's explicit "avoid a second deployment-details request" requirement and because `DeploymentsService.getDeploymentDetails` is already cached/user-token-scoped at the `ConversationService` call site — duplicating it inside the adapter would add latency and a second cache-key computation for no new information.

### 2. Temperature is capability-gated; `maxOutputTokens` is not

Temperature is gated because some Responses-capable models reject the field outright (stated in the prompt and consistent with why the flag exists at all in `ModelCapabilitiesDto`). `maxOutputTokens` has no equivalent Core-exposed capability signal today, so gating it behind an unrelated flag (`maxTokensSupported`/`maxCompletionTokensSupported`) would be gating on data that describes a different parameter (Chat Completions'), not this one — the prompt explicitly forbids that substitution. Instead, `max_output_tokens` inclusion is controlled purely by presence/validity of the Chat-side value, mirroring rule 3 in the proposal's Capability and Precedence Rules. If Core later adds a Responses-specific flag, gating can be added as a follow-up without a wire-format change.

### 3. `buildRequest` signature and mapping

```ts
buildRequest(params: {
  model: string;
  startConversation: ConversationResponseDto;
  messagesForCompletion: ConversationMessageDto[];
  temperatureSupported: boolean;
}): ResponsesApiRequestBody
```

- `temperature`: included only when `temperatureSupported === true` and `startConversation.temperature != null` (using `!= null`, not truthiness, so `0` is preserved — mirrors the existing `chat-completions.adapter.ts:84` pattern).
- `max_output_tokens`: included only when `startConversation.maxOutputTokens` passes the validator below; otherwise omitted entirely (never sent as `null`/`0`).
- `ResponsesApiRequestBody` gains `temperature?: number` and `max_output_tokens?: number`, both optional so every existing call site/test that omits them keeps compiling and passing.

### 4. Validation boundary for `maxOutputTokens`: adapter seam, not nested DTO validation

Because `SaveConversationBodyDto` only does `@IsObject()` on the whole `conversation` payload (no nested class-validator today, for any field), adding `@IsOptional() @IsInt() @Min(1)` to `ConversationResponseDto.maxOutputTokens` would document intent and generate a correct OpenAPI schema/type (following the DTO-decorator convention, same as documentation-only decorators already used elsewhere on this class such as `temperature!: number`), but it would not actually run at persistence time given the current save-path validation gap — that gap is pre-existing and out of scope to close here.

The actual enforcement point is therefore the same seam that already defends the outbound wire request against bad Chat-side data: a small pure guard, `isValidMaxOutputTokens(value: unknown): value is number`, checking `Number.isInteger(value) && Number.isSafeInteger(value) && value > 0`, called from `ResponsesAdapter.buildRequest` immediately before conditionally spreading `max_output_tokens` into the request body. This is a TypeScript type-narrowing predicate backed by a real runtime numeric check — not a bare type assertion — satisfying the prompt's explicit requirement. Living in `responses.adapter.ts` (or a small exported helper in `generation.types.ts` next to the interfaces it validates) keeps the check colocated with the one place that can ever emit `max_output_tokens`, so a future second caller can't accidentally skip it.

Alternative considered — upgrade `SaveConversationBodyDto` to `@ValidateNested() @Type(() => ConversationResponseDto)`: rejected as out-of-scope scope creep — it would newly enforce every existing decorator-annotated field on `ConversationResponseDto` (most of which currently have no decorators at all), risking rejecting previously-accepted conversation payloads unrelated to this change, which the prompt's compatibility constraints forbid.

### 5. Persistence-surface enumeration

`maxOutputTokens` needs to survive exactly the surfaces that already carry `temperature` verbatim, because both are plain optional fields on the same `Conversation`/`ConversationResponseDto` object with no field-specific handling elsewhere:

- **Load/save** (`conversation.service.ts:191`, `:846`) — spreads the full DTO; automatically included once the field exists.
- **Duplicate** (`conversation.service.ts:546-553`) — spreads `...sourceData`; automatically included.
- **Import/export** (`apps/chat/src/utils/export-conversation.ts`, `apps/chat/src/utils/import-conversation.ts`) — both are field-agnostic (pass the full object through/rebase IDs and attachment URLs only); automatically included.
- **Overlay** (`OverlayContext.tsx`, `chat-overlay` protocol/manager) — has dedicated per-field bridge methods only for `temperature` (`setTemperature`) and other explicitly modeled settings; there is no generic "set arbitrary conversation field" overlay path, so `maxOutputTokens` is **not** wired into the overlay bridge in this change (no `setMaxOutputTokens` request type is added) — consistent with the proposal's Non-Goals (no new UI/bridge surface) and the prompt's "do not add new... user-visible strings" constraint. It still round-trips correctly through overlay conversation reads that serialize the full object, if any exist; only the interactive *setter* is excluded.
- **Publish** (`conversation-publish.service.ts`) — no field-specific handling at all (resource-relocation only); unaffected either way.

No test is added for a surface that only does generic object spreading and is already covered by an equivalent `temperature` test, per the prompt's "do not duplicate adapter coverage" instruction — one representative round-trip test per genuinely distinct code path (save, duplicate, import/export) is sufficient.

### 6. Merge-conflict avoidance with the hardening change

Since hardening is already merged/archived on this branch's history, there is no live merge risk; this change is authored directly on top of `6d19cbd20`. To keep future rebases low-risk, all new code in `responses.adapter.ts` is additive (new optional params, one new guard function, two new conditional spread clauses in `buildRequest`) and does not touch `relay`, `handleEvent`, or any terminal-state logic. The spec delta targets only the two new/changed requirements (request-construction fields) and leaves every hardening-authored requirement in `responses-api-generation/spec.md` untouched (no `## MODIFIED Requirements` block references any terminal-state requirement).

## Risks / Trade-offs

- **[Risk]** A future Core release adds a genuine Responses-specific max-output-tokens capability flag, making the current "always attempt if present" behavior technically permissive for models that would reject it. → **Mitigation**: documented explicitly in the proposal's Alternatives Considered and this design's Decision 2 as a deliberate, revisitable choice; DIAL Core's own `responsesDefaults`/validation is the current backstop, matching precedence rule 4 in the proposal.
- **[Risk]** `ConversationResponseDto.maxOutputTokens` decorators look like they validate on save but don't (per Decision 4's documented gap). → **Mitigation**: the design explicitly calls this out rather than silently relying on it; the real guard lives in the adapter and is unit-tested directly.
- **[Trade-off]** Not adding a UI control means `maxOutputTokens` is currently only settable by direct API/import payload manipulation, not through the product UI. → Accepted per proposal Non-Goals; tracked as a follow-up.
