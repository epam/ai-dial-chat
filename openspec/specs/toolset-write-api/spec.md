# toolset-write-api Specification

## Purpose
TBD - created by archiving change add-toolset-editor-flow. Update Purpose after archive.
## Requirements
### Requirement: Create toolset endpoint
The backend SHALL expose `POST /api/v1/toolsets` that creates a toolset by proxying DIAL
Core using the caller's session access token. The request body SHALL be validated via a DTO,
including an optional `intro` string field limited to 90 characters, the per-user toolset
list cache SHALL be invalidated on success, and DIAL Core error statuses SHALL be mapped to
typed HTTP responses. When `intro` is provided, it SHALL be forwarded to DIAL Core as part of
the create request body.

#### Scenario: Successful create
- **WHEN** an authenticated user POSTs a valid toolset body
- **THEN** the service proxies the create to DIAL Core, invalidates the user's toolset list
  cache, and returns the created toolset identifier

#### Scenario: Successful create with intro
- **WHEN** an authenticated user POSTs a valid toolset body including an `intro` of 90
  characters or fewer
- **THEN** the service includes `intro` in the DIAL Core create request and the create
  succeeds

#### Scenario: Successful create without intro
- **WHEN** an authenticated user POSTs a valid toolset body with `intro` omitted or empty
- **THEN** the create succeeds and no `intro` value is sent to DIAL Core

#### Scenario: Invalid create body
- **WHEN** the request body fails DTO validation
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Intro exceeds the character limit
- **WHEN** an authenticated user POSTs a toolset body with `intro` longer than 90 characters
- **THEN** the endpoint responds with a 400 validation error and does not call DIAL Core

#### Scenario: DIAL Core create error
- **WHEN** DIAL Core returns an error status during create
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. 502/503)

### Requirement: Update and delete toolset endpoints
The backend SHALL expose `PATCH /api/v1/toolsets/:toolsetName` and
`DELETE /api/v1/toolsets/:toolsetName` that proxy DIAL Core, validate the toolset name
parameter against an allowlist, and invalidate the affected caches on success.

#### Scenario: Successful update
- **WHEN** an authenticated user PATCHes an existing toolset with a valid body
- **THEN** the service proxies the update to DIAL Core and invalidates the relevant caches

#### Scenario: Successful delete
- **WHEN** an authenticated user DELETEs an existing toolset
- **THEN** the service proxies the delete to DIAL Core and invalidates the relevant caches

#### Scenario: Invalid toolset name
- **WHEN** the toolset name path parameter contains disallowed characters
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

### Requirement: Login and logout endpoints
The backend SHALL expose `POST /api/v1/toolsets/:toolsetName/login` and
`POST /api/v1/toolsets/:toolsetName/logout` that proxy DIAL Core credential submission and
revocation. The login endpoint SHALL accept the credentials level and either an API key or
an OAuth `code` + `redirectUri`, validated via a DTO.

#### Scenario: API key login
- **WHEN** an authenticated user submits an API key login for a toolset
- **THEN** the service proxies the credential submission to DIAL Core and returns the result

#### Scenario: OAuth code login
- **WHEN** an authenticated user submits an OAuth `code` and `redirectUri` for a toolset
- **THEN** the service proxies the code exchange to DIAL Core and returns the result

#### Scenario: Logout
- **WHEN** an authenticated user requests logout for a toolset
- **THEN** the service proxies the credential revocation to DIAL Core

### Requirement: Secrets are never returned or logged
The write API SHALL NOT return credential secrets (such as API key or client secret) in
responses and SHALL NOT log credential payloads. Existing secret redaction SHALL be applied
to any toolset returned to the client.

#### Scenario: Secret redaction on response
- **WHEN** a toolset response would include a client secret
- **THEN** the secret is stripped before the response is returned to the client

#### Scenario: No credential logging
- **WHEN** a login request is processed
- **THEN** the API does not write the API key, client secret, or code to logs

### Requirement: Endpoints are versioned, rate-limited, and documented
All new write endpoints SHALL be URI-versioned at `/api/v1/toolsets`, SHALL declare
`@Throttle` rate limits, and SHALL document every response status via `@ApiResponse`, with
handler names suitable for the generated client (e.g. `createToolset`, `updateToolset`,
`deleteToolset`, `loginToolset`, `logoutToolset`).

#### Scenario: OpenAPI contract regenerated
- **WHEN** the new endpoints are added
- **THEN** `npm run openapi` regenerates the spec, `npm run openapi:check` passes, and the
  generated `@epam/chat-api-client` exposes the new operations

#### Scenario: Authentication required
- **WHEN** a request to a write endpoint has no valid session cookie
- **THEN** the endpoint responds with 401

