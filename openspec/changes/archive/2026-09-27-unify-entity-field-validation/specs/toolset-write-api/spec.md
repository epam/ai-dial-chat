## MODIFIED Requirements

### Requirement: Create toolset endpoint
The backend SHALL expose `POST /api/v1/toolsets` that creates a toolset by proxying DIAL
Core using the caller's session access token. The request body SHALL be validated via a DTO;
the per-user toolset list cache SHALL be invalidated on success, and DIAL Core error statuses
SHALL be mapped to typed HTTP responses. The DTO SHALL NOT define an `intro` field — a request
body that still includes an `intro` property SHALL be rejected with a 400 (the global
`ValidationPipe`'s `forbidNonWhitelisted` behavior). The `endpoint` field SHALL be required to
be present but MAY be an empty string — an empty string is accepted so the toolset editor can
create a draft toolset right after its General step, before the endpoint is collected on the
Settings step; when non-empty, `endpoint` SHALL still be validated as a well-formed
`http(s)://` URL. DIAL Core validates the URI scheme of the endpoint it stores and accepts
only `http`/`https`, answering anything else with a 400 `invalid URI scheme <x>`; the SSE
transport is an ordinary `http(s)://` endpoint selected through `transport`, so an `sse://`
endpoint SHALL be rejected by the DTO rather than forwarded to DIAL Core. The `authSettings`
field SHALL be required to be present in the request body — an entirely omitted
`authSettings` SHALL fail DTO validation and SHALL NOT reach the DIAL Core call, regardless
of whether its nested `authenticationType` is itself valid.

The `name` field SHALL match `DISPLAY_NAME_PATTERN`
(`apps/chat-api/src/common/validators/display-name.pattern.ts`): 1-256 characters with no
control or surrogate characters. The same pattern applies to every additional-locale `name`.
The optional `description` SHALL be `@MaxLength(2000)`. Both bounds come from
`apps/chat-api/src/common/validators/entity-field-limits.ts` and appear as `maxLength` in the
OpenAPI spec. There is no generated-client method change; `ToolsetBodyDto` only gains the
`maxLength` metadata.

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

#### Scenario: Request body still includes intro
- **WHEN** an authenticated user POSTs a toolset body that includes an `intro` property
- **THEN** the endpoint responds with a 400 validation error (unknown property) and does not
  call DIAL Core

#### Scenario: Invalid create body
- **WHEN** the request body fails DTO validation
- **THEN** the endpoint responds with a 400 and does not call DIAL Core

#### Scenario: Name or description over its limit
- **WHEN** an authenticated user POSTs a toolset body whose `name` is 257 characters or whose
  `description` is 2001 characters (a 256-character name is accepted)
- **THEN** the endpoint responds with a 400 naming that property and does not call DIAL Core

#### Scenario: Endpoint using the sse:// scheme
- **WHEN** an authenticated user POSTs a toolset body with `endpoint` set to
  `sse://mcp-test.example.com/events`, whether or not `transport` is `SSE`
- **THEN** the endpoint responds with a 400 naming `endpoint` and does not call DIAL Core

#### Scenario: SSE transport over an https endpoint
- **WHEN** an authenticated user POSTs a toolset body with `transport` set to `SSE` and
  `endpoint` set to an `https://` URL
- **THEN** the body passes DTO validation and is forwarded to DIAL Core

#### Scenario: DIAL Core create error
- **WHEN** DIAL Core returns an error status during create
- **THEN** the endpoint maps it to the corresponding typed HTTP error (e.g. 502/503)
