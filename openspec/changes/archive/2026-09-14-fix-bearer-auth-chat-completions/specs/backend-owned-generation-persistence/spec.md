## MODIFIED Requirements

### Requirement: A failure before the stream opens is reported with its own status code

`ConversationStreamingService.streamCompletion` is an async generator, so everything it does before calling `onReadyToStream` — registering the generation, resolving the deployment, fetching the conversation — runs on the consuming loop's first `next()` rather than at the call site. `ConversationController.streamCompletion` SHALL therefore distinguish a rejection that arrives before SSE headers were sent from one that arrives after: while `res.headersSent` is false it MUST NOT end the response, so the rejection propagates to the exception filter, which owns the status code and body. Once the stream is open the status is already committed, so a later failure ends the response as before and only the SSE transport reports it.

Ending the response on the pre-stream path would flush an empty `200` and leave the exception filter nothing to write, which is how a second browser tab submitting into a conversation that is already generating rendered an empty assistant answer instead of the documented `409`.

The duplicate-generation condition is scoped to the caller's **principal** and conversation path, as `generation-principal-ownership` defines — not to a cookie session. For a header-authenticated caller, all clients presenting tokens for the same (`providerId`, `sub`) are one principal, so a second such client submitting into the same conversation hits the same `409`.

#### Scenario: A duplicate active generation is reported as 409

- **GIVEN** a generation is already active for this principal and conversation path
- **WHEN** a second request to `POST /conversations/completions` reaches `register` for the same principal and path
- **THEN** the response is `409` with the conflict message, not a `200` with an empty body

#### Scenario: A mid-stream failure still ends the open SSE response

- **GIVEN** SSE headers have been sent and at least one chunk written
- **WHEN** the generator subsequently rejects
- **THEN** the controller ends the response, leaving the already-committed `200` status and the chunks written so far intact

#### Scenario: A second bearer client of the same principal is reported as 409

- **GIVEN** a generation is already active on a conversation path for header principal (`providerId` P, `sub` S)
- **WHEN** a different client presenting a valid token for the same (P, S) posts to `POST /conversations/completions` for that path
- **THEN** the response is `409` with the conflict message

## ADDED Requirements

### Requirement: Backend-owned persistence is independent of the authentication mode

Every persistence guarantee in this capability — saving the start state before opening the upstream stream, assembling the assistant message chunk by chunk, and saving the final or partial state on completion, stop, or error regardless of whether the originating HTTP request is still connected — SHALL hold identically for a header-authenticated caller and a cookie-authenticated caller.

#### Scenario: A bearer caller's generation persists after the client disconnects

- **GIVEN** a header-authenticated caller started a generation and its HTTP connection then closed
- **WHEN** the upstream stream subsequently reaches `[DONE]`
- **THEN** the backend persists the complete assistant message, and reopening the conversation shows the full response — the same outcome the cookie-authenticated path produces

#### Scenario: A bearer caller's stopped generation persists the partial answer

- **GIVEN** a header-authenticated caller's generation has produced some tokens
- **WHEN** that principal stops it via `POST .../completions/stop`
- **THEN** the saved conversation contains the partial assistant message flagged `wasStoppedByUser: true`
