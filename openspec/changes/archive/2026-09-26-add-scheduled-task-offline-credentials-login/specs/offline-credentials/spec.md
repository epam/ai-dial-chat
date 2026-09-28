## Purpose

Provide authenticated, uncached offline-credentials status and OAuth sign-in for proactive Scheduled Tasks login and reactive DIAL-native chat interrupts.

## ADDED Requirements

### Requirement: Offline-credentials status endpoint
The system SHALL expose `GET /api/v1/offline-credentials`, proxying DIAL
Core's `GET /v1/user/offline-credentials` via `DialClientService` using the
session user's bearer access token, and SHALL require a valid session and
at least one of `scheduledTasksEnabled` or `liveChatInteraction` before returning a response. Both flags SHALL be evaluated for the same caller and roles. No new flag is introduced.

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
- **WHEN** neither `scheduledTasksEnabled` nor `liveChatInteraction` is enabled for the caller
- **THEN** the endpoint returns `403`

#### Scenario: Upstream error
- **WHEN** DIAL Core returns a non-OK response
- **THEN** the endpoint applies the shared `mapDialHttpStatus` mapping, including `429` for an upstream rate-limit response and `502` for upstream server errors

#### Scenario: Upstream unreachable
- **WHEN** DIAL Core is unreachable or times out
- **THEN** the endpoint returns `503`

#### Scenario: Response is never cached
- **WHEN** any client or intermediary receives a response from this endpoint
- **THEN** the response includes `Cache-Control: private, no-store`

#### Scenario: Live chat enabled without Scheduled Tasks
- **WHEN** `liveChatInteraction` is enabled and `scheduledTasksEnabled` is disabled for an authenticated caller
- **THEN** the status endpoint permits the request and returns Core's mapped status

### Requirement: Offline-credentials sign-in endpoint
The system SHALL expose `POST /api/v1/offline-credentials/signin`, proxying
DIAL Core's `POST /v1/user/offline-credentials/signin` via
`DialClientService`, accepting `{ code, redirectUri }`, and SHALL validate
`redirectUri` against an app-owned allowlist before forwarding it upstream. The endpoint SHALL require a valid session, the standard CSRF checks, and at least one of `scheduledTasksEnabled` or `liveChatInteraction`.

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
- **WHEN** neither `scheduledTasksEnabled` nor `liveChatInteraction` is enabled for the caller
- **THEN** the endpoint returns `403`

#### Scenario: Upstream error
- **WHEN** DIAL Core returns a non-OK response (`response.error`)
- **THEN** the endpoint applies the shared `mapDialHttpStatus` mapping, including `429` for an upstream rate-limit response and `502` for upstream server errors, with the upstream message when the mapper permits it

#### Scenario: Upstream unreachable
- **WHEN** DIAL Core is unreachable or times out
- **THEN** the endpoint returns `503`

#### Scenario: Live chat OAuth exchange without Scheduled Tasks
- **WHEN** `liveChatInteraction` is enabled, `scheduledTasksEnabled` is disabled, and the authenticated caller submits a valid code, allowlisted redirect URI, and required CSRF header
- **THEN** the endpoint permits the exchange and returns `200 { "success": true }` when Core confirms success

### Requirement: Offline-credentials generated client

The application SHALL use the normal generated `OfflineCredentialsApi.getOfflineCredentials` and `OfflineCredentialsApi.signInOfflineCredentials` methods through `apps/chat/src/server-api/offline-credentials.ts`. The contract SHALL use `GetOfflineCredentialsResponseDto`, `OfflineCredentialsSigninBodyDto`, and `OfflineCredentialsAuthResultDto`; transport configuration and auth SHALL remain at the application edge.

#### Scenario: OAuth request uses the generated contract
- **WHEN** the callback submits `{ "code": "authorization-code", "redirectUri": "https://chat.example.com/auth/toolset-signin" }`
- **THEN** the app adapter calls the generated `signInOfflineCredentials` operation and receives `{ "success": true }` on HTTP 200

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
