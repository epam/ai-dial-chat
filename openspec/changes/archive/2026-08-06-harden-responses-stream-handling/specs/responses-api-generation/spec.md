## MODIFIED Requirements

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

## ADDED Requirements

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
