## MODIFIED Requirements

### Requirement: Create toolset endpoint
The backend SHALL expose `POST /api/v1/toolsets` that creates a toolset by proxying DIAL
Core using the caller's session access token. The request body SHALL be validated via a DTO,
including an optional `intro` string field limited to 90 characters, the per-user toolset
list cache SHALL be invalidated on success, and DIAL Core error statuses SHALL be mapped to
typed HTTP responses. When `intro` is provided, it SHALL be forwarded to DIAL Core as part of
the create request body. The `endpoint` field SHALL be required to be present but MAY be an
empty string — an empty string is accepted so the toolset editor can create a draft toolset
right after its General step, before the endpoint is collected on the Settings step; when
non-empty, `endpoint` SHALL still be validated as a well-formed `http(s)://` or `sse://` URL.
The `authSettings` field SHALL be required to be present in the request body — an entirely
omitted `authSettings` SHALL fail DTO validation and SHALL NOT reach the DIAL Core call,
regardless of whether its nested `authenticationType` is itself valid.

#### Scenario: Successful create with a draft (empty) endpoint
- **WHEN** an authenticated user POSTs a toolset body with `endpoint` set to an empty string
- **THEN** the service proxies the create to DIAL Core and returns the created toolset
  identifier

#### Scenario: Missing endpoint field
- **WHEN** an authenticated user POSTs a toolset body with the `endpoint` field omitted
  entirely
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Missing authSettings field
- **WHEN** an authenticated user POSTs a toolset body with the `authSettings` field omitted
  entirely
- **THEN** the endpoint responds with a 400 naming `authSettings` and does not call DIAL Core

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
