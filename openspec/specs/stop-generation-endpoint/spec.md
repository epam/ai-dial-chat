## Purpose

The endpoint and behaviour for cancelling an in-flight generation and persisting the partial answer.

## Requirements

### Requirement: Stop endpoint cancels an active generation

The backend SHALL expose `POST /api/v1/conversations/completions/stop` validated by `StopCompletionDto` (`generationId`, `path`; both `@IsString() @IsNotEmpty()`). The handler resolves the caller's principal key per `generation-principal-ownership` — which succeeds for both a cookie-authenticated and a header-authenticated caller, and SHALL NOT require a cookie session — calls `generationService.abort(ownerKey, path, generationId)`, returns 204 on success, and throws `NotFoundException` (404) when no matching active generation exists for that principal.

#### Scenario: Stop an active generation

- **WHEN** the client posts a valid `generationId` + `path` for an active generation
- **THEN** the upstream call is aborted and the endpoint returns 204

#### Scenario: Stop an unknown generation

- **WHEN** the posted `generationId` matches no active generation for the path
- **THEN** the endpoint returns 404

#### Scenario: A bearer-authenticated caller can stop its own generation

- **WHEN** a caller authenticated as `AuthSource.Header`, with no session cookie, posts a valid `generationId` + `path` for a generation its own principal started
- **THEN** the endpoint returns 204 — never `401` for the absence of a cookie session

#### Scenario: Stop targeting another principal's generation

- **WHEN** the posted `generationId` + `path` match an active generation owned by a different principal
- **THEN** the endpoint returns 404 and that generation keeps running

### Requirement: Stopped generation persists a partial answer

When `abort` cancels the upstream stream, the streaming request SHALL catch the abort, flag the partial assistant message `wasStoppedByUser: true`, save it, and close the response.

#### Scenario: Partial answer saved with the stopped flag

- **WHEN** a generation is stopped after producing some tokens
- **THEN** the saved conversation contains the partial assistant message flagged `wasStoppedByUser: true`
