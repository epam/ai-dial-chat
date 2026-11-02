## MODIFIED Requirements

### Requirement: No active generation for the path returns 404

`POST /api/v1/conversations/completions/attach` SHALL respond `404` when no active generation exists in the registry for the caller's `ownerKey`+`path` — including when a generation existed but already finalized before the attach request arrived, including when an active generation exists for that path under a different principal, and including when this instance retains a non-background entry for the path whose subscribers were already released by the finalization bound while its terminal write is still pending — **unless** the caller's conversation at that path contains a background message with `status: "pending"`, in which case the endpoint SHALL behave as `background-responses-generation` "Any instance recovers a pending background message on attach" and "A start interrupted before responseId was saved is marked failed after 2 minutes" define. The background recovery SHALL read the conversation from the caller's own bucket, so another principal's conversation is never read.

For the retained case, `ConversationController.attachToGeneration` (`apps/chat-api/src/conversations/conversation.controller.ts`) SHALL keep routing the request to the registry without reading the conversation, as it does for any local non-background entry, and SHALL respond `404` before any SSE header is sent: it SHALL start no keepalive timer, add no emitter listener, and add no `dial_chat_sse_active{kind="generation_attach"}` contribution. Repeated attaches SHALL receive the same `404`. The status code, the error message, the OpenAPI document and the generated client (`operationId` `attachToGeneration`) are unchanged; a client that treats `404` as "fall back to the `watch`-based terminal check" — every client of this endpoint — then observes the eventual save through `POST /api/v1/conversations/watch`. Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`; no i18n, RTL or accessibility impact; no new telemetry.

#### Scenario: Attach after the generation already finished

- **WHEN** the attach request arrives after the registry entry for that path has already been deleted (via `complete`/`error`) and the conversation contains no `pending` background message
- **THEN** the endpoint responds `404` and opens no SSE stream

#### Scenario: Attach for a path with no generation history

- **WHEN** the attach request targets a path for which no generation was ever registered for this principal
- **THEN** the endpoint responds `404`

#### Scenario: Attach to another principal's active generation

- **WHEN** the attach request targets a path on which a different principal has an active generation
- **THEN** the endpoint responds `404` and opens no SSE stream, disclosing nothing about that generation's existence

#### Scenario: Attach to a pending background message without a local entry

- **WHEN** the attach request arrives on an instance with no registry entry for the path and the caller's conversation contains a `pending` background message that has a `responseId`
- **THEN** the endpoint opens an SSE stream recovered through DIAL Core instead of responding `404`

#### Scenario: Attach to a retained entry after the finalization bound

- **GIVEN** this instance runs a non-background generation for the caller's principal and path whose finalization bound has elapsed while its terminal write is still pending
- **WHEN** the caller attaches to that path, once or several times
- **THEN** each request responds `404` with no SSE headers sent, the conversation is not read, no keepalive timer or emitter listener remains, the SSE-active gauge is unchanged, and a new completion for that path still receives `409`

#### Scenario: Existing subscribers are unaffected by a refused late attach

- **GIVEN** a subscriber attached before the finalization bound elapsed
- **WHEN** the bound elapses and a later attach for the same path is refused with `404`
- **THEN** the earlier subscriber received exactly one terminal event, its keepalive was cleared and its response was released, independently of the refused request
