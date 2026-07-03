## ADDED Requirements

### Requirement: Stop endpoint cancels an active generation

The backend SHALL expose `POST /api/v1/conversations/completions/stop` validated by `StopCompletionDto` (`generationId`, `path`; both `@IsString() @IsNotEmpty()`). The handler resolves `sessionId` from the session, calls `generationService.abort(sessionId, path, generationId)`, returns 204 on success, and throws `NotFoundException` (404) when no matching active generation exists.

#### Scenario: Stop an active generation

- **WHEN** the client posts a valid `generationId` + `path` for an active generation
- **THEN** the upstream call is aborted and the endpoint returns 204

#### Scenario: Stop an unknown generation

- **WHEN** the posted `generationId` matches no active generation for the path
- **THEN** the endpoint returns 404

### Requirement: Stopped generation persists a partial answer

When `abort` cancels the upstream stream, the streaming request SHALL catch the abort, flag the partial assistant message `wasStoppedByUser: true`, save it, and close the response.

#### Scenario: Partial answer saved with the stopped flag

- **WHEN** a generation is stopped after producing some tokens
- **THEN** the saved conversation contains the partial assistant message flagged `wasStoppedByUser: true`
