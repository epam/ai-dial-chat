# Spec Delta

## MODIFIED Requirements

### Requirement: Late subscribers can attach to an active generation by conversation path

`POST /api/v1/conversations/completions/attach` SHALL accept `{ path }` for the caller's authenticated principal — resolved per `generation-principal-ownership`, so the endpoint is reachable under both `AuthSource.Cookie` and `AuthSource.Header` and SHALL NOT require a cookie session — and, when an active generation exists for that `ownerKey`+`path` (the same key `ConversationGenerationService.abort` uses), SHALL open an SSE stream that:

1. Emits one `{ type: "snapshot", message: <ConversationMessageDto> }` event carrying the registry entry's current assembled message, synchronously captured before any subsequent chunk can be missed.
2. Emits one `{ type: "chunk", ... }` event — in the same shape as a live `/completions` chunk — for every chunk produced by the generation after the snapshot was captured.
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

### Requirement: No active generation for the path returns 404

`POST /api/v1/conversations/completions/attach` SHALL respond `404` when no active generation exists in the registry for the caller's `ownerKey`+`path` — including when a generation existed but already finalized before the attach request arrived, and including when an active generation exists for that path under a different principal — **unless** the caller's conversation at that path contains a background message with `status: "pending"`, in which case the endpoint SHALL behave as `background-responses-generation` "Any instance recovers a pending background message on attach" and "A start interrupted before responseId was saved is marked failed after 2 minutes" define. The background recovery SHALL read the conversation from the caller's own bucket, so another principal's conversation is never read.

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

## ADDED Requirements

### Requirement: The background path does not retain assembled content in the registry

For a generation on the background path, the registry entry SHALL NOT retain the assembled assistant message or its text; the "Backend retains in-flight assistant message content per active generation" requirement applies only to the Chat Completions and stateless Responses paths. An attach to a background generation — on the originating instance or any other — SHALL be served from DIAL Core replay, with the snapshot taken from the stored conversation.

#### Scenario: Attach on the originating instance

- **WHEN** a client attaches to a running background generation on the instance that started it
- **THEN** the snapshot is the stored placeholder and the chunks are replayed from DIAL Core from the beginning, not taken from local memory
