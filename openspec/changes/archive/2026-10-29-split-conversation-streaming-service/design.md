## Context

`ConversationStreamingService` (see proposal) still owns two things the codebase already has a seam for.

**The Chat Completions transport.** `ChatCompletionsAdapter` exists and is registered, but nothing calls it. The service's `relayModelCompletion` and inline request building are the live copy. A line diff of the two relays shows exactly three differences, all on the service side:

- the `X-Timezone` header;
- the `onChunkApplied?.(parsed, assembledMessage)` call;
- `getEncodedSkills` in the request body.

Everything else is line-identical, including the `outcome` union, which matches `GenerationRelayOutcome`. `ResponsesAdapter.stream` already takes `timezone` and an `onChunkApplied` callback, so the target shape exists next door.

**Capability resolution.** It needs `DeploymentsService`, `FeatureFlagsService`, `GenerationApi`/`resolveGenerationApi` and the Core `interfaces` lookup. Its behavior is pinned by about 15 tests in `conversation-streaming.service.spec.ts` that assert on `getDeploymentDetails`/`getDeploymentInterfaces`/`isEnabled` mocks.

## Goals / Non-Goals

**Goals:** one copy of the Chat Completions transport; `streamCompletion` dispatching to two symmetric adapters; capability resolution behind one injectable; existing tests unchanged as characterization.

**Non-Goals:** splitting the finalize/persist closure or the relay loop; changing `ResponsesAdapter`; changing any observable request, response, error or metric.

## Decisions

**D1. Adopt the adapter rather than delete it.** The adapter seam is what the spec already describes, and it makes the two generation APIs symmetric at the call site. The work is mechanical: port three small drifts into the adapter, then delete the service copy. **Rejected:** deleting the adapter and moving the service copy to a new module. That gives the same line savings but leaves an asymmetric dispatch and a spec to rewrite. This was the user's choice.

**D2. `ChatCompletionsAdapter.buildRequest` takes `configuration`.** `streamCompletion` already computes `configuration` once and hands it to `ResponsesAdapter.buildRequest`. The adapter takes it as a parameter too, so both adapters get the same value. The adapter's own recomputation from `customContent` is dropped. The params become `{ startConversation, messagesForCompletion, temperatureSupported, configuration }`. `getValidAttachments` and `getEncodedSkills` move with it, as module-level helpers in the adapter file, and keep the service's block comment on why skill paths are encoded at this boundary.

**D3. `ChatCompletionsAdapter.stream` mirrors `ResponsesAdapter.stream`'s parameter order.** The order is `(model, requestBody, token, signal, initialAssembledMessage, clientChannelId, timezone, timing, conversationId, onChunkApplied, jobTitle)`, the same order `relayModelCompletion` uses today, so the call site changes only its receiver. The body is the service's `relayModelCompletion` body, which is the newer one. Log prefixes stay `relayModelCompletion …` so existing log searches keep working; this is noted in a code comment. The unused `relay(res)` is deleted.

**D4. `GenerationApiSelector` is a NestJS `@Injectable()` in `generation/`.** The name avoids colliding with the pure `resolveGenerationApi` and its "Generation API resolver" requirement. The method is `select(sub, model, token): Promise<GenerationApiSelection>`. The result type `{ generationApi, isBackground, temperatureSupported, reasoningEfforts? }` becomes an exported interface in `generation/generation.types.ts`. The private interfaces lookup moves with it unchanged: any failure means "not background" and is logged. `SERVER_APP_CONFIG_CONTEXT` and `OPENAI_RESPONSES_INTERFACE` move into the selector file. The selector logs with its own `Logger(GenerationApiSelector.name)`, and the debug message text stays identical. `BadRequestException` for toolsets is thrown from the selector. `streamCompletion` already maps a selector rejection exactly as it mapped the private method's (`generationService.error` + rethrow), so status codes do not change.

**D5. Tests construct real collaborators over existing mocks.** In `conversation-streaming.service.spec.ts` (two `new ConversationStreamingService(` sites) and `completion-persistence.integration.spec.ts`, pass `new ChatCompletionsAdapter(mockDialClient)` and `new GenerationApiSelector(mockDeploymentsService, mockFeatureFlagsService)`. No assertion changes. **Rejected:** mocking the new collaborators. That would delete the behavioral proof this refactor depends on. New focused specs cover each unit directly. Selector tests may be moved out of the streaming spec only where a block tests resolution alone; otherwise they stay as integration coverage.

**D6. The streaming service's constructor loses `FeatureFlagsService`.** It becomes `(dialClient, generationService, persistenceService, deploymentsService, responsesAdapter, chatCompletionsAdapter, generationApiSelector, backgroundGeneration)`. `DeploymentsService` stays because `assertModelNotHidden` needs it before selection, and `DialClientService` stays because `watchConversation` calls `subscribeToResources`.

## Risks / Trade-offs

- **[Risk] A subtle difference between the two relay copies that the diff missed.** → Mitigation: the adapter's new `stream` body is copied from the service, not the reverse, and the existing service spec (28 `sendChatCompletionRequest` assertions) runs unchanged against it.
- **[Risk] Log-based alerts keyed on the `ConversationStreamingService` logger context.** → Mitigation: keep the message texts. The logger context changes to `ChatCompletionsAdapter` / `GenerationApiSelector`; this is called out in the PR.
- **[Risk] Nest DI order.** → Mitigation: register `GenerationApiSelector` in `ConversationModule.providers`. `ChatCompletionsAdapter` is already registered. Covered by `conversation.controller.integration.spec.ts` and the `chat-api` build.
- **[Trade-off]** `streamCompletion` stays long (about 330 lines) until the finalize/relay-loop follow-up.

## Migration Plan

Single PR, three vertical slices (adapter parity → switch and delete → selector). Each slice leaves `chat-api` green. Rollback is a revert.

## Open Questions

None blocking. Follow-ups: extract finalize/persist and the relay loop from `streamCompletion`; delete `ResponsesAdapter.relay(res)` once its spec cases are re-pointed at `stream`.
