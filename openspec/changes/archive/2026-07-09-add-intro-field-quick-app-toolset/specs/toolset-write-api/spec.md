## MODIFIED Requirements

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
