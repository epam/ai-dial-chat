## ADDED Requirements

### Requirement: Create application endpoint
The backend SHALL expose `POST /api/v1/applications` that creates a Quick App by proxying
DIAL Core (`saveCustomApplication`) using the caller's session access token. The request body
SHALL be validated via `CreateApplicationBodyDto`, including an optional `intro` string field
limited to 90 characters. When `intro` is provided, it SHALL be forwarded to DIAL Core as part
of the create request body. The per-user applications list cache SHALL be invalidated on
success, and DIAL Core error statuses SHALL be mapped to typed HTTP responses.

#### Scenario: Successful create with intro
- **WHEN** an authenticated user POSTs a valid application body including an `intro` of 90
  characters or fewer
- **THEN** the service includes `intro` in the DIAL Core create request and returns the
  created application identifier

#### Scenario: Successful create without intro
- **WHEN** an authenticated user POSTs a valid application body with `intro` omitted or empty
- **THEN** the create succeeds and no `intro` value is sent to DIAL Core

#### Scenario: Invalid create body
- **WHEN** the request body fails DTO validation (for example, `name` is missing)
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Intro exceeds the character limit
- **WHEN** an authenticated user POSTs an application body with `intro` longer than 90
  characters
- **THEN** the endpoint responds with a 400 validation error and does not call DIAL Core

#### Scenario: DIAL Core create error
- **WHEN** DIAL Core returns an error status during create
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. 502/503)

### Requirement: Endpoint is versioned, rate-limited, and documented
The create-application endpoint SHALL be URI-versioned at `/api/v1/applications`, SHALL
declare a `@Throttle` rate limit, and SHALL document every response status via
`@ApiResponse`, including the `intro` field's `maxLength: 90` constraint in the Swagger
schema for `CreateApplicationBodyDto`.

#### Scenario: OpenAPI contract regenerated
- **WHEN** the `intro` field is added to `CreateApplicationBodyDto`
- **THEN** `npm run openapi` regenerates the spec, `npm run openapi:check` passes, and the
  generated `@epam/chat-api-client` `CreateApplicationBodyDto` type includes `intro`

#### Scenario: Authentication required
- **WHEN** a request to the create endpoint has no valid session cookie
- **THEN** the endpoint responds with 401
