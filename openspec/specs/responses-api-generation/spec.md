### Requirement: Generation API resolver

`resolveGenerationApi` (`apps/chat-api/src/conversations/generation/generation-api.ts`) SHALL be a pure function that takes the resolved deployment `features` object (`{ responsesApi?: boolean }`, as produced by `DeploymentsService.getDeploymentDetails`) and returns a `GenerationApi` string enum value: `Responses = 'responses'` when `features.responsesApi === true`, otherwise `ChatCompletions = 'chat_completions'`. A missing `features` object or a missing/`false` `responsesApi` field SHALL resolve to `ChatCompletions`.

#### Scenario: Responses-capable deployment resolves to Responses

- **WHEN** `resolveGenerationApi({ responsesApi: true })` is called
- **THEN** it returns `GenerationApi.Responses`

#### Scenario: Deployment without the flag resolves to Chat Completions

- **WHEN** `resolveGenerationApi({ responsesApi: false })` or `resolveGenerationApi(undefined)` is called
- **THEN** it returns `GenerationApi.ChatCompletions`

---

### Requirement: ConversationService resolves generation API before opening the upstream stream

`ConversationService.streamCompletion` SHALL call `DeploymentsService.getDeploymentDetails(sub, model, token)` (the existing cached, user-token-scoped lookup already used by the deployment details endpoint) before issuing any upstream generation call, read `features` off the returned `modelDetails`/`applicationDetails` per the resolved `type`, and pass the result through `resolveGenerationApi` to select the adapter. `ConversationModule` SHALL import `DeploymentsModule` to obtain `DeploymentsService`. When `getDeploymentDetails` resolves the target id to `type: 'toolset'`, `streamCompletion` SHALL reject the request with HTTP 400 before any generation call, since a toolset is not a generation deployment.

#### Scenario: Responses-capable model dispatches to the Responses adapter

- **WHEN** a completion request targets a model whose `getDeploymentDetails` result has `features.responsesApi: true`
- **THEN** `streamCompletion` calls the Responses adapter and does not call `sendChatCompletionRequest`

#### Scenario: Responses-capable application dispatches to the Responses adapter

- **WHEN** a completion request targets an application whose `getDeploymentDetails` result has `features.responsesApi: true`
- **THEN** `streamCompletion` calls the Responses adapter and does not call `sendChatCompletionRequest`

#### Scenario: Legacy deployment without the flag keeps using Chat Completions

- **WHEN** a completion request targets a deployment whose `getDeploymentDetails` result has no `responsesApi` field (older Core, or capability not declared)
- **THEN** `streamCompletion` calls `sendChatCompletionRequest` exactly as before this change

#### Scenario: Target resolves to a toolset

- **WHEN** a completion request's `model` resolves via `getDeploymentDetails` to `type: 'toolset'`
- **THEN** the request is rejected with HTTP 400 and no generation call is made

#### Scenario: Capability lookup fails

- **WHEN** `getDeploymentDetails` rejects with a 401/403/404/5xx-mapped exception
- **THEN** `streamCompletion` surfaces the corresponding BFF error and does not call either generation adapter

---

### Requirement: Chat Completions transport extracted behind the adapter seam

The existing SDK `sendChatCompletionRequest` call, request construction from `buildConversationHistory`'s `messages`, and SSE chunk parsing SHALL be extracted verbatim into `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts`, exposing the same normalized chunk stream contract as the Responses adapter. This extraction SHALL NOT change any request sent to DIAL Core nor any chunk delivered to `apply-chunk.server.ts`.

#### Scenario: Chat Completions behavior is unchanged after extraction

- **WHEN** an existing Chat Completions integration test exercises `streamCompletion` for a non-Responses deployment
- **THEN** the outbound DIAL Core request and the resulting `StreamChunk` sequence are identical to the pre-change behavior

---

### Requirement: Responses request built from existing conversation history

`responses.adapter.ts` (`apps/chat-api/src/conversations/generation/responses.adapter.ts`) SHALL build the Responses request from the same `buildConversationHistory` result used by the Chat Completions path: each history message becomes an `input` item carrying its `role` and text `content`, in order, with the system/instruction message kept as the first `input` item. The request SHALL set `stream: true` and `store: false`, and SHALL NOT set `previous_response_id` or `conversation` (neither key, nor a `null` value, since DIAL Core rejects the key's mere presence).

#### Scenario: Full turn history sent as input

- **WHEN** a conversation has a system message and three prior turns
- **THEN** the Responses request `input` array contains one item per message, in original order, with no `previous_response_id` or `conversation` field present

#### Scenario: store is always false in this iteration

- **WHEN** any Responses request is built by this adapter
- **THEN** the request body has `store: false`

---

### Requirement: SDK createResponse call and cast isolation

`responses.adapter.ts` SHALL call `this.dialClient.client.createResponse({ body: responsesRequest as never, headers: { ...bearer auth headers, Accept: 'text/event-stream', ...optional X-DIAL-CLIENT-CHANNEL-ID }, parseAs: 'stream', signal })`. The `as never` cast SHALL be confined to this single call site; the function's return value SHALL be converted immediately to the locally defined types in `generation.types.ts` before being passed to any caller.

#### Scenario: Cast does not leak past the adapter

- **WHEN** `ConversationService` or `apply-chunk.server.ts` consumes output from `responses.adapter.ts`
- **THEN** the consumed value is typed via `generation.types.ts`, with no `as never`/`any` in the calling code

---

### Requirement: Responses SSE events normalized into the existing StreamChunk contract

`responses.adapter.ts` SHALL translate the following Responses SSE event types into the existing `StreamChunk` (`chat.completion.chunk`) shape consumed by `apply-chunk.server.ts` and the frontend, and SHALL NOT forward raw `event: response.*` frames to the browser:

- `response.created` → record the upstream-rewritten `response.id` for later use as `message.responseId`; MAY emit a chunk carrying `delta.responseId`.
- `response.output_text.delta` → emit a `StreamChunk` with `choices[0].delta.content` set to `event.delta`.
- `response.completed` → validate `response.status`; if terminal-success, emit the final compatible chunk (mirroring the Chat Completions terminal chunk shape) followed by `[DONE]`; persist `message.responseId` from `response.id`.
- `response.incomplete` → finalize the generation the same way an in-progress error/stop is finalized today: save the partial assistant message accumulated so far via the existing `backend-owned-generation-persistence` partial-save path, setting the terminal-error signal.
- An in-band `error` event or an error payload embedded in another event → terminate the stream via the existing stream-error path (no Chat Completions retry).
- Any other event `type` → skip without forwarding to the browser; count it by `event.type` in metrics; MUST NOT log event content or prompt/response text.

#### Scenario: Text deltas assemble into the assistant message

- **WHEN** the upstream Responses stream emits a `response.created` event followed by several `response.output_text.delta` events and a terminal `response.completed`
- **THEN** the assembled assistant message content is the in-order concatenation of the delta text, and the conversation is saved with `message.responseId` set to the DIAL `response.id`

#### Scenario: response.incomplete preserves partial text as an error

- **WHEN** the upstream stream emits several `response.output_text.delta` events followed by `response.incomplete`
- **THEN** the backend saves the partial assistant message accumulated so far with the terminal-error signal set, matching `backend-owned-generation-persistence`'s existing partial-save-on-error behavior

#### Scenario: In-band error event ends the stream without a Completions retry

- **WHEN** the upstream Responses stream emits an `error` event before any terminal event
- **THEN** the generation ends via the existing stream-error path, and `sendChatCompletionRequest` is never called for that request

#### Scenario: Unknown event type does not break the stream

- **WHEN** the upstream Responses stream emits an event whose `type` is not in the handled allowlist
- **THEN** the adapter continues processing subsequent events, the unknown event is not forwarded to the browser, and only its `type` (never its payload) is recorded for metrics

---

### Requirement: No automatic fallback after a Responses call has started

Once `responses.adapter.ts` has issued the `createResponse` call, a subsequent 4xx/5xx response or an in-stream error SHALL terminate the attempt as an error through the existing stream-error path. The system SHALL NOT automatically retry the same generation through the Chat Completions adapter.

#### Scenario: Upstream 5xx during a Responses call is not retried via Chat Completions

- **WHEN** `createResponse` returns a 5xx response
- **THEN** the generation ends with an error, and no Chat Completions request is made for that same generation attempt

---

### Requirement: message.responseId carries the DIAL Responses id for diagnostics

`ConversationMessageDto` (or the equivalent assistant message shape saved by `ConversationService`) SHALL accept an optional `responseId: string` field, populated from the DIAL `response.id` on a Responses-routed generation's `response.created`/`response.completed` events, and left unset for Chat Completions-routed generations.

#### Scenario: responseId present only for Responses-routed messages

- **WHEN** a generation is routed through the Responses adapter and completes successfully
- **THEN** the saved assistant message has `responseId` set to the DIAL `response.id`

#### Scenario: responseId absent for Chat Completions-routed messages

- **WHEN** a generation is routed through the Chat Completions adapter
- **THEN** the saved assistant message has no `responseId` field set
