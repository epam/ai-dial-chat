## Purpose

The endpoint and behaviour for cancelling an in-flight generation and persisting the partial answer.

## Requirements

### Requirement: Stop endpoint cancels an active generation

The backend SHALL expose `POST /api/v1/conversations/completions/stop`, validated by `StopCompletionDto` (`apps/chat-api/src/conversations/dto/stop-completion.dto.ts`):

- `generationId` is `@IsUUID('4')`;
- `path` is `@IsString() @MinLength(1)` plus `@Matches(/^(?!.*..)[sS]+$/)`, which rejects any value containing `..`;
- the optional `content` is `@IsString() @MaxLength(1_000_000)`.

An invalid body is rejected with 400 by the global `ValidationPipe`. The handler resolves the caller's principal key per `generation-principal-ownership`. That succeeds for both a cookie-authenticated and a header-authenticated caller, and SHALL NOT require a cookie session.

The handler SHALL try, in this order:

1. **Local foreground generation.** When this instance runs a non-background generation for the caller's principal, `path` and `generationId`, the handler SHALL stop it from the registry alone, as in step 4, without reading the conversation.
2. **Background message.** Otherwise, when the caller's conversation at `path` contains the background message identified by the posted `generationId` in `status: "pending"`, the handler SHALL stop it through DIAL Core as `background-responses-generation` "Stop cancels the Core job from any instance" defines, and return 204, whether or not this instance holds a registry entry for it.
   - When that message exists but is no longer `pending`, the handler SHALL return 204 without writing.
   - Only for `BackgroundStopResult.Handled` (the message was stopped and its job cancel was sent) SHALL the handler also abort a registry entry this instance holds for the generation, so the relay stops sending tokens.
   - For `BackgroundStopResult.StoppedBeforeJob` (no `responseId` stored yet) and `BackgroundStopResult.AlreadyFinished` the handler returns 204 and SHALL leave a local relay running, so it can read the `responseId` and cancel the job itself.
   - When the stopped-state write fails (`BackgroundWriteResult.Failed`), the background Stop throws `ServiceUnavailableException` ('The generation could not be stopped; retry shortly.'), the endpoint returns 503, and the job keeps running so Stop can be retried.
3. **Foreground marker.** Otherwise, when the conversation contains a message whose live `foregroundGeneration` carries the posted `generationId`, the handler SHALL store the Stop on that marker as `foreground-generation-lock` "A Stop from any writer is stored on the marker" defines.
   - It returns 204 once the write is stored, or when the marker already carries `stopRequestedAt`.
   - In both cases, a generation on this instance with that `generationId` on the same bucket-qualified conversation resource is aborted before the response is sent.
   - A storage failure of that write returns 503 ('The generation could not be stopped; retry shortly.').
   - A caller whose read or write DIAL Core rejects receives the same 404 as for an unknown generation.
   - `content` is ignored on this branch.
4. **Registry.** Otherwise the handler calls `generationService.abort(ownerKey, path, generationId)`, returns 204 on success, and throws `NotFoundException` (404) when no matching active generation exists for that principal.

When the conversation cannot be read, the handler SHALL skip steps 2 and 3 and go straight to step 4.

Example of step 3, where another writer stops a generation that runs on another instance:

```http
POST /api/v1/conversations/completions/stop
{ "path": "gpt-4o__Chat__0b1f…", "generationId": "4b2c8f1e-7d3a-4c5b-9e2f-0a1b2c3d4e5f" }

HTTP/1.1 204 No Content
```

**Generated-client impact: none.** The operation `stopCompletion` and the project operation `stopProjectCompletion` keep their DTOs and responses, and `503` and `404` are already documented. The frontend calls Stop through `libs/chat-hooks/src/conversation/create-chat-stream-api.ts`.

#### Scenario: Stop an active generation

- **WHEN** the client posts a valid `generationId` + `path` for an active non-background generation
- **THEN** the upstream call is aborted and the endpoint returns 204

#### Scenario: Stop an unknown generation

- **WHEN** the posted `generationId` matches no active generation for the path, no background message in the conversation carries it, and no live foreground marker carries it
- **THEN** the endpoint returns 404

#### Scenario: Stop arrives after the generation ended or is already being stopped

- **WHEN** the posted `generationId` + `path` match a generation of the caller's own principal that has already finished, or that an earlier Stop has already begun cancelling, and no pending background message and no live foreground marker without `stopRequestedAt` carries the id
- **THEN** the endpoint returns 404 — the response is identical to that for an unknown generation, and clients such as `useConversationStream` treat it as benign when their own generation has ended

#### Scenario: A bearer-authenticated caller can stop its own generation

- **WHEN** a caller authenticated as `AuthSource.Header`, with no session cookie, posts a valid `generationId` + `path` for a generation its own principal started
- **THEN** the endpoint returns 204 — never `401` for the absence of a cookie session

#### Scenario: Stop targeting another principal's generation in a conversation the caller cannot write

- **WHEN** the posted `generationId` + `path` match an active generation owned by a different principal, in a conversation the caller cannot read or write
- **THEN** the endpoint returns 404 and that generation keeps running

#### Scenario: Stop a foreground generation that runs on another instance

- **WHEN** a caller who may write the conversation posts the `generationId` of its live foreground marker, and the generation runs on another instance
- **THEN** `stopRequestedAt` is stored on the marker, the endpoint returns 204, and the generation stops within `FOREGROUND_REREAD_INTERVAL_MS` with its partial answer stored as stopped

#### Scenario: A repeated foreground Stop is accepted

- **WHEN** Stop is posted again for a live marker that already carries `stopRequestedAt`
- **THEN** the endpoint returns 204 and makes no write

#### Scenario: Stop a background generation on any instance

- **WHEN** the posted `generationId` matches a `pending` background message in the caller's conversation and this instance has no registry entry for it
- **THEN** the partial answer is saved as stopped, DIAL Core cancel is then called for its `responseId`, and the endpoint returns 204

#### Scenario: Stop an already finished background generation

- **WHEN** the background message carrying the posted `generationId` has `status` `completed`, `stopped`, or `failed`
- **THEN** the endpoint returns 204 and makes no write and no Core call

#### Scenario: Stopped-state save fails

- **WHEN** Stop targets a `pending` background message and saving its stopped state fails
- **THEN** the endpoint returns 503, no Core cancel is sent, and the generation keeps running

#### Scenario: Background stop before the job reported a responseId

- **WHEN** Stop targets a `pending` background message that has no `responseId` yet and this instance runs its relay
- **THEN** the message is saved as stopped, the endpoint returns 204, and the local relay is not aborted

#### Scenario: Invalid stop body

- **WHEN** the posted `generationId` is not a UUID v4, or `path` is empty or contains `..`, or `content` exceeds 1,000,000 characters
- **THEN** the endpoint returns 400

### Requirement: Stopped generation persists a partial answer

When `abort` cancels the upstream stream, the streaming request SHALL catch the abort, flag the partial assistant message `wasStoppedByUser: true`, save it, and close the response. For a background generation, whose text the backend never assembles, the partial answer SHALL be the optional `content` the client posts with Stop (the text it has shown so far), saved with `wasStoppedByUser: true` and `backgroundGeneration.status: "stopped"` before the job is cancelled. `StopCompletionDto.content` is optional, capped at 1,000,000 characters (`@MaxLength`), and ignored for every other generation, whose answer the backend already holds.

#### Scenario: Partial answer saved with the stopped flag

- **WHEN** a generation is stopped after producing some tokens
- **THEN** the saved conversation contains the partial assistant message flagged `wasStoppedByUser: true`

#### Scenario: Background partial answer comes from the client

- **WHEN** a background generation is stopped after the client showed some tokens and posts them as `content`
- **THEN** the saved partial content equals that text, flagged `wasStoppedByUser: true` with `status: "stopped"`, the endpoint responds without waiting for DIAL Core, and the Core cancel is sent after that save

#### Scenario: Shown text is ignored for a non-background generation

- **WHEN** Stop for a non-background generation carries `content`
- **THEN** the backend saves its own assembled partial answer, as before
