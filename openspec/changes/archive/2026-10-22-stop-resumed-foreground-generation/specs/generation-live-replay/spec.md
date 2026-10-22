# Spec Delta

## MODIFIED Requirements

### Requirement: Late subscribers can attach to an active generation by conversation path

`POST /api/v1/conversations/completions/attach` SHALL accept `{ path }` for the caller's authenticated principal — resolved per `generation-principal-ownership`, so the endpoint is reachable under both `AuthSource.Cookie` and `AuthSource.Header` and SHALL NOT require a cookie session — and, when an active generation exists for that `ownerKey`+`path` (the same key `ConversationGenerationService.abort` uses), SHALL open an SSE stream that:

1. Emits one `{ type: "snapshot", message: <ConversationMessageDto>, generationId?: <uuid> }` event — `generationId` as "A registry-served attach tells the client the generation id" defines — carrying the registry entry's current assembled message, synchronously captured before any subsequent chunk can be missed.
2. Emits one `{ type: "chunk", chunk: <delta> }` event — whose `chunk` is the parsed delta in the same shape as a live `/completions` chunk — for every chunk produced by the generation after the snapshot was captured.
3. Emits exactly one terminal event — `{ type: "done" }`, `{ type: "error", message?: string, errorType?: string }`, or `{ type: "stopped" }` — matching the generation's actual outcome, including terminal persistence failure, then ends the response.

For a conversation that contains a `pending` background message, this requirement does not apply: the stream is served as `background-responses-generation` "Any instance recovers a pending background message on attach" defines — the snapshot is the stored pending message and the chunks are replayed from DIAL Core from the first event — on every instance, including one that holds a registry entry for the path. An attach for which this instance runs a non-background generation on that path SHALL be served from the registry as above, without reading the conversation.

The endpoint SHALL support more than one concurrent subscriber for the same active generation, each receiving its own snapshot-then-live-chunks sequence. For a header-authenticated principal, those subscribers may be separate clients presenting tokens for the same (`providerId`, `sub`), as `generation-principal-ownership` defines.

#### Scenario: Attach immediately after generation start

- **WHEN** a client attaches shortly after a generation registers, before any chunk has been applied
- **THEN** the snapshot event carries the empty placeholder message, followed by every chunk as it is produced

#### Scenario: Attach mid-generation

- **WHEN** a client attaches after several chunks have already been applied
- **THEN** the snapshot event carries the content assembled so far (including any merged stages), and only chunks produced after the attach are delivered as separate `chunk` events — the snapshot is not followed by a re-delivery of chunks it already contains

#### Scenario: Two concurrent subscribers on the same generation

- **WHEN** two clients of the same principal both attach to the same active generation
- **THEN** each receives its own snapshot (reflecting the state at its own attach time) and its own subsequent live chunk events, independently

#### Scenario: Generation finishes while a subscriber is attached

- **WHEN** the generation reaches `finalize()` while an attach subscriber is connected
- **THEN** the subscriber receives the matching terminal event (`done`, `error`, or `stopped`) before the SSE response ends

#### Scenario: A bearer-authenticated caller attaches to its own generation

- **WHEN** a caller authenticated as `AuthSource.Header`, with no session cookie, attaches to a generation its own principal started
- **THEN** the SSE stream opens with a snapshot followed by live chunks and one terminal event — never `401` for the absence of a cookie session

#### Scenario: Attach to a background generation is served from Core replay

- **WHEN** a client attaches to a conversation containing a `pending` background message, on the instance that started it
- **THEN** the snapshot is the stored pending message and the chunks are replayed from DIAL Core from the first event, not taken from the registry entry

## ADDED Requirements

### Requirement: A registry-served attach tells the client the generation id

When `POST /api/v1/conversations/completions/attach` is served from the in-memory registry (this instance runs a non-background generation for the caller's principal and path), the `snapshot` event SHALL carry an additional optional `generationId` field: the generation id the registry holds for that generation, which is the client-supplied id of the request that started it. This is the id `POST /api/v1/conversations/completions/stop` accepts for the same principal and path, so a client that attaches after a refresh can stop the generation it joined. The field SHALL be present on every registry-served `snapshot` and SHALL NOT change the `message` it carries, the `chunk` events, or the terminal events.

Attach for a conversation with a pending background message is unchanged: its `snapshot` is the stored pending message, whose `backgroundGeneration.generationId` already identifies the generation, and it need not carry the top-level field.

The field is additive and optional on the wire. A client that does not know it ignores it; a client that receives a `snapshot` without it SHALL behave as before (no id is known). No new route is introduced and the endpoint's status codes are unchanged. The attach operation description in the OpenAPI document SHALL mention the field; the SSE stream is not a typed generated model, so no generated-client signature changes (`operationId` stays `attachToGeneration`). The id is disclosed only to the principal that could already stop the generation — attach is principal-scoped — so no new exposure is created. Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`; no i18n, RTL or accessibility impact; no new telemetry.

Example `snapshot` event for a registry-served attach:

```json
{
  "type": "snapshot",
  "message": { "role": "assistant", "content": "The Crusades, a series of" },
  "generationId": "2d0b6c8e-5f7a-4c1b-9e3d-1a2b3c4d5e6f"
}
```

#### Scenario: Snapshot carries the generation id

- **WHEN** a client attaches to an active non-background generation served from the registry
- **THEN** the first event is a `snapshot` whose `generationId` equals the id the generation was registered with

#### Scenario: The announced id is accepted by Stop

- **WHEN** the client posts that `generationId` with the same `path` to `POST /api/v1/conversations/completions/stop` while the generation is active
- **THEN** the endpoint stops the generation and returns 204, and the attached subscriber receives the terminal `stopped` event

#### Scenario: A background attach is unchanged

- **WHEN** attach is served for a conversation with a pending background message
- **THEN** the `snapshot` is the stored pending message as `background-responses-generation` defines, and the registry-served `generationId` rule does not apply

#### Scenario: Older clients ignore the field

- **WHEN** a client that does not read `generationId` consumes the `snapshot`
- **THEN** it renders the message and subsequent events exactly as before
