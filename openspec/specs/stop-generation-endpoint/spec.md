## Purpose

The endpoint and behaviour for cancelling an in-flight generation and persisting the partial answer.

## Requirements

### Requirement: Stop endpoint cancels an active generation

The backend SHALL expose `POST /api/v1/conversations/completions/stop` validated by `StopCompletionDto` (`apps/chat-api/src/conversations/dto/stop-completion.dto.ts`): `generationId` is `@IsUUID('4')`; `path` is `@IsString() @MinLength(1)` plus `@Matches(/^(?!.*..)[sS]+$/)`, which rejects any value containing `..`; the optional `content` is `@IsString() @MaxLength(1_000_000)`. An invalid body is rejected with 400 by the global `ValidationPipe`. The handler resolves the caller's principal key per `generation-principal-ownership` — which succeeds for both a cookie-authenticated and a header-authenticated caller, and SHALL NOT require a cookie session.

When this instance runs a non-background generation for the caller's principal, `path` and `generationId`, the handler SHALL stop it from the registry alone, as below, without reading the conversation. Otherwise, when the caller's conversation at `path` contains the background message identified by the posted `generationId` in `status: "pending"`, the handler SHALL stop it through DIAL Core as `background-responses-generation` "Stop cancels the Core job from any instance" defines and return 204, whether or not this instance holds a registry entry for it. When that message exists but is no longer `pending`, the handler SHALL return 204 without writing. Only when the background Stop returns `BackgroundStopResult.Handled` (the message was stopped and its job cancel was sent) SHALL the handler also abort a registry entry this instance holds for the generation, so the relay stops sending tokens. For `BackgroundStopResult.StoppedBeforeJob` (no `responseId` stored yet) and `BackgroundStopResult.AlreadyFinished` the handler returns 204 and SHALL leave a local relay running, so it can read the `responseId` and cancel the job itself. When the stopped-state write fails (`BackgroundWriteResult.Failed`), the background Stop throws `ServiceUnavailableException` ('The generation could not be stopped; retry shortly.'), the endpoint returns 503, and the job keeps running so Stop can be retried. When the conversation cannot be read, the handler SHALL fall through to the registry path below.

Otherwise the handler calls `generationService.abort(ownerKey, path, generationId)`, returns 204 on success, and throws `NotFoundException` (404) when no matching active generation exists for that principal.

#### Scenario: Stop an active generation

- **WHEN** the client posts a valid `generationId` + `path` for an active non-background generation
- **THEN** the upstream call is aborted and the endpoint returns 204

#### Scenario: Stop an unknown generation

- **WHEN** the posted `generationId` matches no active generation for the path and no background message in the conversation carries it
- **THEN** the endpoint returns 404

#### Scenario: A bearer-authenticated caller can stop its own generation

- **WHEN** a caller authenticated as `AuthSource.Header`, with no session cookie, posts a valid `generationId` + `path` for a generation its own principal started
- **THEN** the endpoint returns 204 — never `401` for the absence of a cookie session

#### Scenario: Stop targeting another principal's generation

- **WHEN** the posted `generationId` + `path` match an active generation owned by a different principal
- **THEN** the endpoint returns 404 and that generation keeps running

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
