## ADDED Requirements

### Requirement: No upstream request is dispatched once a generation is cancelled or released during preparation

When preparation (as `generation-registry` defines it) completes in time but the generation's lease was aborted during it — by a user Stop, the max-duration timer or stale expiry — `ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) SHALL NOT invoke the Chat Completions relay or `ResponsesAdapter.stream`, and no DIAL Core model request SHALL be dispatched. Everything else SHALL be unchanged:

- the start-state save, `onReadyToStream` and the SSE response proceed as before;
- the generation is classified through the existing `aborted` outcome (`wasStoppedByUser: true` for a user Stop, `streamErrorMessage: ''` for any other reason);
- its single terminal save is made;
- the stream ends.

The observable Stop contract is preserved: `POST /api/v1/conversations/completions/stop` responds `204`, and the originating completion request opens its stream, persists the stopped partial, and closes.

When the generation's entry is released during preparation by process shutdown, the worker SHALL stop at its next preparation boundary. It SHALL make no further preparation call, no start-state save and no upstream request, and SHALL fail the request before SSE headers are sent. It makes no persistence claim about any write already in flight.

#### Scenario: A user Stop during preparation persists a stopped answer without calling the model

- **GIVEN** a generation is preparing and the principal stops it
- **WHEN** preparation then completes before the deadline
- **THEN** Stop responded `204`, the completion stream opens and closes, the persisted assistant message carries `wasStoppedByUser: true` and no `streamErrorMessage`, and no DIAL Core completion or Responses request was made

#### Scenario: A max-duration cancellation during preparation is a non-user abort without a model call

- **GIVEN** `MAX_GENERATION_DURATION_MS` elapses while the generation is preparing
- **WHEN** preparation then completes before its own deadline
- **THEN** the persisted assistant message carries `streamErrorMessage: ''` and no `wasStoppedByUser`, and no upstream model request was made

#### Scenario: Shutdown during preparation makes no further write or request

- **GIVEN** the module is destroyed while a generation's stored-conversation read is pending
- **WHEN** that read then resolves
- **THEN** no start-state save, upstream model request or terminal save is made, and the request fails without SSE headers

## MODIFIED Requirements

### Requirement: A pre-stream failure releases the registry entry

If any step between registering the generation and opening the upstream stream **rejects** — resolving the deployment's generation capability, fetching the conversation, or building its history — the backend SHALL release the registry entry before rethrowing, so a transient failure does not lock the conversation.

Releasing on this path SHALL NOT perform a conversation write of any kind: nothing has been assembled, and a preflight failure must not invent a terminal save. Release SHALL be the entry's single settlement, so its max-duration timer, its attach listeners, its registry key, its preparation timer and its runtime generation tracking are all released exactly once.

Because `generation-registry` no longer removes or replaces an owned entry on `register`, this release is the only thing that frees the key after a preflight failure. A retry therefore succeeds immediately rather than waiting for any sweep.

A step that is still **pending** when `GENERATION_PREPARATION_TIMEOUT_MS` elapses is not a rejection, and SHALL NOT take this path. An abandoned preparation releases its subscribers but retains the key until the abandoned step settles, as `generation-registry` "Generation preparation is bounded, and an abandoned preparation retains ownership until it settles" defines, because the pending step may still be the start-state save, an unconditional write. The existing `generation.capability_resolution{outcome="failed"}` count SHALL still be recorded when the abandoned step is capability resolution.

The start-state save keeps its own rule ("A failed start-state save does not abort the stream"): a start-state save that *rejects* before the deadline is logged as a warning and the request proceeds.

#### Scenario: Conversation fetch fails after registration

- **WHEN** registration succeeds but the subsequent `getConversation` throws
- **THEN** the backend releases the entry — clearing its timer, listeners, registry key, and runtime tracking — and rethrows, performing no conversation write, so a retry is not rejected with 409

#### Scenario: A generation-capability resolution failure releases the entry without writing

- **WHEN** registration succeeds but resolving the deployment's generation API throws
- **THEN** the backend releases the entry and rethrows with no `saveConversation` call made, and the failure reaches the exception filter before any SSE response is opened

#### Scenario: A pending step at the deadline does not release the key

- **GIVEN** a preparation step is still pending when `GENERATION_PREPARATION_TIMEOUT_MS` elapses
- **WHEN** the preparation is abandoned
- **THEN** no conversation write is made by the abandonment, the entry keeps its registry key until that step settles, and a retry before then is rejected with `409`

### Requirement: A failure before the stream opens is reported with its own status code

`ConversationStreamingService.streamCompletion` is an async generator, so everything it does before calling `onReadyToStream` — registering the generation, resolving the deployment, fetching the conversation, saving the start state — runs on the consuming loop's first `next()` rather than at the call site. `ConversationController.streamCompletion` SHALL therefore distinguish a rejection that arrives before SSE headers were sent from one that arrives after. While `res.headersSent` is false it MUST NOT end the response, so the rejection propagates to the exception filter, which owns the status code and body. Once the stream is open the status is already committed, so a later failure ends the response as before and only the SSE transport reports it.

Ending the response on the pre-stream path would flush an empty `200` and leave the exception filter nothing to write. That is how a second browser tab submitting into a conversation that is already generating rendered an empty assistant answer instead of the documented `409`.

An abandoned preparation (`generation-registry`) SHALL be reported on this path as `503 Service Unavailable`, raised as `ServiceUnavailableException`, before any SSE header is sent. Because preparation always ends before `onReadyToStream`, an abandoned preparation SHALL NOT be reported as a post-header SSE termination. A preparation stopped by process shutdown SHALL also fail on this path. Example response:

```http
POST /api/v1/conversations/completions
{ "path": "gpt-4o__Chat__0b1f…", "generationId": "4b2c…", "message": "Hello", "model": "gpt-4o", "custom_content": {} }

HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{ "statusCode": 503, "message": "Generation preparation timed out", "error": "Service Unavailable" }
```

Generated-client impact: none. The handler keeps its name and operation, the existing `@ApiResponse({ status: 503, description: 'DIAL Core unreachable' })` already documents this status, every preparation step is a DIAL Core request or app-config evaluation, and the frontend calls this streaming endpoint through `libs/chat-hooks/src/conversation/create-chat-stream-api.ts` rather than a generated method. That file already reports any non-`409` pre-stream status as a failed send. The OpenAPI document is not regenerated. No new user-visible string, i18n key, RTL or accessibility impact. Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

The duplicate-generation condition is scoped to the caller's **principal** and conversation path, as `generation-principal-ownership` defines — not to a cookie session. For a header-authenticated caller, all clients presenting tokens for the same (`providerId`, `sub`) are one principal, so a second such client submitting into the same conversation hits the same `409`.

#### Scenario: A duplicate active generation is reported as 409

- **GIVEN** a generation is already active for this principal and conversation path
- **WHEN** a second request to `POST /conversations/completions` reaches `register` for the same principal and path
- **THEN** the response is `409` with the conflict message, not a `200` with an empty body

#### Scenario: A mid-stream failure still ends the open SSE response

- **GIVEN** SSE headers have been sent and at least one chunk written
- **WHEN** the generator subsequently rejects
- **THEN** the controller ends the response, leaving the already-committed `200` status and the chunks written so far intact

#### Scenario: An abandoned preparation is reported as 503 before headers

- **GIVEN** a preparation step never settles
- **WHEN** `GENERATION_PREPARATION_TIMEOUT_MS` elapses
- **THEN** the response is `503` with the timeout message, `res.headersSent` was false when the filter wrote it, no keepalive was started, and no completion-response termination is counted as `completed`

#### Scenario: A second bearer client of the same principal is reported as 409

- **GIVEN** a generation is already active on a conversation path for header principal (`providerId` P, `sub` S)
- **WHEN** a different client presenting a valid token for the same (P, S) posts to `POST /conversations/completions` for that path
- **THEN** the response is `409` with the conflict message
