## ADDED Requirements

### Requirement: Offline-credentials status endpoint
The system SHALL expose `GET /api/v1/offline-credentials`, proxying DIAL
Core's `GET /v1/user/offline-credentials` via `DialClientService` using the
session user's bearer access token, and SHALL require a valid session and
the `scheduledTasksEnabled` feature flag before returning a response.

#### Scenario: Authenticated user with available, unconnected credentials
- **WHEN** a session-authenticated user with `scheduledTasksEnabled` calls
  `GET /api/v1/offline-credentials` and DIAL Core reports
  `{ available: true, connected: false, connect: {...} }`
- **THEN** the endpoint returns `200` with
  `{ available: true, connected: false, connect: { authorizationEndpoint, clientId, redirectUri, scopes } }`
  (camelCase, mapped from Core's snake_case fields)

#### Scenario: Credentials already connected
- **WHEN** DIAL Core reports `{ available: true, connected: true }`
- **THEN** the endpoint returns `200` with `{ available: true, connected: true }`
  and no `connect` object

#### Scenario: Missing optional upstream fields
- **WHEN** DIAL Core omits `available`, `connected`, or `connect` entirely
- **THEN** the endpoint applies safe defaults (`available: false`,
  `connected: false`, no `connect`) rather than throwing or returning `undefined` fields

#### Scenario: No session
- **WHEN** the caller has no valid session cookie
- **THEN** the endpoint returns `401` before invoking DIAL Core

#### Scenario: Feature disabled
- **WHEN** the caller's session does not have the `scheduledTasksEnabled`
  feature flag enabled
- **THEN** the endpoint returns `403`

#### Scenario: Rate limit exceeded
- **WHEN** a caller exceeds 60 requests per 60 seconds to this endpoint
- **THEN** the endpoint returns `429`

#### Scenario: Upstream error
- **WHEN** DIAL Core returns a non-OK response
- **THEN** the endpoint returns `502`

#### Scenario: Upstream unreachable
- **WHEN** DIAL Core is unreachable or times out
- **THEN** the endpoint returns `503`

#### Scenario: Response is never cached
- **WHEN** any client or intermediary receives a response from this endpoint
- **THEN** the response includes `Cache-Control: private, no-store`

### Requirement: Offline-credentials sign-in endpoint
The system SHALL expose `POST /api/v1/offline-credentials/signin`, proxying
DIAL Core's `POST /v1/user/offline-credentials/signin` via
`DialClientService`, accepting `{ code, redirectUri }`, and SHALL validate
`redirectUri` against an app-owned allowlist before forwarding it upstream.

#### Scenario: Successful sign-in
- **WHEN** a session-authenticated, feature-enabled user submits a valid
  `code` and an allowlisted `redirectUri`, and DIAL Core's
  `offlineCredentialsSignIn` resolves to the literal boolean `true`
- **THEN** the endpoint returns `200` with `{ success: true }`

#### Scenario: Upstream reports failure via literal false
- **WHEN** DIAL Core's `offlineCredentialsSignIn` resolves to the literal
  boolean `false`
- **THEN** the endpoint returns `502` and never returns `{ success: true }`

#### Scenario: Disallowed redirect URI
- **WHEN** the submitted `redirectUri` does not resolve to the configured
  `AUTH_CALLBACK_BASE_URL` origin and an app-owned callback path
- **THEN** the endpoint returns `400` and does not forward the request to
  DIAL Core

#### Scenario: Missing or empty code
- **WHEN** `code` is missing, empty, or not a string
- **THEN** the endpoint returns `400`

#### Scenario: No session
- **WHEN** the caller has no valid session cookie
- **THEN** the endpoint returns `401`

#### Scenario: Feature disabled
- **WHEN** the caller's session does not have the `scheduledTasksEnabled`
  feature flag enabled
- **THEN** the endpoint returns `403`

#### Scenario: Rate limit exceeded
- **WHEN** a caller exceeds 10 requests per 60 seconds to this endpoint
- **THEN** the endpoint returns `429`

#### Scenario: Upstream error
- **WHEN** DIAL Core returns a non-OK response (`response.error`)
- **THEN** the endpoint returns `502` with the upstream message when available

#### Scenario: Upstream unreachable
- **WHEN** DIAL Core is unreachable or times out
- **THEN** the endpoint returns `503`

### Requirement: Offline-credentials logging discipline
The system SHALL log offline-credentials operations at `debug`/`warn`/`error`
levels for observability, and SHALL NOT log authorization codes, tokens,
cookies, or full request/response bodies of the sign-in call.

#### Scenario: Sign-in attempt is logged without the code value
- **WHEN** a sign-in request is received
- **THEN** any debug log line for the request includes the redirect URI and
  the length of the code, and never the code's value

#### Scenario: Upstream failure is logged
- **WHEN** DIAL Core returns a non-OK response
- **THEN** the service logs a `warn` including the upstream status and any
  extracted error message, before throwing the mapped exception
