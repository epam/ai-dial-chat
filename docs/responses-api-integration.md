# Responses API Integration in AI DIAL Chat

This document describes the current integration of the OpenAI Responses API in AI DIAL Chat rather than the OpenAI Responses API protocol in general. It explains how Chat selects a generation API, what it sends to DIAL Core, how it transforms the event stream, and which limitations the current implementation has.

## At a Glance

AI DIAL Chat supports two generation APIs:

- Chat Completions API — the existing mode;
- Responses API — used only when **both** a server-side operator flag (`RESPONSES_API_ENABLED`, default `false`) is enabled **and** DIAL Core reports `features.responses_api: true` for the selected model or application.

Both modes look the same to the browser. The client continues to call:

```http
POST /api/v1/conversations/completions
```

The BFF selects the appropriate upstream API and returns the SSE stream format already understood by Chat. The frontend neither calls `/openai/v1/responses` directly nor parses native Responses API events. There is no client-visible toggle for this — the flag is server-only (`visibility: server` in the config registry) and the client cannot select the generation API.

The main selection rule is:

```text
features.responsesApiEnabled === true (server flag, default false)
AND features.responsesApi === true (deployment capability)
    -> Responses API
otherwise
    -> Chat Completions API
```

There is no automatic retry through the other API after an error.

### Operator kill switch

`RESPONSES_API_ENABLED` (env var, boolean, default `false`) is the operational rollback lever for this integration. Setting it to `false` (or leaving it unset) and restarting the backend makes every generation use Chat Completions, regardless of what any deployment reports for `features.responsesApi` — including deployments that were previously being routed to Responses. This is the fastest way to stop new generations from using the Responses API without a DIAL Core change or a Chat code rollback. See `apps/chat-api/README.md` and `apps/chat-api/.env.template` for the operator-facing description.

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
ResponsesAdapter             ConversationStreamingService
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

The Responses mode is isolated in `ResponsesAdapter`. The active Chat Completions
relay remains in `ConversationStreamingService.relayModelCompletion`; the dormant
`ChatCompletionsAdapter` refactor is not used for runtime dispatch. Both modes
preserve the existing external Chat contract and shared conversation-history
logic.

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

Two independent conditions gate the Responses API: the server-side operator flag `features.responsesApiEnabled` (backed by `RESPONSES_API_ENABLED`, default `false`) and the per-deployment capability `features.responsesApi`. Both must be `true`:

| `features.responsesApiEnabled` (server, default `false`) | `features.responsesApi` (deployment) | Selected API         |
| -------------------------------------------------------- | ------------------------------------ | -------------------- |
| `false` (default)                                        | `true`                               | Chat Completions API |
| `false` (default)                                        | `false` / absent                     | Chat Completions API |
| `true`                                                   | `true`                               | Responses API        |
| `true`                                                   | `false` / absent                     | Chat Completions API |

The deployment-capability check is deliberately strict: only `true` enables the Responses API on that side. This preserves compatibility with Core versions and deployments that do not yet publish the new flag. The server-side flag defaults to `false`, so upgrading Chat to a version that includes this integration does not change any deployment's behavior until an operator explicitly opts in.

### Background mode

When the Responses API is selected, Chat can instead start the generation as a DIAL Core **background job** (`background: true`, `store: true`), which survives browser disconnects and BFF restarts. Background mode is a sub-mode of Responses and needs two more conditions on top of the table above:

| `features.responsesBackgroundEnabled` (server, default `false`) | `interfaces` of the deployment contain `openaiResponses` | Result                                      |
| --------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| `false` (default)                                               | any                                                      | stateless Responses API (no lookup is made) |
| `true`                                                          | yes                                                      | background Responses job                    |
| `true`                                                          | no, or the lookup fails                                  | stateless Responses API                     |

- `features.responsesBackgroundEnabled` is backed by `RESPONSES_BACKGROUND_ENABLED` (server-only, default `false`) and requires DIAL Core 0.48.0 or later.
- `interfaces` is not part of `getDeploymentDetails`: the BFF reads it from DIAL Core's `GET /v1/deployments/{deployment_name}` with the caller's token, only when Responses is already selected and the background flag is on. It is cached per user and deployment for about 60 seconds under its own key and is invalidated together with the details.
- The DIAL Core team defines `openaiResponses` in `interfaces` as "the deployment fully supports the Responses API including background jobs". DIAL Core sets it whenever a Responses endpoint is configured, so the guarantee depends on correct deployment configuration; `RESPONSES_BACKGROUND_ENABLED=false` is the operator's switch if a deployment advertises it without working support.
- The flag only decides how a **new** generation starts. Background jobs already running keep being recovered, stopped and finalized after the flag is turned off.
- With the flag off, the other paths still differ slightly from before: Stop and attach read the stored conversation whenever this instance has no local foreground generation for it, and client saves, rename and LLM naming always save with `If-Match`. After repeated conflicts, a conversation without a `pending` background message falls back to the previous unconditional save, so only one with a pending answer can get `503`.
- **Slower first text.** A background job first waits in the model provider's queue (`response.queued` → `response.in_progress`; about 3 s for `gpt-4.1-nano` on dev) before any text is produced. DIAL Core proxies the stream directly and the BFF forwards each event as it arrives, so this delay comes from the provider's background mode. It is the trade-off for an answer that survives a refresh, a closed tab, or a restart.

### Where deployment details come from

Before generation starts, the BFF calls `DeploymentsService.getDeploymentDetails(sub, deploymentName, token)` and uses:

- `modelDetails.features` for a model;
- `applicationDetails.features` for an application.

Data previously received by the browser is not trusted on its own. The capability is resolved again on the server with the current user's token. Details are cached separately for each user and deployment for approximately 60 seconds.

If the deployment is a toolset, generation is rejected with `400 Bad Request`. If details cannot be retrieved, the upstream request is not started and the registered generation is released correctly.

`getDeploymentDetails` runs unconditionally on every completion request, regardless of `RESPONSES_API_ENABLED`'s state — it is not skipped when the server-side flag is disabled. It also performs the toolset rejection above and the `temperature`-capability detection used to build the outgoing request, neither of which is specific to the Responses API; skipping the call for a disabled flag would silently remove that validation for Chat Completions requests too. The feature-flag check runs concurrently with this lookup, so a disabled (default) flag adds no additional latency to the existing call.

## Complete Request Lifecycle

1. The frontend calls the existing `/api/v1/conversations/completions` endpoint.
2. `ConversationService` registers an active generation, preserving the existing protection against concurrent generations in the same conversation.
3. The BFF retrieves details for the selected model or application and selects the generation API.
4. The initial conversation state and assistant placeholder are created and saved before Core is called.
5. The selected adapter sends the request to DIAL Core with the stable persisted conversation id in `X-CONVERSATION-ID` (percent-encoded, see below) and processes the upstream SSE stream.
6. Response fragments are applied to the assistant message through the shared `applyChunkToMessage` function.
7. The final text, status, optional error, and `responseId` are saved when generation ends.
8. The active-generation record is removed regardless of the outcome.

This lifecycle is the same for Responses and Chat Completions except for upstream request construction and stream parsing.

### Browser timezone context

For each completion request, the frontend resolves the browser's current IANA
timezone with `Intl.DateTimeFormat().resolvedOptions().timeZone`. Resolution is
best-effort and happens again for every send, so a changed browser timezone is
used without reloading the application. When resolution succeeds, the frontend
adds the optional request header:

```http
X-Timezone: Europe/Warsaw
```

The streaming frontend deliberately continues to use raw `fetch` for
`POST /api/v1/conversations/completions`. Although the generated
`ConversationsApi.streamCompletion` contract exposes optional
`xTimezone?: string`, neither that method nor its `Raw` variant exposes the live
response body needed by the existing SSE reader.

`ConversationController` validates a present header before generation starts.
It must be a single IANA timezone string, no longer than 255 characters, match
the safe timezone-segment syntax, and be accepted by `Intl.DateTimeFormat`.
Malformed, unknown, oversized, or multi-value input returns `400 Bad Request`
without calling DIAL Core. An absent header is accepted for backward
compatibility.

The validated value stays request-local. The BFF forwards it unchanged as
`X-Timezone` through both active upstream paths:

- Chat Completions via
  `ConversationStreamingService.relayModelCompletion` and
  `sendChatCompletionRequest`;
- Responses via `ResponsesAdapter` and `createResponse`.

The timezone is context for DIAL Core only. Chat does not persist it, cache it,
put it into metrics, or include it in logs.

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
- for messages with `image/*` attachments, `content` is an array of `input_text` (omitted when empty) and `input_image` parts; non-image attachments are dropped; messages with no image attachments use a plain `content` string;
- `model` contains the selected deployment name;
- `stream` is always `true`;
- `store` is `false` on the stateless path; on the background path (see [Background mode](#background-mode)) the request instead sets `store: true` and `background: true`, and every other field is built the same way;
- `reasoning.effort` is included when the resolved deployment's `features.reasoningEfforts` list is non-empty (the first entry is used); omitted when the list is absent or empty;
- `custom_fields.configuration` is included when a configuration value is present on the conversation, mirroring the Chat Completions Deep Research passthrough.

The request also includes the user's Bearer token, `Accept: text/event-stream`,
an AbortSignal, the stable persisted conversation id in `X-CONVERSATION-ID`,
`X-DIAL-CLIENT-CHANNEL-ID` when available, and the validated `X-Timezone` when
supplied by the browser. The Chat Completions adapter forwards the same
conversation and timezone headers.

Both adapters build the conversation header through
`buildConversationIdHeaders` (`apps/chat-api/src/common/utils/header-value.ts`),
which percent-encodes the UTF-8 bytes that cannot appear literally in an HTTP
header value. A conversation id embeds the user-authored title, so an id
containing an em dash, Cyrillic text, an emoji or a currency sign would
otherwise make Node's `fetch` throw a ByteString conversion `TypeError` before
the request left the BFF. Plain-ASCII ids — including spaces — are forwarded
byte-identical, so DIAL Core sees the same value it always has for them; the
`/rate` call encodes the header the same way.

### Why the full history is sent

The current Responses API integration is stateless. It does not use:

- `previous_response_id`;
- the Responses API `conversation` object;
- response state stored by Core.

Chat sends the prepared message history again with every request. AI DIAL Chat's conversation storage remains the source of truth.

### Why `store: false` is used on the stateless path

Chat stores conversation history itself. On the stateless path it does not use Core to continue, retrieve, or delete Responses objects, so persisting a response in Core is unnecessary and the returned `responseId` is a diagnostic identifier.

On the background path `store: true` is required: DIAL Core keeps the job and its result so that Chat can retrieve the final answer after the browser or the originating BFF instance is gone. The history is still sent in full on every turn; `previous_response_id` and `conversation` are never used on either path.

## SSE Stream Transformation

The Responses API returns typed events, while the existing frontend expects Chat Completions-like chunks. The BFF performs the transformation.

### Supported events

| Upstream event                  | BFF action                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `response.created`              | Saves the response identifier and sends it in `delta.responseId`                               |
| `response.output_text.delta`    | Appends `delta` to the assistant message and sends it as `delta.content`                       |
| `response.reasoning_text.delta` | Discarded — not forwarded to the browser and not persisted in the assembled message            |
| `response.completed`            | Validates the final status; a valid status completes the stream and saves `responseId`         |
| `response.failed`               | Ends generation with an error extracted from `response.error`, preserving text received so far |
| `response.incomplete`           | Ends generation with an error while preserving text received so far                            |
| `error`                         | Ends generation with the upstream error message                                                |
| unknown event                   | Does not send it to the client, writes a debug log, and increments a metric                    |

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

On the stateless path this field is intended for diagnostics and tracing. It does not mean that Chat can continue the response through `previous_response_id`, and it is not required for messages created through Chat Completions.

On the background path it is also the job's recovery key: the BFF saves it as soon as `response.created` arrives (while the message is still pending) and keeps it after finalization and after the Core response is deleted, so rating keeps sending the same id.

### Background generation lifecycle

A background message carries a server-owned marker next to `responseId`:

```json
{
  "role": "assistant",
  "responseId": "dial_gpt-4.1-nano-2025-04-14_61994b96...",
  "backgroundGeneration": {
    "generationId": "2d0b6c8e-5f7a-4c1b-9e3d-1a2b3c4d5e6f",
    "status": "pending",
    "startedAt": 1790000000000
  }
}
```

`generationId` identifies the message (messages have no ids of their own), so every background read and write finds the message by it and replaces it in place — a status message appended after it, for example on a model change, is kept. `status` is `pending`, `completed`, `stopped`, or `failed`.

1. **One pending generation per conversation.** A new send, regenerate, or edit on a conversation that contains a `pending` background message is rejected with `409`, whatever the flags.
2. **Placeholder first.** The BFF stores the pending placeholder with a conditional write (`If-Match` on the version it read) before creating the Core job. A concurrent start gets `409`; a change by the display-name writer is retried; a storage error makes the request continue on the stateless path, which is safe because no job exists yet.
3. **Pass-through relay.** Chunks are normalized exactly as on the stateless path but are not assembled: the registry entry holds no answer text, and the originating instance keeps reading the Core stream after the browser disconnects.
4. **Finalization from Core.** At the stream's end the BFF retrieves the stored response once (`GET /openai/v1/responses/{id}`) and writes the final state, but only while the message is still `pending` with the same `generationId`:

   | Stored response status   | Saved message                                                                       |
   | ------------------------ | ----------------------------------------------------------------------------------- |
   | `completed`              | final output, `status: completed`                                                   |
   | `cancelled`              | available output, `wasStoppedByUser: true`, `status: stopped`                       |
   | `failed` / `incomplete`  | available output, `streamErrorMessage` (as on the stateless path), `status: failed` |
   | `queued` / `in_progress` | nothing — the message stays `pending`                                               |

   "Output" is the text of `message` items' `output_text` parts only, so reasoning is never saved.

   If the write cannot be completed (conflicts exhausted, storage error, expired token) the message stays `pending`, the completion stream ends without an error envelope, and the client resumes it through `completions/attach`.

5. **Cleanup.** After a final state is written the BFF deletes the Core response (`DELETE /openai/v1/responses/{id}`); `404` counts as already done and `409` (job still active) is only logged. After Stop, the delete runs only when the cancel reports a finished job; a job that keeps running is left to Core's TTL.
6. **Detach.** At `MAX_GENERATION_DURATION_MS`, or on process shutdown, the originating instance stops reading and releases its registry entry without cancelling the job or writing the conversation; the message stays `pending` for recovery.
7. **Recovery on attach.** `POST /api/v1/conversations/completions/attach` is served from the local registry, with no storage read, when this instance runs a non-background generation for the path. Otherwise it checks the caller's conversation for a `pending` background message before the registry, so it works on every instance, including the originating one. With the caller's current token it:
   - replays a running job from DIAL Core (`GET /openai/v1/responses/{id}?stream=true`): one `snapshot` of the stored message, every event from the first one as `chunk` events, then one terminal event after finalizing;
   - finalizes a job that already ended and sends the saved message and its terminal event;
   - marks a job DIAL Core no longer knows (`404`) as `failed` with `streamErrorMessage: ''`;
   - responds `404` for a response owned by another user (`403` from DIAL Core);
   - for a `pending` message without `responseId`: responds `404` for the first 2 minutes (the start may still be waiting for `response.created`), then marks it `failed`. The job is never resubmitted.

   Every write goes through the same "still `pending` with this `generationId`" check, so an attach racing the originating instance never produces a second terminal state.

8. **Stop.** `POST /api/v1/conversations/completions/stop` stops a non-background generation running on this instance from the registry alone, as before. Otherwise it checks for the posted `generationId` on a `pending` background message before the registry, so it works on any instance and for a generation resumed after a refresh. The BFF never assembles the answer, and DIAL Core cannot return partial text in time (its JSON retrieve has none, and its replay starts from the first event at the job's own pace), so the frontend posts the text it has shown as the optional `content`. Stop **saves** it as `stopped` with `wasStoppedByUser: true`, responds `204`, and only **then** calls `POST /openai/v1/responses/{id}/cancel`, without waiting for it. `content` is ignored for non-background generations, whose answer the BFF already holds. Saving first means the originating relay and any attach already see a finished message and skip. When DIAL Core refuses the cancel, the message stays stopped and the rest of the job is ignored. When the stopping instance also runs the relay, it ends it, so the tab stops receiving tokens; a tab that resumed the answer through attach ignores further replayed text after its own Stop. A Stop before the job reported its `responseId` saves `stopped` but leaves the relay running, so the relay reads the id, sees the message is no longer pending, and cancels the job. If the stopped state cannot be saved, Stop answers `503` and does not cancel. A Stop that reaches the registry before the placeholder is visible ends the relay, which then saves the message as `stopped`. If the conversation cannot be read, attach and Stop fall back to the registry path.
9. **Client saves.** `PUT /api/v1/conversations` keeps its contract. While the stored conversation has a `pending` background message, the BFF puts back that message's server-owned fields (`content`, `custom_content`, `responseId`, `backgroundGeneration`, `streamErrorMessage`, `wasStoppedByUser`) from storage, keeps the client's other fields (for example `rating`), and saves with `If-Match`. A stale body that lacks the pending message gets the stored messages up to it put back, so it drops neither the question nor the answer; a body that shows an older answer where a regenerate is now pending gets the pending message in its place; and a body that still shows a finished background answer as pending, or as an unmarked copy at its position while the body still lines up with storage (a tab that streamed it and has not reloaded), takes the stored final state, so it never undoes it. After earlier messages are deleted the positions shift, so a different answer at that position is saved as sent. Every save of an existing conversation is written with `If-Match` on the version read (re-read on `412`; after 3 conflicts it reads once more and falls back to the previous unconditional save, unless that read holds a `pending` background answer, which gets `503`), so it never overwrites a placeholder or a final answer written in between; rename does the same. If the read fails, the save keeps today's unconditional path. A client body can never create a `pending` marker: any other `pending` marker it carries is saved as `failed`.
10. **Copies.** Duplicating a conversation writes a `pending` background message to the copy as `failed`, and import goes through the client-save rule above, so a copy never shares the original's live job. Publish is copied by DIAL Core itself, so `POST /api/v1/conversations/publish` answers `409` ("The answer is still being generated. Publish the conversation after it finishes.") while the conversation has a `pending` background message; the frontend shows it in the existing publish-error notification.

### Known limitations

- **Stop on a resumed tab when Core ignores the cancel.** The tab stops showing new text right away, but its replay stays open, so it shows "generating" until the job ends in Core. The saved answer is already the stopped one.
- **Core keeps refusing the retrieve.** If DIAL Core answers `403`, an error, or `409` to every retrieve, attach makes no write and the message stays `pending`, so new messages get `409`. Reopening the conversation resumes it, and Stop then settles it.
- **Attach in the first moments of a start.** Until the BFF has resolved that a new generation runs in the background, its registry entry looks like a normal one. An attach in that short window is served from the registry, which holds no text on the background path, so that client shows an empty answer until the generation completes.
- **Stop when the conversation cannot be read.** If storage fails while Stop decides whether the generation runs in the background, Stop falls back to the registry path. A background generation that this instance does not relay then gets `404`, keeps running, and saves its full answer.

### Security notes

- Every DIAL Core call on the background path (create, retrieve, replay, cancel, delete) uses the bearer token of the request being served. The BFF stores no access token, refresh token, DIAL Core per-request key, or `DIAL_API_KEY` for later use.
- Authorization for a job is DIAL Core's: it accepts retrieve, replay, cancel and delete only from the user who created the job (`403` otherwise, which the BFF answers as `404`). The BFF only reads conversations from the caller's own bucket, so a `responseId` can only come from the caller's own file.
- **Isolation on the background path is per DIAL user, not per session.** Unlike the in-memory registry (keyed by cookie session or bearer principal), any authenticated client of the same user — another browser session, another device, a bearer client — can attach to and stop that user's background generation. A different user still gets `404`.
- `responseId` is not a secret: it appears in exports and shared copies, but only its owner can use it.

## Completion, Errors, and Stopping

Both adapters return the same result type to `ConversationService`:

- `completed` — the stream completed successfully;
- `rejected` — Core rejected the HTTP request;
- `aborted` — the request was cancelled through the AbortSignal;
- `error` — an error occurred while reading or processing the stream.

Shared logic then sets the message status and saves the conversation state.

The AbortSignal behind `aborted` is driven only by an explicit user Stop (see "User-initiated stop" below) or the server-owned max-duration bound (`ConversationGenerationService`, `MAX_GENERATION_DURATION_MS`) — never by the originating browser connection closing. Generation ownership is independent of that connection: closing the tab, refreshing, or navigating away from `/api/v1/conversations/completions` has no effect on either adapter's stream: the BFF keeps consuming it to its terminal event and persists the result exactly as if the client were still connected. While the downstream response is open, the BFF writes a `: keepalive` comment every 15 s so a long silent phase is not idle-closed; a client whose connection drops anyway (device sleep, network loss) rejoins the running generation through `completions/attach`.

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

The frontend uses the existing generation-stop endpoint. On the stateless path the BFF aborts the current upstream request through an AbortController and saves the partial assistant message with `wasStoppedByUser`.

For a background generation the BFF saves the text the frontend posts with Stop (`content`) and then calls Core's cancel endpoint; see step 8 of [Background generation lifecycle](#background-generation-lifecycle).

### Fallback

Fallback occurs only as part of capability-based API selection:

- when `features.responsesApiEnabled` (server flag) is not `true`, Chat Completions is selected immediately, regardless of what the deployment reports;
- when the server flag is `true` but the deployment's `features.responsesApi` is not `true`, Chat Completions is selected;
- when both are `true`, the Responses API is selected.

When the server-side flag is disabled, Chat behaves exactly as if the targeted deployment had never reported `responses_api: true` — no different code path, no different error, no latency change beyond what `getDeploymentDetails` already costs today. Setting `RESPONSES_API_ENABLED=false` and restarting the backend is the operational rollback path: it immediately makes every new generation use Chat Completions.

If the Responses API has already been selected and returns an error, Chat does not repeat the request through Chat Completions. An automatic retry could create a second response or repeat a tool or action, so such switching must be designed separately.

## Adapter Differences

| Behavior                   | Responses                                                               | Chat Completions                                |
| -------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| Selection                  | `responsesApi === true`                                                 | value is not `true`                             |
| Upstream SDK               | `createResponse`                                                        | `sendChatCompletionRequest`                     |
| History                    | `input[]` with `role` and `content`                                     | existing Chat Completions payload               |
| System prompt              | first item in `input`                                                   | system message                                  |
| Image attachments          | `image/*` → `input_image` parts; non-image dropped                      | forwarded as-is in `custom_content.attachments` |
| Reasoning effort           | `reasoning.effort` when `features.reasoningEfforts` non-empty           | not applicable                                  |
| Configuration              | `custom_fields.configuration` when present                              | `custom_content.configuration`                  |
| Reasoning events           | `response.reasoning_text.delta` discarded (not streamed, not persisted) | not applicable                                  |
| Streaming                  | native events are transformed to chunks                                 | upstream chunks are passed through almost as-is |
| Storage in Core            | `store: false`                                                          | not applicable                                  |
| Continuation by ID         | not used                                                                | not applicable                                  |
| Final conversation storage | AI DIAL Chat                                                            | AI DIAL Chat                                    |

The Chat Completions branch retains existing support for DIAL-specific payloads: attachments, `custom_content`, configuration, and stages. The Responses branch sends text-based `role`/`content` messages, the system prompt, generation parameters (`temperature`, `max_output_tokens`, `reasoning.effort`), `custom_fields.configuration`, and image attachments mapped to `input_image`; non-image attachments and remaining DIAL-specific payloads remain Chat-Completions-only. `response.reasoning_text.delta` events are discarded — not forwarded to the browser and not persisted.

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
- `max_output_tokens`: forwarded from the conversation's optional `maxOutputTokens` setting whenever it is a valid positive safe integer, independent of any capability flag (no Responses-specific max-output-tokens capability exists in DIAL Core today). Absent or invalid values (zero, negative, fractional, non-finite, or unsafe-integer) omit the field entirely — Chat never derives it from a deployment's `limits.maxCompletionTokens`, the legacy Chat Completions `defaults.max_tokens`, or DIAL Core's own `responsesDefaults`, which keep governing the field's default whenever Chat sends none;
- `reasoning.effort`: forwarded from the deployment's `features.reasoningEfforts` list when non-empty (first entry is used); omitted when the list is absent or empty, so models that do not declare reasoning-effort support never receive the field;
- image input: `image/*` attachments from the conversation's message history are mapped to `input_image` content parts in the Responses `input` array; non-image attachments are dropped (not forwarded) in the Responses branch;
- `custom_fields.configuration`: forwarded when a configuration value is present on the conversation, mirroring the Chat Completions Deep Research passthrough;
- `response.reasoning_text.delta` events are recognized and explicitly discarded — not forwarded to the browser stream and not persisted in conversation history; the assembled message retains no `stages` entry for reasoning, so chain-of-thought does not appear on conversation reload.

Not yet supported in the Responses branch:

- `previous_response_id` and server-side continuation;
- tools and function calling;
- reasoning display — `response.reasoning_text.delta` is discarded today; persisting and displaying reasoning requires a dedicated UI design;
- non-image file input and other non-image multimodal content items (`image/*` attachments are supported; other types are dropped);
- citations, annotations, and rich output;
- DIAL non-image attachment forwarding and remaining `custom_content` fields not described in Supported above;
- generation parameters other than `temperature`, `max_output_tokens`, and `reasoning.effort` (e.g. penalties, seed, response format);
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

| Area                                        | File                                                                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API enum and selection                      | `apps/chat-api/src/conversations/generation/generation-api.ts`                                                                                                                    |
| Shared result types                         | `apps/chat-api/src/conversations/generation/generation.types.ts`                                                                                                                  |
| Responses request and SSE parser            | `apps/chat-api/src/conversations/generation/responses.adapter.ts`                                                                                                                 |
| Active Chat Completions flow                | `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`                                                                                                     |
| Browser timezone resolution and SSE request | `apps/chat/src/utils/browser-timezone.ts`, `apps/chat/src/server-api/chat-stream.api.ts`                                                                                          |
| Timezone header validation                  | `apps/chat-api/src/conversations/utils/timezone-header.ts`, `apps/chat-api/src/conversations/conversation.controller.ts`                                                          |
| Metrics                                     | `apps/chat-api/src/conversations/generation/generation-metrics.ts`                                                                                                                |
| Orchestration and conversation persistence  | `apps/chat-api/src/conversations/conversation.service.ts`                                                                                                                         |
| Deployment-details retrieval and caching    | `apps/chat-api/src/deployments/deployments.service.ts`                                                                                                                            |
| Deployment-capability DTOs and mapping      | `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`, `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`, and `apps/chat-api/src/deployments/deployments.service.ts` |
| Message DTO containing `responseId`         | `apps/chat-api/src/conversations/dto/conversation-message.dto.ts`                                                                                                                 |
| API-selection unit tests                    | `apps/chat-api/src/conversations/generation/generation-api.spec.ts`                                                                                                               |
| Responses-adapter unit tests                | `apps/chat-api/src/conversations/generation/responses.adapter.spec.ts`                                                                                                            |
| Service-level integration                   | `apps/chat-api/src/conversations/tests/conversation.service.spec.ts`                                                                                                              |
| `features.responsesApiEnabled` flag source  | `apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts`, `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`                                     |

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
