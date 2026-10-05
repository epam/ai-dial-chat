# Spec Delta

## MODIFIED Requirements

### Requirement: Responses request built from existing conversation history

`responses.adapter.ts` (`apps/chat-api/src/conversations/generation/responses.adapter.ts`) SHALL build the Responses request from the same `buildConversationHistory` result used by the Chat Completions path: each history message becomes an `input` item carrying its `role` and text `content`, in order, with the system/instruction message kept as the first `input` item. Messages whose `role` is `ConversationMessageRole.Status` (internal Chat-owned bookkeeping markers, e.g. model-changed) SHALL be excluded from the `input` array before the remaining messages are mapped, matching the equivalent filtering already applied by `chat-completions.adapter.ts`; the relative order of all remaining messages SHALL be preserved. The request SHALL set `stream: true` and SHALL NOT set `previous_response_id` or `conversation` (neither key, nor a `null` value, since DIAL Core rejects the key's mere presence).

On the stateless Responses path the request SHALL set `store: false` and SHALL NOT set `background`. On the background path defined by `background-responses-generation` the request SHALL set `store: true` and `background: true`; every other field (`input`, `instructions`, `temperature`, `max_output_tokens`, `reasoning`, `custom_fields`) SHALL be built exactly as on the stateless path.

#### Scenario: Full turn history sent as input

- **WHEN** a conversation has a system message and three prior turns
- **THEN** the Responses request `input` array contains one item per message, in original order, with no `previous_response_id` or `conversation` field present

#### Scenario: store is always false in this iteration

- **WHEN** a Responses request is built for a generation that is not on the background path
- **THEN** the request body has `store: false` and no `background` key

#### Scenario: store and background are true on the background path

- **WHEN** a Responses request is built for a generation on the background path
- **THEN** the request body has `store: true`, `background: true`, `stream: true`, and the same `input` as the stateless path would build

#### Scenario: Internal status messages are excluded from the input array

- **WHEN** the conversation history passed to `buildRequest` contains one or more messages with `role: ConversationMessageRole.Status` interleaved among user/assistant messages
- **THEN** the built `input` array omits every `Status`-role message, and the remaining user and assistant messages keep their original relative order

### Requirement: message.responseId carries the DIAL Responses id for diagnostics

`ConversationMessageDto` (or the equivalent assistant message shape saved by `ConversationService`) SHALL accept an optional `responseId: string` field, populated from the DIAL `response.id` on a Responses-routed generation's `response.created`/`response.completed` events, and left unset for Chat Completions-routed generations.

On the stateless Responses path `responseId` is diagnostic only. On the background path it is also the recovery key: it SHALL be persisted as soon as `response.created` is received (while the message is still `pending`), and SHALL be kept on the message after finalization and after the Core response is deleted, so rating and tracing keep working.

#### Scenario: responseId present only for Responses-routed messages

- **WHEN** a generation is routed through the Responses adapter and completes successfully
- **THEN** the saved assistant message has `responseId` set to the DIAL `response.id`

#### Scenario: responseId absent for Chat Completions-routed messages

- **WHEN** a generation is routed through the Chat Completions adapter
- **THEN** the saved assistant message has no `responseId` field set

#### Scenario: responseId is persisted early on the background path

- **WHEN** a background generation receives `response.created`
- **THEN** the stored assistant message has `responseId` set and `backgroundGeneration.status: "pending"` before the job's first content delta is relayed

## ADDED Requirements

### Requirement: SDK retrieve, replay, cancel and delete calls are isolated at the app edge

`apps/chat-api` SHALL call DIAL Core's `GET /openai/v1/responses/{response_id}` (plain and `?stream=true`), `POST /openai/v1/responses/{response_id}/cancel`, and `DELETE /openai/v1/responses/{response_id}` only through the shared SDK client (`getResponseItem`, `cancelResponseItem`, `deleteResponseItem`) wrapped by one app-level module. Because the installed SDK declares `query?: never` for `getResponseItem`, the `stream` query parameter SHALL be passed through a single documented cast inside that module; no caller outside it SHALL use `as never`/`any` for these calls. The module SHALL URL-encode `response_id`.

#### Scenario: Replay request carries the stream query

- **WHEN** the wrapper requests a replay for a response id
- **THEN** the outbound request is `GET /openai/v1/responses/<encoded id>?stream=true` with `Accept: text/event-stream` and the caller's bearer token

#### Scenario: Cast does not leak

- **WHEN** background-path code retrieves, replays, cancels, or deletes a response
- **THEN** it calls the wrapper's typed functions and contains no cast of its own
