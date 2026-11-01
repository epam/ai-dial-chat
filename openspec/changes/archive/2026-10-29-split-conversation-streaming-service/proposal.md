## Why

`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts` is 1036 lines, has seven injected services, and changed 18 times in 60 days. The 2026-10-26 refactoring audit ranks it as backend god module #1. Two of its jobs belong elsewhere.

**1. A second copy of the Chat Completions transport.** `ChatCompletionsAdapter` (`apps/chat-api/src/conversations/generation/chat-completions.adapter.ts`) was extracted "verbatim" for this purpose. It is registered in `conversation.module.ts` but never called. Meanwhile the service still carries its own copy:

- `relayModelCompletion` (`conversation-streaming.service.ts:372-597`);
- the inline request building in `streamCompletion` (`:746-792`);
- a `RelayOutcome` type identical to `GenerationRelayOutcome`.

The two copies have drifted. The live service copy encodes skill URLs (`getEncodedSkills`, a DIAL Core 400 fix), forwards `X-Timezone`, and calls `onChunkApplied`. The adapter does none of that.

The docs and the spec disagree about which copy is live:

- `docs/responses-api-integration.md` calls the adapter "dormant";
- `openspec/specs/responses-api-generation` says generation runs through it ("Chat Completions transport extracted behind the adapter seam").

The adapter's `relay(res)` method is also unused.

**2. Deployment capability resolution.** `resolveGenerationApiForDeployment` and `readDeploymentInterfaces` (`:140-246`, about 107 lines) resolve the generation API and the background mode from deployment details, two feature flags and Core interfaces. They are the only reason the service injects `DeploymentsService` and `FeatureFlagsService`.

This is P1 in the refactoring plan, after `split-background-generation-service`.

## What Changes

The user chose **adopt the adapter** (over deleting it) and **relay + API selector** as the scope (over relay-only or a full decomposition).

- **Bring `ChatCompletionsAdapter` up to the service's current behavior.**
  - `buildRequest` encodes skill URLs and takes the precomputed `configuration`, like `ResponsesAdapter.buildRequest`;
  - `stream` takes `timezone` and `onChunkApplied` in the same parameter order as `ResponsesAdapter.stream`;
  - remove the unused `relay(res)`.
- **Route Chat Completions through the adapter.** `streamCompletion` calls `chatCompletionsAdapter.buildRequest`/`.stream` exactly as it calls the Responses adapter. Delete `relayModelCompletion`, `RelayOutcome`, `getValidAttachments`, `getEncodedSkills` and the inline request body from the service. `ChatCompletionsAdapter` replaces `DialClientService` among the service's dependencies.
- **New `GenerationApiSelector`** (`apps/chat-api/src/conversations/generation/generation-api-selector.service.ts`). It holds `select(sub, model, token)` (formerly `resolveGenerationApiForDeployment`), the interfaces lookup, `SERVER_APP_CONFIG_CONTEXT` and `OPENAI_RESPONSES_INTERFACE`. It owns `DeploymentsService` and `FeatureFlagsService`, and the streaming service injects the selector instead of them. It is registered in `ConversationModule`.
- **Tests.**
  - `conversation-streaming.service.spec.ts` and `completion-persistence.integration.spec.ts` construct the service with real `ChatCompletionsAdapter` and `GenerationApiSelector` instances over the same mocks. Their existing assertions on `sendChatCompletionRequest`, `getDeploymentDetails` and `isEnabled` stay unchanged and become the proof that behavior is preserved.
  - New `chat-completions.adapter.spec.ts` covers the request body (skill encoding, configuration, temperature gate) and headers (`X-Timezone`).
  - New `generation-api-selector.service.spec.ts` covers the selector.
- **Docs.** `docs/responses-api-integration.md` names the adapter as the active Chat Completions path. The `responses-api-generation` delta spec updates two requirements.

Result: the service goes from 1036 lines to 622. It injects eight collaborators instead of seven, but it no longer owns the Chat Completions transport or the feature-flag lookup.

Non-goals:

- extracting the finalize/persist closure or the relay loop from `streamCompletion` (follow-up);
- changing any request, header, chunk, error text, status code or metric;
- touching `ResponsesAdapter` beyond its call site. Its own unused `relay(res)` is kept, because `responses.adapter.spec.ts` drives it; that is recorded as a follow-up.

Acceptance criteria:

- The service contains no `sendChatCompletionRequest`, `relayModelCompletion`, `RelayOutcome`, `getEncodedSkills` or `resolveGenerationApiForDeployment`.
- Its constructor no longer takes `FeatureFlagsService`. `DeploymentsService` (hidden-model check) and `DialClientService` (`watchConversation`) stay.
- Every existing test in `conversation-streaming.service.spec.ts` and the conversation integration specs passes, with only constructor wiring and logger-spy targets changed.
- `npm exec nx test chat-api`, `lint` and `build` pass, as do `validate:specs` and `validate:docs`.

Rollback: revert the commit. Nothing persisted or external changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `responses-api-generation`:
  - "ConversationService resolves generation API before opening the upstream stream": resolution moves to `GenerationApiSelector`;
  - "Chat Completions transport extracted behind the adapter seam": becomes true, with the drifted behaviors (skill encoding, `X-Timezone`, `onChunkApplied`) named, and the service holding no copy.

## Impact

- **Code:**
  - `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`;
  - `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts`;
  - new `generation-api-selector.service.ts`;
  - `apps/chat-api/src/conversations/conversation.module.ts`.
- **Tests:**
  - `streaming/tests/conversation-streaming.service.spec.ts` and `tests/completion-persistence.integration.spec.ts` (constructor wiring);
  - `tests/conversation.controller.integration.spec.ts` (providers);
  - two new specs.
- **Docs:** `docs/responses-api-integration.md`.
- **Unaffected:** endpoints, OpenAPI, the generated client, env vars, the frontend and libs.
