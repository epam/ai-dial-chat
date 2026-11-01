Slicing: vertical. Each slice leaves `chat-api` green before the next starts.

1. Make the dormant adapter behave like the live copy.
2. Switch `streamCompletion` to it and delete the copy.
3. Move capability resolution behind `GenerationApiSelector`.
4. Docs.

Every move keeps request bodies, headers, chunks, error texts, status codes, log message texts and metrics identical. Backend conventions: `apps/chat-api/AGENTS.md`. All paths are under `apps/chat-api/src/conversations/`. No endpoint, DTO, OpenAPI or env change.

## 1. Adapter parity

- [x] 1.1 In `generation/chat-completions.adapter.ts`, port `getEncodedSkills` (with its block comment) from `streaming/conversation-streaming.service.ts` next to `getValidAttachments`, and use it in `buildRequest`.
- [x] 1.2 Change `ChatCompletionsAdapter.buildRequest` params to `{ startConversation, messagesForCompletion, temperatureSupported, configuration }` (design D2). Drop its internal `configuration` recomputation and the now-unused `customContent` param.
- [x] 1.3 Replace `ChatCompletionsAdapter.stream`'s signature and body with the service's `relayModelCompletion` (design D3). It gains `timezone` and `onChunkApplied`, with parameter order identical to the service method. Delete `ChatCompletionsAdapter.relay` and the imports only it used.
- [x] 1.4 Add `generation/chat-completions.adapter.spec.ts`. Test names describe behavior. Cases:
  - `buildRequest` encodes a skill URL containing a space;
  - it uses the passed `configuration` as `custom_fields.configuration`;
  - it forwards `temperature` only when `temperatureSupported` is true;
  - it drops `status` messages, `stages` and invalid attachments;
  - `stream` sends `X-Timezone` only when given;
  - `stream` calls `onChunkApplied` with each applied chunk;
  - a non-2xx response returns `outcome: 'rejected'` with the DIAL error text.

Verification: `npm run test:file -- apps/chat-api/src/conversations/generation/chat-completions.adapter.spec.ts`

## 2. Route Chat Completions through the adapter

- [x] 2.1 Inject `ChatCompletionsAdapter` into `ConversationStreamingService`. In `streamCompletion`:
  - build `requestBody` with `chatCompletionsAdapter.buildRequest({ startConversation, messagesForCompletion, temperatureSupported, configuration })`;
  - call `chatCompletionsAdapter.stream(...)` where `this.relayModelCompletion(...)` was called;
  - keep the `streamCompletion sending N message(s)` debug log with the same count (non-`status` messages, system prompt excluded); counting the built body's `messages` would add the system prompt and change the log text.
- [x] 2.2 Delete `relayModelCompletion`, `RelayOutcome`, `getValidAttachments`, `getEncodedSkills` and the inline `dialMessages`/`systemMessages`/`requestBody` code from the service. Type the relay with `GenerationRelayOutcome`. Remove the imports that become unused.
- [x] 2.3 Wire the real adapter into the tests:
  - `streaming/tests/conversation-streaming.service.spec.ts`: both `new ConversationStreamingService(` sites get `new ChatCompletionsAdapter(mockDialClient)`;
  - `tests/completion-persistence.integration.spec.ts`: the same.

  No assertion changes. The two rejection-log sanitization cases spy on the adapter's logger instead of the service's (the line moved with the relay), and the timezone-never-logged case spies on both.

Verification:

- `npm run test:file -- apps/chat-api/src/conversations/streaming/tests/conversation-streaming.service.spec.ts`
- the two `apps/chat-api/src/conversations/tests/*.integration.spec.ts` files that construct or provide the service

## 3. GenerationApiSelector

- [x] 3.1 Add `GenerationApiSelection` (the `{ generationApi, isBackground, temperatureSupported, reasoningEfforts? }` result) to `generation/generation.types.ts` with JSDoc.
- [x] 3.2 Create `generation/generation-api-selector.service.ts`:
  - `@Injectable() GenerationApiSelector` with `select(sub, model, token): Promise<GenerationApiSelection>`;
  - a private interfaces lookup, `SERVER_APP_CONFIG_CONTEXT` and `OPENAI_RESPONSES_INTERFACE`, all moved verbatim from the service (design D4);
  - `Logger(GenerationApiSelector.name)`.

  Register it in `conversation.module.ts` providers.
- [x] 3.3 In the service, inject `GenerationApiSelector` and call `select(...)` where `resolveGenerationApiForDeployment` was called. Delete the two private methods and the two constants. Drop `FeatureFlagsService` from the constructor (design D6). `DeploymentsService` stays for `assertModelNotHidden` and `DialClientService` for `watchConversation`.
- [x] 3.4 Wire tests:
  - pass `new GenerationApiSelector(mockDeploymentsService, mockFeatureFlagsService)` at the same construction sites as 2.3;
  - add `GenerationApiSelector` to the providers in `tests/conversation.controller.integration.spec.ts`.
- [x] 3.5 Add `generation/generation-api-selector.service.spec.ts`. Cases:
  - a toolset is rejected with `BadRequestException` before any flag matters;
  - the flag being off forces `ChatCompletions` while `getDeploymentDetails` is still called;
  - flag on with `responsesApi` gives `Responses`;
  - background is chosen only with both flags and the `openaiResponses` interface;
  - an interfaces lookup failure yields `isBackground: false`;
  - `temperatureSupported` and `reasoningEfforts` come from the same `features`.

Verification:

- `npm run test:file -- apps/chat-api/src/conversations/generation/generation-api-selector.service.spec.ts`
- the streaming service spec and the integration specs from section 2

## 4. Docs and close

- [x] 4.1 In `docs/responses-api-integration.md`:
  - replace "The active Chat Completions relay remains in `ConversationStreamingService.relayModelCompletion`; the dormant `ChatCompletionsAdapter` refactor is not used for runtime dispatch" with the adapter being the active path;
  - point the `X-Timezone` path list at `ChatCompletionsAdapter.stream`;
  - mention `GenerationApiSelector` where generation-API selection is described.
- [x] 4.2 Confirm `conversation-streaming.service.ts` contains no `sendChatCompletionRequest`, `relayModelCompletion`, `RelayOutcome`, `getEncodedSkills` or `resolveGenerationApiForDeployment`. Record its new line count and constructor in the PR.
- [x] 4.3 `npm exec nx test chat-api`, `npm exec nx lint chat-api` and `npm exec nx build chat-api` pass. Run `npm run validate:specs` and `npm run validate:docs`.

## 5. Follow-ups (out of scope)

- [ ] 5.1 Propose extracting the finalize/persist closure and the relay loop from `streamCompletion` into a generation runner.
- [ ] 5.2 Re-point the `ResponsesAdapter.relay(res)` cases in `generation/responses.adapter.spec.ts` at `stream`, then delete `relay`.
