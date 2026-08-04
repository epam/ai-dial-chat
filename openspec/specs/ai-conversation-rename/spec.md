## Requirements

### Requirement: Generate-title endpoint

The system SHALL expose a synchronous endpoint `POST /api/v1/conversations/generate-title` that generates an LLM-based title for an existing conversation. The endpoint SHALL accept the conversation path as a query parameter, SHALL require no request body, and SHALL return a JSON object `{ "name": string }` after the LLM responds.

#### Scenario: Successful title generation

- **WHEN** an authenticated user calls `POST /api/v1/conversations/generate-title?path=<valid-conversation-path>` for a conversation that has at least one user/assistant exchange
- **THEN** the system generates a title using the operator-configured `UTILITY_MODEL`
- **AND** returns HTTP 200 with body `{ "name": "<sanitised generated title>" }`

#### Scenario: Path query parameter is missing

- **WHEN** the endpoint is called without a `path` query parameter
- **THEN** the system rejects the request with HTTP 400 and does not call the LLM

#### Scenario: Path query parameter fails validation

- **WHEN** the endpoint is called with a `path` value that does not match the allowed conversation-path format (e.g. path traversal sequences or disallowed characters)
- **THEN** the system rejects the request with HTTP 400 and does not call the LLM

#### Scenario: Conversation does not exist

- **WHEN** the endpoint is called with a syntactically valid `path` that refers to a conversation the user cannot access or that does not exist
- **THEN** the system responds with HTTP 404 and does not return a name

### Requirement: On-demand generation does not persist or lock naming

On-demand title generation SHALL compute and return a suggested name only. It SHALL NOT persist the generated name to the conversation and SHALL NOT set or read the `llmNamingDone` flag. The endpoint SHALL succeed regardless of whether `llmNamingDone` is already `true`.

#### Scenario: Generation on an already-auto-named conversation

- **WHEN** the endpoint is called for a conversation whose `llmNamingDone` is already `true`
- **THEN** the system still generates and returns a new suggested name
- **AND** the stored conversation name and `llmNamingDone` flag are left unchanged

#### Scenario: Persistence happens only on user confirmation

- **WHEN** the endpoint returns a suggested name
- **THEN** the conversation's stored name is unchanged until the user confirms the rename through the existing rename flow

### Requirement: Generation uses the full current conversation context

The generated title SHALL be based on the full current conversation content (not only the first user/assistant exchange), so that the suggested title reflects the conversation as it currently stands.

#### Scenario: Title reflects later topic

- **WHEN** a conversation has evolved through many messages beyond the initial exchange
- **AND** the user requests an AI-generated title
- **THEN** the prompt sent to the LLM includes the current conversation messages beyond only the first exchange

### Requirement: Reuse existing naming prompt, sanitisation, and timeout

On-demand generation SHALL reuse the existing conversation-naming system prompt, the existing name sanitisation (`prepareEntityName`), and the existing `UTILITY_NAMING_TIMEOUT_MS` timeout and DIAL Core client path used by `ConversationNamingService`.

#### Scenario: Sanitised output

- **WHEN** the LLM returns a raw candidate name (with surrounding quotes, trailing dots, or excess length)
- **THEN** the returned `name` is passed through the same sanitisation applied by the auto-naming flow before being returned

#### Scenario: LLM call times out

- **WHEN** the LLM does not respond within `UTILITY_NAMING_TIMEOUT_MS`
- **THEN** the system aborts the call and responds with an appropriate error status without returning a name

### Requirement: On-demand generation authenticates as the calling user

Unlike automatic naming (which authenticates with the operator-configured `DIAL_API_KEY`), on-demand title generation SHALL authenticate the completion request with the calling user's own bearer token, the same way a regular chat completion is authenticated. The endpoint SHALL NOT require `DIAL_API_KEY` to be configured; it SHALL only require `UTILITY_MODEL` to be configured and the calling user to have access to that deployment.

#### Scenario: Generation succeeds without DIAL_API_KEY configured

- **WHEN** `UTILITY_MODEL` is configured but `DIAL_API_KEY` is not
- **AND** the calling user has access to the `UTILITY_MODEL` deployment
- **THEN** the endpoint generates and returns a title successfully

#### Scenario: User lacks access to the utility model

- **WHEN** the calling user's own token does not have permission to invoke the `UTILITY_MODEL` deployment
- **THEN** DIAL Core rejects the request and the endpoint surfaces a typed upstream error rather than falling back to a service-level credential

### Requirement: Endpoint failure handling and rate limiting

The endpoint SHALL be rate limited per user via `@Throttle`, and SHALL translate upstream/LLM failures into typed HTTP exceptions rather than returning `null` or an empty name, using the shared `mapDialHttpStatus` / `handleDialFetchError` DIAL Core error mapping used elsewhere in `chat-api` so the same upstream status always maps to the same exception type across domains. Upstream DIAL Core rejections that indicate the calling user's token is not authorized for the configured `UTILITY_MODEL` deployment (upstream HTTP 401 or 403) SHALL be surfaced as HTTP 401 or 403 respectively, distinct from other upstream failures (timeouts, network errors, or upstream 5xx), which SHALL continue to surface as HTTP 503 or 502 respectively.

#### Scenario: Upstream LLM failure

- **WHEN** the DIAL Core / utility-model call fails with a network error or an upstream 5xx response
- **THEN** the system responds with HTTP 502 and logs the failure context, including the upstream status, without leaking secrets

#### Scenario: Upstream rejects the calling user's access to the utility model

- **WHEN** the DIAL Core / utility-model completion call responds with upstream HTTP 401 or 403 (the calling user's token is not authorized for the `UTILITY_MODEL` deployment)
- **THEN** the system responds with the matching HTTP 401 or 403 status
- **AND** the failure is logged at a level visible in standard production log aggregation (not only at debug level), including the upstream status and error body, without leaking the token or other secrets

#### Scenario: Rate limit exceeded

- **WHEN** a user exceeds the configured request rate for the endpoint
- **THEN** the system responds with HTTP 429

### Requirement: AI rename control in the rename modal

The rename conversation modal (`RenameConversationPopup`) SHALL present an "AI rename" icon button at the end of the title input row. The control SHALL always be available in the modal (no feature-flag gating in this change).

#### Scenario: Control is visible

- **WHEN** the rename modal is open
- **THEN** an AI rename icon button is rendered at the end (trailing edge) of the title input row

#### Scenario: Clicking triggers generation

- **WHEN** the user clicks the AI rename button
- **THEN** the modal calls `POST /api/v1/conversations/generate-title` for the current conversation

### Requirement: AI rename in-flight and result behavior

While generation is in flight the modal SHALL show a spinner on the AI rename control and prevent duplicate concurrent requests. On success the modal SHALL populate the title input with the returned name, leaving it editable so the user can adjust it before confirming. Confirming SHALL save through the existing rename endpoint.

#### Scenario: Spinner while in-flight

- **WHEN** an AI rename request is in progress
- **THEN** the AI rename control shows a spinner and cannot be clicked again until the request settles

#### Scenario: Populate input on success

- **WHEN** the generate-title request returns a name
- **THEN** the modal replaces the title input value with the returned name
- **AND** the input remains editable and the user can confirm or further edit before saving

#### Scenario: Confirm saves via existing rename flow

- **WHEN** the user confirms after an AI-generated name is populated
- **THEN** the conversation is renamed through the existing rename endpoint (not the generate-title endpoint)

#### Scenario: Generation error is surfaced

- **WHEN** the generate-title request fails
- **THEN** the modal stops the spinner, leaves the current input value unchanged, and shows a user-facing error message
