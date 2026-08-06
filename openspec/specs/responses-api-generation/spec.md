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

The same `features` lookup used to resolve the generation API SHALL also be used to determine whether the resolved deployment explicitly supports the `temperature` parameter (`features.temperature === true`). `ConversationService` SHALL make no additional `getDeploymentDetails` (or equivalent deployment-details) call for this purpose — the boolean SHALL be derived from the `features` object already read while resolving `GenerationApi`, and passed through to whichever adapter's `buildRequest` is invoked for that generation.

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

#### Scenario: Temperature capability is derived from the same lookup used for generation-API resolution

- **WHEN** a completion request targets a Responses-capable deployment whose `getDeploymentDetails` result has `features.temperature: true`
- **THEN** `streamCompletion` passes `temperatureSupported: true` to `ResponsesAdapter.buildRequest` without issuing a second `getDeploymentDetails` call for that generation

#### Scenario: Missing or false temperature capability is derived without a duplicate lookup

- **WHEN** a completion request targets a Responses-capable deployment whose `getDeploymentDetails` result has `features.temperature: false` or no `temperature` field
- **THEN** `streamCompletion` passes `temperatureSupported: false` to `ResponsesAdapter.buildRequest` without issuing a second `getDeploymentDetails` call for that generation

---

### Requirement: Chat Completions transport extracted behind the adapter seam

The existing SDK `sendChatCompletionRequest` call, request construction from `buildConversationHistory`'s `messages`, and SSE chunk parsing SHALL be extracted verbatim into `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts`, exposing the same normalized chunk stream contract as the Responses adapter. This extraction SHALL NOT change any request sent to DIAL Core nor any chunk delivered to `apply-chunk.server.ts`.

#### Scenario: Chat Completions behavior is unchanged after extraction

- **WHEN** an existing Chat Completions integration test exercises `streamCompletion` for a non-Responses deployment
- **THEN** the outbound DIAL Core request and the resulting `StreamChunk` sequence are identical to the pre-change behavior

---

### Requirement: Responses request built from existing conversation history

`responses.adapter.ts` (`apps/chat-api/src/conversations/generation/responses.adapter.ts`) SHALL build the Responses request from the same `buildConversationHistory` result used by the Chat Completions path: each history message becomes an `input` item carrying its `role` and text `content`, in order, with the system/instruction message kept as the first `input` item. Messages whose `role` is `ConversationMessageRole.Status` (internal Chat-owned bookkeeping markers, e.g. model-changed) SHALL be excluded from the `input` array before the remaining messages are mapped, matching the equivalent filtering already applied by `chat-completions.adapter.ts`; the relative order of all remaining messages SHALL be preserved. The request SHALL set `stream: true` and `store: false`, and SHALL NOT set `previous_response_id` or `conversation` (neither key, nor a `null` value, since DIAL Core rejects the key's mere presence).

#### Scenario: Full turn history sent as input

- **WHEN** a conversation has a system message and three prior turns
- **THEN** the Responses request `input` array contains one item per message, in original order, with no `previous_response_id` or `conversation` field present

#### Scenario: store is always false in this iteration

- **WHEN** any Responses request is built by this adapter
- **THEN** the request body has `store: false`

#### Scenario: Internal status messages are excluded from the input array

- **WHEN** the conversation history passed to `buildRequest` contains one or more messages with `role: ConversationMessageRole.Status` interleaved among user/assistant messages
- **THEN** the built `input` array omits every `Status`-role message, and the remaining user and assistant messages keep their original relative order

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
- `response.completed` → validate `response.status`; if terminal-success (`status` absent or `'completed'`), record an explicit success terminal signal, emit the final compatible chunk (mirroring the Chat Completions terminal chunk shape), and persist `message.responseId` from `response.id`; if `status` is present and not `'completed'`, record an explicit stream-error terminal signal instead — this generation SHALL NOT be treated as successful.
- `response.failed` → record an explicit terminal-error signal. Extract a human-readable message from `response.error` using the repository's established DIAL error-extraction conventions (`extractDialErrorMessage`); fall back to a stable generic message when no usable text is available. Preserve any assistant text assembled from prior `response.output_text.delta` events. SHALL NOT be counted as an unknown event, SHALL NOT cause a downstream `data: [DONE]` write, and SHALL NOT trigger a Chat Completions retry.
- `response.incomplete` → finalize the generation the same way an in-progress error/stop is finalized today: record an explicit terminal-error signal and save the partial assistant message accumulated so far via the existing `backend-owned-generation-persistence` partial-save path.
- An in-band `error` event or an error payload embedded in another event → record an explicit terminal-error signal and terminate the stream via the existing stream-error path (no Chat Completions retry).
- Any other event `type` → skip without forwarding to the browser; count it by `event.type` in metrics; MUST NOT log event content or prompt/response text; MUST NOT be treated as a terminal signal of any kind.

A downstream-compatibility `[DONE]` marker (`data: [DONE]`) SHALL be accepted only as a backward-compatibility signal for legacy or non-standard upstreams, not as part of the canonical DIAL Core Responses contract (Core's canonical stream ends in `response.completed` or `response.incomplete` and does not append `[DONE]`). Observing `[DONE]` SHALL record an explicit success terminal signal only when no terminal signal (success or error) has already been recorded for that stream; it SHALL NOT override an earlier `response.failed`, `response.incomplete`, in-band `error`, or invalid-status `response.completed` signal.

The upstream socket closing (end of stream) SHALL NOT by itself imply successful generation. If the stream ends — whether by socket EOF or by a `[DONE]` marker — without an explicit success terminal signal having been recorded (i.e. without a valid `response.completed` or, for legacy streams, an unpreceded `[DONE]`), the adapter SHALL return an error outcome, using a stable generic error message that does not expose prompt or response content, and SHALL preserve any assistant text assembled so far. The adapter SHALL NOT write a downstream `data: [DONE]` frame for any stream that resolves to an error outcome under this requirement.

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
- **THEN** the adapter continues processing subsequent events, the unknown event is not forwarded to the browser, only its `type` (never its payload) is recorded for metrics, and no terminal signal is recorded from it

#### Scenario: response.failed before any text returns an error outcome

- **WHEN** the upstream Responses stream emits `response.failed` as its first event
- **THEN** the adapter returns an error outcome, no downstream `data: [DONE]` is written, and no Chat Completions retry occurs

#### Scenario: response.failed after text deltas preserves partial text

- **WHEN** the upstream Responses stream emits several `response.output_text.delta` events followed by `response.failed`
- **THEN** the returned error outcome's assembled message contains the in-order concatenation of the delta text received before the failure

#### Scenario: response.failed message extraction does not log the event payload

- **WHEN** `response.failed` carries a structured `response.error.message`
- **THEN** the extracted message is used as the error outcome's message, and no log statement contains the raw event payload

#### Scenario: response.failed is not recorded as an unknown event

- **WHEN** the upstream Responses stream emits `response.failed`
- **THEN** `generation.responses.unknown_events` is not incremented for that event

#### Scenario: Canonical Core stream completes on response.completed alone

- **WHEN** a Core-shaped SSE stream (containing both `event:` and `data:` lines) ends in a valid `response.completed` event and never sends `data: [DONE]`
- **THEN** the adapter returns a completed outcome without requiring a `[DONE]` marker

#### Scenario: Legacy [DONE] stream still completes when no error was observed

- **WHEN** a legacy-compatible upstream stream sends only `response.output_text.delta` events followed by `data: [DONE]`, with no `response.completed`, `response.failed`, `response.incomplete`, or `error` event
- **THEN** the adapter returns a completed outcome

#### Scenario: [DONE] does not override an earlier error terminal signal

- **WHEN** the upstream stream emits `response.failed` (or `response.incomplete`, or an in-band `error`, or a `response.completed` with a non-`completed` status) and is later followed by `data: [DONE]`
- **THEN** the adapter still returns an error outcome for that stream

#### Scenario: response.completed with a non-completed status remains an error

- **WHEN** `response.completed` is received with `response.status` set to a value other than `'completed'`
- **THEN** the adapter returns an error outcome and does not treat the stream as successful

#### Scenario: Socket close after text deltas but before any terminal signal is an error

- **WHEN** the upstream socket closes after one or more `response.output_text.delta` events with no `response.completed`, `response.failed`, `response.incomplete`, `error`, or `[DONE]` observed
- **THEN** the adapter returns an error outcome, preserves the partial assistant text assembled so far, and does not write a downstream `data: [DONE]` frame

#### Scenario: Socket close before any event is an error

- **WHEN** the upstream socket closes before any SSE event is received
- **THEN** the adapter returns an error outcome with a stable generic message that does not reference prompt or response content

---

### Requirement: Non-2xx Responses request error message preserves DIAL Core's message

When `createResponse` resolves to a non-2xx (or otherwise non-OK) response, `responses.adapter.ts` SHALL extract an error message in the following order and return it through `GenerationRelayOutcome.errorMessage`:

1. The SDK-parsed error value (`dialResult.error`), via `extractDialErrorMessage`, when it yields a non-empty message — including when the SDK exposes a plain string rather than a structured object.
2. Only when step 1 yields nothing, and only when the raw response body can still be safely read: attempt structured JSON extraction of the raw body via `extractDialErrorMessage(JSON.parse(rawBody))`.
3. Only when steps 1 and 2 yield nothing and the raw body is non-empty: treat the sanitized raw body text itself as the error message.
4. When the raw body is empty and steps 1–2 yielded nothing, `errorMessage` SHALL remain an empty string (existing generic-fallback behavior for the frontend to localize).

Any extracted message used in a log statement SHALL be sanitized per the repository's established log-sanitization conventions (`StringUtils.sanitizeForLog`). Logs SHALL include only the response status and the sanitized extracted message — never the complete SDK result, the full response body, the request body, the auth token, the prompt, generated text, or an unknown-event payload.

#### Scenario: SDK-parsed error message is returned

- **WHEN** `createResponse` resolves non-2xx and the SDK's parsed `error` value yields a non-empty message via `extractDialErrorMessage`
- **THEN** `GenerationRelayOutcome.errorMessage` is that SDK-parsed message, and the raw response body is not read

#### Scenario: Raw-body extraction is used only as a fallback

- **WHEN** `createResponse` resolves non-2xx and the SDK's parsed `error` value yields no usable message
- **THEN** the adapter reads the raw response body and attempts structured JSON extraction before falling back to plain text

#### Scenario: Plain-text non-2xx body is preserved when the SDK gives nothing usable

- **WHEN** `createResponse` resolves non-2xx with a non-empty, non-JSON plain-text body (for example, `Upstream is missing required id`) and the SDK's parsed `error` value yields no usable message
- **THEN** `GenerationRelayOutcome.errorMessage` equals the sanitized raw body text

#### Scenario: Empty non-2xx body preserves the generic fallback

- **WHEN** `createResponse` resolves non-2xx with an empty response body and the SDK's parsed `error` value yields no usable message
- **THEN** `GenerationRelayOutcome.errorMessage` is an empty string

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

---

### Requirement: Responses request forwards conversation temperature only when explicitly supported

`ResponsesAdapter.buildRequest` SHALL accept a `temperatureSupported: boolean` parameter, computed by `ConversationService` from the deployment `features` already fetched to resolve the generation API. The built `ResponsesApiRequestBody` SHALL include an optional `temperature: number` field set to `startConversation.temperature` only when `temperatureSupported === true` AND `startConversation.temperature` is not `null`/`undefined`. Presence SHALL be checked with a nullish check, not a truthiness check, so that `temperature: 0` is preserved. The field SHALL be omitted entirely — never sent as `null`, `undefined`, or a substituted default — when `temperatureSupported` is `false`, when it was not determined (absent capability), or when the conversation has no usable value. `ResponsesAdapter` SHALL NOT read a default temperature from any frontend constant, environment variable, or DIAL Core configuration, and SHALL NOT alter `ChatCompletionsAdapter.buildRequest`'s existing unconditional temperature forwarding.

#### Scenario: Supported deployment forwards a zero temperature exactly

- **WHEN** `temperatureSupported` is `true` and `startConversation.temperature` is `0`
- **THEN** the built Responses request body has `temperature: 0`

#### Scenario: Supported deployment forwards a non-zero temperature exactly

- **WHEN** `temperatureSupported` is `true` and `startConversation.temperature` is `0.7`
- **THEN** the built Responses request body has `temperature: 0.7`

#### Scenario: Temperature is omitted when the deployment does not support it

- **WHEN** `temperatureSupported` is `false` and `startConversation.temperature` is any usable value
- **THEN** the built Responses request body has no `temperature` field

#### Scenario: Temperature is omitted when support is unknown

- **WHEN** `temperatureSupported` is `false` because the deployment `features` object had no `temperature` field
- **THEN** the built Responses request body has no `temperature` field

#### Scenario: Chat Completions temperature forwarding is unaffected

- **WHEN** a generation is routed through `ChatCompletionsAdapter` rather than `ResponsesAdapter`
- **THEN** `ChatCompletionsAdapter.buildRequest`'s existing temperature-forwarding behavior (unconditional on presence, capability-independent) is unchanged

---

### Requirement: Persisted conversation carries an optional Responses output-token limit

The shared `Conversation` model (`@epam/ai-dial-chat-shared`) and `ConversationResponseDto` SHALL each gain an optional `maxOutputTokens?: number` field. The field SHALL be a Chat-side, user/import-settable value distinct from and never derived from `limits.maxCompletionTokens`, `defaultMaxTokens`, `defaults.max_tokens`, token usage, context-window size, or any hard-coded constant. Existing conversations that omit the field SHALL continue to load, save, duplicate, import, and export exactly as before this change, with the field simply absent.

#### Scenario: New field is optional and independently settable

- **WHEN** a conversation payload sets `maxOutputTokens: 4096` without any relation to the deployment's `limits.maxCompletionTokens`
- **THEN** the conversation persists with `maxOutputTokens: 4096` regardless of the deployment's limit value

#### Scenario: Legacy conversations remain unaffected

- **WHEN** an existing conversation payload has no `maxOutputTokens` field
- **THEN** the conversation continues to load, save, duplicate, import, and export with identical behavior to before this change, and no `maxOutputTokens` value is invented

---

### Requirement: Responses request maps a valid maxOutputTokens to max_output_tokens

`ResponsesAdapter.buildRequest` SHALL include an optional `max_output_tokens: number` field on the built `ResponsesApiRequestBody`, set to `startConversation.maxOutputTokens` verbatim (no renaming, scaling, or transformation) only when that value passes a runtime validation check: it SHALL be a positive, finite integer within `Number.isSafeInteger` range (equivalently: `Number.isInteger(value) && Number.isSafeInteger(value) && value > 0`). The check SHALL be a real runtime predicate, not solely a TypeScript type assertion. The value `1` SHALL be preserved (checked via this validation, not truthiness). Any other value — absent, `null`, `0`, negative, fractional, `NaN`, `Infinity`, or outside the safe-integer range — SHALL cause `max_output_tokens` to be omitted entirely from the request; it SHALL NOT be sent as `null`, `undefined`, `0`, or a value derived from deployment limits or Chat Completions defaults. `max_output_tokens` mapping SHALL NOT be gated by `maxTokensSupported`, `maxCompletionTokensSupported`, or any other Chat-Completions-scoped capability flag. `ResponsesAdapter` SHALL NOT emit `max_tokens` or `max_completion_tokens` on a Responses request under any circumstance.

#### Scenario: Minimum valid value is preserved

- **WHEN** `startConversation.maxOutputTokens` is `1`
- **THEN** the built Responses request body has `max_output_tokens: 1`

#### Scenario: A representative larger value is preserved exactly

- **WHEN** `startConversation.maxOutputTokens` is `4096`
- **THEN** the built Responses request body has `max_output_tokens: 4096`

#### Scenario: Absent value omits the wire field

- **WHEN** `startConversation.maxOutputTokens` is `undefined`
- **THEN** the built Responses request body has no `max_output_tokens` field, and no substituted value from deployment metadata is sent in its place

#### Scenario: Invalid values are rejected rather than forwarded

- **WHEN** `startConversation.maxOutputTokens` is `0`, a negative number, a fractional number, `NaN`, `Infinity`, or a number exceeding `Number.MAX_SAFE_INTEGER`
- **THEN** the built Responses request body has no `max_output_tokens` field

#### Scenario: max_output_tokens is not gated by Chat Completions capability flags

- **WHEN** the resolved deployment has `maxTokensSupported: false` and `maxCompletionTokensSupported: false`, and `startConversation.maxOutputTokens` is a valid positive safe integer
- **THEN** the built Responses request body still includes `max_output_tokens` set to that value

#### Scenario: Legacy Chat Completions field names never appear on a Responses request

- **WHEN** any Responses request is built by `ResponsesAdapter.buildRequest`, with or without `maxOutputTokens` set
- **THEN** the built request body never contains a `max_tokens` or `max_completion_tokens` key

---

### Requirement: Temperature and max_output_tokens coexist without altering base request or stream semantics

A Responses request MAY include both `temperature` and `max_output_tokens` simultaneously when both are independently eligible per their own requirements above. Adding either or both fields SHALL NOT change `stream: true`, `store: false`, the `input` array, message ordering, system-prompt mapping, status-message filtering, or the omission of `previous_response_id`/`conversation`. Adding either field SHALL NOT alter SSE parsing, terminal-state precedence, partial-message persistence, abort handling, error propagation, or unknown-event handling as specified by the hardened Responses stream behavior; those requirements are unchanged by this capability delta.

#### Scenario: Both parameters present together

- **WHEN** a Responses-capable deployment supports temperature, `startConversation.temperature` is `0.4`, and `startConversation.maxOutputTokens` is `2048`
- **THEN** the built Responses request body includes `temperature: 0.4` and `max_output_tokens: 2048` alongside the unchanged base fields (`model`, `input`, `stream: true`, `store: false`), with no `previous_response_id` or `conversation` key

#### Scenario: Hardened stream behavior is unaffected by request-construction changes

- **WHEN** a Responses request built with either or both new parameters is relayed through `ResponsesAdapter.relay`
- **THEN** SSE event handling, terminal-state precedence, partial-message persistence on error, and abort/error outcome reporting behave identically to a request built without the new parameters
