## 1. Deployments list capability metadata

- [x] 1.1 Add `responsesApi?: boolean` and `chatCompletion?: boolean` to `RawDeploymentFeaturesDto` (`apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`), mapped defensively from `features.responses_api` / `features.chat_completion`.
- [x] 1.2 Add the same two fields with `@ApiProperty` to `DeploymentFeaturesDto` (`apps/chat-api/src/deployments/dto/deployment-item.dto.ts`).
- [x] 1.3 Update `mapToDeploymentItem` (`apps/chat-api/src/deployments/deployments.service.ts`) to copy the two flags through, alongside the existing `mcp` flag mapping.
- [x] 1.4 Add/extend `deployments.service.spec.ts` unit tests: model/application with `responses_api: true`, item with `chat_completion: true`, item with neither field (both omitted/undefined).
- [x] 1.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` for this slice.

## 2. Generation API resolver and adapter scaffolding

- [x] 2.1 Create `apps/chat-api/src/conversations/generation/generation-api.ts` with the `GenerationApi` enum (`Responses = 'responses'`, `ChatCompletions = 'chat_completions'`) and the pure `resolveGenerationApi(features?: { responsesApi?: boolean })` function.
- [x] 2.2 Create `apps/chat-api/src/conversations/generation/generation.types.ts` with local types for the Responses request shape, the handled Responses SSE event types (`response.created`, `response.output_text.delta`, `response.completed`, `response.incomplete`, error events), and the normalized chunk output type shared by both adapters.
- [x] 2.3 Unit test `resolveGenerationApi`: `responsesApi: true` → `Responses`; `responsesApi: false` → `ChatCompletions`; `undefined` features → `ChatCompletions`.

## 3. Extract the Chat Completions transport behind the adapter seam

- [x] 3.1 Extract the current `sendChatCompletionRequest` call, request construction, and SSE parsing out of `ConversationService`/`relayModelCompletion` into `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts`, preserving behavior exactly (same request built from `buildConversationHistory`, same chunk parsing).
- [x] 3.2 Update `ConversationService` to call the extracted adapter and confirm no request/response behavior changed.
- [x] 3.3 Run existing `conversation.service.spec.ts` / `conversation.controller.integration.spec.ts` and confirm all pre-existing Chat Completions tests stay green.

## 4. Wire deployment capability resolution into streamCompletion

- [x] 4.1 Add `DeploymentsModule` to `ConversationModule`'s imports.
- [x] 4.2 Update `ConversationController.streamCompletion` to pass the authenticated `sub` (from `SessionUser`) through to `ConversationService`.
- [x] 4.3 In `ConversationService.streamCompletion`, call `DeploymentsService.getDeploymentDetails(sub, model, token)` before opening the upstream stream; read `features` from `modelDetails`/`applicationDetails` per `type`; reject with HTTP 400 when `type === 'toolset'`.
- [x] 4.4 Call `resolveGenerationApi(features)` and dispatch to `chat-completions.adapter.ts` or `responses.adapter.ts` accordingly.
- [x] 4.5 Unit/service tests: Responses-capable model dispatches to Responses adapter only; Responses-capable application dispatches to Responses adapter only; deployment without the flag (or old Core payload without either flag) dispatches to Chat Completions only; toolset target → 400, no generation call; `getDeploymentDetails` 401/403/404/5xx → corresponding BFF error, no generation call made.

## 5. Responses adapter — request mapping

- [x] 5.1 Implement `responses.adapter.ts`'s request builder: map `buildConversationHistory`'s messages to Responses `input` items (role + text content, in order, system/instruction message first), set `stream: true`, `store: false`, and never send `previous_response_id` or `conversation` (not even `null`).
- [x] 5.2 Implement the SDK call: `this.dialClient.client.createResponse({ body: responsesRequest as never, headers: {...bearer auth, Accept: 'text/event-stream', optional X-DIAL-CLIENT-CHANNEL-ID}, parseAs: 'stream', signal })`, converting the result to `generation.types.ts` types immediately; confirm the `as never` cast does not appear anywhere outside this file.
- [x] 5.3 Unit tests: full history mapped to `input` in order with no `previous_response_id`/`conversation` keys; `store: false` always set.

## 6. Responses adapter — SSE normalization

- [x] 6.1 Implement the Responses SSE parser and normalize `response.created` (record `response.id`, optionally emit `delta.responseId`), `response.output_text.delta` (emit `choices[0].delta.content`), `response.completed` (validate status, emit terminal chunk + `[DONE]`, set `message.responseId`).
- [x] 6.2 Implement `response.incomplete` handling: finalize via the existing partial-save-on-error path with the terminal-error signal set, preserving already-accumulated text.
- [x] 6.3 Implement in-band `error` event handling: terminate via the existing stream-error path; confirm no automatic Chat Completions retry occurs.
- [x] 6.4 Implement unknown-event handling: skip without forwarding to the browser, count by `event.type` in metrics, never log event content.
- [x] 6.5 Add `responseId?: string` to the assistant message DTO/shape saved by `ConversationService`, populated only for Responses-routed generations.
- [x] 6.6 Unit tests covering the full event-normalization test matrix: text deltas assemble correctly; `response.incomplete` preserves partial text as an error; in-band error ends the stream without a Completions retry; unknown event type doesn't break the stream and isn't logged with payload; `responseId` present only for Responses-routed messages and absent for Chat Completions-routed ones.

## 7. Parity and observability

- [x] 7.1 Confirm stop (`POST /completions/stop`) and `AbortController` correctly close a Responses-mode foreground stream, saving the partial message the same way Chat Completions stop does today.
- [x] 7.2 Confirm the `409` concurrent-generation guard (`generation-registry`) behaves identically regardless of which adapter is in use.
- [x] 7.3 Add safe observability (no prompt/response content): generation API used (`responses`/`chat_completions`), deployment id/type, capability resolution outcome, upstream status, terminal outcome (`completed`/`incomplete`/`error`/`aborted`), unknown-event-type counts, time-to-first-delta and total stream duration.
- [x] 7.4 Unit/integration test: user stop during a Responses generation aborts the upstream call and saves the partial message as stopped.

## 8. Integration tests and full test matrix

- [x] 8.1 Add/extend `conversation.controller.integration.spec.ts` (supertest) covering: Responses-capable model → only `createResponse` invoked; Responses-capable application → only `createResponse` invoked; `responsesApi=false`/absent → only `sendChatCompletionRequest` invoked; legacy metadata payload without either flag → Chat Completions; both flags `false` → Chat Completions.
- [x] 8.2 Confirm all pre-existing Chat Completions integration tests still pass unmodified.
- [x] 8.3 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, and `npm exec nx build chat-api` for the full change.
- [x] 8.4 Run `npm run openapi` and `npm run openapi:check`. 

## 9. Documentation

- [x] 9.1 Update any affected doc under `docs/` that describes the completion/generation flow to mention the dual-mode routing (per `AGENTS.md`'s "update docs in the same commit" rule), if such a doc exists.
