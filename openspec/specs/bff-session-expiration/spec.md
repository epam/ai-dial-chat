# bff-session-expiration Specification

## Purpose

Define scope-independent rolling lifetimes for encrypted BFF sessions, provider-token deadlines, server-side expiry checks, and compatibility rules for session renewal and migration.

## Requirements

### Requirement: Explicit rolling session lifetime

The backend SHALL own the session deadline in an encrypted v2 payload and SHALL set `session_exp = now + maxAge` at login and on successful token refresh using `AUTH_SESSION_MAX_AGE_SECONDS` (default 2592000 seconds, positive integer at most 2147483647). Requested scopes SHALL NOT determine the deadline. Configuration changes SHALL apply to new logins and successful renewals. Existing cookies SHALL retain their current deadline until renewal.

#### Scenario: Scope-independent lifetime

- **WHEN** users log in with and without `offline_access` under the same lifetime setting
- **THEN** both sessions receive the same maximum lifetime from their respective login times

#### Scenario: Invalid configuration

- **WHEN** the configured lifetime is zero, negative, fractional, non-numeric, empty, or above the maximum
- **THEN** startup fails validation

### Requirement: Effective token deadline

The backend SHALL use the earlier of the application deadline and a known refresh-token deadline; when a refresh token exists but expiry is unknown, it SHALL use the application deadline. Without a refresh token it SHALL use the earlier of application and access-token expiry and SHALL NOT attempt refresh.

#### Scenario: No refresh token near access expiry

- **WHEN** an access token has 30 seconds remaining and no refresh token was issued
- **THEN** the request is authorized without refresh and a request at access expiry is rejected

#### Scenario: Keycloak expiry metadata

- **WHEN** Keycloak supplies positive integer `refresh_expires_in`
- **THEN** its deadline bounds the session, calculated from the token exchange start
- **AND** zero, missing, or unusable metadata SHALL NOT fabricate a deadline

#### Scenario: Unsupported provider metadata

- **WHEN** a provider other than Keycloak supplies the same extension field
- **THEN** the backend treats its refresh expiry as unknown until an explicit provider contract is supported

### Requirement: Server-side enforcement

Required cookie authentication SHALL reject expired, malformed, or legacy sessions before upstream work, clear session cookies and chunks, and recheck expiration after asynchronous work. Optional authentication SHALL return no user for those sessions or an expired access token, without refresh or cookie mutation. Cookie Max-Age SHALL be the remaining effective lifetime; equality with the deadline SHALL count as expired.

#### Scenario: Replay expired cookie with valid access token

- **WHEN** a client sends an expired session cookie whose access token is still valid
- **THEN** protected endpoints return 401 and clear the cookie without refreshing tokens or resolving the bucket

#### Scenario: Deadline passes during asynchronous work

- **WHEN** token exchange or bucket lookup finishes after the session deadline
- **THEN** authentication fails and no usable session cookie is issued

### Requirement: Rotation renews only a currently valid session

Refresh SHALL validate the existing `session_exp` before and after exchange, update token deadlines according to the response, and only then renew `session_exp` and `iat`. An exchange that completes after the existing session deadline SHALL fail even if tokens were returned. Required authentication SHALL attempt refresh within 60 seconds of access-token or effective session expiry when a refresh token is present. Optional authentication and bucket-only cookie rewrites SHALL NOT renew the session. Failed or absorbed refresh races SHALL NOT renew the session or overwrite cookies, including coalesced requests and lazy bucket resolution. A replacement refresh token without usable expiry SHALL NOT inherit the old token's expiry. Without replacement or new expiry metadata the existing expiry SHALL be retained.

#### Scenario: Rotated token has unknown lifetime

- **WHEN** the provider returns a different refresh token without expiry metadata
- **THEN** `rt_exp` becomes unknown and `session_exp` is renewed from the current time using the configured lifetime

#### Scenario: Active session outlives its original deadline

- **WHEN** a still-valid session successfully refreshes before its deadline
- **THEN** the renewed cookie is usable beyond the original deadline
- **AND** replay of the original cookie at its original deadline still returns 401

#### Scenario: Session expires before the access token

- **WHEN** an authenticated request arrives less than 60 seconds before session expiry and has a refresh token
- **THEN** token refresh is attempted even if the access token is still fresh

#### Scenario: Concurrent requests lose a refresh race

- **WHEN** an exchange fails with invalid_grant while the old access token and session are still valid
- **THEN** all coalesced callers may use that valid access token without changing the session deadline or issuing a cookie, even if bucket resolution is required

### Requirement: Explicit compatibility boundary

Normal session authorization SHALL reject v1 cookies. Login transaction cookies SHALL retain the ten-minute expiry behavior, including pre-upgrade transactions. Logout SHALL still attempt best-effort cleanup of legacy or expired cookies.

#### Scenario: Legacy session and in-progress login

- **WHEN** the new backend receives a legacy session cookie
- **THEN** it requires a new login
- **AND** an unexpired legacy transaction cookie can still finish its OIDC callback and receive a v2 session

### Requirement: Existing integration contracts remain intact

The backend SHALL retain existing routes, response DTOs, CSRF behavior, header authentication, and frontend recovery. No generated client, feature flag, i18n key, React context/hook, cache, or UI/RTL/a11y change SHALL be introduced. Existing auth metrics SHALL remain available without new token-bearing attributes.

#### Scenario: Header authentication

- **WHEN** a caller authenticates using a valid bearer token
- **THEN** cookie lifetime configuration does not alter header authentication
