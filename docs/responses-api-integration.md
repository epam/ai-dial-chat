# Responses API Integration in AI DIAL Chat

This document describes the current integration of the OpenAI Responses API in AI DIAL Chat rather than the OpenAI Responses API protocol in general. It explains how Chat selects a generation API, what it sends to DIAL Core, how it transforms the event stream, and which limitations the current implementation has.

## At a Glance

AI DIAL Chat supports two generation APIs:

- Chat Completions API — the existing mode;
- Responses API — used only when DIAL Core reports `features.responses_api: true` for the selected model or application.

Both modes look the same to the browser. The client continues to call:

```http
POST /api/v1/conversations/completions
```

The BFF selects the appropriate upstream API and returns the SSE stream format already understood by Chat. The frontend neither calls `/openai/v1/responses` directly nor parses native Responses API events.

The main selection rule is:

```text
features.responsesApi === true
    -> Responses API
otherwise
    -> Chat Completions API
```

There is no automatic retry through the other API after an error.

## Architecture

```text
Browser
  |
  | POST /api/v1/conversations/completions
  v
ConversationController
  |
  v
ConversationService
  |
  | retrieves current deployment details from DIAL Core
  | and reads features.responsesApi
  v
resolveGenerationApi()
  |                              |
  | true                         | false / absent
  v                              v
ResponsesAdapter             ChatCompletionsAdapter
  |                              |
  | POST /openai/v1/responses    | Chat Completions request
  v                              v
DIAL Core                    DIAL Core
  |                              |
  +------------- SSE ------------+
                 |
                 v
       shared conversation history,
       status, and generation stop handling
```

Separating the two modes into adapters preserves the existing external Chat contract and the shared conversation-history logic.

## How Responses API Support Is Determined

### Capability source

DIAL Core publishes deployment capabilities in the `features` field. Responses API support is represented by:

```json
{
  "features": {
    "responses_api": true
  }
}
```

Inside Chat, snake_case is converted to camelCase:

```ts
features.responsesApi;
```

Core derives this flag from the deployment interfaces. Responses API support corresponds to the `OPENAI_RESPONSES` interface. This applies to both models and applications.

### Selection table

| `features.responsesApi` | Selected API         |
| ----------------------- | -------------------- |
| `true`                  | Responses API        |
| `false`                 | Chat Completions API |
| absent                  | Chat Completions API |
| `undefined`             | Chat Completions API |

The check is deliberately strict: only `true` enables the Responses API. This preserves compatibility with Core versions and deployments that do not yet publish the new flag.

### Where deployment details come from

Before generation starts, the BFF calls `DeploymentsService.getDeploymentDetails(sub, deploymentName, token)` and uses:

- `modelDetails.features` for a model;
- `applicationDetails.features` for an application.

Data previously received by the browser is not trusted on its own. The capability is resolved again on the server with the current user's token. Details are cached separately for each user and deployment for approximately 60 seconds.

If the deployment is a toolset, generation is rejected with `400 Bad Request`. If details cannot be retrieved, the upstream request is not started and the registered generation is released correctly.

## Complete Request Lifecycle

1. The frontend calls the existing `/api/v1/conversations/completions` endpoint.
2. `ConversationService` registers an active generation, preserving the existing protection against concurrent generations in the same conversation.
3. The BFF retrieves details for the selected model or application and selects the generation API.
4. The initial conversation state and assistant placeholder are created and saved before Core is called.
5. The selected adapter sends the request to DIAL Core and processes the upstream SSE stream.
6. Response fragments are applied to the assistant message through the shared `applyChunkToMessage` function.
7. The final text, status, optional error, and `responseId` are saved when generation ends.
8. The active-generation record is removed regardless of the outcome.

This lifecycle is the same for Responses and Chat Completions except for upstream request construction and stream parsing.

## Responses API Request

The Responses adapter calls the SDK's `createResponse` method, which sends a request to:

```http
POST /openai/v1/responses
```

Minimal request body:

```json
{
  "model": "deployment-name",
  "input": [
    {
      "role": "system",
      "content": "System prompt"
    },
    {
      "role": "user",
      "content": "Hello"
    }
  ],
  "stream": true,
  "store": false
}
```

Mapping rules:

- the system prompt is added as the first `input` item when present;
- all messages from the prepared history are then added in their original order;
- only `role` and `content` are included for each message;
- `model` contains the selected deployment name;
- `stream` is always `true`;
- `store` is always `false`.

The request also includes the user's Bearer token, `Accept: text/event-stream`, an AbortSignal, and `X-DIAL-CLIENT-CHANNEL-ID` when available.

### Why the full history is sent

The current Responses API integration is stateless. It does not use:

- `previous_response_id`;
- the Responses API `conversation` object;
- response state stored by Core.

Chat sends the prepared message history again with every request. AI DIAL Chat's conversation storage remains the source of truth.

### Why `store: false` is used

Chat stores conversation history itself and does not currently use Core to continue, retrieve, or delete Responses objects. Persisting a response mapping in Core is therefore unnecessary.

As a result, the returned `responseId` is a diagnostic identifier. Chat does not use it for the next turn and does not attempt to retrieve, cancel, or delete the response through Core.

## SSE Stream Transformation

The Responses API returns typed events, while the existing frontend expects Chat Completions-like chunks. The BFF performs the transformation.

### Supported events

| Upstream event               | BFF action                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `response.created`           | Saves the response identifier and sends it in `delta.responseId`                               |
| `response.output_text.delta` | Appends `delta` to the assistant message and sends it as `delta.content`                       |
| `response.completed`         | Validates the final status; a valid status completes the stream and saves `responseId`         |
| `response.failed`            | Ends generation with an error extracted from `response.error`, preserving text received so far |
| `response.incomplete`        | Ends generation with an error while preserving text received so far                            |
| `error`                      | Ends generation with the upstream error message                                                |
| unknown event                | Does not send it to the client, writes a debug log, and increments a metric                    |

`event:` lines, empty lines, and SSE comments are ignored. JSON is parsed from `data:` lines. See "Terminal state and `[DONE]`" below for how a stream resolves to success or error — none of `response.failed`, `response.incomplete`, or an in-band `error` ever produce a downstream `data: [DONE]`, and none of them are retried through Chat Completions.

### What the frontend receives

Response creation event:

```text
data: {"choices":[{"delta":{"responseId":"dial_deployment_uuid"}}]}

```

Text delta:

```text
data: {"choices":[{"delta":{"content":"Hello"}}]}

```

Final marker:

```text
data: [DONE]

```

Native events such as `response.output_text.delta` are never sent to the browser. This allows the existing frontend parser, text rendering, conversation persistence, and stop flow to work without a separate Responses API branch.

### `responseId` in conversation history

`ConversationMessageDto` has an optional `responseId` field. The Responses adapter populates it from `response.created` or `response.completed`.

This field is intended for diagnostics and tracing. It does not mean that Chat can continue the response through `previous_response_id`, and it is not required for messages created through Chat Completions.

## Completion, Errors, and Stopping

Both adapters return the same result type to `ConversationService`:

- `completed` — the stream completed successfully;
- `rejected` — Core rejected the HTTP request;
- `aborted` — the request was cancelled through the AbortSignal;
- `error` — an error occurred while reading or processing the stream.

Shared logic then sets the message status and saves the conversation state.

### Terminal state and `[DONE]`

The Responses adapter tracks one explicit terminal signal per stream instead of assuming success whenever no error was seen. A stream resolves to `completed` only when it observes a valid `response.completed` (status absent or `"completed"`) or, for legacy/non-standard upstreams only, a `data: [DONE]` marker that no earlier error signal has already claimed.

The DIAL Core Responses contract and the `[DONE]` compatibility path are not the same thing:

- **Canonical DIAL Core streams** end in `response.completed` or `response.incomplete` and do not send `[DONE]`. A canonical stream completes as soon as it sees a valid `response.completed` — it never needs `[DONE]`.
- **`[DONE]` is a backward-compatibility signal** for legacy or non-standard upstreams that do not send a Responses-native terminal event. Observing `[DONE]` records success only if no terminal signal (success or error) was already recorded; it can never override an earlier `response.failed`, `response.incomplete`, in-band `error`, or an invalid-status `response.completed`.
- **A `response.completed` with a status other than `"completed"`** remains an error, regardless of anything that follows it, including `[DONE]`.
- **The upstream socket closing does not by itself mean success.** If the stream ends — by socket EOF or by `[DONE]` — without a previously recorded success or error signal, the adapter returns an error using a fixed, generic message that never echoes prompt or response content, and preserves any partial assistant text assembled so far. No downstream `data: [DONE]` is written in this case.

DIAL Core does not yet recognize `response.failed` as a terminal event on its own side — it can still forward a `response.failed` frame to Chat before the upstream socket closes. Chat's adapter treats `response.failed` as terminal regardless, which is why this defensive handling exists on the Chat side even though Core has not adopted it internally yet.

### Partial responses

If `response.failed`, `response.incomplete`, an `error` event, an unterminated stream, or an abort occurs after several deltas, the accumulated text is preserved. It is saved together with the error or the indication that the user stopped generation.

### User-initiated stop

The frontend uses the existing generation-stop endpoint. The BFF aborts the current upstream request through an AbortController and saves the partial assistant message with `wasStoppedByUser`.

Core's response cancellation endpoint is not used because the current implementation does not start background Responses jobs.

### Fallback

Fallback occurs only as part of capability-based API selection:

- when the flag is not `true`, Chat Completions is selected immediately;
- when the flag is `true`, the Responses API is selected.

If the Responses API has already been selected and returns an error, Chat does not repeat the request through Chat Completions. An automatic retry could create a second response or repeat a tool or action, so such switching must be designed separately.

## Adapter Differences

| Behavior                   | Responses                               | Chat Completions                                |
| -------------------------- | --------------------------------------- | ----------------------------------------------- |
| Selection                  | `responsesApi === true`                 | value is not `true`                             |
| Upstream SDK               | `createResponse`                        | `sendChatCompletionRequest`                     |
| History                    | `input[]` with `role` and `content`     | existing Chat Completions payload               |
| System prompt              | first item in `input`                   | system message                                  |
| Streaming                  | native events are transformed to chunks | upstream chunks are passed through almost as-is |
| Storage in Core            | `store: false`                          | not applicable                                  |
| Continuation by ID         | not used                                | not applicable                                  |
| Final conversation storage | AI DIAL Chat                            | AI DIAL Chat                                    |

The Chat Completions branch retains existing support for DIAL-specific payloads: attachments, `custom_content`, configuration, and stages. The Responses branch sends text-based `role`/`content` messages, the system prompt, and now the two generation parameters described below (`temperature`, `max_output_tokens`); all other DIAL-specific payloads remain Chat-Completions-only.

## Current Support Scope

Supported:

- models and applications with `features.responses_api: true`;
- streaming text output;
- full stateless history on every turn;
- system prompts;
- persistence of complete and partial text in conversation history;
- explicit `response.failed` handling as a terminal error, with partial-text preservation;
- an explicit terminal-state model: a canonical DIAL Core stream succeeds on a valid `response.completed` alone; `data: [DONE]` is accepted only as a legacy/non-standard-upstream compatibility signal and never overrides an earlier error signal; an unterminated stream (socket EOF or `[DONE]` with no prior terminal signal) is treated as an error rather than an implicit success;
- stopping generation through the existing Chat endpoint;
- diagnostic persistence of `responseId`;
- safe handling of unknown SSE events;
- compatibility with older deployments that do not expose the capability flag;
- `temperature`: forwarded from the conversation's persisted value only when the resolved deployment's capabilities explicitly report `features.temperature: true`; omitted (never substituted with a default) when support is `false` or unknown, so a model that rejects the field is never sent one. The value `0` is forwarded, not treated as absent;
- `max_output_tokens`: forwarded from the conversation's optional `maxOutputTokens` setting whenever it is a valid positive safe integer, independent of any capability flag (no Responses-specific max-output-tokens capability exists in DIAL Core today). Absent or invalid values (zero, negative, fractional, non-finite, or unsafe-integer) omit the field entirely — Chat never derives it from a deployment's `limits.maxCompletionTokens`, the legacy Chat Completions `defaults.max_tokens`, or DIAL Core's own `responsesDefaults`, which keep governing the field's default whenever Chat sends none.

Not yet supported in the Responses branch:

- `previous_response_id` and server-side continuation;
- `store: true`;
- background mode;
- Core `GET`, `CANCEL`, and `DELETE /openai/v1/responses/{response_id}` operations;
- tools and function calling;
- reasoning items and reasoning summaries;
- image/file input and other multimodal content items;
- citations, annotations, and rich output;
- DIAL attachments, `custom_content`, configuration, and stages;
- generation parameters other than `temperature` and `max_output_tokens` (e.g. penalties, seed, response format, reasoning effort);
- a UI control for editing `maxOutputTokens` — the field is settable today only via the persisted conversation model (API, import/export), not through a chat-settings control; a dedicated UI is a follow-up;
- dedicated handling for every output-item type;
- automatic fallback after a Responses API error.

If a deployment declares `responses_api: true` but requires any capability from this list to work correctly, the capability flag alone is insufficient. The adapter must be extended before that deployment can be included in a production scenario.

### Known Core-side gap

DIAL Core does not currently recognize `response.failed` as a terminal Responses event on its own side, and it can end a proxied stream on upstream socket close even when no recognized terminal event was observed. Chat's adapter defends against both possibilities regardless — `response.failed` is treated as terminal in Chat even though Core has not adopted that terminal state internally yet, and an unterminated stream is never treated as an implicit success. Extending Core's own terminal-event recognition is tracked as a follow-up in the `ai-dial-core` repository and is out of scope for this Chat-side change.

## Observability

The implementation publishes the following metrics:

| Metric                                | Purpose                                 | Main attributes                             |
| ------------------------------------- | --------------------------------------- | ------------------------------------------- |
| `generation.requests`                 | Number of completed generation attempts | `generation.api`, `outcome`                 |
| `generation.capability_resolution`    | Success of API capability resolution    | `outcome`, plus `generation.api` on success |
| `generation.responses.unknown_events` | Unknown Responses event types           | `event.type`                                |
| `generation.time_to_first_delta`      | Time to the first text delta            | `generation.api`                            |
| `generation.stream_duration`          | Total stream duration                   | `generation.api`, `outcome`                 |

Prompts, response content, and full unknown-event payloads are not written to metric labels or debug logs. This reduces the risk of leaking user data and introducing uncontrolled cardinality.

Possible `generation.api` values:

- `responses`;
- `chat_completions`.

## Code Map

| Area                                       | File                                                                                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API enum and selection                     | `apps/chat-api/src/conversations/generation/generation-api.ts`                                                                                                                    |
| Shared result types                        | `apps/chat-api/src/conversations/generation/generation.types.ts`                                                                                                                  |
| Responses request and SSE parser           | `apps/chat-api/src/conversations/generation/responses.adapter.ts`                                                                                                                 |
| Existing Chat Completions flow             | `apps/chat-api/src/conversations/generation/chat-completions.adapter.ts`                                                                                                          |
| Metrics                                    | `apps/chat-api/src/conversations/generation/generation-metrics.ts`                                                                                                                |
| Orchestration and conversation persistence | `apps/chat-api/src/conversations/conversation.service.ts`                                                                                                                         |
| Deployment-details retrieval and caching   | `apps/chat-api/src/deployments/deployments.service.ts`                                                                                                                            |
| Deployment-capability DTOs and mapping     | `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`, `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`, and `apps/chat-api/src/deployments/deployments.service.ts` |
| Message DTO containing `responseId`        | `apps/chat-api/src/conversations/dto/conversation-message.dto.ts`                                                                                                                 |
| API-selection unit tests                   | `apps/chat-api/src/conversations/generation/generation-api.spec.ts`                                                                                                               |
| Responses-adapter unit tests               | `apps/chat-api/src/conversations/generation/responses.adapter.spec.ts`                                                                                                            |
| Service-level integration                  | `apps/chat-api/src/conversations/tests/conversation.service.spec.ts`                                                                                                              |

## DIAL Core Context

DIAL Core provides an OpenAI-compatible Responses API:

```text
POST   /openai/v1/responses
GET    /openai/v1/responses/{response_id}
POST   /openai/v1/responses/{response_id}/cancel
DELETE /openai/v1/responses/{response_id}
```

In its current mode, AI DIAL Chat uses only `POST /openai/v1/responses`. The other endpoints apply to stored or background responses and do not participate in the flow described here.

It is important to distinguish between two API layers:

- Chat's external BFF endpoint, `/api/v1/conversations/completions`, remains stable for the frontend;
- Core's upstream endpoint, `/openai/v1/responses`, is selected by the server based on the deployment capability.

The BFF adapter is the compatibility boundary between these two layers.
